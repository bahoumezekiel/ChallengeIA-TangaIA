"""
factory.py — Crew Factory : transforme la décision du LLM en agents CrewAI réels.

C'est le pont entre LangGraph (décision) et CrewAI (exécution).
Entrée  : PlanAgents (liste d'AgentSpec validés par Pydantic)
Sortie  : Crew CrewAI prête à être lancée via kickoff()

Principe : aucun agent n'est codé en dur. Tout vient de la décision du LLM.
"""

from crewai import Agent, Task, Crew, Process

from models.schemas import AgentSpec, PlanAgents, ProfilPME
from tools.registry import get_tools


def build_agent(
    spec: AgentSpec,
    credentials: dict[str, dict] | None = None,
    llm_model: str = "gpt-4o-mini",
) -> Agent:
    """
    Instancie un Agent CrewAI à partir d'une spécification validée.

    credentials : transmis à get_tools() pour injecter les clés API dans chaque outil.
                  Sans credentials → les outils fonctionnent en mode simulation.
    """
    outils = get_tools(spec.outils_requis, credentials=credentials)

    return Agent(
        role=spec.role,
        goal=spec.objectif,
        backstory=spec.backstory,
        tools=outils,
        llm=llm_model,
        verbose=True,
        allow_delegation=False,
        max_iter=8,
    )


