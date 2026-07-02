"""
Endpoints FastAPI du module portfolio.

À brancher dans le main.py du backend :
    from portfolio.routes import router as portfolio_router
    app.include_router(portfolio_router)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from portfolio.service import lancer_generation, obtenir_statut

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Modèles d'entrée (le frontend pré-remplit ce qu'il connaît) ──

class ProjetItem(BaseModel):
    name: str = ""
    description: str = ""
    tech_stack: list[str] = []


class ExperienceItem(BaseModel):
    role: str = ""
    company: str = ""
    description: str = ""


class EducationItem(BaseModel):
    degree: str = ""
    school: str = ""
    year: str = ""


class TemoignageItem(BaseModel):
    author: str = ""
    text: str = ""


class PortfolioRequest(BaseModel):
    # Obligatoires
    name: str
    sector: str
    # Fortement recommandés
    title: str = ""
    bio: str = ""
    # Listes
    skills: list[str] = []
    projects: list[ProjetItem] = []
    experience: list[ExperienceItem] = []
    education: list[EducationItem] = []
    testimonials: list[TemoignageItem] = []
    # Contacts (affichés seulement si renseignés)
    contact_email: str = ""
    contact_phone: str = ""
    address: str = ""
    business_hours: str = ""
    contact_github: str = ""
    contact_linkedin: str = ""
    contact_whatsapp: str = ""
    contact_facebook: str = ""
    contact_instagram: str = ""
    # Apparence
    primary_color: str = ""
    secondary_color: str = ""
    target_audience: str = ""


@router.post("/generer")
def generer(req: PortfolioRequest):
    """Lance la génération du portfolio en arrière-plan. Retourne un job_id à interroger."""
    if not req.name.strip() or not req.sector.strip():
        raise HTTPException(status_code=400, detail="Le nom et le secteur sont obligatoires.")
    profil = req.model_dump()  # les sous-modèles deviennent des dicts simples
    job_id = lancer_generation(profil)
    return {"job_id": job_id, "statut": "en_cours"}


@router.get("/statut/{job_id}")
def statut(job_id: str):
    """Retourne l'état du job : en_cours / termine (+html, +rapport) / echec (+erreur)."""
    job = obtenir_statut(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Génération introuvable (job inconnu).")
    return job
