"""
notifications.py — Notifications destinées à la PME.

Persistées dans data/notifications.db. Créées par le système à des moments clés
(analyse terminée, publication publiée, alerte réputation) et lisibles par le
frontend web et l'app mobile via les endpoints /notifications.

Types : 'info' | 'success' | 'warning' | 'error'.
"""

import sqlite3
import uuid
from pathlib import Path
from typing import Optional

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "notifications.db"

_TYPES_VALIDES = {"info", "success", "warning", "error"}


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init() -> None:
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id          TEXT PRIMARY KEY,
                session_id  TEXT,
                user_id     TEXT,
                type        TEXT DEFAULT 'info',
                titre       TEXT NOT NULL,
                message     TEXT DEFAULT '',
                lien        TEXT,
                lue         INTEGER DEFAULT 0,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notif_session ON notifications(session_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)")


_init()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "session_id": row["session_id"],
        "user_id": row["user_id"],
        "type": row["type"],
        "titre": row["titre"],
        "message": row["message"],
        "lien": row["lien"],
        "lue": bool(row["lue"]),
        "created_at": row["created_at"],
    }


def add_notification(
    titre: str,
    message: str = "",
    type: str = "info",
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    lien: Optional[str] = None,
) -> dict:
    """Crée une notification. Ne lève jamais : un échec ne doit pas casser le flux principal."""
    if type not in _TYPES_VALIDES:
        type = "info"
    notif_id = str(uuid.uuid4())
    try:
        with _conn() as conn:
            conn.execute(
                "INSERT INTO notifications (id, session_id, user_id, type, titre, message, lien) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (notif_id, session_id, user_id, type, titre, message, lien),
            )
        return {
            "id": notif_id, "session_id": session_id, "user_id": user_id,
            "type": type, "titre": titre, "message": message, "lien": lien, "lue": False,
        }
    except Exception:
        return {}


def list_notifications(
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Liste les notifications (plus récentes d'abord), filtrées par session et/ou user."""
    clauses, params = [], []
    if session_id:
        clauses.append("session_id = ?")
        params.append(session_id)
    if user_id:
        clauses.append("user_id = ?")
        params.append(user_id)
    where = f"WHERE {' OR '.join(clauses)}" if clauses else ""
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM notifications {where} ORDER BY created_at DESC LIMIT ?",
            (*params, limit),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def unread_count(session_id: Optional[str] = None, user_id: Optional[str] = None) -> int:
    clauses, params = ["lue = 0"], []
    sub = []
    if session_id:
        sub.append("session_id = ?")
        params.append(session_id)
    if user_id:
        sub.append("user_id = ?")
        params.append(user_id)
    where = "WHERE lue = 0" + (f" AND ({' OR '.join(sub)})" if sub else "")
    with _conn() as conn:
        row = conn.execute(f"SELECT COUNT(*) AS n FROM notifications {where}", tuple(params)).fetchone()
    return int(row["n"]) if row else 0


def mark_read(notif_id: str) -> bool:
    with _conn() as conn:
        cur = conn.execute("UPDATE notifications SET lue = 1 WHERE id = ?", (notif_id,))
    return cur.rowcount > 0


def mark_all_read(session_id: Optional[str] = None, user_id: Optional[str] = None) -> int:
    clauses, params = [], []
    if session_id:
        clauses.append("session_id = ?")
        params.append(session_id)
    if user_id:
        clauses.append("user_id = ?")
        params.append(user_id)
    where = f"WHERE {' OR '.join(clauses)}" if clauses else ""
    with _conn() as conn:
        cur = conn.execute(f"UPDATE notifications SET lue = 1 {where}", tuple(params))
    return cur.rowcount


def delete_notification(notif_id: str) -> bool:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM notifications WHERE id = ?", (notif_id,))
    return cur.rowcount > 0