def build_task(
    spec: AgentSpec,
    agent: Agent,
    profil_pme: ProfilPME,
    credentials: dict[str, dict] | None = None,
) -> Task:
    """
    Construit la Task CrewAI associée à un agent avec un contexte PME complet.

    Le contexte injecté dans la description comprend :
    - Identité de la PME (nom, secteur, taille, cible)
    - Tous les objectifs (court et long terme)
    - Budget disponible et contraintes
    - Informations de connexion aux outils (page Facebook, email d'envoi...)
      pour que l'agent sache CONCRÈTEMENT où agir

    Cela permet à l'agent d'être autonome sans avoir à deviner le contexte.
    """
    credentials = credentials or {}

    # --- Contexte PME complet ---
    objectifs_ct = "\n".join(f"  - {o}" for o in profil_pme.objectifs_court_terme) or "  - Non précisé"
    objectifs_lt = "\n".join(f"  - {o}" for o in profil_pme.objectifs_long_terme) or "  - Non précisé"
    contraintes = "\n".join(f"  - {c}" for c in profil_pme.contraintes) or "  - Aucune contrainte particulière"
    services = ", ".join(profil_pme.services_souhaites) or "non précisé"
    budget_label = {
        "faible": "économique (outils gratuits prioritaires, actions à coût nul)",
        "moyen": "modéré (quelques outils payants si nécessaire)",
        "eleve": "premium (meilleurs outils disponibles)",
    }.get(profil_pme.budget_indicatif or "", profil_pme.budget_indicatif or "non précisé")

    contexte_pme = f"""
CONTEXTE DE LA PME :
  Entreprise    : {profil_pme.nom_entreprise}
  Secteur       : {profil_pme.secteur}
  Effectif      : {profil_pme.taille_effectif or 'Non précisé'} employés
  Cible client  : {profil_pme.cible_clientele}
  Budget        : {budget_label}
  Services voulus : {services}

  Objectifs COURT TERME (priorité maximale) :
{objectifs_ct}

  Objectifs LONG TERME :
{objectifs_lt}

  Contraintes à respecter :
{contraintes}"""

    # --- Contexte des outils disponibles avec leurs accès réels ---
    outils_context_lines = []
    for outil in spec.outils_requis:
        creds = credentials.get(outil, {})
        if outil == "publication_reseaux_sociaux":
            if creds.get("page_id") and creds.get("access_token"):
                page = creds.get("page_name") or creds.get("page_id")
                outils_context_lines.append(
                    f"  - Facebook : page '{page}' (ID: {creds['page_id']}) — "
                    "accès configuré, tu PEUX publier du contenu réel"
                )
            else:
                outils_context_lines.append(
                    "  - Facebook : accès non configuré → prépare le contenu des posts "
                    "pour publication manuelle ultérieure"
                )
        elif outil == "envoi_email":
            if creds.get("smtp_user"):
                from_name = creds.get("smtp_from_name", "")
                expediteur = f"{from_name} <{creds['smtp_user']}>" if from_name else creds['smtp_user']
                outils_context_lines.append(
                    f"  - Email SMTP configuré — expéditeur : {expediteur}\n"
                    "    • Envoie aux clients en appelant envoi_email(destinataire, sujet, corps)\n"
                    "    • Supporte plusieurs destinataires séparés par des virgules\n"
                    f"    • Pour envoyer un résumé au propriétaire : destinataire='{creds['smtp_user']}'"
                )
            else:
                outils_context_lines.append(
                    "  - Email : non configuré → rédige les emails et donne les instructions d'envoi"
                )
        elif outil == "recherche_crm":
            if creds.get("api_key"):
                outils_context_lines.append(
                    f"  - CRM ({creds.get('base_url', 'HubSpot')}) : accès configuré — "
                    "tu PEUX rechercher des contacts réels"
                )
            else:
                outils_context_lines.append("  - CRM : non configuré → propose une stratégie de prospection")
        elif outil == "recherche_web":
            if creds.get("api_key"):
                outils_context_lines.append("  - Recherche web : clé Serper.dev configurée")
            else:
                outils_context_lines.append("  - Recherche web : mode simulation (résultats génériques)")
        elif outil == "redaction_contenu":
            outils_context_lines.append("  - Rédaction contenu : disponible (LLM intégré)")
        elif outil == "analyse_donnees_ventes":
            if creds.get("source_url"):
                outils_context_lines.append(
                    f"  - Source de données connectée : {creds['source_url']}\n"
                    "    • Appelle analyse_donnees_ventes(periode='...', metrique='contacts') "
                    "pour extraire la liste des clients avec leurs emails\n"
                    "    • Appelle avec metrique='ventes' pour l'analyse commerciale"
                )
            else:
                outils_context_lines.append("  - Données ventes/contacts : mode simulation")
        elif outil in ("generation_devis", "generation_facture", "suivi_paiement"):
            if creds.get("api_key"):
                outils_context_lines.append(f"  - Facturation ({outil}) : API configurée")
            else:
                outils_context_lines.append(f"  - Facturation ({outil}) : mode simulation")
        elif outil == "planification_calendrier":
            if creds.get("api_key"):
                outils_context_lines.append("  - Calendrier : API configurée")
            else:
                outils_context_lines.append("  - Calendrier : mode simulation")

    outils_section = ""
    if outils_context_lines:
        outils_section = "\n\nOUTILS DONT TU DISPOSES :\n" + "\n".join(outils_context_lines)

    # --- Instructions spécifiques par domaine ---
    instructions_domaine = _instructions_par_domaine(spec.domaine, profil_pme)

    description = (
        f"En tant que {spec.role}, ta mission pour {profil_pme.nom_entreprise} :\n"
        f"{spec.objectif}\n"
        f"{contexte_pme}"
        f"{outils_section}\n\n"
        f"{instructions_domaine}\n\n"
        "IMPORTANT : Utilise tes outils pour réaliser des actions concrètes (pas uniquement des plans). "
        "Si un outil est configuré avec de vrais accès, effectue l'action réelle. "
        "Adapte toujours ton travail au contexte africain et aux contraintes de la PME."
    )

    # Expected output varie selon le domaine
    expected_outputs = {
        "marketing": (
            "Un plan de contenu détaillé avec au moins 3 posts prêts à publier "
            "(texte complet + hashtags), une stratégie réseaux sociaux sur 30 jours, "
            "et la confirmation des publications effectuées si l'outil est configuré."
        ),
        "vente": (
            "Une liste de prospects qualifiés, un script de prospection personnalisé, "
            "et un plan d'action commercial sur 30 jours avec des étapes concrètes."
        ),
        "admin_finance": (
            "Un rapport financier synthétique, des devis ou factures générés si nécessaire, "
            "et des recommandations d'optimisation adaptées au budget de la PME."
        ),
        "support": (
            "Des procédures de support client, des réponses types aux questions fréquentes, "
            "et un plan d'amélioration de l'expérience client."
        ),
        "autre": (
            "Un livrable concret et exploitable immédiatement par l'équipe de la PME."
        ),
    }

    return Task(
        description=description,
        agent=agent,
        expected_output=expected_outputs.get(spec.domaine, expected_outputs["autre"]),
    )


