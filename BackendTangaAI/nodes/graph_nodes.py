"""
graph_nodes.py — Logique métier de chaque nœud du graphe LangGraph.

Chaque fonction correspond à un nœud du graphe défini dans orchestrator_graph.py.
Convention : reçoit AgentState, retourne AgentState modifié (pas de mutation globale).

Les nœuds qui ont besoin du thread_id (session) déclarent un second paramètre
`config: RunnableConfig` — LangGraph l'injecte automatiquement.
"""

import time
import logging

from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.types import interrupt

from models.schemas import (
    AgentState,
    PlanAgents,
    ResultatCrew,
    ResultatAgent,
)
from crew_factory.factory import build_crew
from memory.credentials import get_missing_credentials, get_all_credentials
from memory.history import save_run  # FUSION : persistance de l'historique des runs

logger = logging.getLogger("orchestrator")

# LLM fort pour la décision d'orchestration (temperature=0 → déterministe)
# Distinct des LLM utilisés par les agents CrewAI pour maîtriser les coûts.
ORCHESTRATOR_LLM = ChatOpenAI(model="gpt-4o", temperature=0)


# ---------------------------------------------------------------------------
# Nœud 1 : analyse_besoin
# Rôle : le LLM lit le profil PME et décide librement quels agents créer.
#         Sa sortie est forcée dans le schéma PlanAgents (structured output)
#         ce qui garantit que le code peut exploiter la décision sans parsing fragile.
# ---------------------------------------------------------------------------

PROMPT_SYSTEME_ANALYSE = """Tu es l'orchestrateur d'un système multi-agents IA qui aide \
les PME africaines à développer leur activité (marketing, vente, administration/finance, support).

À partir du profil PME fourni, décide quelle équipe d'agents spécialisés créer.

━━━ RÈGLES OBLIGATOIRES ━━━
- Maximum {slots_restants} nouveaux agents (limite globale : 8 agents actifs au total).
- Chaque agent a un rôle précis, non redondant.
- N'utilise QUE des outils de cette liste : {outils_disponibles}
- Si aucun outil ne correspond, laisse outils_requis vide plutôt qu'inventer.
- process_type="hierarchical" uniquement si > 3 agents collaborent sur un objectif commun.

━━━ CONTEXTE PME À PRENDRE EN COMPTE ━━━
Budget : {budget}
Contraintes : {contraintes}
{existing_agents_section}
━━━ QUALITÉ DES BACKSTORY ET OBJECTIFS ━━━
Le backstory et l'objectif de chaque agent DOIVENT être spécifiques à CETTE entreprise :
- Inclure le nom de l'entreprise et son secteur dans le backstory
- L'objectif doit être ACTIONNABLE avec des résultats mesurables
- Exemples d'objectifs bien formulés :
  * Marketing : "Créer et publier 3 posts par semaine sur la page Facebook de [entreprise], \
ciblant [cible], avec un contenu authentique mettant en valeur les produits du terroir africain"
  * Vente : "Identifier 20 prospects parmi les restaurateurs et épiceries fines, \
personnaliser l'approche commerciale et initier le premier contact"
  * Finance : "Analyser les ventes du dernier trimestre, identifier les 3 produits les plus rentables \
et établir un plan de trésorerie sur 90 jours"

━━━ OUTILS ET CE QU'ILS PERMETTENT ━━━
- publication_reseaux_sociaux : poster du contenu RÉEL sur la page Facebook/Instagram de la PME \
  (nécessite page_id + token → le système demandera ces accès à l'utilisateur)
- redaction_contenu : rédiger textes et contenus marketing (jamais de credentials requis)
- envoi_email : envoyer des emails via SMTP (newsletters, prospection, confirmations)
- recherche_crm : chercher contacts et prospects dans le CRM connecté
- recherche_web : rechercher des infos actuelles (marchés, concurrents, tendances)
- generation_devis / generation_facture / suivi_paiement : gestion commerciale et financière
- planification_calendrier : planifier événements et campagnes
- analyse_donnees_ventes : lire une liste de contacts/clients depuis un Google Sheet ou CSV \
  (nécessite source_url → le système demandera ce lien à l'utilisateur)

━━━ RÈGLE DE COUPLAGE OBLIGATOIRE ━━━
Si un agent doit envoyer des emails à des clients/contacts issus d'une source de données \
(Google Sheet, CRM, fichier CSV...), il DOIT avoir les DEUX outils dans son outils_requis :
  • analyse_donnees_ventes  → pour lire la liste des contacts avec leurs emails
  • envoi_email             → pour envoyer les messages
Ces deux outils forment un binôme inséparable. Ne les sépare jamais dans deux agents différents.

━━━ IMPORTANT ━━━
Les agents qui utilisent publication_reseaux_sociaux, envoi_email ou analyse_donnees_ventes \
devront avoir accès aux credentials de l'utilisateur. Le système les demandera automatiquement. \
Assigne ces outils aux agents dont la mission l'exige réellement.

Erreurs précédentes à corriger : {erreurs_precedentes}
"""

