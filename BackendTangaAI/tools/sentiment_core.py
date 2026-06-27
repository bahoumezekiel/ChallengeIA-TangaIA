"""
sentiment_core.py — Moteur d'analyse de sentiment des commentaires Facebook.

Logique PURE (sans dépendance à CrewAI), réutilisable :
- par l'outil CrewAI `analyse_sentiment_facebook` (dans tools/registry.py)
- par l'endpoint API `GET /sentiment/{session_id}` (pour le dashboard)

Principe :
1. Récupère les posts récents de la page (API Graph Meta).
2. Récupère les commentaires de chaque post.
3. Classe chaque commentaire en positif / neutre / negatif via un LLM
   (robuste au français familier et aux langues locales).
4. Agrège la répartition et déclenche une alerte si trop de négatifs.

À placer dans : tools/sentiment_core.py
"""

import logging
import requests
from typing import Literal

from pydantic import BaseModel
from langchain_openai import ChatOpenAI

logger = logging.getLogger("sentiment")

GRAPH_API = "https://graph.facebook.com/v19.0"

# LLM léger pour la classification (déterministe). Récupère OPENAI_API_KEY depuis l'env.
_CLASSIF_LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0)


# ---------------------------------------------------------------------------
# Schémas internes pour la classification structurée
# ---------------------------------------------------------------------------

class _Classification(BaseModel):
    index: int
    sentiment: Literal["positif", "neutre", "negatif"]


class _LotClassification(BaseModel):
    items: list[_Classification]


# ---------------------------------------------------------------------------
# Appels à l'API Graph
# ---------------------------------------------------------------------------

def _recuperer_posts(page_id: str, token: str, nb_posts: int) -> list[dict]:
    """Récupère les posts récents de la page."""
    url = f"{GRAPH_API}/{page_id}/posts"
    params = {
        "fields": "id,message,created_time",
        "limit": max(1, min(nb_posts, 25)),
        "access_token": token,
    }
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    return response.json().get("data", [])


def _recuperer_commentaires(post_id: str, token: str, limit: int = 100) -> list[dict]:
    """Récupère les commentaires d'un post donné."""
    url = f"{GRAPH_API}/{post_id}/comments"
    params = {
        "fields": "message,from,created_time",
        "limit": limit,
        "access_token": token,
    }
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    return response.json().get("data", [])


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def _classer_commentaires(textes: list[str]) -> list[str]:
    """
    Classe une liste de commentaires en un seul appel LLM (batch).
    Retourne une liste de sentiments alignée par index ('positif'|'neutre'|'negatif').
    En cas d'échec, tout est marqué 'neutre' (sécurité).
    """
    if not textes:
        return []

    llm = _CLASSIF_LLM.with_structured_output(_LotClassification)
    numerotes = "\n".join(f"{i}: {t}" for i, t in enumerate(textes))

    prompt = (
        "Tu analyses des commentaires laissés sous les publications Facebook d'une PME africaine. "
        "Classe CHAQUE commentaire en 'positif', 'neutre' ou 'negatif'. "
        "Tiens compte du français familier, des fautes, et des expressions locales (Burkina Faso, "
        "Afrique de l'Ouest). Une simple question neutre = 'neutre'. Une plainte ou critique = 'negatif'. "
        "Un compliment ou encouragement = 'positif'. Réponds pour chaque index fourni."
    )

    try:
        lot = llm.invoke([
            {"role": "system", "content": prompt},
            {"role": "user", "content": numerotes},
        ])
        resultats = ["neutre"] * len(textes)
        for item in lot.items:
            if 0 <= item.index < len(resultats):
                resultats[item.index] = item.sentiment
        return resultats
    except Exception:
        logger.exception("Échec de la classification de sentiment")
        return ["neutre"] * len(textes)


# ---------------------------------------------------------------------------
# Fonction principale (réutilisable)
# ---------------------------------------------------------------------------

