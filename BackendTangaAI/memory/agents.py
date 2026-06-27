"""
agents.py — Couche de persistance SQLite pour les agents PME.

Séparé de memory.db (checkpoints LangGraph) pour permettre des opérations
CRUD indépendantes du cycle d'exécution de l'orchestrateur.
"""

import json
import sqlite3
import time
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "agents.db"
LIMIT_AGENTS_ACTIFS = 8


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init() -> None:
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                agent_id   TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id    TEXT,
                spec_json  TEXT NOT NULL,
                source     TEXT NOT NULL DEFAULT 'auto',
                actif      INTEGER NOT NULL DEFAULT 1,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_agents_session ON agents(session_id)"
        )
        conn.commit()


_init()

_META_FIELDS = {"agent_id", "session_id", "user_id", "source", "actif", "created_at", "updated_at"}


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    spec = json.loads(d.pop("spec_json"))
    return {
        "agent_id":   d["agent_id"],
        "session_id": d["session_id"],
        "user_id":    d["user_id"],
        "source":     d["source"],
        "actif":      bool(d["actif"]),
        "created_at": d["created_at"],
        "updated_at": d["updated_at"],
        **spec,
    }


# ---------------------------------------------------------------------------
# Lecture
# ---------------------------------------------------------------------------

def get_agents(session_id: str) -> list[dict]:
    """Retourne tous les agents d'une session (actifs + inactifs), triés par priorité."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT * FROM agents WHERE session_id = ?
               ORDER BY json_extract(spec_json, '$.priorite') ASC, created_at ASC""",
            (session_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_agent(agent_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM agents WHERE agent_id = ?", (agent_id,)
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_manual_agents(session_id: str) -> list[dict]:
    """Agents manuels/édités qui survivent à une ré-analyse (source='manuel')."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT * FROM agents WHERE session_id = ? AND source = 'manuel'
               ORDER BY json_extract(spec_json, '$.priorite') ASC""",
            (session_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def count_active(session_id: str) -> int:
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM agents WHERE session_id = ? AND actif = 1",
            (session_id,),
        ).fetchone()
    return row[0] if row else 0


# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------

def save_agents(session_id: str, user_id: str | None, specs: list[dict]) -> list[str]:
    """
    Sauvegarde la liste d'agents générés automatiquement par l'orchestrateur,
    en remplaçant les anciens agents 'auto' pour cette session.
    Retourne la liste des agent_id créés (même ordre que specs).
    """
    now = time.time()
    ids: list[str] = []
    with _conn() as conn:
        conn.execute(
            "DELETE FROM agents WHERE session_id = ? AND source = 'auto'",
            (session_id,),
        )
        for spec in specs:
            agent_id = str(uuid.uuid4())
            spec_clean = {k: v for k, v in spec.items() if k not in _META_FIELDS}
            conn.execute(
                """INSERT INTO agents
                   (agent_id, session_id, user_id, spec_json, source, actif, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'auto', 1, ?, ?)""",
                (agent_id, session_id, user_id, json.dumps(spec_clean), now, now),
            )
            ids.append(agent_id)
        conn.commit()
    return ids


def create_agent(session_id: str, user_id: str | None, spec: dict) -> dict:
    """Crée un agent manuel. Vérifie la limite globale avant insertion."""
    if count_active(session_id) >= LIMIT_AGENTS_ACTIFS:
        raise ValueError(
            f"Limite de {LIMIT_AGENTS_ACTIFS} agents actifs atteinte pour cette session. "
            "Désactivez un agent existant avant d'en créer un nouveau."
        )
    agent_id = str(uuid.uuid4())
    now = time.time()
    spec_clean = {k: v for k, v in spec.items() if k not in _META_FIELDS}
    spec_clean.setdefault("outils_requis", [])
    spec_clean.setdefault("outils_en_attente", [])
    spec_clean.setdefault("priorite", 3)
    with _conn() as conn:
        conn.execute(
            """INSERT INTO agents
               (agent_id, session_id, user_id, spec_json, source, actif, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'manuel', 1, ?, ?)""",
            (agent_id, session_id, user_id, json.dumps(spec_clean), now, now),
        )
        conn.commit()
    return get_agent(agent_id)


def update_agent(agent_id: str, partial: dict) -> dict | None:
    """
    Met à jour les champs d'un agent.
    Toute modification humaine → source passe à 'manuel'.
    """
    existing = get_agent(agent_id)
    if not existing:
        return None
    spec = {k: v for k, v in existing.items() if k not in _META_FIELDS}
    updates = {k: v for k, v in partial.items() if k not in _META_FIELDS and v is not None}
    spec.update(updates)
    with _conn() as conn:
        conn.execute(
            "UPDATE agents SET spec_json = ?, source = 'manuel', updated_at = ? WHERE agent_id = ?",
            (json.dumps(spec), time.time(), agent_id),
        )
        conn.commit()
    return get_agent(agent_id)


def toggle_agent(agent_id: str, session_id: str | None = None) -> dict | None:
    """
    Bascule actif ↔ inactif.
    Si on réactive, vérifie la limite (session_id requis dans ce cas).
    """
    existing = get_agent(agent_id)
    if not existing:
        return None
    if not existing["actif"]:
        sid = session_id or existing["session_id"]
        if count_active(sid) >= LIMIT_AGENTS_ACTIFS:
            raise ValueError(
                f"Limite de {LIMIT_AGENTS_ACTIFS} agents actifs atteinte. "
                "Désactivez un autre agent avant de réactiver celui-ci."
            )
    new_actif = 0 if existing["actif"] else 1
    with _conn() as conn:
        conn.execute(
            "UPDATE agents SET actif = ?, updated_at = ? WHERE agent_id = ?",
            (new_actif, time.time(), agent_id),
        )
        conn.commit()
    return get_agent(agent_id)


def delete_agent(agent_id: str) -> bool:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM agents WHERE agent_id = ?", (agent_id,))
        conn.commit()
    return cur.rowcount > 0
