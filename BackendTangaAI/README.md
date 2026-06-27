# TangaAI — Orchestrateur multi-agents pour PME

Système d'intelligence artificielle qui analyse le profil d'une PME, crée dynamiquement
une équipe d'agents spécialisés (marketing, vente, admin/finance), et les exécute de
manière autonome après que l'utilisateur a connecté ses outils (CRM, email, réseaux
sociaux...).

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI (api/main.py)                    │
│   POST /analyse   POST /session/{id}/credentials   POST /resume │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   LangGraph (graphe)  │   orchestrator_graph.py
                │                       │
                │  analyse_besoin       │  ← GPT-4o décide quels agents créer
                │       ↓               │
                │  validation_schema    │  ← vérifie les règles métier
                │       ↓               │
                │  verification_creds   │  ← credentials manquants ? → PAUSE
                │       ↓               │     (interrupt + notification utilisateur)
                │  instanciation_crew   │  ← construit et lance la crew CrewAI
                │       ↓               │
                │  synthese             │  ← GPT-4o-mini formate les résultats
                │       ↓               │
                │  notification         │  ← pousse vers le frontend (à brancher)
                └───────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   CrewAI              │   crew_factory/factory.py
                │   Agent 1 (marketing) │
                │   Agent 2 (vente)     │  ← exécutés avec les vrais credentials
                │   Agent 3 (finance)   │
                └───────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Outils MCP          │   tools/registry.py
                │   - Facebook/Insta    │
                │   - CRM (HubSpot...)  │
                │   - Email SMTP        │
                │   - Calendrier        │
                │   - Facturation       │
                └───────────────────────┘
```

---

## Structure des fichiers

```
files/
│
├── orchestrator_graph.py       Point d'entrée : construit et compile le graphe LangGraph
│
├── models/
│   └── schemas.py              Contrats Pydantic : ProfilPME, AgentSpec, PlanAgents, AgentState
│
├── nodes/
│   └── graph_nodes.py          Logique de chaque nœud du graphe (6 nœuds)
│
├── crew_factory/
│   └── factory.py              Transforme PlanAgents → Agent/Task/Crew CrewAI
│
├── tools/
│   └── registry.py             10 outils MCP (stubs à connecter aux vrais services)
│
├── memory/
│   ├── store.py                Checkpointer SQLite pour LangGraph (persistance de session)
│   └── credentials.py          Stockage des credentials par PME par outil
│
├── api/
│   └── main.py                 API FastAPI avec gestion interrupt/resume
│
├── data/
│   ├── memory.db               Base SQLite LangGraph (créée automatiquement)
│   └── credentials.db          Base SQLite credentials (créée automatiquement)
│
├── .env                        Clés API (OpenAI, Anthropic)
└── requirements.txt            Dépendances Python
```

---

## Flux complet d'utilisation

### 1. Lancement de l'API

```powershell
# Activer l'environnement virtuel
.\venv311\Scripts\Activate.ps1

# Lancer le serveur
uvicorn api.main:app --reload
```

Swagger UI disponible sur : `http://localhost:8000/docs`

---

### 2. Analyser un profil PME — `POST /analyse`

```json
{
  "profil_pme": {
    "nom_entreprise": "Saveurs du Sahel",
    "secteur": "agroalimentaire / transformation locale",
    "taille_effectif": 12,
    "cible_clientele": "restaurateurs et épiceries fines en zone urbaine",
    "objectifs_court_terme": [
      "augmenter les commandes en ligne de 30%",
      "publier du contenu régulier sur Facebook et Instagram"
    ],
    "objectifs_long_terme": [
      "exporter vers la France et la Belgique"
    ],
    "services_souhaites": ["marketing", "vente", "admin_finance"],
    "budget_indicatif": "moyen",
    "contraintes": ["équipe non technique"]
  }
}
```

**Réponse possible A — credentials manquants (cas normal au premier appel) :**
```json
{
  "session_id": "saveurs_du_sahel",
  "statut": "en_attente_credentials",
  "agents_crees": [
    {
      "nom": "Gestionnaire Réseaux Sociaux",
      "role": "Spécialiste en création et publication de contenu",
      "domaine": "marketing",
      "objectif": "Augmenter la visibilité sur Facebook et Instagram",
      "outils_requis": ["publication_reseaux_sociaux", "redaction_contenu"],
      "priorite": 1
    }
  ],
  "nb_agents": 3,
  "notification": {
    "message": "Vos agents sont prêts ! Veuillez renseigner les informations de connexion.",
    "outils_manquants": {
      "publication_reseaux_sociaux": {
        "label": "Réseaux sociaux (Facebook / Instagram)",
        "fields": {
          "page_url": "URL de votre page Facebook ou Instagram",
          "access_token": "Token d'accès (Meta Business Suite)"
        }
      }
    }
  }
}
```

