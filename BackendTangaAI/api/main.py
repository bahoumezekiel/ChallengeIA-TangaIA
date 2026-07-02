"""
API FastAPI — point d'entrée HTTP de l'orchestrateur TangaAI (VERSION FUSIONNÉE A).
Lance avec : uvicorn api.main:app --host 0.0.0.0 --port 8000  (SANS --reload : scheduler)

Contient À LA FOIS :
  • NOS features          : interrupt robuste, /onboarding/message, /historique,
                            /sentiment/{id}, /ventes/{id}, /publications/*, scheduler.
  • LEURS features (Phase A) : auth (/auth/register, /auth/login, /auth/me),
                            CRUD agents (GET/POST /session/{id}/agents,
                            PUT/PATCH/DELETE /agents/{id}), prise en compte des
                            agents manuels/édités par l'orchestrateur (agents_existants).
"""

import asyncio
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Optional, Any
from typing import Optional as Opt

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langgraph.errors import GraphInterrupt
from langgraph.types import Command

load_dotenv()

from orchestrator_graph import build_orchestrator_graph
from models.schemas import ProfilPME, AgentState, AgentSpec, PlanAgents, ResultatCrew
from memory.store import get_checkpointer, session_id_from_nom
from memory.credentials import (
    save_credentials,
    get_missing_credentials,
    get_credentials,
    TOOL_CREDENTIALS_SCHEMA,
)
# --- NOS features ---
from memory.history import get_history
from onboarding import run_onboarding_step
from tools.sentiment_core import analyser_sentiments_facebook
from tools.sales_core import analyser_ventes
from publications_programmees import (
    programmer_publication,
    lister_publications,
    get_publication,
    annuler_publication,
    demarrer_scheduler,
    arreter_scheduler,
)
# --- LEURS features (Phase A) : auth + CRUD agents ---
from memory.auth import (
    register_user,
    login_user,
    create_token,
    verify_token,
    save_user_session,
    get_user_last_session,
    get_user_by_id,
)
from memory.agents import (
    save_agents as db_save_agents,
    get_agents as db_get_agents,
    get_manual_agents,
    create_agent as db_create_agent,
    update_agent as db_update_agent,
    toggle_agent as db_toggle_agent,
    delete_agent as db_delete_agent,
    LIMIT_AGENTS_ACTIFS,
)
from memory import notifications as notif

from rag.routes import router as creation_router
from portfolio.routes import router as portfolio_router


logger = logging.getLogger("api")

_executor = ThreadPoolExecutor(max_workers=4)
_checkpointer = None
_app_with_memory = None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AnalyseRequest(BaseModel):
    profil_pme: ProfilPME
    session_id: Optional[str] = None


class AgentResultat(BaseModel):
    nom_agent: str
    statut: str
    livrable: str
    erreurs: Optional[str] = None


class AgentCree(BaseModel):
    agent_id: Optional[str] = None
    nom: str
    role: str
    domaine: str
    objectif: str
    backstory: str = ""
    outils_requis: list[str] = []
    outils_en_attente: list[str] = []
    priorite: int = 3
    source: str = "auto"
    actif: bool = True


class AgentCreateRequest(BaseModel):
    nom: str
    role: str
    backstory: str
    domaine: str
    objectif: str
    outils_requis: list[str] = []
    outils_en_attente: list[str] = []
    priorite: int = 3


class AgentUpdateRequest(BaseModel):
    nom: Optional[str] = None
    role: Optional[str] = None
    backstory: Optional[str] = None
    domaine: Optional[str] = None
    objectif: Optional[str] = None
    outils_requis: Optional[list[str]] = None
    outils_en_attente: Optional[list[str]] = None
    priorite: Optional[int] = None


class AnalyseResponse(BaseModel):
    session_id: str
    statut: str
    agents_crees: list[AgentCree] = []
    synthese: Optional[str] = None
    nb_agents: int = 0
    process_type: str = "unknown"
    resultats_agents: list[AgentResultat] = []
    duree_secondes: float = 0.0
    retry_count: int = 0
    notification: Optional[dict] = None


