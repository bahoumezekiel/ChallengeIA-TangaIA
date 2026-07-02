from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import FileReadTool
import os
import re
import sys

# Évite un crash sur les emojis des logs quand la console Windows utilise
# un encodage historique (cp1252) plutôt que UTF-8 (ex: sortie redirigée vers un fichier).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure") and (_stream.encoding or "").lower() != "utf-8":
        _stream.reconfigure(encoding="utf-8", errors="replace")


@CrewBase
class PortfolioCrew():
    """Portfolio generation crew"""

    agents_config = 'config/agents.yaml'
    tasks_config  = 'config/tasks.yaml'

    # ── Agents ────────────────────────────────────────────────────────────────

    @agent
    def context_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['context_analyst'],
            verbose=True
        )

    @agent
    def engineering_lead(self) -> Agent:
        return Agent(
            config=self.agents_config['engineering_lead'],
            verbose=True
        )

    @agent
    def frontend_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config['frontend_engineer'],
            verbose=True
        )

    @agent
    def test_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config['test_engineer'],
            tools=[FileReadTool()],
            verbose=True
        )

    # ── Tasks ─────────────────────────────────────────────────────────────────

    @task
    def context_task(self) -> Task:
        return Task(
            config=self.tasks_config['context_task']
        )

    @task
    def design_task(self) -> Task:
        return Task(
            config=self.tasks_config['design_task']
        )

    @task
    def frontend_task(self) -> Task:
        return Task(
            config=self.tasks_config['frontend_task']
        )

    @task
    def qa_task(self) -> Task:
        return Task(
            config=self.tasks_config['qa_task']
        )

    # ── Crew ──────────────────────────────────────────────────────────────────

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,   # auto-collectés via @agent
            tasks=self.tasks,     # auto-collectés via @task
            process=Process.sequential,
            verbose=True,
        )


# ─── Post-processing : nettoyage du HTML écrit par CrewAI via output_file ─────

def clean_html_output(output_path: str) -> None:
    """
    CrewAI a déjà écrit le raw output dans output_path via output_file.
    Cette fonction retire d'éventuelles fences markdown résiduelles (```html ... ```)
    que le LLM aurait pu ajouter malgré la consigne, sans tenter de parser du JSON.
    """
    if not os.path.exists(output_path):
        print(f"⚠️  Fichier introuvable : {output_path}")
        return

    with open(output_path, 'r', encoding='utf-8') as f:
        content = f.read()

    cleaned = content.strip()
    cleaned = re.sub(r'^```(?:html)?\s*\n?', '', cleaned)
    cleaned = re.sub(r'\n?```\s*$', '', cleaned)
    cleaned = cleaned.strip()

    if not cleaned.lower().startswith("<!doctype html"):
        print(f"⚠️  Attention : le fichier généré ne commence pas par <!DOCTYPE html> — vérifie {output_path}")

    if cleaned != content:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        print(f"✅ Fences markdown nettoyées → {output_path}")
    else:
        print(f"✅ Portfolio HTML généré → {output_path}")
