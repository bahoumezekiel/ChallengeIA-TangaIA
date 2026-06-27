"""
test_pme.py — Test complet de l'orchestrateur avec une PME exemple.
Lance avec : python test_pme.py
"""

import os
import sys

# Force UTF-8 sur toutes les sorties
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv()

if not os.getenv("OPENAI_API_KEY"):
    print("[ERREUR] OPENAI_API_KEY manquante dans .env")
    sys.exit(1)

from models.schemas import ProfilPME, AgentState
from memory.credentials import save_credentials
from memory.store import session_id_from_nom
from orchestrator_graph import build_orchestrator_graph
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphInterrupt
from langgraph.types import Command

# ---------------------------------------------------------------------------
# PME de test
# ---------------------------------------------------------------------------

PROFIL_TEST = ProfilPME(
    nom_entreprise="Saveurs du Sahel",
    secteur="agroalimentaire / transformation locale",
    taille_effectif=12,
    cible_clientele="restaurateurs et epiceries fines en zone urbaine, diaspora africaine en Europe",
    objectifs_court_terme=[
        "augmenter les commandes en ligne de 30%",
        "fideliser les clients existants par email",
        "publier du contenu regulier sur Facebook et Instagram",
    ],
    objectifs_long_terme=[
        "exporter vers la France et la Belgique",
    ],
    services_souhaites=["marketing", "vente", "admin_finance"],
    budget_indicatif="moyen",
    contraintes=["equipe non technique", "pas de budget publicite payante pour l'instant"],
)

SESSION_ID = session_id_from_nom(PROFIL_TEST.nom_entreprise)

CREDENTIALS_TEST = {
    "publication_reseaux_sociaux": {
        "page_id": "703215969538043",          # ID numérique de la page Facebook (test)
        "access_token": "EAAL6tj0TQZA0BRxekJRtQATZAmSAomTzq5QOnvTWIqS2I9qNDfQYpXpQB1aLHsk5rBrZBsuoGcF8OgIPXsUVp6Av580Y1XMZAdsZCkJMzm7y3zu4DyigC9ntDRj6h8SRP99KM53ZANgN4zJGTuxzvB5PJxqZCbHXyZCOM1iKmPqGPZBAVd0cY0uHyOS962odAHBL0fu3dO5ZBubNqKcztXZC4z2p5cpHCAbLwM7LKxxlxby75oZD",
        "page_name": "MOAGA TEL",
    },
    "recherche_crm": {
        "api_key": "TEST_CRM_KEY",
        "base_url": "https://api.hubspot.com",
    },
    "envoi_email": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": "587",
        "smtp_user": "kaboreinnocent93@gmail.com",
        "smtp_password": "gcaquwvqwootkoim",
    },
    "planification_calendrier": {
        "api_key": "TEST_CALENDAR_KEY",
        "calendar_id": "primary",
    },
    "generation_devis": {
        "api_key": "TEST_BILLING_KEY",
        "base_url": "https://api.pennylane.com",
    },
    "generation_facture": {
        "api_key": "TEST_BILLING_KEY",
        "base_url": "https://api.pennylane.com",
    },
    "suivi_paiement": {"api_key": "TEST_BILLING_KEY"},
    "analyse_donnees_ventes": {
        "source_url": "https://docs.google.com/spreadsheets/test",
        "api_key": "TEST_SHEETS_KEY",
    },
    "recherche_web": {"api_key": "TEST_SERPER_KEY"},
}

LINE = "=" * 65


