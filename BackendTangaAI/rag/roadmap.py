"""
Génération d'une feuille de route personnalisée pour la création d'entreprise.

À partir du profil de l'utilisateur (type d'entreprise, activité, ville...),
on récupère les passages pertinents dans le corpus, puis on demande au LLM de
produire un parcours STRUCTURÉ EN JSON : étapes ordonnées, documents requis,
lieu, coût et délai estimés — le tout fondé sur les documents officiels.

Réutilisé par l'endpoint FastAPI (routes.py).
"""
import json
from typing import Optional

from openai import OpenAI

from rag.config import CHAT_MODEL, OPENAI_API_KEY, TYPE_LABELS
from rag.search import rechercher

_client = None


def _get_client():
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY introuvable. Vérifiez votre fichier .env.")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


SYSTEME = (
    "Tu es l'assistant officiel de TangaAI pour la création d'entreprise au "
    "Burkina Faso (cadre OHADA, formalités CEFORE/MEBF). "
    "À partir du profil de l'entrepreneur et des extraits de documents officiels "
    "fournis, tu produis une FEUILLE DE ROUTE claire, étape par étape.\n\n"
    "RÈGLES ABSOLUES :\n"
    "1. Utilise UNIQUEMENT les informations présentes dans les extraits. "
    "N'invente jamais un document, un lieu, un coût ou un délai. Si un coût ou "
    "un délai n'est pas indiqué dans les extraits, mets la valeur null.\n"
    "2. Ordonne les étapes de façon logique (préparation des pièces -> dépôt -> "
    "immatriculation -> documents délivrés).\n"
    "3. Reste factuel, en français simple.\n"
    "4. Réponds STRICTEMENT au format JSON demandé, sans texte avant ni après, "
    "sans balises Markdown.\n"
)

# Schéma JSON attendu, décrit au modèle
SCHEMA = """{
  "titre": "string — titre court de la feuille de route",
  "resume": "string — 1 à 2 phrases de synthèse",
  "cout_total_estime": "string ou null — si calculable d'après les extraits (ex: '≈ 2 000 F CFA')",
  "delai_total_estime": "string ou null — si indiqué dans les extraits",
  "etapes": [
    {
      "numero": 1,
      "titre": "string — intitulé de l'étape",
      "description": "string — ce qu'il faut faire, en clair",
      "documents": ["string — pièces requises pour cette étape"],
      "ou": "string ou null — où effectuer la démarche (ex: CEFORE, service des impôts)",
      "cout": "string ou null — coût de cette étape si indiqué",
      "delai": "string ou null — délai de cette étape si indiqué"
    }
  ],
  "documents_delivres": ["string — documents obtenus à la fin (ex: RCCM, IFU)"],
  "conseils": ["string — recommandations pratiques tirées des extraits"]
}"""


def _profil_en_texte(profil: dict) -> str:
    """Transforme le profil en une description lisible pour la requête."""
    type_ent = profil.get("type_entreprise")
    parts = []
    if type_ent:
        parts.append(f"Type d'entreprise souhaité : {TYPE_LABELS.get(type_ent, type_ent)}")
    if profil.get("activite"):
        parts.append(f"Activité : {profil['activite']}")
    if profil.get("ville"):
        parts.append(f"Ville : {profil['ville']}")
    if profil.get("nb_associes") is not None:
        parts.append(f"Nombre d'associés : {profil['nb_associes']}")
    if profil.get("details"):
        parts.append(f"Précisions : {profil['details']}")
    return "\n".join(parts) if parts else "Aucune précision fournie."


def _construire_contexte(passages):
    blocs = []
    for i, p in enumerate(passages, start=1):
        page = f", page {p['page']}" if p.get("page") and p["page"] > 0 else ""
        blocs.append(f"[Extrait {i} — source : {p['source']}{page}]\n{p['texte']}")
    return "\n\n".join(blocs)


def generer_feuille_de_route(profil: dict, k: int = 8):
    """Génère la feuille de route à partir du profil.

    `profil` : dict avec au minimum 'type_entreprise' ('personnelle'/'societaire')
    et idéalement 'activite', 'ville', 'nb_associes', 'details'.

    Retourne : { feuille_de_route: {...}, sources: [...], avertissement: str, trouve: bool }
    """
    type_entreprise = profil.get("type_entreprise")

    # Requête de recherche construite à partir du profil
    requete = (
        f"formalités, étapes, documents, coût et délai pour créer une "
        f"{TYPE_LABELS.get(type_entreprise, 'entreprise')} "
        f"{profil.get('activite', '')} au Burkina Faso"
    )
    passages = rechercher(requete, type_entreprise=type_entreprise, k=k)

    avertissement = (
        "Feuille de route indicative, générée d'après les documents officiels. "
        "Vérifiez les montants et délais auprès du CEFORE / de la MEBF avant toute démarche."
    )

    if not passages:
        return {
            "feuille_de_route": None,
            "sources": [],
            "avertissement": avertissement,
            "trouve": False,
        }

    contexte = _construire_contexte(passages)
    message_utilisateur = (
        f"PROFIL DE L'ENTREPRENEUR :\n{_profil_en_texte(profil)}\n\n"
        f"EXTRAITS DES DOCUMENTS OFFICIELS :\n\n{contexte}\n\n"
        f"Produis la feuille de route au format JSON suivant (respecte exactement "
        f"les clés) :\n{SCHEMA}"
    )

    client = _get_client()
    completion = client.chat.completions.create(
        model=CHAT_MODEL,
        temperature=0.1,
        response_format={"type": "json_object"},  # force une sortie JSON valide
        messages=[
            {"role": "system", "content": SYSTEME},
            {"role": "user", "content": message_utilisateur},
        ],
    )
    brut = completion.choices[0].message.content.strip()

    try:
        feuille = json.loads(brut)
    except json.JSONDecodeError:
        # Repli : on renvoie le texte brut pour ne rien perdre
        feuille = {"titre": "Feuille de route", "resume": brut, "etapes": []}

    # Sources dédupliquées réellement utilisées
    sources, vues = [], set()
    for p in passages:
        cle = (p["source"], p.get("page"))
        if cle not in vues:
            vues.add(cle)
            sources.append({
                "source": p["source"],
                "page": p.get("page") if p.get("page") and p["page"] > 0 else None,
                "type": p.get("type"),
                "score": p.get("score"),
            })

    return {
        "feuille_de_route": feuille,
        "sources": sources,
        "avertissement": avertissement,
        "trouve": True,
    }


if __name__ == "__main__":
    profil_test = {
        "type_entreprise": "personnelle",
        "activite": "vente de vêtements",
        "ville": "Ouagadougou",
    }
    res = generer_feuille_de_route(profil_test)
    print(json.dumps(res["feuille_de_route"], ensure_ascii=False, indent=2))
    print("\nSOURCES :")
    for s in res["sources"]:
        print(f"  - {s['source']} [{s['type']}]")
