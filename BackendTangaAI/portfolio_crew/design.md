# Architecture — Générateur de portfolio PME

## Objectif
Permettre à une PME ou un indépendant (artisan, commerçant, consultant, freelance tech...)
sans portfolio existant d'en générer un rapidement, adapté à son secteur d'activité.

## Pipeline

```
intake.py (CLI interactif ou jeu de démo)
        ↓ inputs (dict de clés plates)
context_task    → context_analyst : détermine le secteur, les sections pertinentes, le ton
design_task     → engineering_lead : spécifie l'architecture (sections, charte graphique)
frontend_task   → frontend_engineer : génère le fichier HTML/CSS/JS auto-suffisant
qa_task         → test_engineer : vérifie le fichier HTML réellement généré (FileReadTool)
        ↓
outputs/<slug>/index.html
outputs/<slug>/quality_assurance_report.md
```

`<slug>` est dérivé du nom de l'entreprise (ex. "Salon de coiffure Awa Style" → `salon-de-coiffure-awa-style`),
ce qui permet de générer plusieurs portfolios sans s'écraser les uns les autres.

## Modèle de données d'entrée

Construit par `src/portfolio_crew/intake.py::build_inputs()`. CrewAI interpole uniquement des
clés **plates** de premier niveau (`{nom_de_cle}`), jamais `{dict[cle]}` — toutes les valeurs
utilisées dans `agents.yaml`/`tasks.yaml` doivent donc être des chaînes simples.

Obligatoire : `name`, `title`, `sector`, `bio`, `skills` (≥1), `contact_email`.

Optionnel (chaîne/liste vide acceptée) : `projects`, `experience`, `education`, `testimonials`,
`contact_phone`, `address`, `business_hours`, `contact_github`, `contact_linkedin`,
`contact_whatsapp`, `contact_facebook`, `contact_instagram`, `primary_color`, `secondary_color`,
`target_audience`.

Les listes (`skills`, `projects`, `experience`, `education`, `testimonials`) sont pré-formatées
en texte (`skills_text`, `projects_text`, ...) avant le `kickoff()`, car CrewAI n'a aucun moyen
d'itérer sur une liste Python dans un prompt YAML — seules les versions `*_text` sont interpolées.

## Adaptation sectorielle
`context_analyst` ne reçoit aucune donnée que l'utilisateur n'a pas fournie : il ne fait que
recommander une structure (quelles sections garder/écarter), un ton, et un libellé d'affichage
pour les champs génériques `skills`/`projects` (ex. "Nos services" pour un artisan vs
"Compétences" pour un freelance tech). Cette recommandation est passée en `context` aux tâches
suivantes ; elle ne modifie jamais les données factuelles.

## Limites connues
- Portfolio mono-fichier HTML auto-suffisant (pas de multi-pages, pas de backend, pas de CMS).
- `test_engineer` ne dispose que d'un outil de lecture de fichier : la QA est une vérification
  textuelle du HTML généré (présence du nom, des couleurs, des sections, d'un lien `mailto:`...),
  pas un audit Lighthouse/cross-browser réel.
- Pas d'interface web : la saisie se fait en ligne de commande (`crewai run`).