class CredentialsRequest(BaseModel):
    tool_name: str
    credentials: dict[str, str]


class CredentialsResponse(BaseModel):
    session_id: str
    tool_name: str
    message: str
    outils_encore_manquants: list[str]


class OnboardingRequest(BaseModel):
    messages: list[dict] = []


class OnboardingResponse(BaseModel):
    complete: bool
    message: str
    profil_pme: Optional[dict] = None


class PublicationProgrammeeRequest(BaseModel):
    session_id: Optional[str] = None
    mode: str = "texte"                 # "texte" | "ia"
    contenu: Optional[str] = None
    brief: Optional[str] = None
    publier_dans_minutes: Optional[float] = None
    publier_le: Optional[str] = None
    page_id: Optional[str] = None
    access_token: Optional[str] = None
    avec_image: bool = False
    image_prompt: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    session: Opt[dict] = None   # {session_id, profil_pme, last_results} si dispo


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _checkpointer, _app_with_memory
    _checkpointer = get_checkpointer()
    _app_with_memory = build_orchestrator_graph(checkpointer=_checkpointer)
    demarrer_scheduler()                       # publications programmées
    logger.info("TangaAI API démarrée — mémoire SQLite active")
    yield
    arreter_scheduler()
    _executor.shutdown(wait=False)
    logger.info("TangaAI API arrêtée")


