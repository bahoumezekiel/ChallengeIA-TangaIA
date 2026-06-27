"""
credentials.py — Stockage des credentials MCP par session PME.

Principe :
- Chaque PME a un session_id (slug de son nom d'entreprise).
- Chaque outil qui nécessite une connexion externe a un schéma de champs attendus.
- Quand le nœud verification_credentials détecte des credentials manquants,
  il pause le graphe et retourne ce schéma à l'utilisateur via l'API.
- L'utilisateur remplit les champs et appelle POST /session/{id}/credentials.
- Les credentials sont stockés ici dans une table SQLite (credentials.db).
- Au resume, le nœud re-vérifie → tout est présent → la crew se lance.

Sécurité : les credentials sont stockés en clair pour le MVP.
           En production, chiffrer avec Fernet (cryptography) ou utiliser
           un service de secrets managés (AWS Secrets Manager, HashiCorp Vault).
"""

import json
import sqlite3
from pathlib import Path

CREDS_DB = Path(__file__).parent.parent / "data" / "credentials.db"

# ---------------------------------------------------------------------------
# Schéma des credentials requis par outil.
# Structure : { nom_outil: { "label": str, "fields": { nom_champ: description } } }
# Ce dictionnaire est retourné tel quel dans la notification à l'utilisateur
# pour qu'il sache exactement quoi renseigner dans le formulaire frontend.
# ---------------------------------------------------------------------------
TOOL_CREDENTIALS_SCHEMA: dict[str, dict] = {
    "analyse_sentiment_facebook": {
        "label": "Analyse des avis Facebook",
        "fields": {
            "page_id":      "ID numérique de votre page Facebook",
            "access_token": "Token d'accès de la PAGE (le même que pour la publication)",
        },
    },
    "publication_reseaux_sociaux": {
        "label": "Réseaux sociaux (Facebook / Instagram)",
        "fields": {
            "page_id":      "ID numérique de votre page Facebook (Paramètres de la page → Infos → 'ID de la page')",
            "access_token": "Token d'accès de la PAGE (Meta Business Suite → Paramètres → Accès à l'API)",
            "page_name":    "Nom de votre page (ex: Saveurs du Sahel) — pour le contexte des posts",
        },
    },
    "recherche_crm": {
        "label": "CRM (HubSpot, Pipedrive, Zoho...)",
        "fields": {
            "api_key":  "Clé API de votre CRM",
            "base_url": "URL de votre CRM (ex : https://api.hubspot.com)",
        },
    },
    "envoi_email": {
        "label": "Email (SMTP)",
        "fields": {
            "smtp_host":      "Serveur SMTP (ex : smtp.gmail.com)",
            "smtp_port":      "Port SMTP (587 = TLS recommandé, 465 = SSL)",
            "smtp_user":      "Votre adresse email d'envoi (aussi utilisée pour recevoir les résumés)",
            "smtp_password":  "Mot de passe d'application Gmail (16 caractères) ou mot de passe SMTP",
            "smtp_from_name": "Nom affiché comme expéditeur (ex : Saveurs du Sahel) — optionnel",
        },
    },
    "planification_calendrier": {
        "label": "Calendrier (Google Calendar, Outlook...)",
        "fields": {
            "api_key":     "Clé API calendrier",
            "calendar_id": "ID du calendrier (ex : primary pour Google)",
        },
    },
    "generation_devis": {
        "label": "Outil de devis (Pennylane, Sellsy, Dolibarr...)",
        "fields": {
            "api_key":  "Clé API de votre outil de facturation",
            "base_url": "URL de l'API (si auto-hébergé)",
        },
    },
    "generation_facture": {
        "label": "Outil de facturation",
        "fields": {
            "api_key":  "Clé API de votre outil de facturation",
            "base_url": "URL de l'API (si auto-hébergé)",
        },
    },
    "suivi_paiement": {
        "label": "Suivi des paiements",
        "fields": {
            "api_key": "Clé API de votre outil de facturation",
        },
    },
    "recherche_web": {
        "label": "Moteur de recherche web (optionnel)",
        "fields": {
            "api_key": "Clé API Serper.dev ou SerpAPI (laisser vide = résultats simulés)",
        },
    },
    "analyse_donnees_ventes": {
        "label": "Contacts clients (Google Sheets / CSV)",
        "fields": {
            "source_url": (
                "URL de votre Google Sheet ou fichier CSV avec vos clients. "
                "Doit contenir une colonne 'email' ou 'mail'. "
                "Google Sheets : partagez en lecture publique et collez l'URL normale."
            ),
            "api_key": "Clé API si votre source nécessite une authentification (optionnel)",
        },
    },
}

# Outils qui fonctionnent sans credentials (utilisent uniquement le LLM)
OUTILS_SANS_CREDENTIALS = {"redaction_contenu"}


# ---------------------------------------------------------------------------
# Accès à la base SQLite
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    """Ouvre la connexion et crée la table si elle n'existe pas encore."""
    CREDS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(CREDS_DB))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tool_credentials (
            session_id  TEXT NOT NULL,
            tool_name   TEXT NOT NULL,
            credentials TEXT NOT NULL,              -- JSON sérialisé
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (session_id, tool_name)     -- un jeu de credentials par PME par outil
        )
    """)
    conn.commit()
    return conn


def save_credentials(session_id: str, tool_name: str, credentials: dict) -> None:
    """INSERT OR REPLACE : un second appel écrase les credentials précédents."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO tool_credentials (session_id, tool_name, credentials) VALUES (?, ?, ?)",
            (session_id, tool_name, json.dumps(credentials)),
        )


def get_credentials(session_id: str, tool_name: str) -> dict | None:
    """Retourne les credentials d'un outil pour une session, ou None si absents."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT credentials FROM tool_credentials WHERE session_id=? AND tool_name=?",
        (session_id, tool_name),
    ).fetchone()
    conn.close()
    return json.loads(row[0]) if row else None


def get_all_credentials(session_id: str) -> dict[str, dict]:
    """
    Retourne tous les credentials disponibles pour une session.
    Utilisé par instanciation_et_dispatch_node pour injecter les clés dans les outils.
    Format : { "publication_reseaux_sociaux": {"page_url": "...", "access_token": "..."}, ... }
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT tool_name, credentials FROM tool_credentials WHERE session_id=?",
        (session_id,),
    ).fetchall()
    conn.close()
    return {r[0]: json.loads(r[1]) for r in rows}


def get_missing_credentials(session_id: str, outils_requis: list[str]) -> dict[str, dict]:
    """
    Filtre la liste des outils requis et retourne uniquement ceux pour lesquels
    les credentials ne sont pas encore en base.

    Ignorés :
    - les outils sans credentials (OUTILS_SANS_CREDENTIALS)
    - les outils hors du schéma connu (pas de credentials définis pour eux)
    """
    manquants = {}
    for outil in outils_requis:
        if outil in OUTILS_SANS_CREDENTIALS:
            continue                            # pas de credentials nécessaires
        if outil not in TOOL_CREDENTIALS_SCHEMA:
            continue                            # outil inconnu du schéma, on ignore
        if not get_credentials(session_id, outil):
            manquants[outil] = TOOL_CREDENTIALS_SCHEMA[outil]
    return manquants
