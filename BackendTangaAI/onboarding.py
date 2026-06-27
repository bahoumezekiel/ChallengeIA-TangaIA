"""
onboarding.py — Onboarding conversationnel.

Mène une discussion avec le dirigeant et construit progressivement le ProfilPME.
Le LLM pose les questions, et signale quand il a assez d'informations.

Utilisé par l'endpoint POST /onboarding/message (alimente l'app mobile et,
si voulu, un mode chat sur le frontend web).

À placer dans : onboarding.py (racine du backend)
"""

import json
import re
from typing import Optional

from pydantic import BaseModel
from langchain_openai import ChatOpenAI

from models.schemas import ProfilPME

# LLM léger en MODE JSON : garantit une réponse JSON parseable (plus de JSON brut affiché)
_ONBOARDING_LLM = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.4,
    model_kwargs={"response_format": {"type": "json_object"}},
)

_PROMPT_SYSTEME = """Tu es l'assistant d'accueil de TangaAI, un copilote IA pour PME africaines.
Ton rôle : discuter avec le dirigeant pour comprendre son entreprise, de façon naturelle et
chaleureuse, en français, UNE question à la fois.

Tu dois collecter progressivement :
- nom_entreprise, secteur, taille_effectif (nombre d'employés)
- cible_clientele
- objectifs_court_terme (liste), objectifs_long_terme (liste)
- services_souhaites : parmi marketing, vente, admin_finance, support, autre
- budget_indicatif, contraintes (liste)

RÈGLES :
- Pose une seule question à la fois, simplement.
- Ne demande pas tout d'un coup ; avance pas à pas.
- Quand tu estimes avoir l'essentiel (au minimum nom, secteur, cible, au moins un objectif et
  au moins un service), tu PEUX conclure.

Tu réponds TOUJOURS en JSON strict, sans texte autour, au format :
{
  "complete": false,
  "message": "ta prochaine question ou ton message",
  "profil_pme": null
}
Quand tu as assez d'informations, renvoie complete=true et profil_pme rempli :
{
  "complete": true,
  "message": "message de conclusion chaleureux",
  "profil_pme": {
    "nom_entreprise": "...", "secteur": "...", "taille_effectif": 10,
    "cible_clientele": "...", "objectifs_court_terme": ["..."],
    "objectifs_long_terme": ["..."], "services_souhaites": ["marketing"],
    "budget_indicatif": "moyen", "contraintes": ["..."]
  }
}
"""


class OnboardingStep(BaseModel):
    complete: bool
    message: str
    profil_pme: Optional[ProfilPME] = None


def run_onboarding_step(messages: list[dict]) -> OnboardingStep:
    """
    Un tour de conversation.
    messages : liste de {role: "user"|"assistant", content: "..."}.
    Si vide → message d'accueil.
    """
    if not messages:
        return OnboardingStep(
            complete=False,
            message=(
                "Bienvenue sur TangaAI ! Je suis votre copilote IA. "
                "Pour composer votre équipe d'agents, parlez-moi de votre entreprise : "
                "quel est son nom et dans quel secteur opérez-vous ?"
            ),
            profil_pme=None,
        )

    conversation = [{"role": "system", "content": _PROMPT_SYSTEME}]
    for m in messages:
        role = m.get("role", "user")
        if role not in ("user", "assistant", "system"):
            role = "user"
        conversation.append({"role": role, "content": m.get("content", "")})

    reponse = _ONBOARDING_LLM.invoke(conversation)
    contenu = reponse.content.strip()

    # Nettoyage d'éventuels backticks markdown
    if contenu.startswith("```"):
        contenu = contenu.strip("`")
        if contenu.startswith("json"):
            contenu = contenu[4:]
        contenu = contenu.strip()

    data = _extraire_json(contenu)
    if data is None:
        # Le modèle n'a pas renvoyé de JSON exploitable : on NE montre PAS de JSON brut,
        # on redemande poliment au lieu d'afficher du texte technique.
        return OnboardingStep(
            complete=False,
            message="Je n'ai pas tout saisi, pouvez-vous reformuler votre dernière réponse ?",
            profil_pme=None,
        )

    profil = None
    if data.get("complete") and data.get("profil_pme"):
        try:
            profil = ProfilPME(**data["profil_pme"])
        except Exception:
            # Profil incomplet → on continue la conversation
            return OnboardingStep(
                complete=False,
                message=data.get("message") or "Pouvez-vous préciser un dernier point ?",
                profil_pme=None,
            )

    message = data.get("message") or ""
    # Garde-fou : si le message ressemble encore à du JSON, on le remplace par un texte propre
    if message.strip().startswith("{") and message.strip().endswith("}"):
        message = "C'est noté, merci !" if not profil else "Parfait, j'ai tout ce qu'il me faut !"

    return OnboardingStep(
        complete=bool(data.get("complete")),
        message=message,
        profil_pme=profil,
    )


def _extraire_json(txt: str) -> Optional[dict]:
    """Tente de parser du JSON, avec repli sur le premier bloc {...} trouvé."""
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", txt, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None