def _instructions_par_domaine(domaine: str, profil_pme: ProfilPME) -> str:
    """Retourne des instructions spécifiques au domaine de l'agent."""
    cible = profil_pme.cible_clientele
    nom = profil_pme.nom_entreprise
    budget = profil_pme.budget_indicatif or "moyen"

    if domaine == "marketing":
        return (
            f"INSTRUCTIONS MARKETING pour {nom} :\n"
            f"  • Cible : {cible}\n"
            "  • Crée du contenu authentique qui reflète l'identité africaine de la marque\n"
            "  • Adapte le ton : chaleureux, professionnel et proche de la communauté\n"
            "  • Pour les posts Facebook : inclus toujours un appel à l'action clair\n"
            "  • Privilégie les contenus qui engagent (questions, stories, témoignages)\n"
            f"  • Budget {'limité → évite les outils payants' if budget == 'faible' else 'disponible → utilise les meilleurs outils'}\n\n"
            "WORKFLOW EMAIL MARKETING (si tu as envoi_email ET une source de données) :\n"
            "  ÉTAPE 1 — Appelle analyse_donnees_ventes(periode='contacts actuels', metrique='contacts')\n"
            "            → tu obtiens la liste des clients avec leurs emails\n"
            "  ÉTAPE 2 — Pour chaque client (ou par batch), appelle envoi_email() avec :\n"
            "            • un message personnalisé (inclus le prénom/nom du client dans le corps)\n"
            "            • un sujet accrocheur adapté à la PME et à sa cible\n"
            "            • un appel à l'action clair en fin d'email\n"
            "  ÉTAPE 3 — Envoie un RÉSUMÉ au propriétaire : envoi_email(destinataire=<smtp_user>,\n"
            "            sujet='Rapport campagne email', corps=<nombre envoyés, taux succès, liste>)\n"
            "  RÈGLE : personnalise chaque email — jamais un message générique identique pour tous."
        )
    elif domaine == "vente":
        return (
            f"INSTRUCTIONS VENTES pour {nom} :\n"
            f"  • Profil client cible : {cible}\n"
            "  • Concentre-toi sur les leads les plus qualifiés (chauds en priorité)\n"
            "  • Personnalise chaque approche selon le contexte du prospect\n"
            "  • Propose des offres adaptées au pouvoir d'achat local\n"
            "  • Utilise le CRM pour tracker tous les contacts"
        )
    elif domaine == "admin_finance":
        return (
            f"INSTRUCTIONS ADMIN/FINANCE pour {nom} :\n"
            "  • Priorité : visibilité financière claire pour la direction\n"
            "  • Génère des devis professionnels et des factures conformes\n"
            "  • Identifie les paiements en retard et propose des relances\n"
            f"  • Budget {'faible → optimise les coûts avant tout' if budget == 'faible' else 'disponible → recommande les meilleurs outils'}"
        )
    elif domaine == "support":
        return (
            f"INSTRUCTIONS SUPPORT pour {nom} :\n"
            f"  • Clients : {cible}\n"
            "  • Traite les demandes avec empathie et efficacité\n"
            "  • Crée des FAQ adaptées aux questions courantes du secteur\n"
            "  • Propose des solutions de fidélisation adaptées au marché africain"
        )
    return ""


def build_crew(
    plan: PlanAgents,
    profil_pme: ProfilPME,
    credentials: dict[str, dict] | None = None,
) -> Crew:
    """
    Construit la Crew complète : un agent + une task par AgentSpec du plan.

    Ordre d'exécution : trié par priorité (1 = critique, exécuté en premier).
    Les credentials sont transmis à chaque agent ET à chaque task pour que
    les agents sachent quels outils sont réellement disponibles.
    """
    agents: list[Agent] = []
    tasks: list[Task] = []

    plan_trie = sorted(plan.agents, key=lambda a: a.priorite)

    for spec in plan_trie:
        agent = build_agent(spec, credentials=credentials)
        task = build_task(spec, agent, profil_pme, credentials=credentials)
        agents.append(agent)
        tasks.append(task)

    process = (
        Process.hierarchical if plan.process_type == "hierarchical"
        else Process.sequential
    )

    crew_kwargs = dict(agents=agents, tasks=tasks, process=process, verbose=True)

    if process == Process.hierarchical:
        crew_kwargs["manager_llm"] = "gpt-4o"

    return Crew(**crew_kwargs)
