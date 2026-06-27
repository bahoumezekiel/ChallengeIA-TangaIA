"""
publications_programmees.py — Planification et publication automatique sur Facebook.

Permet de programmer des posts qui partiront TOUT SEULS à l'heure prévue, sans
intervention. Le contenu peut être fourni par l'utilisateur (mode 'texte') ou
généré par l'IA à partir d'un brief (mode 'ia').

Architecture :
- Une table SQLite (data/publications.db) stocke les publications programmées.
- Un scheduler APScheduler tourne en fond et, toutes les 20 secondes, publie celles
  dont l'heure est arrivée (API Graph Meta).
- Les credentials Facebook sont réutilisés depuis la session (outil publication) ou
  fournis directement (pratique pour une démo via Swagger).

DÉMO : programmer à +1 min / +2 min et laisser le scheduler publier devant le jury.
PRODUCTION : il suffit de mettre un intervalle long (ex. 14 jours) et d'héberger le
serveur pour qu'il tourne en continu — le mécanisme est exactement le même.

À placer dans : publications_programmees.py (racine du backend)
Dépendance : apscheduler (ajouter `apscheduler>=3.10.0` à requirements.txt)
"""

import json
import os
import time
import logging
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional

import requests
from langchain_openai import ChatOpenAI

from memory.credentials import get_credentials

logger = logging.getLogger("publications")

DB_PATH = Path(__file__).parent / "data" / "publications.db"
GRAPH_API = "https://graph.facebook.com/v19.0"

# LLM léger pour générer le contenu des posts (mode 'ia')
_CONTENU_LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

_scheduler = None  # instance APScheduler (démarrée une seule fois)


# ---------------------------------------------------------------------------
# Base de données
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS publications_programmees (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id     TEXT,
            mode           TEXT,                 -- 'texte' | 'ia'
            brief          TEXT,                 -- consigne si mode='ia'
            contenu        TEXT,                 -- texte final à publier
            publier_le_ts  REAL,                 -- timestamp epoch de publication
            statut         TEXT DEFAULT 'en_attente',  -- en_attente | publie | echec | annule
            post_id        TEXT,                 -- id du post Facebook une fois publié
            erreur         TEXT,
            page_id        TEXT,                 -- override optionnel (sinon credentials session)
            access_token   TEXT,                 -- override optionnel
            avec_image     INTEGER DEFAULT 0,    -- 1 = joindre une image générée par l'IA
            image_prompt   TEXT,                 -- consigne pour générer l'image
            image_url      TEXT,                 -- URL de l'image (rempli à la publication)
            created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # Migration des bases déjà existantes (ajout des colonnes image si absentes)
    for col, ddl in (("avec_image", "INTEGER DEFAULT 0"), ("image_prompt", "TEXT"), ("image_url", "TEXT")):
        try:
            conn.execute(f"ALTER TABLE publications_programmees ADD COLUMN {col} {ddl}")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    return conn


def _ligne_vers_dict(row: sqlite3.Row) -> dict:
    """Convertit une ligne en dict propre (sans exposer le token)."""
    d = dict(row)
    d.pop("access_token", None)  # on n'expose jamais le token dans les réponses API
    if d.get("publier_le_ts"):
        d["publier_le"] = datetime.fromtimestamp(d["publier_le_ts"]).strftime("%Y-%m-%d %H:%M:%S")
    return d


# ---------------------------------------------------------------------------
# Génération de contenu (mode 'ia')
# ---------------------------------------------------------------------------

def _generer_contenu(brief: str, session_id: Optional[str] = None) -> str:
    """Génère un post Facebook à partir d'un brief, adapté au contexte PME africaine."""
    prompt = (
        "Tu es un rédacteur de contenu pour une PME africaine. À partir du brief, "
        "rédige UN post Facebook prêt à publier, en français, chaleureux et engageant, "
        "avec un appel à l'action clair et 2 à 4 hashtags pertinents. "
        "Donne uniquement le texte du post, sans guillemets ni commentaire."
    )
    try:
        reponse = _CONTENU_LLM.invoke([
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Brief : {brief}"},
        ])
        return reponse.content.strip()
    except Exception:
        logger.exception("Échec de génération du contenu")
        # Repli : on publie le brief tel quel plutôt que de planter
        return brief


# ---------------------------------------------------------------------------
# Création / consultation / annulation
# ---------------------------------------------------------------------------

def programmer_publication(
    session_id: Optional[str] = None,
    mode: str = "texte",
    contenu: Optional[str] = None,
    brief: Optional[str] = None,
    publier_dans_minutes: Optional[float] = None,
    publier_le: Optional[str] = None,
    page_id: Optional[str] = None,
    access_token: Optional[str] = None,
    avec_image: bool = False,
    image_prompt: Optional[str] = None,
) -> dict:
    """
    Programme une publication.

    - mode='texte' → `contenu` est requis (texte exact à publier).
    - mode='ia'    → `brief` est requis ; le contenu est généré maintenant et stocké.
    - Date : `publier_dans_minutes` (ex. 1) OU `publier_le` ("YYYY-MM-DD HH:MM").
             Si rien n'est fourni → +1 minute par défaut.
    - page_id / access_token : facultatifs (sinon on prend ceux de la session).
    """
    mode = (mode or "texte").lower()

    if mode == "ia":
        # Tolérance : le texte du brief peut arriver dans 'brief' OU dans 'contenu'
        brief_effectif = (brief or contenu or "").strip()
        if not brief_effectif:
            return {"erreur": "Le mode 'ia' nécessite un 'brief' (ou un 'contenu') décrivant le post à générer."}
        contenu_final = _generer_contenu(brief_effectif, session_id)
        brief = brief_effectif
    else:
        # Tolérance : si 'contenu' est vide mais 'brief' fourni, on l'utilise comme texte
        contenu_effectif = (contenu or brief or "").strip()
        if not contenu_effectif:
            return {"erreur": "Le mode 'texte' nécessite un 'contenu' (le texte exact à publier)."}
        contenu_final = contenu_effectif

    # Résolution de la date de publication → timestamp epoch
    if publier_dans_minutes is not None:
        ts = time.time() + float(publier_dans_minutes) * 60
    elif publier_le:
        try:
            ts = datetime.fromisoformat(publier_le.replace(" ", "T")).timestamp()
        except ValueError:
            return {"erreur": "Format de date invalide. Utilisez 'YYYY-MM-DD HH:MM'."}
    else:
        ts = time.time() + 60  # défaut : +1 minute

    with _get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO publications_programmees
               (session_id, mode, brief, contenu, publier_le_ts, page_id, access_token, avec_image, image_prompt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, mode, brief, contenu_final, ts, page_id, access_token,
             1 if avec_image else 0, image_prompt or (brief if mode == 'ia' else contenu_final)),
        )
        pub_id = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM publications_programmees WHERE id=?", (pub_id,)
        ).fetchone()

    logger.info(f"Publication #{pub_id} programmée pour {datetime.fromtimestamp(ts)}")
    return _ligne_vers_dict(row)


