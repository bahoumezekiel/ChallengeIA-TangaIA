"""
history.py — Historique des analyses terminées (table run_history).

Chaque exécution complète (synthèse + résultats) est enregistrée ici par le nœud
notification. L'endpoint GET /historique lit cette table pour alimenter le frontend
(et l'onglet Historique de l'app mobile).

À placer dans : memory/history.py
"""

import json
import sqlite3
from pathlib import Path
from typing import Optional

HISTORY_DB = Path(__file__).parent.parent / "data" / "history.db"


def _get_conn() -> sqlite3.Connection:
    HISTORY_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(HISTORY_DB))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS run_history (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id     TEXT,
            nom_entreprise TEXT,
            secteur        TEXT,
            nb_agents      INTEGER,
            process_type   TEXT,
            synthese       TEXT,
            resultats      TEXT,            -- JSON sérialisé
            duree_secondes REAL,
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    return conn


def save_run(
    session_id: str,
    nom_entreprise: str,
    secteur: str,
    nb_agents: int,
    process_type: str,
    synthese: str,
    resultats: list[dict],
    duree_secondes: float,
) -> None:
    """Enregistre une analyse terminée dans l'historique."""
    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO run_history
               (session_id, nom_entreprise, secteur, nb_agents, process_type,
                synthese, resultats, duree_secondes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                nom_entreprise,
                secteur,
                nb_agents,
                process_type,
                synthese,
                json.dumps(resultats, ensure_ascii=False),
                duree_secondes,
            ),
        )


def get_history(session_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    """Retourne les analyses passées, les plus récentes d'abord."""
    conn = _get_conn()
    if session_id:
        rows = conn.execute(
            "SELECT * FROM run_history WHERE session_id=? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM run_history ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    colonnes = [d[0] for d in conn.execute("SELECT * FROM run_history LIMIT 0").description]
    conn.close()

    runs = []
    for row in rows:
        d = dict(zip(colonnes, row))
        try:
            d["resultats"] = json.loads(d["resultats"]) if d["resultats"] else []
        except (json.JSONDecodeError, TypeError):
            d["resultats"] = []
        runs.append(d)
    return runs