_LIMIT_AGENTS = 8


def analyse_besoin_node(state: AgentState) -> AgentState:
    """
    Appelle GPT-4o avec structured output pour produire un PlanAgents.
    Tient compte des agents manuels/édités déjà configurés (state.agents_existants) :
    le LLM ne propose que les agents nécessaires pour compléter l'équipe.
    En cas d'échec (LLM dérape, timeout...), on stocke l'erreur dans
    validation_errors pour que le routeur puisse déclencher un retry.
    """
    from models.schemas import OUTILS_DISPONIBLES

    existing_actifs = [a for a in state.agents_existants if a.actif]
    slots_restants = _LIMIT_AGENTS - len(existing_actifs)

    # Tous les slots sont pris par des agents existants → plan direct sans LLM
    if slots_restants <= 0:
        state.plan_agents = PlanAgents(
            agents=existing_actifs[:_LIMIT_AGENTS],
            justification="Plan composé entièrement d'agents existants (quota atteint).",
            process_type="sequential",
        )
        state.validation_errors = []
        logger.info(f"Plan pré-rempli : {len(existing_actifs)} agents existants, pas d'appel LLM")
        return state

    # Chaîne LLM + parser Pydantic : si le LLM ne respecte pas le schéma → exception
    llm_structure = ORCHESTRATOR_LLM.with_structured_output(PlanAgents)

    erreurs_precedentes = (
        "; ".join(state.validation_errors) if state.validation_errors else "aucune"
    )

    # Section agents existants dans le prompt
    if existing_actifs:
        liste = "\n".join(
            f"  • {a.nom} ({a.domaine}) : {a.role}" for a in existing_actifs
        )
        existing_section = (
            "\n━━━ AGENTS DÉJÀ CONFIGURÉS (NE PAS dupliquer ces rôles) ━━━\n"
            f"{liste}\n"
            "Propose UNIQUEMENT des agents couvrant des besoins non encore satisfaits.\n"
        )
    else:
        existing_section = ""

    prompt = PROMPT_SYSTEME_ANALYSE.format(
        outils_disponibles=", ".join(sorted(OUTILS_DISPONIBLES)),
        erreurs_precedentes=erreurs_precedentes,
        budget=state.profil_pme.budget_indicatif or "non précisé",
        contraintes=", ".join(state.profil_pme.contraintes) if state.profil_pme.contraintes else "aucune",
        slots_restants=slots_restants,
        existing_agents_section=existing_section,
    )

    message_utilisateur = f"Profil PME :\n{state.profil_pme.model_dump_json(indent=2)}"

    try:
        plan: PlanAgents = llm_structure.invoke([
            {"role": "system", "content": prompt},
            {"role": "user",   "content": message_utilisateur},
        ])

        # Déduplique : retire du plan LLM tout agent dont le nom existe déjà
        noms_existants = {a.nom for a in existing_actifs}
        nouveaux = [a for a in plan.agents if a.nom not in noms_existants]

        # Combine existants + nouveaux, cap à 8
        plan.agents = (existing_actifs + nouveaux)[:_LIMIT_AGENTS]

        state.plan_agents = plan
        state.validation_errors = []
        logger.info(
            f"Plan généré : {len(existing_actifs)} existants + {len(nouveaux)} nouveaux "
            f"= {len(plan.agents)} agents total"
        )
    except Exception as exc:
        # On ne crash pas : on stocke l'erreur et on laisse le routeur gérer le retry
        state.validation_errors = [f"Échec de génération du plan : {exc}"]
        state.plan_agents = None

    return state


