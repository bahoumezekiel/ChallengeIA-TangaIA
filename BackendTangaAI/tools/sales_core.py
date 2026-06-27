"""
sales_core.py — Moteur d'analyse des ventes pour le tableau de bord.

Logique PURE (sans CrewAI), réutilisable par l'endpoint API GET /ventes/{session_id}.
Lit un CSV ou un Google Sheet (même source que l'outil analyse_donnees_ventes),
détecte les colonnes date / montant / produit, et produit des données STRUCTURÉES
prêtes pour un graphique :
- évolution du chiffre d'affaires par période (jour / semaine / mois)
- KPIs : CA total, nombre de ventes, panier moyen, tendance (% vs période précédente)
- top produits

À placer dans : tools/sales_core.py
"""

import io
import csv
import re
import logging
from collections import defaultdict, Counter
from datetime import datetime

import requests

logger = logging.getLogger("ventes")

# Mêmes conventions de colonnes que l'outil existant, + détection de date
_MONTANT_COLS = {"montant", "total", "ca", "prix", "amount", "revenue", "chiffre", "prix_total"}
_PRODUIT_COLS = {"produit", "product", "article", "service", "item", "designation"}
_DATE_COLS = {"date", "jour", "day", "date_vente", "datetime", "periode", "mois", "timestamp", "date_commande"}

# Formats de date acceptés (essayés dans l'ordre)
_FORMATS_DATE = [
    "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y",
    "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%dT%H:%M:%S",
    "%m/%d/%Y", "%d/%m/%y",
]


# ---------------------------------------------------------------------------
# Chargement de la source (CSV direct ou Google Sheets)
# ---------------------------------------------------------------------------

def _vers_csv_url(url: str) -> str:
    """Convertit une URL Google Sheets en URL d'export CSV."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if match:
        sheet_id = match.group(1)
        gid_match = re.search(r"gid=(\d+)", url)
        gid = gid_match.group(1) if gid_match else "0"
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    return url


def _charger_csv(source_url: str, api_key: str = "") -> list[dict]:
    url = _vers_csv_url(source_url)
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    return list(csv.DictReader(io.StringIO(response.text)))


# ---------------------------------------------------------------------------
# Helpers de détection et de parsing
# ---------------------------------------------------------------------------

def _trouver_colonne(colonnes: list[str], candidats: set[str]) -> str | None:
    for col in colonnes:
        if col.strip().lower() in candidats:
            return col
    for col in colonnes:
        if any(c in col.strip().lower() for c in candidats):
            return col
    return None


def _parser_montant(valeur: str) -> float | None:
    try:
        return float(str(valeur).replace(" ", "").replace("\u00a0", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def _parser_date(valeur: str) -> datetime | None:
    v = str(valeur).strip()
    if not v:
        return None
    for fmt in _FORMATS_DATE:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    # Dernier essai : ISO souple
    try:
        return datetime.fromisoformat(v.replace(" ", "T"))
    except ValueError:
        return None


def _cle_periode(d: datetime, granularite: str) -> str:
    if granularite == "jour":
        return d.strftime("%Y-%m-%d")
    if granularite == "semaine":
        return d.strftime("%Y-S%V")
    return d.strftime("%Y-%m")  # mois par défaut


# ---------------------------------------------------------------------------
# Analyse principale
# ---------------------------------------------------------------------------

def analyser_ventes(source_url: str, api_key: str = "", granularite: str = "mois") -> dict:
    """
    Analyse les ventes depuis la source et renvoie des données prêtes pour un graphique.

    granularite : "jour" | "semaine" | "mois" (défaut)

    Retour :
    {
        "total_ca": float, "nb_ventes": int, "panier_moyen": float,
        "tendance_pourcent": float|None,        # évolution dernière période vs précédente
        "evolution": [ {"periode": "2026-05", "ca": 1234.0, "nb": 12}, ... ],  # trié chrono
        "top_produits": [ {"produit": "...", "ca": 500.0, "nb": 8}, ... ],
        "colonnes_detectees": {"date": "...", "montant": "...", "produit": "..."},
        "devise": "FCFA"
    }
    En cas de souci : { "erreur": "..." } ou { "message": "..." } si vide.
    """
    if not source_url:
        return {"erreur": "Aucune source de données (source_url) fournie."}

    try:
        lignes = _charger_csv(source_url, api_key)
    except Exception as exc:
        return {"erreur": f"Impossible de lire la source : {exc}"}

    if not lignes:
        return {"message": "Source de données vide ou format non reconnu."}

    colonnes = list(lignes[0].keys())
    col_date = _trouver_colonne(colonnes, _DATE_COLS)
    col_montant = _trouver_colonne(colonnes, _MONTANT_COLS)
    col_produit = _trouver_colonne(colonnes, _PRODUIT_COLS)

    if not col_montant:
        return {
            "erreur": "Aucune colonne de montant trouvée "
                      "(attendu : montant, total, ca, prix...).",
            "colonnes_disponibles": colonnes,
        }

    # Agrégations
    par_periode_ca: dict[str, float] = defaultdict(float)
    par_periode_nb: dict[str, int] = defaultdict(int)
    ca_par_produit: dict[str, float] = defaultdict(float)
    nb_par_produit: Counter = Counter()

    total_ca = 0.0
    nb_ventes = 0

    for row in lignes:
        montant = _parser_montant(row.get(col_montant, ""))
        if montant is None:
            continue
        total_ca += montant
        nb_ventes += 1

        if col_date:
            d = _parser_date(row.get(col_date, ""))
            if d:
                cle = _cle_periode(d, granularite)
                par_periode_ca[cle] += montant
                par_periode_nb[cle] += 1

        if col_produit:
            p = (row.get(col_produit) or "").strip()
            if p:
                ca_par_produit[p] += montant
                nb_par_produit[p] += 1

    if nb_ventes == 0:
        return {"message": "Aucune vente exploitable (colonne montant vide ou non numérique)."}

    # Série d'évolution triée chronologiquement
    evolution = [
        {"periode": cle, "ca": round(par_periode_ca[cle], 2), "nb": par_periode_nb[cle]}
        for cle in sorted(par_periode_ca.keys())
    ]

    # Tendance : dernière période vs précédente
    tendance = None
    if len(evolution) >= 2:
        avant = evolution[-2]["ca"]
        apres = evolution[-1]["ca"]
        if avant > 0:
            tendance = round((apres - avant) / avant * 100, 1)

    # Top produits par CA
    top_produits = [
        {"produit": p, "ca": round(ca_par_produit[p], 2), "nb": nb_par_produit[p]}
        for p, _ in sorted(ca_par_produit.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    return {
        "total_ca": round(total_ca, 2),
        "nb_ventes": nb_ventes,
        "panier_moyen": round(total_ca / nb_ventes, 2),
        "tendance_pourcent": tendance,
        "evolution": evolution,
        "top_produits": top_produits,
        "colonnes_detectees": {
            "date": col_date,
            "montant": col_montant,
            "produit": col_produit,
        },
        "granularite": granularite,
        "devise": "FCFA",
    }
