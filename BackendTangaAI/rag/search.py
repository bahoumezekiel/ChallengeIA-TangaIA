"""
Recherche dans l'index RAG : récupère les passages les plus pertinents.

Cette fonction `rechercher` sera réutilisée par les endpoints (Q&R,
feuille de route). On peut aussi la tester directement en ligne de commande :

    python -m rag.search "Quels documents pour créer une entreprise individuelle ?"

Option de filtre par type :
    python -m rag.search --type societaire "Comment rédiger les statuts d'une SARL ?"
"""
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions

from rag.config import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL, OPENAI_API_KEY

# La collection est mise en cache pour ne pas se reconnecter à chaque appel
_collection = None


def _get_collection():
    """Ouvre (une seule fois) la collection ChromaDB avec l'embedding OpenAI."""
    global _collection
    if _collection is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY introuvable. Vérifiez votre fichier .env.")
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        openai_ef = embedding_functions.OpenAIEmbeddingFunction(
            api_key=OPENAI_API_KEY,
            model_name=EMBEDDING_MODEL,
        )
        _collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=openai_ef,
        )
    return _collection


def rechercher(question: str, type_entreprise: Optional[str] = None, k: int = 5):
    """Retourne les k passages les plus pertinents pour la question.

    Si `type_entreprise` vaut 'personnelle' ou 'societaire', la recherche est
    filtrée sur le bon parcours juridique (évite de mélanger les procédures).

    Chaque résultat est un dictionnaire : texte, source, page, type, score.
    """
    collection = _get_collection()
    where = {"type": type_entreprise} if type_entreprise else None

    res = collection.query(query_texts=[question], n_results=k, where=where)

    passages = []
    # Chroma renvoie des listes de listes (une par question) ; on prend la 1re
    docs = res["documents"][0]
    metas = res["metadatas"][0]
    dists = res["distances"][0]
    for texte, meta, distance in zip(docs, metas, dists):
        passages.append({
            "texte": texte,
            "source": meta.get("source"),
            "page": meta.get("page"),
            "type": meta.get("type"),
            "score": round(1 - distance, 3),  # cosine : proche de 1 = pertinent
        })
    return passages


if __name__ == "__main__":
    import sys

    args = sys.argv[1:]
    type_filtre = None
    if "--type" in args:
        idx = args.index("--type")
        type_filtre = args[idx + 1]
        del args[idx:idx + 2]
    question = " ".join(args) or "Quels documents faut-il pour créer une entreprise individuelle ?"

    print(f"Question : {question}")
    print(f"Filtre type : {type_filtre or 'aucun'}\n")
    for p in rechercher(question, type_entreprise=type_filtre, k=5):
        page = f" (p.{p['page']})" if p["page"] and p["page"] > 0 else ""
        print(f"[{p['type']}] {p['source']}{page}  —  score {p['score']}")
        apercu = p["texte"][:300].replace("\n", " ")
        print(f"   {apercu} ...\n")