app = FastAPI(
    title="TangaAI Orchestrator API",
    description="Orchestrateur multi-agents pour PME — LangGraph + CrewAI",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(creation_router)
app.include_router(portfolio_router)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _agents_crees(plan: Optional[PlanAgents], ids: Optional[list[str]] = None) -> list[AgentCree]:
    if not plan:
        return []
    sorted_agents = sorted(plan.agents, key=lambda x: x.priorite)
    return [
        AgentCree(
            agent_id=ids[i] if ids and i < len(ids) else None,
            nom=a.nom,
            role=a.role,
            domaine=a.domaine,
            objectif=a.objectif,
            backstory=getattr(a, "backstory", ""),
            outils_requis=a.outils_requis,
            outils_en_attente=getattr(a, "outils_en_attente", []),
            priorite=a.priorite,
            source=getattr(a, "source", "auto"),
            actif=getattr(a, "actif", True),
        )
        for i, a in enumerate(sorted_agents)
    ]


def _build_response(
    session_id: str,
    etat: AgentState,
    debut: float,
    statut: str = "termine",
    agent_ids: Optional[list[str]] = None,
) -> AnalyseResponse:
    plan: Optional[PlanAgents] = etat.plan_agents
    crew_result: Optional[ResultatCrew] = etat.resultat_crew

    resultats_agents = []
    if crew_result:
        resultats_agents = [
            AgentResultat(nom_agent=r.nom_agent, statut=r.statut, livrable=r.livrable, erreurs=r.erreurs)
            for r in crew_result.resultats
        ]

    return AnalyseResponse(
        session_id=session_id,
        statut=statut,
        agents_crees=_agents_crees(plan, agent_ids),
        synthese=etat.synthese or ("Aucune synthèse disponible." if statut == "termine" else None),
        nb_agents=len(plan.agents) if plan else 0,
        process_type=plan.process_type if plan else "unknown",
        resultats_agents=resultats_agents,
        duree_secondes=round(time.time() - debut, 2),
        retry_count=etat.retry_count,
    )


def _invoke_graph(input_data: Any, config: dict) -> Any:
    return _app_with_memory.invoke(input_data, config=config)


def _extract_user(authorization: Opt[str]) -> Opt[str]:
    """Extrait le user_id depuis un header 'Bearer <token>', ou None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return verify_token(authorization[7:])


def _build_interrupt_response(session_id: str, payload: dict, debut: float) -> AnalyseResponse:
    plan = payload.get("plan", {})
    agents_crees = [
        AgentCree(
            nom=a["nom"], role=a["role"], domaine=a["domaine"], objectif=a["objectif"],
            outils_requis=a["outils_requis"], priorite=a["priorite"],
        )
        for a in plan.get("agents", [])
    ]
    return AnalyseResponse(
        session_id=session_id,
        statut="en_attente_credentials",
        agents_crees=agents_crees,
        nb_agents=plan.get("nb_agents", len(agents_crees)),
        process_type=plan.get("process_type", "unknown"),
        duree_secondes=round(time.time() - debut, 2),
        notification=payload,
    )


def _extract_interrupt_payload(resultat: Any, config: dict) -> Optional[dict]:
    """
    Détection robuste de l'interruption : gère le cas où interrupt() NE lève PAS
    d'exception mais renvoie "__interrupt__", avec lecture de secours via get_state().
    """
    if isinstance(resultat, dict) and "__interrupt__" in resultat:
        interruptions = resultat["__interrupt__"]
        if interruptions:
            premier = interruptions[0]
            valeur = getattr(premier, "value", None)
            if valeur is None and isinstance(premier, dict):
                valeur = premier.get("value")
            if isinstance(valeur, dict):
                return valeur
    try:
        snapshot = _app_with_memory.get_state(config)
        if snapshot and snapshot.next and getattr(snapshot, "tasks", None):
            for task in snapshot.tasks:
                interrupts = getattr(task, "interrupts", None)
                if interrupts:
                    valeur = getattr(interrupts[0], "value", None)
                    if isinstance(valeur, dict):
                        return valeur
    except Exception:
        pass
    return None


def _etat_from_resultat(resultat: Any) -> AgentState:
    if isinstance(resultat, dict):
        return AgentState(**{k: v for k, v in resultat.items() if k != "__interrupt__"})
    return resultat


def _charger_agents_existants(session_id: str) -> list[AgentSpec]:
    """Reconstruit les AgentSpec manuels/édités d'une session (source='manuel')."""
    agents_manuels = get_manual_agents(session_id)
    return [
        AgentSpec(**{
            k: v for k, v in a.items()
            if k not in ("agent_id", "session_id", "user_id", "created_at", "updated_at")
        })
        for a in agents_manuels
    ]


def _persister_agents(session_id: str, user_id: Opt[str], etat: AgentState) -> list[str]:
    """
    Sauvegarde en DB les agents générés par l'orchestrateur (remplace les 'auto').
    Les agents 'manuel' présents dans le plan existent déjà en base (chargés via
    agents_existants) : on ne les re-sauvegarde PAS, sinon ils seraient dupliqués.
    """
    if not etat.plan_agents:
        return []
    specs = [
        a.model_dump()
        for a in sorted(etat.plan_agents.agents, key=lambda x: x.priorite)
        if getattr(a, "source", "auto") != "manuel"
    ]
    return db_save_agents(session_id, user_id, specs)


def _agent_row_to_model(row: dict) -> AgentCree:
    return AgentCree(
        agent_id=row["agent_id"],
        nom=row.get("nom", ""),
        role=row.get("role", ""),
        domaine=row.get("domaine", "autre"),
        objectif=row.get("objectif", ""),
        backstory=row.get("backstory", ""),
        outils_requis=row.get("outils_requis", []),
        outils_en_attente=row.get("outils_en_attente", []),
        priorite=row.get("priorite", 3),
        source=row["source"],
        actif=row["actif"],
    )


def _agents_crees_depuis_db(session_id: str, plan: Optional[PlanAgents]) -> list[AgentCree]:
    """
    Construit la liste d'agents de la réponse en récupérant les vrais agent_id
    depuis la base (DB = source de vérité après persistance). Conserve l'ordre du
    plan ; un agent du plan absent de la DB (cas limite) est rendu sans agent_id.
    """
    if not plan:
        return []
    rows_par_nom = {r.get("nom"): r for r in db_get_agents(session_id)}
    out: list[AgentCree] = []
    for a in sorted(plan.agents, key=lambda x: x.priorite):
        row = rows_par_nom.get(a.nom)
        if row:
            out.append(_agent_row_to_model(row))
        else:
            out.append(AgentCree(
                nom=a.nom, role=a.role, domaine=a.domaine, objectif=a.objectif,
                backstory=getattr(a, "backstory", ""),
                outils_requis=a.outils_requis,
                outils_en_attente=getattr(a, "outils_en_attente", []),
                priorite=a.priorite,
                source=getattr(a, "source", "auto"),
                actif=getattr(a, "actif", True),
            ))
    return out


# ---------------------------------------------------------------------------
# Endpoints — santé + onboarding
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "memory": "sqlite"}