# ---------------------------------------------------------------------------
# Nœud 2 : validation_schema
# Rôle : vérifier les règles métier que Pydantic ne peut pas exprimer seul.
#         (Pydantic valide les types et les contraintes de champ ;
#          ce nœud valide la cohérence sémantique entre les champs.)
# ---------------------------------------------------------------------------

def validation_schema_node(state: AgentState) -> AgentState:
    """
    Valide le plan produit par le LLM :
    - Avertissement non-bloquant : agent marketing sans outil de contenu
    - Erreur bloquante : objectif vide (l'agent ne saurait pas quoi faire)

    Les erreurs bloquantes déclenchent un retry via route_apres_validation().
    """
    if state.plan_agents is None:
        state.validation_errors.append("Aucun plan n'a été généré.")
        return state

    erreurs = []

    for agent_spec in state.plan_agents.agents:
        # Avertissement : un agent marketing sans outil de rédaction est sous-optimal
        # mais pas bloquant (il peut encore faire d'autres tâches)
        if agent_spec.domaine == "marketing" and "redaction_contenu" not in agent_spec.outils_requis:
            logger.warning(f"Agent marketing '{agent_spec.nom}' sans outil de rédaction.")

        # Erreur bloquante : un objectif vide rendrait la task CrewAI inutilisable
        if not agent_spec.objectif.strip():
            erreurs.append(f"L'agent '{agent_spec.nom}' a un objectif vide.")

    state.validation_errors = erreurs
    if erreurs:
        state.retry_count += 1   # comptabilisé pour le seuil d'abandon

    return state


# ---------------------------------------------------------------------------
# Nœud 3 : verification_credentials
# Rôle : vérifier que tous les outils requis ont leurs credentials en base.
#         Si non → interrupt() : pause le graphe et notifie l'utilisateur.
#         Le graphe reprend dès que l'utilisateur appelle POST /session/{id}/resume.
#
# Mécanisme interrupt() :
#   - LangGraph sauvegarde l'état courant dans le checkpointer (SQLite)
#   - Lève GraphInterrupt côté appelant (l'API FastAPI)
#   - À la reprise (Command(resume=...)), ce nœud RE-S'EXÉCUTE depuis le début
#     → il re-vérifie les credentials (d'où le pattern "check → interrupt → check again")
# ---------------------------------------------------------------------------