def lister_publications(session_id: Optional[str] = None) -> list[dict]:
    """Liste les publications programmées, les plus récentes d'abord."""
    conn = _get_conn()
    if session_id:
        rows = conn.execute(
            "SELECT * FROM publications_programmees WHERE session_id=? ORDER BY id DESC",
            (session_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM publications_programmees ORDER BY id DESC"
        ).fetchall()
    conn.close()
    return [_ligne_vers_dict(r) for r in rows]


def get_publication(pub_id: int) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM publications_programmees WHERE id=?", (pub_id,)
    ).fetchone()
    conn.close()
    return _ligne_vers_dict(row) if row else None


def annuler_publication(pub_id: int) -> bool:
    """Annule une publication encore en attente. Retourne True si annulée."""
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE publications_programmees SET statut='annule' "
            "WHERE id=? AND statut='en_attente'",
            (pub_id,),
        )
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Publication Facebook
# ---------------------------------------------------------------------------

def _resoudre_credentials(row: sqlite3.Row) -> tuple[Optional[str], Optional[str]]:
    """
    Détermine page_id + access_token à utiliser :
    1) override stocké sur la ligne, sinon
    2) credentials de la session (outil publication, puis analyse sentiment).
    """
    page_id = row["page_id"]
    token = row["access_token"]
    if page_id and token:
        return page_id, token

    session_id = row["session_id"]
    if session_id:
        for outil in ("publication_reseaux_sociaux", "analyse_sentiment_facebook"):
            creds = get_credentials(session_id, outil)
            if creds and creds.get("page_id") and creds.get("access_token"):
                return creds["page_id"], creds["access_token"]
    return page_id, token


def _mots_cles_image(contenu: str, override: Optional[str] = None) -> str:
    """
    Construit la requête de recherche d'image.
    - Si le PME a fourni des mots-clés (override) → on les utilise tels quels.
    - Sinon → on lit le post et on en extrait une courte requête visuelle en anglais
      (meilleurs résultats sur Pexels). Repli : nettoyage simple du contenu.
    """
    if override and override.strip():
        return override.strip()
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        prompt = (
            "À partir de ce post de réseau social, donne UNIQUEMENT 2 à 4 mots-clés en ANGLAIS "
            "décrivant une photo d'illustration concrète et adaptée (objet ou scène, pas de texte). "
            "Réponds seulement par les mots-clés, sans phrase ni ponctuation.\n\nPost : "
            + (contenu or "")[:500]
        )
        requete = llm.invoke(prompt).content.strip().strip('"').strip()
        return requete[:80] or "african small business"
    except Exception:
        import re
        mots = re.sub(r"[#@]\w+|[^\w\s]", " ", contenu or "").split()
        return " ".join(mots[:5]) or "african small business"