@app.post("/onboarding/message", response_model=OnboardingResponse)
def onboarding_message(request: OnboardingRequest):
    """Onboarding conversationnel : construit le ProfilPME au fil de la discussion."""
    step = run_onboarding_step(request.messages)
    return OnboardingResponse(
        complete=step.complete,
        message=step.message,
        profil_pme=step.profil_pme.model_dump() if step.profil_pme else None,
    )


# ---------------------------------------------------------------------------
# Endpoints — coeur orchestrateur
# ---------------------------------------------------------------------------

@app.post("/analyse", response_model=AnalyseResponse)
async def analyser_profil(request: AnalyseRequest, authorization: Opt[str] = Header(None)):
    user_id = _extract_user(authorization)
    session_id = request.session_id or session_id_from_nom(request.profil_pme.nom_entreprise)
    config = {"configurable": {"thread_id": session_id}}

    # Prend en compte les agents manuels/édités déjà configurés pour cette session
    agents_existants = _charger_agents_existants(session_id)
    etat_initial = AgentState(profil_pme=request.profil_pme, agents_existants=agents_existants)
    debut = time.time()

    loop = asyncio.get_event_loop()
    try:
        resultat = await loop.run_in_executor(_executor, lambda: _invoke_graph(etat_initial, config))
    except GraphInterrupt as exc:
        interrupt_payload = exc.args[0][0].value if exc.args and exc.args[0] else {}
        if user_id:
            save_user_session(user_id, session_id, request.profil_pme.model_dump(), {})
        return _build_interrupt_response(session_id, interrupt_payload, debut)
    except Exception as exc:
        logger.exception("Erreur lors de l'exécution de l'orchestrateur")
        raise HTTPException(status_code=500, detail=str(exc))

    payload = _extract_interrupt_payload(resultat, config)
    if payload is not None:
        if user_id:
            save_user_session(user_id, session_id, request.profil_pme.model_dump(), {})
        return _build_interrupt_response(session_id, payload, debut)

    etat_final = _etat_from_resultat(resultat)
    _persister_agents(session_id, user_id, etat_final)
    response = _build_response(session_id, etat_final, debut)
    response.agents_crees = _agents_crees_depuis_db(session_id, etat_final.plan_agents)
    response.nb_agents = len(response.agents_crees)
    notif.add_notification(
        titre="Analyse terminée",
        message=f"Votre équipe de {response.nb_agents} agent(s) a terminé son travail pour "
                f"{request.profil_pme.nom_entreprise}.",
        type="success",
        session_id=session_id,
        user_id=user_id,
    )
    if user_id:
        save_user_session(user_id, session_id, request.profil_pme.model_dump(), response.model_dump())
    return response