def titre(t):
    print(f"\n{LINE[:5]} {t} {LINE[:max(1, 64-len(t))]}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    titre("TangaAI - Test orchestrateur")
    print(f"PME     : {PROFIL_TEST.nom_entreprise}")
    print(f"Secteur : {PROFIL_TEST.secteur}")
    print(f"Session : {SESSION_ID}")

    checkpointer = MemorySaver()
    app = build_orchestrator_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": SESSION_ID}}
    etat_initial = AgentState(profil_pme=PROFIL_TEST)

    # ------------------------------------------------------------------
    # Etape 1 : premier appel -> analyse + pause sur credentials
    # ------------------------------------------------------------------
    titre("ETAPE 1 - Analyse du profil PME par GPT-4o")
    print("-> Appel au LLM orchestrateur...")

    interrupted = False
    interrupt_payload = {}

    try:
        result = app.invoke(etat_initial, config=config)
        print("-> Graphe termine sans interruption")
    except GraphInterrupt as exc:
        interrupted = True
        interrupt_payload = exc.args[0][0].value if exc.args and exc.args[0] else {}
        print("-> Graphe en pause (credentials manquants)")
    except Exception as exc:
        print(f"[ERREUR inattendue] {type(exc).__name__}: {exc}")
        import traceback; traceback.print_exc()
        return

    # Si pas d'interruption, verifier quand meme l'etat pour les interrupts internes
    if not interrupted:
        snapshot = app.get_state(config)
        if snapshot and snapshot.next:
            interrupted = True
            tasks = snapshot.tasks
            if tasks and hasattr(tasks[0], "interrupts") and tasks[0].interrupts:
                interrupt_payload = tasks[0].interrupts[0].value
            print("-> Interruption detectee dans le snapshot")

    # ------------------------------------------------------------------
    # Affichage du plan genere
    # ------------------------------------------------------------------
    plan = interrupt_payload.get("plan", {})
    if plan:
        titre("AGENTS CREES PAR LE LLM")
        print(f"Nombre d'agents : {plan.get('nb_agents', '?')}")
        print(f"Mode execution  : {plan.get('process_type', '?')}")
        for i, a in enumerate(plan.get("agents", []), 1):
            print(f"\n  Agent {i} : {a['nom']}")
            print(f"    Domaine   : {a['domaine']}")
            print(f"    Role      : {a['role']}")
            print(f"    Objectif  : {a['objectif'][:120]}")
            print(f"    Outils    : {', '.join(a['outils_requis']) or 'aucun'}")
            print(f"    Priorite  : {a['priorite']}")
    else:
        print("[INFO] Plan non disponible dans le payload d'interruption")
        # Essayer de recuperer depuis le snapshot
        snapshot = app.get_state(config)
        if snapshot and snapshot.values:
            v = snapshot.values
            if isinstance(v, dict) and v.get("plan_agents"):
                plan_obj = v["plan_agents"]
                agents = plan_obj.get("agents", []) if isinstance(plan_obj, dict) else plan_obj.agents
                titre("AGENTS CREES PAR LE LLM (depuis snapshot)")
                for i, a in enumerate(agents, 1):
                    nom = a["nom"] if isinstance(a, dict) else a.nom
                    print(f"  Agent {i} : {nom}")

    # ------------------------------------------------------------------
    # Affichage des credentials demandes
    # ------------------------------------------------------------------
    if interrupt_payload.get("outils_manquants"):
        titre("CREDENTIALS NECESSAIRES")
        for outil, schema in interrupt_payload["outils_manquants"].items():
            print(f"\n  Outil : {outil}")
            print(f"  Label : {schema.get('label', '')}")
            for champ, desc in schema.get("fields", {}).items():
                print(f"    {champ:25s} -> {desc[:60]}")

    # ------------------------------------------------------------------
    # Etape 2 : sauvegarde des credentials de test
    # ------------------------------------------------------------------
    titre("ETAPE 2 - Sauvegarde des credentials de test")
    for outil, creds in CREDENTIALS_TEST.items():
        save_credentials(SESSION_ID, outil, creds)
        print(f"  [OK] {outil}")

    # ------------------------------------------------------------------
    # Etape 3 : reprise de l'execution
    # ------------------------------------------------------------------
    titre("ETAPE 3 - Reprise (crew.kickoff())")
    print("-> Lancement des agents CrewAI (peut prendre quelques minutes)...")

    try:
        if interrupted:
            resultat = app.invoke(Command(resume="ok"), config=config)
        else:
            resultat = result
    except GraphInterrupt:
        print("[ERREUR] Encore des credentials manquants apres resume")
        return
    except Exception as exc:
        print(f"[ERREUR] {type(exc).__name__}: {exc}")
        import traceback; traceback.print_exc()
        return

    if isinstance(resultat, dict):
        from models.schemas import AgentState as AS
        try:
            etat_final = AS(**resultat)
        except Exception:
            etat_final = None
    else:
        etat_final = resultat

    # ------------------------------------------------------------------
    # Affichage des resultats
    # ------------------------------------------------------------------
    if etat_final and etat_final.resultat_crew:
        titre("RESULTATS PAR AGENT")
        for r in etat_final.resultat_crew.resultats:
            print(f"\n  [{r.statut.upper()}] {r.nom_agent}")
            livrable = r.livrable[:300].replace("\n", " ")
            print(f"    {livrable}")
            if r.erreurs:
                print(f"    Erreur : {r.erreurs[:150]}")
        print(f"\n  Duree totale : {etat_final.resultat_crew.duree_secondes}s")
    else:
        print("[INFO] Pas de resultat crew disponible")

    if etat_final and etat_final.synthese:
        titre("SYNTHESE FINALE (GPT-4o-mini)")
        print()
        print(etat_final.synthese)
    else:
        print("\n[INFO] Pas de synthese disponible")

    print(f"\n{LINE}")
    print("Test termine.")


if __name__ == "__main__":
    main()
