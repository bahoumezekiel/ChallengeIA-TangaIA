"""
Endpoints FastAPI du module « création d'entreprise ».

À brancher dans le main.py du backend :
    from rag.routes import router as creation_router
    app.include_router(creation_router)
"""
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rag.config import TYPE_LABELS
from rag.qa import repondre
from rag.roadmap import generer_feuille_de_route

router = APIRouter(prefix="/creation", tags=["creation-entreprise"])


class QuestionRequest(BaseModel):
    """Corps de la requête de question."""
    question: str
    # 'personnelle' ou 'societaire' ; None = recherche dans tout le corpus
    type_entreprise: Optional[Literal["personnelle", "societaire"]] = None


class SourceItem(BaseModel):
    source: str
    page: Optional[int] = None
    type: Optional[str] = None
    score: Optional[float] = None


class QuestionResponse(BaseModel):
    reponse: str
    sources: list[SourceItem]
    avertissement: str
    trouve: bool


@router.get("/types")
def lister_types():
    """Retourne les types d'entreprise disponibles (pour le frontend)."""
    return {"types": [{"id": k, "libelle": v} for k, v in TYPE_LABELS.items()]}


@router.post("/question", response_model=QuestionResponse)
def poser_question(req: QuestionRequest):
    """Répond à une question sur la création d'entreprise, avec citations."""
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La question est vide.")

    try:
        resultat = repondre(question, type_entreprise=req.type_entreprise)
    except RuntimeError as e:
        # Ex. index non construit ou clé OpenAI manquante
        raise HTTPException(status_code=500, detail=str(e))

    return resultat


class ProfilRequest(BaseModel):
    """Profil de l'entrepreneur pour générer une feuille de route."""
    type_entreprise: Literal["personnelle", "societaire"]
    activite: Optional[str] = None
    ville: Optional[str] = None
    nb_associes: Optional[int] = None
    details: Optional[str] = None


@router.post("/feuille-de-route")
def feuille_de_route(req: ProfilRequest):
    """Génère une feuille de route personnalisée (étapes, documents, coûts, délais)."""
    try:
        resultat = generer_feuille_de_route(req.model_dump())
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not resultat["trouve"]:
        raise HTTPException(
            status_code=404,
            detail="Aucun document trouvé pour ce type d'entreprise. Vérifiez l'index.",
        )
    return resultat
