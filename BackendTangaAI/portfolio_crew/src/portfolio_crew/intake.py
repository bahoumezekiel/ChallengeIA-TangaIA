"""Collecte des informations PME pour la génération de portfolio.

Construit le dict `inputs` consommé par PortfolioCrew().crew().kickoff(inputs=...).
En mode interactif (terminal réel), pose une série de questions en français.
En mode non-interactif (CI, `crewai test`, pipes), retourne un jeu de données de démo.

IMPORTANT : CrewAI interpole uniquement des clés PLATES de premier niveau dans les YAML
(`{nom_de_cle}`), jamais de syntaxe `{dict[cle]}`. Toutes les valeurs utilisées dans
agents.yaml / tasks.yaml doivent donc être des clés plates du dict retourné ici.
"""
import os
import sys
import unicodedata
from datetime import date, datetime

from crewai.utilities.string_utils import slugify

SECTOR_COLOR_DEFAULTS = {
    "plomberie": ("#1D4ED8", "#0F172A"),
    "coiffure": ("#DB2777", "#1F2937"),
    "consult": ("#0F766E", "#111827"),  # conseil, consulting, consultant...
    "tech": ("#3B82F6", "#0F172A"),
    "developpement": ("#3B82F6", "#0F172A"),
    "restauration": ("#B45309", "#1F2937"),
    "beaute": ("#DB2777", "#1F2937"),
}
DEFAULT_COLORS = ("#2563EB", "#111827")


