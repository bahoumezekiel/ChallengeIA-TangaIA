"""
schemas.py — Contrats de données Pydantic du système TangaAI.

Ces modèles jouent trois rôles simultanés :
1. Validation : toute donnée qui entre dans le système est vérifiée automatiquement.
2. Contrat LLM : le LLM est forcé à produire une sortie conforme à ces schémas
   (via .with_structured_output() de LangChain), ce qui rend sa décision exploitable.
3. État du graphe : AgentState est l'objet qui transite entre tous les nœuds LangGraph.
"""

from __future__ import annotations
from typing import Literal, Optional, Annotated
from pydantic import BaseModel, Field, field_validator
import operator


# ---------------------------------------------------------------------------
# 1. Profil PME — entrée du système, produit par l'onboarding
# ---------------------------------------------------------------------------

class ProfilPME(BaseModel):
    """
    Représente ce que l'utilisateur a renseigné lors de l'onboarding.
    C'est la seule donnée fournie par l'humain : tout le reste est généré par l'IA.
    """
    nom_entreprise: str
    secteur: str
    taille_effectif: Optional[int] = None
    cible_clientele: str
    objectifs_court_terme: list[str] = Field(default_factory=list)
    objectifs_long_terme: list[str] = Field(default_factory=list)
    # Doit contenir des valeurs parmi : marketing, vente, admin_finance, support, autre
    services_souhaites: list[str] = Field(default_factory=list)
    budget_indicatif: Optional[str] = None
    contraintes: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 2. Décision de l'orchestrateur — sortie structurée forcée du LLM
# ---------------------------------------------------------------------------

# Type union des domaines d'agents acceptés. Le LLM ne peut pas inventer un domaine.
DomaineAgent = Literal["marketing", "vente", "admin_finance", "support", "autre"]

# Catalogue fermé des outils réellement disponibles côté code.
# Toute valeur hors de cet ensemble est silencieusement retirée par le validator ci-dessous.
# Ajouter un nouvel outil ici ET dans tools/registry.py pour l'activer.
OUTILS_DISPONIBLES = {
    "recherche_web",
    "redaction_contenu",
    "publication_reseaux_sociaux",
    "recherche_crm",
    "generation_devis",
    "generation_facture",
    "suivi_paiement",
    "envoi_email",
    "planification_calendrier",
    "analyse_donnees_ventes",
    "analyse_sentiment_facebook",   # FUSION : outil d'analyse de sentiment (registry.py)
}


class AgentSpec(BaseModel):
    """
    Spécification d'un agent telle que décidée par le LLM orchestrateur.
    Sert de blueprint pour créer l'Agent CrewAI correspondant dans la factory.
    """
    nom: str = Field(description="Nom court et descriptif, ex: 'Gestionnaire Réseaux Sociaux'")
    role: str = Field(description="Rôle CrewAI en une phrase")
    objectif: str = Field(description="Goal CrewAI : ce que l'agent doit accomplir")
    backstory: str = Field(description="Contexte/personnalité de l'agent pour son prompt système")
    domaine: DomaineAgent
    outils_requis: list[str] = Field(default_factory=list)
    priorite: int = Field(default=1, ge=1, le=5, description="1 = critique (exécuté en premier), 5 = optionnel")

    # Champs de gestion (non générés par le LLM — toujours leurs valeurs par défaut à la création)
    source: Literal["auto", "manuel"] = Field(default="auto", description="Origine de l'agent")
    actif: bool = Field(default=True, description="Agent inclus dans la prochaine exécution")
    outils_en_attente: list[str] = Field(
        default_factory=list,
        description="Descriptions d'outils non encore connectés — stockés comme intentions, jamais passés à CrewAI",
    )

    @field_validator("outils_requis")
    @classmethod
    def filtrer_outils_inconnus(cls, v: list[str]) -> list[str]:
        """
        Garde uniquement les outils présents dans OUTILS_DISPONIBLES.
        On préfère un agent sans outil à un crash : si le LLM invente un nom,
        l'outil est ignoré et la validation du plan n'échoue pas pour autant.
        L'absence sera détectée plus haut si elle est critique.
        """
        return [o for o in v if o in OUTILS_DISPONIBLES]


class PlanAgents(BaseModel):
    """
    Sortie complète du nœud analyse_besoin.
    Contient la liste de tous les agents à instancier et le mode d'exécution.
    """
    agents: list[AgentSpec] = Field(min_length=1, max_length=8)
    justification: str = Field(description="Explication du choix des agents par le LLM")
    # sequential : agents exécutés l'un après l'autre (résultat du précédent = contexte du suivant)
    # hierarchical : un agent manager coordonne les autres (nécessite manager_llm dans CrewAI)
    process_type: Literal["sequential", "hierarchical"] = "sequential"

    @field_validator("agents")
    @classmethod
    def verifier_unicite_noms(cls, v: list[AgentSpec]) -> list[AgentSpec]:
        """Deux agents avec le même nom créeraient une ambiguïté dans CrewAI."""
        noms = [a.nom for a in v]
        if len(noms) != len(set(noms)):
            raise ValueError("Deux agents ne peuvent pas porter le même nom")
        return v


# ---------------------------------------------------------------------------
# 3. Résultats d'exécution de la Crew CrewAI
# ---------------------------------------------------------------------------

class ResultatAgent(BaseModel):
    nom_agent: str
    statut: Literal["succes", "echec", "partiel"]
    livrable: str         # texte produit par l'agent (plan, post, devis...)
    erreurs: Optional[str] = None


class ResultatCrew(BaseModel):
    resultats: list[ResultatAgent]
    duree_secondes: float


# ---------------------------------------------------------------------------
# 4. État partagé du graphe LangGraph
# ---------------------------------------------------------------------------

class AgentState(BaseModel):
    """
    L'objet central du système : il entre dans le graphe au début et
    en ressort à la fin, enrichi par chaque nœud au passage.

    LangGraph le sérialise/désérialise automatiquement depuis SQLite
    entre chaque nœud quand un checkpointer est configuré.

    Pourquoi BaseModel et non TypedDict ?
    → Validation automatique à chaque mutation, prix en performance négligeable ici.
    """

    # --- Entrée ---
    profil_pme: ProfilPME                           # fourni par l'utilisateur via l'API
    agents_existants: list[AgentSpec] = Field(default_factory=list)  # agents manuels/édités à préserver

    # --- Décision de l'orchestrateur ---
    plan_agents: Optional[PlanAgents] = None        # produit par analyse_besoin_node
    validation_errors: list[str] = Field(default_factory=list)
    retry_count: int = 0                            # nombre de tentatives de re-génération
    max_retries: int = 3                            # seuil avant abandon

    # --- Résultats CrewAI ---
    resultat_crew: Optional[ResultatCrew] = None    # produit par instanciation_et_dispatch_node

    # --- Sortie finale ---
    synthese: Optional[str] = None                  # résumé produit par synthese_node
    nouvelle_demande: bool = False                  # si True → reboucle sur analyse_besoin
    demande_utilisateur_suivante: Optional[str] = None

    class Config:
        # Nécessaire car AgentState contient des types Pydantic imbriqués
        arbitrary_types_allowed = True
