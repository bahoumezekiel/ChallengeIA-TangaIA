# TangaAI Backend - Orchestrateur Multi-Agents pour PME

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.0.20+-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![CrewAI](https://img.shields.io/badge/CrewAI-0.30+-red.svg)](https://crewai.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TangaAI Backend est le coeur du systeme d'orchestration multi-agents. Il analyse les besoins des PME africaines, genere automatiquement des agents IA specialises, et execute des missions concretes via une API REST securisee.

---

## Sommaire

1. [Apercu](#apercu)
2. [Fonctionnalites](#fonctionnalites)
3. [Architecture technique](#architecture-technique)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Structure du projet](#structure-du-projet)
7. [Endpoints API](#endpoints-api)
8. [Base de donnees](#base-de-donnees)
9. [Deploiement](#deploiement)
10. [Variables d'environnement](#variables-denvironnement)
11. [Licence](#licence)

---

## Apercu

TangaAI Backend est un orchestrateur intelligent qui :
- Discute avec le dirigeant de la PME via un chat conversationnel
- Analyse les besoins et objectifs de l'entreprise
- Cree automatiquement une equipe d'agents IA specialises
- Execute les missions via CrewAI
- Fournit un tableau de bord complet

### Probleme resolu
Les PME africaines manquent d'outils digitaux adaptes, de budgets suffisants et de competences en IA. TangaAI democratise l'acces a l'intelligence artificielle en automatisant la creation et l'execution d'agents specialises.

---

## Fonctionnalites

### Orchestrateur IA
- Analyse des besoins via GPT-4 avec structured output
- Generation dynamique d'agents (jusqu'a 8)
- Execution sequentielle ou hierarchique
- Validation automatique des plans

### Gestion des agents
- Creation automatique via LLM
- CRUD complet (creation, lecture, mise a jour, suppression)
- Activation / desactivation
- Persistance en base de donnees

### Integrations natives
- Publication Facebook (Graph API)
- Analyse de sentiment (avis Facebook)
- Envoi d'emails (SMTP)
- Recherche CRM (HubSpot, Pipedrive...)
- Analyse de donnees (Google Sheets / CSV)
- Recherche web (Serper.dev)
- Generation d'images (Pexels)

### Securite
- Authentification JWT
- Sessions persistantes
- Stockage securise des credentials
- CORS configure

### Tableau de bord
- Reputation (sentiment des avis)
- Ventes (CA, evolution, top produits)
- Publications programmees
- Historique des analyses

## Architecture technique

Framework API: FastAPI 0.104+
Orchestration: LangGraph 0.0.20+
Execution agents: CrewAI 0.30+
LLM: OpenAI GPT-4 / GPT-4o-mini
Base de donnees: SQLite (multiple fichiers)
Authentification: JWT avec HMAC
Scheduler: APScheduler 3.10+
Validation: Pydantic 2.0+
### Schema de l'architecture
┌─────────────────────────────────────────────────────────────────┐
│ API REST (FastAPI) │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ /auth │ │ /analyse │ │ /onboarding │ │
│ │ login/me │ │ resume │ │ message │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ /agents │ │ /session │ │ /publications │ │
│ │ CRUD │ │ credentials│ │ schedule │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ /sentiment │ │ /ventes │ │ /notifications │ │
│ │ analyse │ │ dashboard │ │ list/mark │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ LANGGRAPH ORCHESTRATOR │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Analyse ──► Validation ──► Credentials ──► CrewAI │ │
│ │ └──► Synthese ──► Notification ──► Fin │ │
│ └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ CREWAI FACTORY │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Agents ──► Tasks ──► Crew ──► Execution │ │
│ └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ BASES DE DONNEES │
│ ┌────────────┐ ┌────────────┐ ┌─────────────────────────┐ │
│ │ memory.db │ │ users.db │ │ credentials.db │ │
│ │ checkpoints│ │ auth │ │ tool credentials │ │
│ └────────────┘ └────────────┘ └─────────────────────────┘ │
│ ┌────────────┐ ┌────────────┐ ┌─────────────────────────┐ │
│ │ agents.db │ │ history.db │ │ notifications.db │ │
│ │ CRUD agents│ │ runs │ │ alerts │ │
│ └────────────┘ └────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

 
---

## Installation

### Prérequis

- Python 3.10 ou superieur
- Clé API OpenAI (https://platform.openai.com/api-keys)
- Git

### Etapes d'installation

```bash
# 1. Cloner le projet
git clone https://github.com/votre-username/tangaai-backend.git
cd tangaai-backend

# 2. Creer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# 3. Installer les dependances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos cles API

# 5. Lancer le serveur
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

fichier env
# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx

# Securite (generer une chaine aleatoire)
TANGA_SECRET_KEY=super-secret-key-change-in-production

# Services optionnels
PEXELS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
pexel_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

## Structure du projet
tangaai-backend/
├── api/
│   └── main.py                    # Point d'entree FastAPI
│
├── nodes/
│   ├── graph_nodes.py             # Logique des noeuds LangGraph
│   └── orchestrator_graph.py      # Compilation du graphe
│
├── tools/
│   ├── registry.py                # Registre des outils MCP
│   ├── sentiment_core.py          # Analyse de sentiment Facebook
│   └── sales_core.py              # Analyse des ventes
│
├── crew_factory/
│   └── factory.py                 # Construction des CrewAI
│
├── memory/
│   ├── store.py                   # Checkpointer SQLite
│   ├── credentials.py             # Gestion des credentials
│   ├── auth.py                    # Authentification
│   ├── agents.py                  # CRUD agents
│   ├── history.py                 # Historique des runs
│   └── notifications.py           # Systeme de notifications
│
├── models/
│   └── schemas.py                 # Schemas Pydantic
│
├── data/                          # Bases de donnees SQLite
│   ├── memory.db                  # Checkpoints LangGraph
│   ├── users.db                   # Comptes utilisateurs
│   ├── credentials.db             # Credentials outils
│   ├── agents.db                  # Persistance agents
│   ├── history.db                 # Historique executions
│   └── notifications.db           # Notifications
│
├── onboarding.py                  # Chat conversationnel
├── publications_programmees.py    # Scheduler publications
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md




### Stack