**Réponse possible B — tous les credentials sont déjà présents :**
```json
{
  "session_id": "saveurs_du_sahel",
  "statut": "termine",
  "agents_crees": [...],
  "synthese": "Voici ce que vos agents ont accompli cette semaine...",
  "nb_agents": 3,
  "resultats_agents": [...]
}
```

---

### 3. Fournir les credentials — `POST /session/{session_id}/credentials`

Un appel par outil. L'utilisateur renseigne uniquement ce qui lui est demandé.

```json
{
  "tool_name": "publication_reseaux_sociaux",
  "credentials": {
    "page_url": "https://facebook.com/saveursdusahel",
    "access_token": "EAAxxxxxxxxxxxxxxx"
  }
}
```

Répéter pour chaque outil listé dans `outils_manquants`.

---

### 4. Reprendre l'exécution — `POST /session/{session_id}/resume`

Aucun body nécessaire. Le graphe reprend exactement là où il s'était arrêté
et vérifie à nouveau les credentials. Si tous sont présents, les agents s'exécutent.

---

### 5. Consulter l'état d'une session — `GET /session/{session_id}/etat`

```json
{
  "session_id": "saveurs_du_sahel",
  "en_attente": false,
  "prochains_noeuds": [],
  "synthese": "Voici ce que vos agents ont accompli...",
  "nb_agents": 3
}
```

---

## Outils disponibles et credentials requis

| Outil | Credentials requis |
|---|---|
| `redaction_contenu` | Aucun (utilise le LLM) |
| `recherche_web` | `api_key` Serper/SerpAPI (optionnel) |
| `publication_reseaux_sociaux` | `page_url`, `access_token` (Meta) |
| `recherche_crm` | `api_key`, `base_url` |
| `envoi_email` | `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password` |
| `planification_calendrier` | `api_key`, `calendar_id` |
| `generation_devis` | `api_key`, `base_url` |
| `generation_facture` | `api_key`, `base_url` |
| `suivi_paiement` | `api_key` |
| `analyse_donnees_ventes` | `source_url`, `api_key` (optionnel) |

---

## Configuration `.env`

```env
OPENAI_API_KEY=sk-...          # Utilisé par GPT-4o (orchestrateur) et GPT-4o-mini (synthèse)
ANTHROPIC_API_KEY=sk-ant-...   # Disponible pour basculer vers Claude (voir ci-dessous)
```

### Changer de modèle LLM

Dans [nodes/graph_nodes.py](nodes/graph_nodes.py), remplacer :
```python
# Actuel (OpenAI)
ORCHESTRATOR_LLM = ChatOpenAI(model="gpt-4o", temperature=0)

# Pour basculer sur Claude (Anthropic)
from langchain_anthropic import ChatAnthropic
ORCHESTRATOR_LLM = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)
```

---

## Domaines d'agents supportés

Les agents peuvent appartenir aux domaines suivants (définis dans `models/schemas.py`) :

| Domaine | Description |
|---|---|
| `marketing` | Contenu, réseaux sociaux, visibilité |
| `vente` | CRM, devis, suivi prospects |
| `admin_finance` | Facturation, paiements, calendrier |
| `support` | Relation client, email |
| `autre` | Tout besoin hors des catégories ci-dessus |

---

## Points à brancher avant la production

| Élément | Fichier | Action |
|---|---|---|
| Vrais outils MCP | `tools/registry.py` | Remplacer chaque `_run()` stub par l'appel API réel |
| Notification temps réel | `nodes/graph_nodes.py` → `notification_node` | Brancher WebSocket / SSE |
| Exécution async crew | `nodes/graph_nodes.py` → `instanciation_et_dispatch_node` | Utiliser `crew.kickoff_async()` |
| Sécurité credentials | `memory/credentials.py` | Chiffrer les credentials au repos (Fernet, KMS...) |
| Authentification API | `api/main.py` | Ajouter JWT / API key sur les endpoints |
| Logs production | partout | Remplacer `logging` par un sink structuré (Loguru, OpenTelemetry) |