@app.post("/session/{session_id}/credentials", response_model=CredentialsResponse)
def fournir_credentials(session_id: str, request: CredentialsRequest):
    if request.tool_name not in TOOL_CREDENTIALS_SCHEMA:
        raise HTTPException(
            status_code=400,
            detail=f"Outil inconnu : {request.tool_name}. Outils acceptés : {list(TOOL_CREDENTIALS_SCHEMA.keys())}",
        )

    save_credentials(session_id, request.tool_name, request.credentials)
    logger.info(f"[{session_id}] Credentials enregistrés pour : {request.tool_name}")

    config = {"configurable": {"thread_id": session_id}}
    snapshot = _app_with_memory.get_state(config)
    outils_encore_manquants: list[str] = []

    if snapshot and snapshot.values:
        etat = snapshot.values
        if isinstance(etat, dict):
            etat = AgentState(**{k: v for k, v in etat.items() if k != "__interrupt__"})
        if etat.plan_agents:
            outils_requis = [o for a in etat.plan_agents.agents for o in a.outils_requis]
            manquants = get_missing_credentials(session_id, list(dict.fromkeys(outils_requis)))
            outils_encore_manquants = list(manquants.keys())

    return CredentialsResponse(
        session_id=session_id,
        tool_name=request.tool_name,
        message=(
            "Credentials enregistrés. Appelez POST /session/{id}/resume pour reprendre."
            if not outils_encore_manquants
            else f"Credentials enregistrés. Il manque encore : {outils_encore_manquants}"
        ),
        outils_encore_manquants=outils_encore_manquants,
    )


@app.post("/session/{session_id}/resume", response_model=AnalyseResponse)
async def reprendre_session(session_id: str, authorization: Opt[str] = Header(None)):
    user_id = _extract_user(authorization)
    config = {"configurable": {"thread_id": session_id}}
    snapshot = _app_with_memory.get_state(config)

    if not snapshot or not snapshot.next:
        raise HTTPException(status_code=404, detail="Aucune session en attente pour cet identifiant.")

    debut = time.time()
    loop = asyncio.get_event_loop()
    try:
        resultat = await loop.run_in_executor(_executor, lambda: _invoke_graph(Command(resume="ok"), config))
    except GraphInterrupt as exc:
        interrupt_payload = exc.args[0][0].value if exc.args and exc.args[0] else {}
        return _build_interrupt_response(session_id, interrupt_payload, debut)
    except Exception as exc:
        logger.exception("Erreur lors de la reprise de session")
        raise HTTPException(status_code=500, detail=str(exc))

    payload = _extract_interrupt_payload(resultat, config)
    if payload is not None:
        return _build_interrupt_response(session_id, payload, debut)

    etat_final = _etat_from_resultat(resultat)
    _persister_agents(session_id, user_id, etat_final)
    response = _build_response(session_id, etat_final, debut)
    response.agents_crees = _agents_crees_depuis_db(session_id, etat_final.plan_agents)
    response.nb_agents = len(response.agents_crees)
    if user_id:
        profil = etat_final.profil_pme.model_dump() if etat_final.profil_pme else {}
        save_user_session(user_id, session_id, profil, response.model_dump())
    return response


@app.get("/session/{session_id}/etat")
def get_etat_session(session_id: str):
    config = {"configurable": {"thread_id": session_id}}
    snapshot = _app_with_memory.get_state(config)

    if not snapshot or snapshot.values is None:
        raise HTTPException(status_code=404, detail="Session introuvable")

    etat = snapshot.values
    if isinstance(etat, dict):
        etat = AgentState(**{k: v for k, v in etat.items() if k != "__interrupt__"})

    return {
        "session_id": session_id,
        "en_attente": bool(snapshot.next),
        "prochains_noeuds": list(snapshot.next),
        "synthese": etat.synthese,
        "retry_count": etat.retry_count,
        "nb_agents": len(etat.plan_agents.agents) if etat.plan_agents else 0,
    }


# ---------------------------------------------------------------------------
# Endpoints — Authentification (Phase A)
# ---------------------------------------------------------------------------

