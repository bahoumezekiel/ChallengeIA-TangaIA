"""
Configuration du module RAG (création d'entreprise).

Centralise les chemins des dossiers sources, les modèles OpenAI utilisés,
l'emplacement de la base vectorielle et les paramètres de découpage.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Charge les variables d'environnement (.env du backend), dont OPENAI_API_KEY
load_dotenv()

# Racine du module RAG (le dossier qui contient ce fichier)
RAG_DIR = Path(__file__).resolve().parent

# Dossiers sources des documents officiels, séparés par type d'entreprise.
# On garde la séparation : elle sert à filtrer la recherche par parcours juridique.
SOURCES = {
    "personnelle": Path(r"C:\Users\HP\Desktop\Rag\personnelle"),
    "societaire": Path(r"C:\Users\HP\Desktop\Rag\Societaire"),
}

# Libellés lisibles (pour l'affichage côté frontend)
TYPE_LABELS = {
    "personnelle": "Entreprise personnelle (entreprise individuelle)",
    "societaire": "Entreprise sociétaire (SARL, SA, SAS, ...)",
}

# Base vectorielle ChromaDB : stockée en local, dans le module
CHROMA_DIR = str(RAG_DIR / "chroma_db")
COLLECTION_NAME = "creation_entreprise_bf"

# Modèle d'embedding OpenAI (économique et performant)
EMBEDDING_MODEL = "text-embedding-3-small"

# Modèle de génération des réponses (utilisé par les endpoints)
CHAT_MODEL = "gpt-4o-mini"

# Découpage des documents (en caractères)
CHUNK_SIZE = 1200       # taille d'un morceau
CHUNK_OVERLAP = 150     # chevauchement entre deux morceaux consécutifs

# Clé OpenAI (lue depuis le .env)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