def verification_credentials_node(state: AgentState, config: RunnableConfig) -> AgentState:
    if state.plan_agents is None:
        return state

    # thread_id = identifiant unique de session (slug du nom de l'entreprise)
    session_id = config.get("configurable", {}).get("thread_id", "default")

    # ── Auto-couplage envoi_email ↔ analyse_donnees_ventes ──────────────────
    # Le LLM oublie parfois d'ajouter analyse_donnees_ventes aux agents email.
    # On corrige ici systématiquement : tout agent avec envoi_email obtient aussi
    # analyse_donnees_ventes pour pouvoir lire ses contacts depuis une source réelle.
    agents_enrichis = []
    plan_modifie = False
    for agent in state.plan_agents.agents:
        if ("envoi_email" in agent.outils_requis
                and "analyse_donnees_ventes" not in agent.outils_requis):
            agent = agent.model_copy(update={
                "outils_requis": list(agent.outils_requis) + ["analyse_donnees_ventes"]
            })
            plan_modifie = True
            logger.info(f"[{session_id}] Auto-ajout : analyse_donnees_ventes → agent '{agent.nom}'")
        agents_enrichis.append(agent)

    if plan_modifie:
        state.plan_agents = state.plan_agents.model_copy(update={"agents": agents_enrichis})

    # Collecte tous les outils nécessaires (dédupliqués) parmi tous les agents du plan
    outils_requis = list(dict.fromkeys(
        outil
        for agent in state.plan_agents.agents
        for outil in agent.outils_requis
    ))

    # Vérifie en base SQLite lesquels n'ont pas encore leurs credentials
    manquants = get_missing_credentials(session_id, outils_requis)

    if manquants:
        logger.info(f"[{session_id}] Credentials manquants : {list(manquants.keys())} → pause")

        # Le payload est embarqué dans l'interrupt pour que l'API puisse afficher
        # les agents créés SANS avoir à relire le checkpointer (plus fiable).
        agents_info = [
            {
                "nom":          a.nom,
                "role":         a.role,
                "domaine":      a.domaine,
                "objectif":     a.objectif,
                "outils_requis":a.outils_requis,
                "priorite":     a.priorite,
            }
            for a in sorted(state.plan_agents.agents, key=lambda x: x.priorite)
        ]

        # interrupt() pause le graphe ici. La valeur passée est ce que l'API reçoit
        # dans GraphInterrupt.args[0][0].value
        interrupt({
            "type": "credentials_required",
            "message": (
                "Vos agents sont prêts ! Pour qu'ils puissent agir de manière autonome, "
                "veuillez renseigner les informations de connexion suivantes."
            ),
            "session_id": session_id,
            "plan": {
                "nb_agents":    len(state.plan_agents.agents),
                "process_type": state.plan_agents.process_type,
                "agents":       agents_info,
            },
            "outils_manquants": manquants,
        })
        # ↑ Quand le graphe reprend, l'exécution repart du DÉBUT de ce nœud.
        # La boucle while implicite est : re-vérifier → si encore manquant → interrupt à nouveau.

    logger.info(f"[{session_id}] Tous les credentials présents → lancement de la crew")
    return state


# ---------------------------------------------------------------------------
# Nœud 4 : instanciation_et_dispatch
# Rôle : construire la Crew CrewAI à partir du plan validé et l'exécuter.
#         Les credentials sont injectés ici dans chaque outil.
#
# Note : crew.kickoff() est synchrone et potentiellement long (minutes).
#        En production, ce nœud tourne dans un ThreadPoolExecutor (voir api/main.py).
# ---------------------------------------------------------------------------

def instanciation_et_dispatch_node(state: AgentState, config: RunnableConfig) -> AgentState:
    if state.plan_agents is None:
        # Cas défensif : ne devrait pas arriver si le graphe est bien câblé
        state.resultat_crew = ResultatCrew(resultats=[], duree_secondes=0.0)
        return state

    session_id = config.get("configurable", {}).get("thread_id", "default")

    # Récupère tous les credentials stockés pour cette session
    # → chaque outil recevra ses propres credentials lors de l'instanciation
    credentials = get_all_credentials(session_id)

    debut = time.time()
    crew = build_crew(state.plan_agents, state.profil_pme, credentials=credentials)

    # Les agents sont triés par priorité dans build_crew() → même ordre dans tasks_output
    plan_trie = sorted(state.plan_agents.agents, key=lambda a: a.priorite)

    try:
        sortie_brute = crew.kickoff()

        # CrewAI ≥0.80 expose tasks_output : liste de TaskOutput dans l'ordre d'exécution.
        # Chaque TaskOutput.raw contient la sortie textuelle de la task correspondante.
        tasks_output = getattr(sortie_brute, "tasks_output", None)

        if tasks_output and len(tasks_output) == len(plan_trie):
            resultats = []
            for spec, task_out in zip(plan_trie, tasks_output):
                livrable = getattr(task_out, "raw", None) or str(task_out)
                resultats.append(
                    ResultatAgent(nom_agent=spec.nom, statut="succes", livrable=livrable)
                )
        else:
            # Fallback : sortie_brute est le résultat de la dernière task (mode séquentiel).
            # On l'attribue au dernier agent et "succès partiel" aux autres.
            dernier = plan_trie[-1] if plan_trie else None
            resultats = []
            for spec in plan_trie:
                if spec == dernier:
                    resultats.append(
                        ResultatAgent(nom_agent=spec.nom, statut="succes", livrable=str(sortie_brute))
                    )
                else:
                    resultats.append(
                        ResultatAgent(
                            nom_agent=spec.nom,
                            statut="partiel",
                            livrable="Exécuté dans la séquence (output consolidé dans la synthèse finale).",
                        )
                    )

    except Exception as exc:
        logger.exception("Échec d'exécution de la crew")
        resultats = [
            ResultatAgent(nom_agent=spec.nom, statut="echec", livrable="", erreurs=str(exc))
            for spec in plan_trie
        ]

    state.resultat_crew = ResultatCrew(
        resultats=resultats,
        duree_secondes=round(time.time() - debut, 2),
    )
    return state