def _normalize(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return stripped.lower()


def pick_colors_for_sector(sector: str) -> tuple[str, str]:
    normalized = _normalize(sector)
    for keyword, colors in SECTOR_COLOR_DEFAULTS.items():
        if keyword in normalized:
            return colors
    return DEFAULT_COLORS


def is_interactive() -> bool:
    return sys.stdin.isatty()


def _ask(prompt: str, required: bool = False, default: str = "") -> str:
    while True:
        value = input(prompt).strip()
        if value:
            return value
        if not required:
            return default
        print("  → Ce champ est obligatoire, merci de renseigner une valeur.")


def _ask_email(prompt: str) -> str:
    while True:
        value = input(prompt).strip()
        if "@" in value:
            return value
        print("  → Merci d'indiquer un email valide (contenant @).")


def _ask_skills(prompt: str) -> list[str]:
    while True:
        raw = input(prompt)
        skills = [s.strip() for s in raw.split(",") if s.strip()]
        if skills:
            return skills
        print("  → Merci d'indiquer au moins une compétence ou un service.")


def _ask_projects() -> list[dict]:
    print("Ajoutez vos réalisations/projets (laissez le nom vide pour terminer) :")
    projects = []
    while True:
        name = input("  Nom de la réalisation (vide pour terminer) : ").strip()
        if not name:
            break
        description = input("  Description courte : ").strip()
        tech_raw = input("  Mots-clés / technologies (séparés par virgules, optionnel) : ").strip()
        tech_stack = [t.strip() for t in tech_raw.split(",") if t.strip()]
        projects.append({"name": name, "description": description, "tech_stack": tech_stack})
    return projects


def _ask_experience() -> list[dict]:
    print("Ajoutez une expérience professionnelle (laissez le rôle vide pour terminer) :")
    experience = []
    while True:
        role = input("  Rôle / poste (vide pour terminer) : ").strip()
        if not role:
            break
        company = input("  Entreprise : ").strip()
        description = input("  Description courte : ").strip()
        experience.append({"role": role, "company": company, "description": description})
    return experience


def _ask_education() -> list[dict]:
    print("Ajoutez une formation (laissez le diplôme vide pour terminer) :")
    education = []
    while True:
        degree = input("  Diplôme (vide pour terminer) : ").strip()
        if not degree:
            break
        school = input("  École / établissement : ").strip()
        year = input("  Année : ").strip()
        education.append({"degree": degree, "school": school, "year": year})
    return education


def _ask_testimonials() -> list[dict]:
    print("Ajoutez un témoignage client (laissez l'auteur vide pour terminer) :")
    testimonials = []
    while True:
        author = input("  Auteur du témoignage (vide pour terminer) : ").strip()
        if not author:
            break
        text = input("  Texte du témoignage : ").strip()
        testimonials.append({"author": author, "text": text})
    return testimonials


def ask_questions() -> dict:
    print("=== Création de votre portfolio ===")
    print("Répondez aux questions ci-dessous. Appuyez sur Entrée pour passer un champ optionnel.\n")

    name = _ask("Quel est le nom de votre entreprise ou votre nom complet ? ", required=True)
    title = _ask(
        "Quel est votre métier ou titre d'activité ? "
        "(ex: Plombier chauffagiste, Consultante RH, Développeur freelance) ",
        required=True,
    )
    sector = _ask(
        "Quel est votre secteur d'activité ? "
        "(ex: Plomberie, Coiffure, Conseil RH, Développement web) ",
        required=True,
    )
    bio = _ask("Décrivez votre activité en quelques phrases : ", required=True)

    skills = _ask_skills("Listez vos compétences ou services proposés, séparés par des virgules : ")
    projects = _ask_projects()
    experience = _ask_experience()
    education = _ask_education()
    testimonials = _ask_testimonials()

    contact_email = _ask_email("Email de contact : ")
    contact_phone = _ask("Téléphone (optionnel, Entrée pour passer) : ")
    address = _ask("Adresse ou zone d'intervention (optionnel) : ")
    business_hours = _ask("Horaires d'ouverture (optionnel, ex: Lun-Sam 8h-18h) : ")
    contact_github = _ask("Site GitHub (optionnel, pertinent si activité tech) : ")
    contact_linkedin = _ask("LinkedIn (optionnel) : ")
    contact_whatsapp = _ask("WhatsApp (optionnel) : ")
    contact_facebook = _ask("Page Facebook (optionnel) : ")
    contact_instagram = _ask("Compte Instagram (optionnel) : ")

    primary_color = _ask(
        "Couleur principale en hexadécimal "
        "(optionnel, Entrée pour choisir automatiquement selon votre secteur) : "
    )
    secondary_color = _ask("Couleur secondaire (optionnel) : ")
    target_audience = _ask(
        "Public cible (optionnel, ex: Particuliers du quartier, Entreprises locales, Recruteurs tech) : "
    )

    return {
        "name": name,
        "title": title,
        "sector": sector,
        "bio": bio,
        "skills": skills,
        "projects": projects,
        "experience": experience,
        "education": education,
        "testimonials": testimonials,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
        "address": address,
        "business_hours": business_hours,
        "contact_github": contact_github,
        "contact_linkedin": contact_linkedin,
        "contact_whatsapp": contact_whatsapp,
        "contact_facebook": contact_facebook,
        "contact_instagram": contact_instagram,
        "primary_color": primary_color,
        "secondary_color": secondary_color,
        "target_audience": target_audience,
    }


def build_demo_inputs() -> dict:
    """Jeu de données fixe utilisé en mode non-interactif (CI, crewai test, pipes)."""
    return {
        "name": "Kabore Innocent",
        "title": "Data Analyst | Data Scientist | AI Engineer",
        "sector": "Développement web freelance / Intelligence artificielle",
        "bio": (
            "Passionate Data Analyst and AI Engineer specialized in Machine Learning, "
            "Large Language Models (LLMs), Data Visualization and intelligent multi-agent systems. "
            "I build scalable AI-powered applications, modern APIs and data-driven solutions "
            "focused on real-world impact and innovation in Africa."
        ),
        "skills": [
            "Python", "Laravel", "FastAPI", "React", "Next.js", "TailwindCSS",
            "Machine Learning", "LLMs", "CrewAI", "SQL",
            "Power BI", "Tableau", "Data Visualization",
            "API Development", "Multi-Agent Systems",
        ],
        "projects": [
            {
                "name": "AI Multi-Agent Portfolio Generator",
                "description": "Autonomous multi-agent system generating complete professional portfolios using CrewAI.",
                "tech_stack": ["CrewAI", "Python", "GPT", "Claude", "FastAPI"],
            },
            {
                "name": "Telecom Churn Prediction",
                "description": "Machine learning system for predicting customer churn using transactional telecom data.",
                "tech_stack": ["Python", "Scikit-Learn", "XGBoost", "Pandas"],
            },
            {
                "name": "Digital Assistant API",
                "description": "Intelligent Laravel API understanding telecom service commands in natural language.",
                "tech_stack": ["Laravel", "PHP", "NLP", "REST API"],
            },
        ],
        "experience": [
            {
                "role": "Junior Data Analyst",
                "company": "Freelance",
                "description": "Dashboards, predictive analytics and data-driven business insights.",
            }
        ],
        "education": [
            {"degree": "Bachelor Degree in Computer Science", "school": "University", "year": "2025"}
        ],
        "testimonials": [],
        "contact_email": "kaboreinnocent@example.com",
        "contact_phone": "",
        "address": "",
        "business_hours": "",
        "contact_github": "https://github.com/yourgithub",
        "contact_linkedin": "https://linkedin.com/in/yourlinkedin",
        "contact_whatsapp": "",
        "contact_facebook": "",
        "contact_instagram": "",
        "primary_color": "#3B82F6",
        "secondary_color": "#0F172A",
        "target_audience": "Recruteurs, entreprises tech, startups IA",
    }


def _format_list(items: list[str], empty_message: str) -> str:
    if not items:
        return empty_message
    return "\n".join(f"- {item}" for item in items)


def _format_projects(projects: list[dict]) -> str:
    if not projects:
        return "(aucune réalisation renseignée)"
    lines = []
    for p in projects:
        line = f"- {p['name']} : {p['description']}"
        if p.get("tech_stack"):
            line += f" (mots-clés : {', '.join(p['tech_stack'])})"
        lines.append(line)
    return "\n".join(lines)


def _format_experience(experience: list[dict]) -> str:
    if not experience:
        return "(aucune expérience renseignée)"
    return "\n".join(f"- {e['role']} chez {e['company']} : {e['description']}" for e in experience)


def _format_education(education: list[dict]) -> str:
    if not education:
        return "(aucune formation renseignée)"
    return "\n".join(f"- {e['degree']}, {e['school']} ({e['year']})" for e in education)


def _format_testimonials(testimonials: list[dict]) -> str:
    if not testimonials:
        return "(aucun témoignage renseigné)"
    return "\n".join(f'- "{t["text"]}" — {t["author"]}' for t in testimonials)


def _unique_slug(base_slug: str) -> str:
    if not os.path.isdir(os.path.join("outputs", base_slug)):
        return base_slug
    return f"{base_slug}-{date.today().isoformat()}"


def finalize_inputs(raw: dict) -> dict:
    primary_color = raw.get("primary_color") or ""
    secondary_color = raw.get("secondary_color") or ""
    if not primary_color or not secondary_color:
        default_primary, default_secondary = pick_colors_for_sector(raw["sector"])
        primary_color = primary_color or default_primary
        secondary_color = secondary_color or default_secondary

    target_audience = raw.get("target_audience") or "Vos futurs clients"
    base_slug = slugify(raw["name"], separator="-")

    inputs = dict(raw)
    inputs.update({
        "primary_color": primary_color,
        "secondary_color": secondary_color,
        "target_audience": target_audience,
        "theme": "Sobre et moderne, adapté à l'activité",
        "portfolio_style": "Site portfolio professionnel",
        "current_year": str(datetime.now().year),
        "slug": _unique_slug(base_slug),
        "skills_text": _format_list(raw["skills"], "(aucune compétence/service renseigné)"),
        "projects_text": _format_projects(raw["projects"]),
        "experience_text": _format_experience(raw["experience"]),
        "education_text": _format_education(raw["education"]),
        "testimonials_text": _format_testimonials(raw["testimonials"]),
        # Objet pratique pour affichage console uniquement (PAS interpolé dans les YAML)
        "contact": {
            "email": raw["contact_email"],
            "phone": raw["contact_phone"],
            "github": raw["contact_github"],
            "linkedin": raw["contact_linkedin"],
            "whatsapp": raw["contact_whatsapp"],
            "facebook": raw["contact_facebook"],
            "instagram": raw["contact_instagram"],
        },
    })
    return inputs


def build_inputs() -> dict:
    raw = build_demo_inputs() if not is_interactive() else ask_questions()
    return finalize_inputs(raw)
