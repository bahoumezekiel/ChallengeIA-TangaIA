"""
orchestrator_graph.py — Construction et compilation du graphe LangGraph.

Ce fichier est le point d'entrée du système. Il assemble les nœuds en un graphe
d'état dirigé (StateGraph) et définit les transitions entre eux.

Principe clé : LangGraph maintient un état partagé (AgentState) qui transite
de nœud en nœud. Chaque nœud peut le lire et le modifier.
"""

import logging
from typing import Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver

from models.schemas import AgentState
from nodes.graph_nodes import (
    analyse_besoin_node,
    validation_schema_node,
    verification_credentials_node,
    instanciation_et_dispatch_node,
    synthese_node,
    notification_node,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orchestrator")


# ---------------------------------------------------------------------------
# Fonctions de routage conditionnel
# Ces fonctions lisent l'état et retournent une clé string qui détermine
# quel nœud sera exécuté ensuite. Elles ne modifient jamais l'état.
# ---------------------------------------------------------------------------

def route_apres_validation(state: AgentState) -> str:
    """
    Décide la suite après la validation du plan :
    - "ok"      → le plan est valide, on passe à la vérification des credentials
    - "retry"   → erreurs détectées mais il reste des tentatives → on réanalyse
    - "abandon" → trop de tentatives échouées → fin du graphe sans résultat
    """
    if not state.validation_errors:
        return "ok"

    if state.retry_count >= state.max_retries:
        logger.error("Nombre maximal de tentatives atteint, abandon du plan.")
        return "abandon"

    return "retry"


def route_apres_notification(state: AgentState) -> str:
    """
    Décide si on relance un cycle complet (nouvelle demande utilisateur)
    ou si on termine. Permet les conversations multi-tours sans relancer l'API.
    """
    return "boucle" if state.nouvelle_demande else "fin"


# ---------------------------------------------------------------------------
# Construction du graphe
# ---------------------------------------------------------------------------

def build_orchestrator_graph(checkpointer: Optional[BaseCheckpointSaver] = None):
    """
    Construit et compile le graphe LangGraph complet.

    checkpointer : si fourni (SqliteSaver en prod), chaque état est persisté
                   en base après chaque nœud. Cela permet :
                   - de reprendre une session interrompue (interrupt/resume)
                   - de survivre à un redémarrage du serveur
                   Si None : exécution en mémoire pure (tests, scripts locaux).
    """
    graph = StateGraph(AgentState)

    # --- Enregistrement des nœuds ---
    # Chaque nœud est une fonction Python qui reçoit AgentState et le retourne modifié.
    graph.add_node("analyse_besoin",           analyse_besoin_node)
    graph.add_node("validation_schema",        validation_schema_node)
    graph.add_node("verification_credentials", verification_credentials_node)
    graph.add_node("instanciation_et_dispatch",instanciation_et_dispatch_node)
    graph.add_node("synthese",                 synthese_node)
    graph.add_node("notification",             notification_node)

    # --- Définition des transitions ---

    # Point d'entrée obligatoire
    graph.set_entry_point("analyse_besoin")

    # 1 → 2 : toujours
    graph.add_edge("analyse_besoin", "validation_schema")

    # 2 → ? : conditionnel selon les erreurs de validation
    graph.add_conditional_edges(
        "validation_schema",
        route_apres_validation,
        {
            "ok":      "verification_credentials",  # plan valide → on vérifie les credentials
            "retry":   "analyse_besoin",             # plan invalide → on régénère
            "abandon": END,                          # trop d'erreurs → fin
        },
    )

    # 3 → 4 : après vérification (ou après reprise d'un interrupt), on lance la crew
    graph.add_edge("verification_credentials", "instanciation_et_dispatch")

    # 4 → 5 → 6 : exécution linéaire jusqu'à la notification
    graph.add_edge("instanciation_et_dispatch", "synthese")
    graph.add_edge("synthese", "notification")

    # 6 → ? : boucle si nouvelle demande, sinon fin
    graph.add_conditional_edges(
        "notification",
        route_apres_notification,
        {
            "boucle": "analyse_besoin",  # relancer un cycle pour la nouvelle demande
            "fin":    END,
        },
    )

    return graph.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Instance par défaut (sans persistance) — importée par les tests et scripts
# L'API FastAPI crée sa propre instance avec checkpointer via build_orchestrator_graph()
# ---------------------------------------------------------------------------
orchestrator_app = build_orchestrator_graph()


# ---------------------------------------------------------------------------
# Exécution directe en ligne de commande (test rapide sans API)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from dotenv import load_dotenv
    from models.schemas import ProfilPME

    load_dotenv()

    profil_exemple = ProfilPME(
        nom_entreprise="Atelier Karite Faso",
        secteur="cosmetique naturelle",
        taille_effectif=8,
        cible_clientele="particuliers urbains 25-45 ans, export regional",
        objectifs_court_terme=["augmenter la visibilite reseaux sociaux", "structurer le suivi des devis"],
        objectifs_long_terme=["exporter vers la sous-region CEDEAO"],
        services_souhaites=["marketing", "vente"],
        budget_indicatif="moyen",
    )

    etat_initial = AgentState(profil_pme=profil_exemple)
    resultat = orchestrator_app.invoke(etat_initial)

    print("\n=== SYNTHESE FINALE ===")
    print(resultat["synthese"] if isinstance(resultat, dict) else resultat.synthese)