# ---------------------------------------------------------------------------
# Nœud 5 : synthese
# Rôle : agréger les résultats bruts des agents en une réponse lisible
#         pour un dirigeant de PME (sans jargon technique, en français).
#         Utilise GPT-4o-mini (plus léger) car c'est une tâche de reformulation.
# ---------------------------------------------------------------------------

SYNTHESE_LLM = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)


def synthese_node(state: AgentState) -> AgentState:
    if state.resultat_crew is None or not state.resultat_crew.resultats:
        state.synthese = "Aucun résultat n'a pu être généré."
        return state

    # Résumé compact des livrables (300 chars max par agent pour rester dans le contexte)
    resume_resultats = "\n".join(
        f"- {r.nom_agent} [{r.statut}] : {r.livrable[:300]}"
        for r in state.resultat_crew.resultats
    )

    reponse = SYNTHESE_LLM.invoke([
        {
            "role": "system",
            "content": (
                "Résume les résultats suivants de manière claire et actionnable "
                "pour un dirigeant de PME, en français, sans jargon technique."
            ),
        },
        {"role": "user", "content": resume_resultats},
    ])

    state.synthese = reponse.content
    return state


# ---------------------------------------------------------------------------
# Nœud 6 : notification
# Rôle : pousser la synthèse finale vers le canal de sortie.
#         Actuellement : simple log. À brancher sur WebSocket/SSE/push mobile.
# ---------------------------------------------------------------------------

def notification_node(state: AgentState, config: RunnableConfig) -> AgentState:
    logger.info(f"[NOTIFICATION] {state.synthese}")

    # FUSION : enregistre le run terminé dans l'historique (synthèse + résultats présents)
    if state.synthese and state.resultat_crew and state.resultat_crew.resultats:
        session_id = config.get("configurable", {}).get("thread_id", "default")
        resultats = [
            {
                "nom_agent": r.nom_agent,
                "statut": r.statut,
                "livrable": r.livrable,
                "erreurs": r.erreurs,
            }
            for r in state.resultat_crew.resultats
        ]
        try:
            save_run(
                session_id=session_id,
                nom_entreprise=state.profil_pme.nom_entreprise,
                secteur=state.profil_pme.secteur,
                nb_agents=len(state.plan_agents.agents) if state.plan_agents else 0,
                process_type=state.plan_agents.process_type if state.plan_agents else "unknown",
                synthese=state.synthese,
                resultats=resultats,
                duree_secondes=state.resultat_crew.duree_secondes,
            )
            logger.info(f"[{session_id}] Run enregistré dans l'historique.")
        except Exception as exc:
            # L'historique ne doit jamais faire échouer le flux principal
            logger.warning(f"Échec d'enregistrement de l'historique : {exc}")

    return state
