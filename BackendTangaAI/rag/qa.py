"""
Logique de question-réponse (RAG) pour la création d'entreprise.

Enchaîne : recherche des passages pertinents -> construction d'un prompt
strict (réponse fondée uniquement sur les extraits, avec citations) ->
génération de la réponse par OpenAI. Renvoie la réponse et ses sources.

Cette fonction est réutilisée par l'endpoint FastAPI (routes.py).
"""
from typing import Optional

from openai import OpenAI

from rag.config import CHAT_MODEL, OPENAI_API_KEY
from rag.search import rechercher

_client = None


def _get_client():
    """Client OpenAI (créé une seule fois)."""
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY introuvable. Vérifiez votre fichier .env.")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


# Consigne système : impose la règle anti-hallucination
SYSTEME = (
    "Tu es l'assistant officiel de TangaAI pour la création d'entreprise au "
    "Burkina Faso (cadre OHADA, formalités CEFORE/MEBF). "
    "Tu réponds en français clair et simple, adapté à un entrepreneur.\n\n"
    "RÈGLES ABSOLUES :\n"
    "1. Réponds UNIQUEMENT à partir des extraits fournis ci-dessous. "
    "N'invente jamais une démarche, un document, un coût ou un délai.\n"
    "2. Si l'information demandée ne figure pas dans les extraits, dis-le "
    "explicitement et invite l'utilisateur à se rapprocher du CEFORE / de la "
    "Maison de l'Entreprise (MEBF). Ne comble jamais un manque par des "
    "connaissances générales.\n"
    "3. Cite tes sources en fin de réponse en reprenant le nom des documents "
    "utilisés.\n"
    "4. Reste factuel et concis. Structure ta réponse (étapes, listes) quand "
    "c'est utile.\n"
)


def _construire_contexte(passages):
    """Met en forme les extraits récupérés pour les insérer dans le prompt."""
    blocs = []
    for i, p in enumerate(passages, start=1):
        page = f", page {p['page']}" if p.get("page") and p["page"] > 0 else ""
        blocs.append(
            f"[Extrait {i} — source : {p['source']}{page}]\n{p['texte']}"
        )
    return "\n\n".join(blocs)


def repondre(question: str, type_entreprise: Optional[str] = None, k: int = 5):
    """Répond à une question à partir du corpus indexé.

    Retourne un dictionnaire :
        - reponse : le texte généré, fondé sur les documents
        - sources : liste des documents utilisés (source, page, type)
        - avertissement : rappel que l'info est indicative
        - trouve : False si aucun passage pertinent n'a été trouvé
    """
    passages = rechercher(question, type_entreprise=type_entreprise, k=k)

    avertissement = (
        "Informations données à titre indicatif d'après les documents officiels. "
        "Vérifiez toujours auprès du CEFORE / de la MEBF (ou d'un notaire) avant "
        "toute démarche."
    )

    # Aucun passage récupéré : on ne génère rien, on renvoie vers le CEFORE
    if not passages:
        return {
            "reponse": (
                "Je n'ai pas trouvé cette information dans mes documents. "
                "Je vous invite à contacter le CEFORE / la Maison de l'Entreprise "
                "(MEBF) pour une réponse fiable."
            ),
            "sources": [],
            "avertissement": avertissement,
            "trouve": False,
        }

    contexte = _construire_contexte(passages)
    message_utilisateur = (
        f"Question de l'utilisateur : {question}\n\n"
        f"Extraits des documents officiels :\n\n{contexte}\n\n"
        "Réponds à la question en respectant strictement les règles."
    )

    client = _get_client()
    completion = client.chat.completions.create(
        model=CHAT_MODEL,
        temperature=0.1,  # faible : on veut de la fidélité, pas de la créativité
        messages=[
            {"role": "system", "content": SYSTEME},
            {"role": "user", "content": message_utilisateur},
        ],
    )
    reponse = completion.choices[0].message.content.strip()

    # Liste dédupliquée des sources réellement récupérées
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
        "reponse": reponse,
        "sources": sources,
        "avertissement": avertissement,
        "trouve": True,
    }


if __name__ == "__main__":
    import sys

    args = sys.argv[1:]
    type_filtre = None
    if "--type" in args:
        idx = args.index("--type")
        type_filtre = args[idx + 1]
        del args[idx:idx + 2]
    question = " ".join(args) or "Quels documents faut-il pour créer une entreprise individuelle ?"

    res = repondre(question, type_entreprise=type_filtre)
    print("RÉPONSE :\n", res["reponse"], "\n")
    print("SOURCES :")
    for s in res["sources"]:
        page = f" (p.{s['page']})" if s["page"] else ""
        print(f"  - {s['source']}{page} [{s['type']}]")
    print("\n", res["avertissement"])
