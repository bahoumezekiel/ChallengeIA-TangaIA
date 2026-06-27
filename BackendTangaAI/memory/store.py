"""
store.py — Checkpointer SQLite pour LangGraph.

Le checkpointer est le mécanisme de persistance de LangGraph :
- Après chaque nœud, l'AgentState complet est sérialisé et sauvegardé en SQLite.
- Si le serveur redémarre, le graphe peut reprendre depuis le dernier checkpoint.
- C'est aussi ce qui permet l'interrupt/resume : l'état est figé au moment
  de l'interrupt() et restauré au moment du resume.

Chaque PME a son propre "thread" dans la base (identifié par thread_id),
ce qui isole complètement les sessions entre elles.
"""

import re
import sqlite3
from pathlib import Path
from langgraph.checkpoint.sqlite import SqliteSaver

DB_PATH = Path(__file__).parent.parent / "data" / "memory.db"


def get_checkpointer() -> SqliteSaver:
    """
    Retourne un SqliteSaver opérationnel lié à data/memory.db.

    check_same_thread=False : requis pour partager la connexion entre les threads
    du ThreadPoolExecutor utilisé par FastAPI pour exécuter crew.kickoff().
    Sans ça, SQLite lèverait une erreur de threading.
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    return SqliteSaver(conn)


def session_id_from_nom(nom_entreprise: str) -> str:
    """
    Génère un thread_id stable, lisible et URL-safe depuis le nom de l'entreprise.
    Exemples :
        "Saveurs du Sahel"  → "saveurs_du_sahel"
        "Atelier Karité !"  → "atelier_karite"
    """
    slug = re.sub(r"[^a-z0-9]", "_", nom_entreprise.lower().strip())
    return re.sub(r"_+", "_", slug).strip("_")