def _rechercher_image_pexels(query: str) -> Optional[str]:
    """Recherche une photo réelle correspondant à la requête sur Pexels. Retourne une URL ou None."""
    api_key = os.getenv("PEXELS_API_KEY", "")
    if not api_key:
        logger.warning("PEXELS_API_KEY absente — aucune image jointe au post.")
        return None
    try:
        r = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": api_key},
            params={"query": query, "per_page": 1, "orientation": "landscape"},
            timeout=15,
        )
        photos = r.json().get("photos", [])
        if not photos:
            logger.info(f"Pexels : aucun résultat pour '{query}'.")
            return None
        src = photos[0].get("src", {})
        url = src.get("large") or src.get("original") or src.get("medium")
        logger.info(f"Pexels : image trouvée pour '{query}'.")
        return url
    except requests.RequestException as exc:
        logger.warning(f"Pexels indisponible : {exc}")
        return None


def _publier_facebook(page_id: str, access_token: str, contenu: str, image_url: Optional[str] = None) -> tuple[bool, str]:
    """Publie sur la page. Avec image → /photos ; sinon → /feed. Retourne (succès, post_id|erreur)."""
    try:
        if image_url:
            url = f"{GRAPH_API}/{page_id}/photos"
            response = requests.post(
                url,
                data={"url": image_url, "caption": contenu, "access_token": access_token, "published": "true"},
                timeout=30,
            )
        else:
            url = f"{GRAPH_API}/{page_id}/feed"
            response = requests.post(
                url, data={"message": contenu, "access_token": access_token}, timeout=15
            )
        data = response.json()
        if "post_id" in data or "id" in data:
            return True, data.get("post_id") or data["id"]
        error = data.get("error", {})
        return False, f"Code {error.get('code', '?')} : {error.get('message', str(data))}"
    except requests.RequestException as exc:
        return False, f"Erreur réseau : {exc}"


# ---------------------------------------------------------------------------
# Worker du scheduler
# ---------------------------------------------------------------------------

def _verifier_et_publier() -> None:
    """Appelé périodiquement : publie les programmations dont l'heure est arrivée."""
    maintenant = time.time()
    conn = _get_conn()
    a_publier = conn.execute(
        "SELECT * FROM publications_programmees "
        "WHERE statut='en_attente' AND publier_le_ts <= ?",
        (maintenant,),
    ).fetchall()
    conn.close()

    for row in a_publier:
        page_id, token = _resoudre_credentials(row)
        if not page_id or not token:
            _marquer(row["id"], "echec", erreur="Credentials Facebook absents (page_id/token).")
            continue

        image_url = None
        try:
            if row["avec_image"]:
                requete = _mots_cles_image(row["contenu"] or "", row["image_prompt"])
                image_url = _rechercher_image_pexels(requete)
        except (IndexError, KeyError):
            image_url = None
        succes, info = _publier_facebook(page_id, token, row["contenu"], image_url=image_url)
        if succes:
            _marquer(row["id"], "publie", post_id=info)
            logger.info(f"Publication #{row['id']} publiée (post {info}).")
            _notifier_publication(row, succes=True)
        else:
            _marquer(row["id"], "echec", erreur=info)
            logger.warning(f"Publication #{row['id']} en échec : {info}")
            _notifier_publication(row, succes=False, erreur=info)


def _notifier_publication(row, succes: bool, erreur: str = "") -> None:
    """Crée une notification PME pour le résultat d'une publication programmée."""
    try:
        from memory import notifications as notif
        extrait = (row["contenu"] or "")[:60]
        if succes:
            notif.add_notification(
                titre="Publication publiée",
                message=f"Votre post a été publié sur Facebook : « {extrait}… »",
                type="success",
                session_id=row["session_id"],
            )
        else:
            notif.add_notification(
                titre="Échec de publication",
                message=f"Votre post programmé n'a pas pu être publié : {erreur}",
                type="error",
                session_id=row["session_id"],
            )
    except Exception:
        pass


def _marquer(pub_id: int, statut: str, post_id: str = None, erreur: str = None) -> None:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE publications_programmees SET statut=?, post_id=?, erreur=? WHERE id=?",
            (statut, post_id, erreur, pub_id),
        )


# ---------------------------------------------------------------------------
# Démarrage du scheduler (appelé une fois au lancement de l'API)
# ---------------------------------------------------------------------------

def demarrer_scheduler(intervalle_secondes: int = 20) -> None:
    """Démarre le scheduler en fond (idempotent : ne démarre qu'une fois)."""
    global _scheduler
    if _scheduler is not None:
        return
    from apscheduler.schedulers.background import BackgroundScheduler

    _get_conn().close()  # crée la table au démarrage
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _verifier_et_publier,
        "interval",
        seconds=intervalle_secondes,
        id="worker_publications",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(f"Scheduler de publications démarré (vérification toutes les {intervalle_secondes}s).")


def arreter_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
