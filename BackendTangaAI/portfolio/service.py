"""
Service de génération de portfolio.

Fait le pont entre TangaAI et le projet `portfolio_crew` (crew multi-agents) :
mappe un profil (dict) vers les entrées du crew, lance la génération en
arrière-plan (le crew prend 1 à 3 minutes), et met le résultat à disposition
via un identifiant de job.

Le package `portfolio_crew` se trouve dans BackendTangaAI/portfolio_crew/src ;
on l'ajoute au chemin d'import pour pouvoir l'utiliser directement.
"""
import sys
import uuid
import threading
import traceback
from pathlib import Path

# Rend le package portfolio_crew importable (layout src/)
_CREW_SRC = Path(__file__).resolve().parent.parent / "portfolio_crew" / "src"
if _CREW_SRC.exists() and str(_CREW_SRC) not in sys.path:
    sys.path.insert(0, str(_CREW_SRC))

from portfolio_crew.crew import PortfolioCrew, clean_html_output  # noqa: E402
from portfolio_crew.intake import finalize_inputs                 # noqa: E402

# ── Stockage des jobs en mémoire (suffisant pour un MVP / une démo) ──
_JOBS = {}
_LOCK = threading.Lock()

# Champs texte et champs liste attendus par finalize_inputs / les YAML du crew
_CHAMPS_TEXTE = (
    "name", "title", "sector", "bio",
    "contact_email", "contact_phone", "address", "business_hours",
    "contact_github", "contact_linkedin", "contact_whatsapp",
    "contact_facebook", "contact_instagram",
    "primary_color", "secondary_color", "target_audience",
)
_CHAMPS_LISTE = ("skills", "projects", "experience", "education", "testimonials")


def _normaliser_profil(profil: dict) -> dict:
    """Construit le dict `raw` attendu par finalize_inputs à partir du profil reçu.

    Les champs manquants deviennent une chaîne vide (le crew ignore les champs
    vides et n'invente jamais de valeur).
    """
    raw = {}
    for champ in _CHAMPS_TEXTE:
        valeur = profil.get(champ)
        raw[champ] = (valeur or "").strip() if isinstance(valeur, str) else (valeur or "")
    for champ in _CHAMPS_LISTE:
        valeur = profil.get(champ) or []
        raw[champ] = valeur if isinstance(valeur, list) else []
    return raw


def _generer(job_id: str, profil: dict):
    """Exécute réellement le crew (dans un thread) et stocke le résultat."""
    try:
        raw = _normaliser_profil(profil)
        if not raw["name"] or not raw["sector"]:
            raise ValueError("Le nom et le secteur sont obligatoires.")

        inputs = finalize_inputs(raw)
        # Slug isolé par job : évite toute collision entre utilisateurs/sessions
        inputs["slug"] = f"portfolio-{job_id[:8]}"

        PortfolioCrew().crew().kickoff(inputs=inputs)

        dossier = Path("outputs") / inputs["slug"]
        chemin_html = dossier / "index.html"
        clean_html_output(str(chemin_html))
        html = chemin_html.read_text(encoding="utf-8") if chemin_html.exists() else ""

        chemin_qa = dossier / "quality_assurance_report.md"
        rapport = chemin_qa.read_text(encoding="utf-8") if chemin_qa.exists() else ""

        if not html:
            raise RuntimeError("Le portfolio n'a pas été généré (fichier HTML vide).")

        with _LOCK:
            _JOBS[job_id] = {
                "statut": "termine",
                "html": html,
                "rapport": rapport,
                "erreur": None,
            }
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        with _LOCK:
            _JOBS[job_id] = {
                "statut": "echec",
                "html": None,
                "rapport": None,
                "erreur": str(e),
            }


def lancer_generation(profil: dict) -> str:
    """Démarre la génération en arrière-plan et retourne un identifiant de job."""
    job_id = uuid.uuid4().hex
    with _LOCK:
        _JOBS[job_id] = {"statut": "en_cours", "html": None, "rapport": None, "erreur": None}
    thread = threading.Thread(target=_generer, args=(job_id, profil), daemon=True)
    thread.start()
    return job_id


def obtenir_statut(job_id: str):
    """Retourne l'état d'un job : en_cours / termine / echec (ou None si inconnu)."""
    with _LOCK:
        return _JOBS.get(job_id)
