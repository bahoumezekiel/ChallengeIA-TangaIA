#!/usr/bin/env python
import sys
import warnings

from portfolio_crew.crew import PortfolioCrew, clean_html_output
from portfolio_crew.intake import build_inputs

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


def run():
    inputs = build_inputs()

    print("\n🚀 Démarrage de PortfolioCrew...")
    print(f"   Nom      : {inputs['name']}")
    print(f"   Titre    : {inputs['title']}")
    print(f"   Secteur  : {inputs['sector']}")
    print(f"   Couleurs : {inputs['primary_color']} / {inputs['secondary_color']}")
    print()

    result = PortfolioCrew().crew().kickoff(inputs=inputs)

    output_path = f"outputs/{inputs['slug']}/index.html"
    clean_html_output(output_path)

    print(f"\n✅ Génération terminée. Ouvre {output_path} dans ton navigateur.")
    return result


def train():
    inputs = build_inputs()
    try:
        PortfolioCrew().crew().train(
            n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs
        )
    except Exception as e:
        raise Exception(f"Erreur durant l'entraînement du crew : {e}")


def replay():
    try:
        PortfolioCrew().crew().replay(task_id=sys.argv[1])
    except Exception as e:
        raise Exception(f"Erreur durant le replay du crew : {e}")


def test():
    inputs = build_inputs()
    try:
        PortfolioCrew().crew().test(
            n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs
        )
    except Exception as e:
        raise Exception(f"Erreur durant le test du crew : {e}")


def run_with_trigger():
    return run()


if __name__ == "__main__":
    run()