@app.post("/auth/register", response_model=AuthResponse)
def inscription(request: RegisterRequest):
    """Crée un compte utilisateur et retourne un token d'authentification."""
    try:
        user = register_user(request.email, request.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    token = create_token(user["user_id"])
    return AuthResponse(token=token, user_id=user["user_id"], email=user["email"])


@app.post("/auth/login", response_model=AuthResponse)
def connexion(request: LoginRequest):
    """Vérifie les credentials et retourne un token + la dernière session si disponible."""
    user = login_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")
    token = create_token(user["user_id"])
    session = get_user_last_session(user["user_id"])
    return AuthResponse(token=token, user_id=user["user_id"], email=user["email"], session=session)


@app.get("/auth/me", response_model=AuthResponse)
def get_me(authorization: Opt[str] = Header(None)):
    """Valide le token et retourne les infos utilisateur + dernière session."""
    user_id = _extract_user(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré.")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    session = get_user_last_session(user_id)
    token = authorization[7:] if authorization else ""
    return AuthResponse(token=token, user_id=user_id, email=user["email"], session=session)


# ---------------------------------------------------------------------------
# Endpoints — CRUD agents (Phase A)
# ---------------------------------------------------------------------------

@app.get("/session/{session_id}/agents", response_model=list[AgentCree])
def list_agents(session_id: str):
    """Retourne tous les agents d'une session (actifs + inactifs)."""
    return [_agent_row_to_model(r) for r in db_get_agents(session_id)]


@app.post("/session/{session_id}/agents", response_model=AgentCree, status_code=201)
def creer_agent(session_id: str, request: AgentCreateRequest, authorization: Opt[str] = Header(None)):
    """Crée un agent manuel pour une session existante."""
    user_id = _extract_user(authorization)
    try:
        row = db_create_agent(session_id, user_id, request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _agent_row_to_model(row)


@app.put("/agents/{agent_id}", response_model=AgentCree)
def modifier_agent(agent_id: str, request: AgentUpdateRequest):
    """Modifie un agent existant. Passe source à 'manuel' automatiquement."""
    row = db_update_agent(agent_id, request.model_dump(exclude_none=True))
    if not row:
        raise HTTPException(status_code=404, detail="Agent introuvable.")
    return _agent_row_to_model(row)


@app.patch("/agents/{agent_id}/statut", response_model=AgentCree)
def basculer_agent(agent_id: str):
    """Bascule l'agent actif <-> inactif. Vérifie la limite de 8 actifs à la réactivation."""
    try:
        row = db_toggle_agent(agent_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not row:
        raise HTTPException(status_code=404, detail="Agent introuvable.")
    return _agent_row_to_model(row)


@app.delete("/agents/{agent_id}", status_code=204)
def supprimer_agent(agent_id: str):
    """Suppression définitive d'un agent."""
    if not db_delete_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent introuvable.")


# ---------------------------------------------------------------------------
# Endpoints — historique (NOS features)
# ---------------------------------------------------------------------------

@app.get("/historique")
def historique(session_id: Optional[str] = None, limit: int = 50):
    """Analyses passées (les plus récentes d'abord)."""
    return {"runs": get_history(session_id, limit)}


# ---------------------------------------------------------------------------
# Endpoints — analyse de sentiment Facebook (NOS features)
# ---------------------------------------------------------------------------

@app.get("/sentiment/{session_id}")
def sentiment_facebook(session_id: str, nb_posts: int = 5):
    """Analyse de sentiment des commentaires de la page Facebook de la session."""
    creds = (
        get_credentials(session_id, "analyse_sentiment_facebook")
        or get_credentials(session_id, "publication_reseaux_sociaux")
    )
    if not creds or not creds.get("page_id") or not creds.get("access_token"):
        raise HTTPException(
            status_code=400,
            detail="Credentials Facebook absents pour cette session (page_id + access_token requis).",
        )
    resultat = analyser_sentiments_facebook(creds["page_id"], creds["access_token"], nb_posts=nb_posts)
    if isinstance(resultat, dict) and resultat.get("alerte"):
        pct = round((resultat.get("pourcentage_negatif") or 0) * 100)
        notif.add_notification(
            titre="Alerte réputation",
            message=f"{pct}% des avis récents sur votre page Facebook sont négatifs. "
                    "Une réponse rapide est recommandée.",
            type="warning",
            session_id=session_id,
        )
    return resultat


# ---------------------------------------------------------------------------
# Endpoints — tableau de bord ventes (NOS features)
# ---------------------------------------------------------------------------

@app.get("/ventes/{session_id}")
def tableau_ventes(session_id: str, granularite: str = "mois", source_url: Optional[str] = None):
    """Données du tableau de bord ventes (CA, évolution, top produits)."""
    api_key = ""
    if not source_url:
        creds = get_credentials(session_id, "analyse_donnees_ventes")
        if not creds or not creds.get("source_url"):
            raise HTTPException(
                status_code=400,
                detail="Aucune source de ventes connectée (outil analyse_donnees_ventes : source_url).",
            )
        source_url = creds["source_url"]
        api_key = creds.get("api_key", "")
    return analyser_ventes(source_url, api_key, granularite=granularite)


# ---------------------------------------------------------------------------
# Endpoints — publications programmées (NOS features)
# ---------------------------------------------------------------------------

@app.post("/publications/programmer")
def creer_publication_programmee(request: PublicationProgrammeeRequest):
    """Programme une publication (texte fourni ou contenu généré par l'IA)."""
    resultat = programmer_publication(
        session_id=request.session_id,
        mode=request.mode,
        contenu=request.contenu,
        brief=request.brief,
        publier_dans_minutes=request.publier_dans_minutes,
        publier_le=request.publier_le,
        page_id=request.page_id,
        access_token=request.access_token,
        avec_image=request.avec_image,
        image_prompt=request.image_prompt,
    )
    if "erreur" in resultat:
        raise HTTPException(status_code=400, detail=resultat["erreur"])
    return resultat


@app.get("/publications")
def lister_publications_programmees(session_id: Optional[str] = None):
    return {"publications": lister_publications(session_id)}


@app.get("/publications/{pub_id}")
def detail_publication(pub_id: int):
    pub = get_publication(pub_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Publication introuvable.")
    return pub


@app.delete("/publications/{pub_id}")
def annuler_publication_programmee(pub_id: int):
    if annuler_publication(pub_id):
        return {"message": "Publication annulée.", "id": pub_id}
    raise HTTPException(status_code=400, detail="Impossible d'annuler (déjà publiée ou inexistante).")


# ---------------------------------------------------------------------------
# Endpoints — Notifications (destinées à la PME)
# ---------------------------------------------------------------------------

class NotificationCreateRequest(BaseModel):
    titre: str
    message: str = ""
    type: str = "info"
    session_id: Optional[str] = None
    lien: Optional[str] = None


@app.get("/notifications")
def lister_notifications(
    session_id: Optional[str] = None,
    limit: int = 50,
    authorization: Opt[str] = Header(None),
):
    """Notifications de la PME (par session et/ou par utilisateur connecté)."""
    user_id = _extract_user(authorization)
    items = notif.list_notifications(session_id=session_id, user_id=user_id, limit=limit)
    return {
        "notifications": items,
        "non_lues": notif.unread_count(session_id=session_id, user_id=user_id),
    }


@app.post("/notifications")
def creer_notification(request: NotificationCreateRequest, authorization: Opt[str] = Header(None)):
    """Crée une notification (utilisable par le système ou pour test)."""
    user_id = _extract_user(authorization)
    created = notif.add_notification(
        titre=request.titre, message=request.message, type=request.type,
        session_id=request.session_id, user_id=user_id, lien=request.lien,
    )
    if not created:
        raise HTTPException(status_code=500, detail="Échec de création de la notification.")
    return created


@app.post("/notifications/{notif_id}/lue")
def marquer_notification_lue(notif_id: str):
    if notif.mark_read(notif_id):
        return {"id": notif_id, "lue": True}
    raise HTTPException(status_code=404, detail="Notification introuvable.")


@app.post("/notifications/lues")
def marquer_toutes_lues(session_id: Optional[str] = None, authorization: Opt[str] = Header(None)):
    user_id = _extract_user(authorization)
    n = notif.mark_all_read(session_id=session_id, user_id=user_id)
    return {"marquees": n}


@app.delete("/notifications/{notif_id}")
def supprimer_notification(notif_id: str):
    if notif.delete_notification(notif_id):
        return {"id": notif_id, "supprimee": True}
    raise HTTPException(status_code=404, detail="Notification introuvable.")