def analyser_sentiments_facebook(
    page_id: str,
    access_token: str,
    nb_posts: int = 5,
    seuil_alerte: float = 0.2,
) -> dict:
    """
    Analyse le sentiment des commentaires des `nb_posts` posts les plus récents.

    Retourne un dictionnaire structuré :
    {
        "total": int,                      # nombre de commentaires analysés
        "positif": int, "neutre": int, "negatif": int,
        "pourcentage_negatif": float,      # 0.0 à 1.0
        "alerte": bool,                    # True si pourcentage_negatif >= seuil_alerte
        "nb_posts_analyses": int,
        "commentaires_negatifs": [ {texte, auteur, post_extrait}, ... ],  # max 20
    }
    En cas de problème : { "erreur": "..." }.
    """
    if not page_id or not access_token:
        return {"erreur": "page_id et access_token (token de PAGE) requis."}

    try:
        posts = _recuperer_posts(page_id, access_token, nb_posts)
    except requests.RequestException as exc:
        return {"erreur": f"Impossible de récupérer les posts : {exc}"}

    # Collecte de tous les commentaires des posts récents
    commentaires: list[dict] = []
    for post in posts:
        post_id = post.get("id")
        extrait = (post.get("message") or "").strip()[:80]
        if not post_id:
            continue
        try:
            for c in _recuperer_commentaires(post_id, access_token):
                texte = (c.get("message") or "").strip()
                if texte:
                    commentaires.append({
                        "texte": texte,
                        "auteur": (c.get("from") or {}).get("name", "Anonyme"),
                        "post_id": post_id,
                        "post_extrait": extrait,
                    })
        except requests.RequestException:
            continue  # un post illisible ne bloque pas l'analyse

    total = len(commentaires)
    if total == 0:
        return {
            "total": 0, "positif": 0, "neutre": 0, "negatif": 0,
            "pourcentage_negatif": 0.0, "alerte": False,
            "nb_posts_analyses": len(posts),
            "commentaires_negatifs": [],
            "message": "Aucun commentaire trouvé sur les posts récents.",
        }

    sentiments = _classer_commentaires([c["texte"] for c in commentaires])
    for c, s in zip(commentaires, sentiments):
        c["sentiment"] = s

    positif = sum(1 for s in sentiments if s == "positif")
    neutre = sum(1 for s in sentiments if s == "neutre")
    negatif = sum(1 for s in sentiments if s == "negatif")
    pct_negatif = round(negatif / total, 3)

    commentaires_negatifs = [
        {
            "texte": c["texte"][:200],
            "auteur": c["auteur"],
            "post_extrait": c["post_extrait"],
        }
        for c in commentaires if c.get("sentiment") == "negatif"
    ][:20]

    return {
        "total": total,
        "positif": positif,
        "neutre": neutre,
        "negatif": negatif,
        "pourcentage_negatif": pct_negatif,
        "alerte": pct_negatif >= seuil_alerte,
        "nb_posts_analyses": len(posts),
        "commentaires_negatifs": commentaires_negatifs,
    }


def formater_rapport(res: dict) -> str:
    """Transforme le dictionnaire d'analyse en rapport texte lisible (pour l'agent CrewAI)."""
    if "erreur" in res:
        return f"[ERREUR analyse sentiment] {res['erreur']}"
    if res.get("total", 0) == 0:
        return res.get("message", "Aucun commentaire à analyser.")

    lignes = [
        f"Analyse de sentiment — {res['total']} commentaires sur "
        f"{res.get('nb_posts_analyses', '?')} posts récents :",
        f"  • Positifs : {res['positif']}",
        f"  • Neutres  : {res['neutre']}",
        f"  • Négatifs : {res['negatif']} ({res['pourcentage_negatif'] * 100:.0f}%)",
    ]
    if res.get("alerte"):
        lignes.append(
            "  ⚠ ALERTE : la proportion de commentaires négatifs est élevée. "
            "Il est recommandé de répondre rapidement aux clients mécontents."
        )
    if res.get("commentaires_negatifs"):
        lignes.append("  Commentaires négatifs à examiner :")
        for c in res["commentaires_negatifs"][:5]:
            lignes.append(f'    - "{c["texte"]}" — {c["auteur"]} (post : {c["post_extrait"]}...)')
    return "\n".join(lignes)
