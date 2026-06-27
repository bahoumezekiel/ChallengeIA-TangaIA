"""
registry.py — Registre central des outils MCP de TangaAI.

Architecture :
- Chaque outil hérite de BaseTool (CrewAI/Pydantic).
- Les credentials sont des champs Pydantic optionnels sur chaque classe.
- Sans credentials valides → _run() retourne un message de simulation explicite.
- Avec credentials → _run() appelle le vrai service externe.

Pourquoi des instances fraîches à chaque build_crew() ?
→ Isolation totale entre PME : les credentials d'une session ne contaminent jamais une autre.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests
from crewai.tools import BaseTool


# ---------------------------------------------------------------------------
# Outil sans credentials — fonctionne uniquement avec le LLM
# ---------------------------------------------------------------------------

class RedactionContenuTool(BaseTool):
    """
    Génère du contenu marketing textuel.
    Pas de credentials : le LLM de l'agent fait le travail.
    Seul outil "always available" — les autres nécessitent une connexion externe.
    """
    name: str = "redaction_contenu"
    description: str = (
        "Rédige du contenu marketing adapté à la PME : posts réseaux sociaux, "
        "articles de blog, descriptions produit, newsletters, scripts vidéo. "
        "Précise le type de contenu, le ton souhaité et la plateforme cible."
    )

    def _run(self, brief: str) -> str:
        # Le LLM de l'agent génère le contenu directement dans son raisonnement.
        # Cet outil sert de déclencheur formel pour structurer la demande.
        return f"Contenu rédigé selon le brief : {brief}"


# ---------------------------------------------------------------------------
# Recherche web (Serper.dev)
# ---------------------------------------------------------------------------

class RechercheWebTool(BaseTool):
    """Recherche web via Serper.dev — version fiabilisée (anti-hallucination)."""
    name: str = "recherche_web"
    description: str = (
        "Recherche des informations FACTUELLES et ACTUELLES sur le web (tendances, "
        "concurrents, prix, actualités). RÈGLE : n'utilise QUE les résultats renvoyés, "
        "ne complète jamais avec ta mémoire, cite la source [n], et si l'information n'apparaît "
        "pas dans les résultats, dis-le explicitement au lieu de l'inventer."
    )
    api_key: str = ""

    _CONSIGNE = (
        "\n\n---\nCONSIGNE : Base-toi UNIQUEMENT sur les résultats ci-dessus. "
        "Cite la source entre crochets (ex. [1]). Si une information demandée n'y est pas, écris "
        "\"information non disponible dans les sources\" — n'invente jamais de chiffre, date, nom ou lien."
    )

    def _run(self, query: str) -> str:
        if not self.api_key:
            return (
                "[RECHERCHE WEB INDISPONIBLE] Aucune clé configurée, aucune donnée web réelle pour : "
                f"\"{query}\". N'invente aucune information ; indique que la recherche n'a pas pu être faite."
            )
        try:
            response = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": self.api_key, "Content-Type": "application/json"},
                json={"q": query, "gl": "ci", "hl": "fr", "num": 5},
                timeout=12,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as exc:
            return (
                f"[ERREUR recherche web] Recherche \"{query}\" échouée ({exc}). "
                "N'invente aucune information ; indique que la recherche a échoué."
            )

        resultats = data.get("organic", [])[:5]
        if not resultats:
            return (
                f"[AUCUN RÉSULTAT] Aucune source pour \"{query}\". "
                "N'invente rien : indique qu'aucune information n'a été trouvée."
            )

        lignes = [f"Résultats web réels pour \"{query}\" ({len(resultats)} sources) :"]
        for i, r in enumerate(resultats, start=1):
            titre = (r.get("title") or "").strip()
            extrait = (r.get("snippet") or "").strip()
            lien = (r.get("link") or "").strip()
            date = (r.get("date") or "").strip()
            ligne = f"[{i}] {titre}"
            if date:
                ligne += f" ({date})"
            ligne += f"\n    {extrait}\n    Source : {lien}"
            lignes.append(ligne)
        return "\n\n".join(lignes) + self._CONSIGNE


# ---------------------------------------------------------------------------
# Réseaux sociaux — Facebook Graph API
# ---------------------------------------------------------------------------

class PublicationReseauxTool(BaseTool):
    """
    Publie du contenu sur une page Facebook via l'API Graph de Meta.

    Credentials requis :
    - page_id      : ID numérique de la page (visible dans Paramètres de la page)
    - access_token : Token d'accès de la PAGE (pas le token utilisateur)
    - page_name    : Nom de la page (contexte pour le contenu, pas requis par l'API)

    Permission Facebook nécessaire : pages_manage_posts
    """
    name: str = "publication_reseaux_sociaux"
    description: str = (
        "Publie un post sur la page Facebook ou Instagram connectée. "
        "Fournis le contenu complet du post (texte, hashtags, appel à l'action). "
        "Adapte le ton à la cible clientèle et au secteur de la PME. "
        "Paramètres : contenu (str), plateforme (str, défaut 'facebook')."
    )
    page_id: str = ""
    access_token: str = ""
    page_name: str = ""

    def _run(self, contenu: str, plateforme: str = "facebook") -> str:
        if not self.access_token or not self.page_id:
            return (
                "[ERREUR] Identifiants Facebook manquants (page_id et/ou access_token). "
                "Renseignez-les via le formulaire de connexion."
            )

        plateforme = plateforme.lower().strip()

        if plateforme in ("facebook", "fb", "meta"):
            return self._publier_facebook(contenu)
        else:
            # Fallback : on publie quand même sur Facebook
            return (
                f"[INFO] Plateforme '{plateforme}' non encore supportée. "
                "Publication sur Facebook à la place.\n"
                + self._publier_facebook(contenu)
            )

    def _publier_facebook(self, contenu: str) -> str:
        """Appelle POST /{page_id}/feed sur l'API Graph Meta v19."""
        url = f"https://graph.facebook.com/v19.0/{self.page_id}/feed"
        payload = {
            "message": contenu,
            "access_token": self.access_token,
        }

        try:
            response = requests.post(url, data=payload, timeout=15)
            data = response.json()

            if "id" in data:
                page = self.page_name or self.page_id
                return (
                    f"[SUCCÈS] Post publié sur la page Facebook '{page}'.\n"
                    f"ID du post : {data['id']}\n"
                    f"Contenu publié :\n{contenu}"
                )

            error = data.get("error", {})
            code = error.get("code", "?")
            msg = error.get("message", str(data))
            return (
                f"[ERREUR Facebook API] Code {code} : {msg}\n"
                "Vérifiez que le token est un token de PAGE (pas utilisateur) "
                "avec la permission pages_manage_posts."
            )

        except requests.RequestException as exc:
            return f"[ERREUR réseau] Impossible de joindre l'API Facebook : {exc}"


# ---------------------------------------------------------------------------
# CRM — HubSpot (ou Pipedrive / Zoho selon base_url)
# ---------------------------------------------------------------------------

class RechercheCRMTool(BaseTool):
    """Recherche des contacts et prospects dans le CRM connecté (HubSpot par défaut)."""
    name: str = "recherche_crm"
    description: str = (
        "Recherche des contacts, clients et prospects dans le CRM. "
        "Utile pour trouver des leads, vérifier l'historique client, "
        "ou identifier des cibles de prospection. Précise le critère de recherche."
    )
    api_key: str = ""
    base_url: str = "https://api.hubapi.com"

    def _run(self, critere: str) -> str:
        if not self.api_key:
            return (
                "[OUTIL NON CONNECTÉ — recherche_crm] Aucun CRM n'est connecté. "
                "Je n'ai accès à AUCUN contact réel et je ne dois inventer aucun nom, email ou prospect. "
                "Message à transmettre au propriétaire : « Pour accéder à vos vrais contacts, veuillez "
                "connecter votre CRM dans le menu « Gérer les accès ». » "
                "Ne fournis aucune donnée tant que l'outil n'est pas connecté."
            )

        url = f"{self.base_url.rstrip('/')}/crm/v3/objects/contacts/search"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": critere,
            "limit": 10,
            "properties": ["firstname", "lastname", "email", "company", "phone", "lifecyclestage"],
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=12)

            if response.status_code == 401:
                return "[ERREUR CRM] Clé API invalide ou expirée."
            if response.status_code != 200:
                return f"[ERREUR CRM] HTTP {response.status_code} : {response.text[:300]}"

            data = response.json()
            contacts = data.get("results", [])

            if not contacts:
                return f"Aucun contact trouvé dans le CRM pour : {critere}"

            lignes = [f"Contacts CRM pour '{critere}' ({len(contacts)} résultats) :"]
            for c in contacts:
                p = c.get("properties", {})
                nom = f"{p.get('firstname', '')} {p.get('lastname', '')}".strip() or "Inconnu"
                email = p.get("email", "—")
                entreprise = p.get("company", "—")
                stage = p.get("lifecyclestage", "—")
                lignes.append(f"• {nom} | {email} | {entreprise} | Statut: {stage}")

            return "\n".join(lignes)

        except requests.RequestException as exc:
            return f"[ERREUR réseau CRM] {exc}"


# ---------------------------------------------------------------------------
# Facturation
# ---------------------------------------------------------------------------

class GenerationDevisTool(BaseTool):
    """Génère un devis via l'outil de facturation connecté (Pennylane, Sellsy...)."""
    name: str = "generation_devis"
    description: str = (
        "Génère un devis professionnel à partir d'une liste de prestations et d'un client. "
        "Précise : nom_client, liste des prestations avec prix unitaires et quantités."
    )
    api_key: str = ""
    base_url: str = ""

    def _run(self, prestations: str, client: str) -> str:
        if not self.api_key:
            return (
                "[OUTIL NON CONNECTÉ — generation_devis] Aucun outil de facturation n'est connecté. "
                "Je ne peux pas générer de devis réel et je ne dois pas en simuler. "
                "Message à transmettre au propriétaire : « Pour générer de vrais devis, veuillez connecter "
                "votre outil de facturation dans « Gérer les accès ». »"
            )
        # TODO: intégration Pennylane / Sellsy / Dolibarr selon self.base_url
        return (
            "[NON DISPONIBLE — generation_devis] L'intégration de facturation n'est pas encore active. "
            "Aucun devis réel n'a été créé."
        )


class GenerationFactureTool(BaseTool):
    """Génère une facture à partir d'un devis accepté."""
    name: str = "generation_facture"
    description: str = (
        "Convertit un devis accepté en facture officielle. "
        "Précise le devis_id ou les détails de la prestation et le client."
    )
    api_key: str = ""
    base_url: str = ""

    def _run(self, devis_id: str) -> str:
        if not self.api_key:
            return (
                "[OUTIL NON CONNECTÉ — generation_facture] Aucun outil de facturation n'est connecté. "
                "Aucune facture réelle ne peut être créée et je ne dois pas en simuler. "
                "Demande au propriétaire de connecter son outil de facturation dans « Gérer les accès »."
            )
        return (
            "[NON DISPONIBLE — generation_facture] L'intégration de facturation n'est pas encore active. "
            "Aucune facture réelle n'a été créée."
        )


class SuiviPaiementTool(BaseTool):
    """Vérifie le statut de paiement des factures."""
    name: str = "suivi_paiement"
    description: str = (
        "Vérifie si une facture a été payée, est en retard ou en attente. "
        "Permet de relancer automatiquement les clients en retard de paiement."
    )
    api_key: str = ""

    def _run(self, facture_id: str) -> str:
        if not self.api_key:
            return (
                "[OUTIL NON CONNECTÉ — suivi_paiement] Aucun outil de facturation n'est connecté. "
                "Je n'ai aucune information de paiement réelle et je ne dois inventer aucun statut ni délai. "
                "Demande au propriétaire de connecter son outil de facturation dans « Gérer les accès »."
            )
        return (
            "[NON DISPONIBLE — suivi_paiement] L'intégration de facturation n'est pas encore active. "
            "Aucun statut de paiement réel n'est disponible."
        )


# ---------------------------------------------------------------------------
# Email SMTP
# ---------------------------------------------------------------------------

class EnvoiEmailTool(BaseTool):
    """
    Envoie des emails via SMTP (Gmail, Outlook, serveur dédié...).

    Credentials requis :
    - smtp_host      : ex. smtp.gmail.com
    - smtp_port      : 587 (STARTTLS) ou 465 (SSL)
    - smtp_user      : adresse email d'envoi (aussi utilisée pour les résumés au propriétaire)
    - smtp_password  : mot de passe d'application Gmail ou mot de passe SMTP
    - smtp_from_name : nom affiché comme expéditeur (ex : "Saveurs du Sahel") — optionnel

    Cas d'usage :
    - Envoyer des emails aux clients (newsletters, relances, fidélisation)
    - Envoyer des résumés / rapports au propriétaire (destinataire = smtp_user)
    - Envoyer à plusieurs destinataires séparés par des virgules
    """
    name: str = "envoi_email"
    description: str = (
        "Envoie un email via SMTP. Supporte un ou plusieurs destinataires (séparés par des virgules). "
        "Pour envoyer un résumé au propriétaire, utilise son adresse email comme destinataire. "
        "Paramètres : destinataire (email ou liste emails séparés par virgule), "
        "sujet (str), corps (texte complet personnalisé)."
    )
    smtp_host: str = ""
    smtp_port: str = "587"
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = ""

    def _expediteur(self) -> str:
        """Construit l'adresse expéditeur avec nom affiché si disponible."""
        if self.smtp_from_name:
            return f"{self.smtp_from_name} <{self.smtp_user}>"
        return self.smtp_user

    def _connecter(self) -> smtplib.SMTP:
        """Ouvre et authentifie la connexion SMTP."""
        port = int(self.smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(self.smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(self.smtp_host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        server.login(self.smtp_user, self.smtp_password)
        return server

    def _run(self, destinataire: str, sujet: str, corps: str) -> str:
        if not self.smtp_host or not self.smtp_user or not self.smtp_password:
            return (
                "[EMAIL NON ENVOYÉ — SMTP non configuré] L'email a bien été rédigé mais il ne peut PAS "
                "être envoyé tant que l'accès email (SMTP) n'est pas connecté. Ne prétends pas qu'il a été "
                "envoyé. Message à transmettre au propriétaire : « Pour envoyer réellement vos emails, "
                "veuillez connecter votre accès email dans « Gérer les accès ». »\n"
                f"  Brouillon — À : {destinataire} | Sujet : {sujet}"
            )

        # Supporte plusieurs destinataires séparés par des virgules
        destinataires = [d.strip() for d in destinataire.split(",") if d.strip()]
        if not destinataires:
            return "[ERREUR] Aucun destinataire valide fourni."

        expediteur = self._expediteur()
        resultats = []
        erreurs = []

        try:
            server = self._connecter()
            with server:
                for dest in destinataires:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = sujet
                    msg["From"] = expediteur
                    msg["To"] = dest
                    msg.attach(MIMEText(corps, "plain", "utf-8"))
                    try:
                        server.sendmail(self.smtp_user, dest, msg.as_string())
                        resultats.append(dest)
                    except smtplib.SMTPException as exc:
                        erreurs.append(f"{dest} → {exc}")

        except smtplib.SMTPAuthenticationError:
            return (
                "[ERREUR SMTP] Authentification refusée.\n"
                "Pour Gmail : Compte Google → Sécurité → Mots de passe d'application."
            )
        except OSError as exc:
            return f"[ERREUR réseau] Impossible de joindre {self.smtp_host}:{self.smtp_port} — {exc}"

        lignes = [f"[SUCCÈS] {len(resultats)} email(s) envoyé(s)."]
        if resultats:
            lignes.append(f"  Destinataires : {', '.join(resultats)}")
            lignes.append(f"  Sujet         : {sujet}")
            lignes.append(f"  Expéditeur    : {expediteur}")
        if erreurs:
            lignes.append(f"  Échecs ({len(erreurs)}) : {'; '.join(erreurs)}")
        return "\n".join(lignes)


# ---------------------------------------------------------------------------
# Calendrier
# ---------------------------------------------------------------------------

class PlanificationCalendrierTool(BaseTool):
    """Planifie des événements et rendez-vous dans Google Calendar ou Outlook."""
    name: str = "planification_calendrier"
    description: str = (
        "Planifie des événements : réunions clients, campagnes, publications programmées, "
        "deadlines. Précise : titre, date_heure (format YYYY-MM-DD HH:MM), "
        "durée_minutes, description (optionnel)."
    )
    api_key: str = ""
    calendar_id: str = "primary"

    def _run(self, titre: str, date_heure: str, duree_minutes: str = "60") -> str:
        if not self.api_key:
            return (
                "[OUTIL NON CONNECTÉ — planification_calendrier] Aucun calendrier n'est connecté. "
                "Je ne peux pas créer d'événement réel et je ne dois pas en simuler. "
                "Demande au propriétaire de connecter son calendrier (Google/Outlook) dans « Gérer les accès »."
            )
        # TODO: googleapiclient.discovery.build("calendar", "v3", ...).events().insert(...)
        return (
            "[NON DISPONIBLE — planification_calendrier] L'intégration calendrier n'est pas encore active. "
            "Aucun événement réel n'a été créé."
        )


# ---------------------------------------------------------------------------
# Analyse des données de ventes
# ---------------------------------------------------------------------------

class AnalyseDonneesVentesTool(BaseTool):
    """
    Lit et analyse des données depuis un fichier CSV ou Google Sheets.

    Deux usages principaux :
    1. metrique="contacts"   → extrait la liste des clients avec leurs emails
       (utile pour l'agent email qui va ensuite envoyer des messages personnalisés)
    2. metrique="ventes"     → analyse les ventes, CA, produits, tendances

    Supporte les URLs Google Sheets (converties automatiquement en export CSV)
    et les URLs directes vers des fichiers CSV publics.
    """
    name: str = "analyse_donnees_ventes"
    description: str = (
        "Lit des données depuis un Google Sheet ou fichier CSV connecté. "
        "Utilise metrique='contacts' pour extraire la liste des clients avec leurs emails "
        "(indispensable avant d'envoyer des emails marketing). "
        "Utilise metrique='ventes' pour analyser CA, tendances et produits. "
        "Paramètres : periode (contexte temporel, ex: 'juin 2025'), "
        "metrique ('contacts' | 'ventes' | nom de colonne)."
    )
    source_url: str = ""
    api_key: str = ""

    # Colonnes typiquement utilisées pour les emails et les noms
    _EMAIL_COLS = {"email", "mail", "courriel", "e-mail", "adresse_email", "adresse mail", "email_client"}
    _NOM_COLS   = {"nom", "name", "prenom", "prénom", "firstname", "lastname", "client", "contact", "full_name"}

    def _vers_csv_url(self, url: str) -> str:
        """Convertit une URL Google Sheets en URL d'export CSV."""
        import re
        match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
        if match:
            sheet_id = match.group(1)
            gid_match = re.search(r"gid=(\d+)", url)
            gid = gid_match.group(1) if gid_match else "0"
            return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
        return url  # déjà une URL CSV directe

    def _charger_csv(self) -> list[dict]:
        """Télécharge et parse le CSV depuis source_url (Google Sheets ou URL directe)."""
        import io, csv
        url = self._vers_csv_url(self.source_url)
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        reader = csv.DictReader(io.StringIO(response.text))
        return list(reader)

    def _trouver_colonne(self, colonnes: list[str], candidats: set[str]) -> str | None:
        """Trouve la première colonne dont le nom (en minuscules) est dans les candidats."""
        for col in colonnes:
            if col.strip().lower() in candidats:
                return col
        # Recherche partielle si aucun match exact
        for col in colonnes:
            if any(c in col.strip().lower() for c in candidats):
                return col
        return None

    def _run(self, periode: str, metrique: str = "ventes") -> str:
        if not self.source_url:
            if metrique == "contacts":
                return (
                    "[OUTIL NON CONNECTÉ — analyse_donnees_ventes] Aucune source de données "
                    "(Google Sheet / CSV) n'est connectée. Je n'ai AUCUNE liste de clients réelle "
                    "et je ne dois inventer aucun contact ni email. "
                    "Message à transmettre au propriétaire : « Pour récupérer vos clients, veuillez "
                    "connecter votre Google Sheet / fichier CSV dans « Gérer les accès ». »"
                )
            return (
                "[OUTIL NON CONNECTÉ — analyse_donnees_ventes] Aucune source de ventes n'est connectée. "
                "Je n'ai AUCUN chiffre de vente réel et je ne dois inventer aucun montant, CA, produit "
                "ou tendance. Message à transmettre au propriétaire : « Pour analyser vos ventes, veuillez "
                "connecter votre Google Sheet / fichier CSV de ventes dans « Gérer les accès ». » "
                "Ne fournis aucune statistique tant que la source n'est pas connectée."
            )

        try:
            lignes = self._charger_csv()
        except Exception as exc:
            return f"[ERREUR] Impossible de lire la source : {exc}"

        if not lignes:
            return "Source de données vide ou format non reconnu."

        colonnes = list(lignes[0].keys())

        # ── Mode contacts : extraire emails + noms ──────────────────────────
        if metrique == "contacts":
            col_email = self._trouver_colonne(colonnes, self._EMAIL_COLS)
            col_nom   = self._trouver_colonne(colonnes, self._NOM_COLS)

            if not col_email:
                return (
                    f"[INFO] Aucune colonne email trouvée dans la source ({len(lignes)} lignes).\n"
                    f"Colonnes disponibles : {', '.join(colonnes)}\n"
                    "Assurez-vous qu'une colonne s'appelle 'email', 'mail' ou 'courriel'."
                )

            contacts = []
            sans_email = 0
            for row in lignes[:200]:  # limite raisonnable
                email = row.get(col_email, "").strip()
                nom   = row.get(col_nom, "").strip() if col_nom else ""
                if email and "@" in email:
                    contacts.append({"nom": nom or "Client", "email": email, "row": row})
                else:
                    sans_email += 1

            if not contacts:
                return f"Aucun email valide trouvé dans la colonne '{col_email}'."

            lignes_affichage = [
                f"[CONTACTS] {len(contacts)} clients avec emails (sur {len(lignes)} lignes) :"
            ]
            for c in contacts[:50]:  # affiche 50 max dans le contexte
                autres = {k: v for k, v in c["row"].items()
                          if k not in (col_email, col_nom or "") and v.strip()}
                infos = " | ".join(f"{k}: {v}" for k, v in list(autres.items())[:3])
                ligne = f"  • {c['nom']} — {c['email']}"
                if infos:
                    ligne += f"  ({infos})"
                lignes_affichage.append(ligne)

            if len(contacts) > 50:
                lignes_affichage.append(f"  ... et {len(contacts) - 50} autres contacts.")
            if sans_email:
                lignes_affichage.append(f"  ({sans_email} lignes sans email ignorées)")
            lignes_affichage.append(
                "\nACTION : Pour envoyer des emails, appelle envoi_email pour chaque contact "
                "en personnalisant le corps avec le nom du client."
            )
            return "\n".join(lignes_affichage)

        # ── Mode ventes : analyse générale ─────────────────────────────────
        col_montant = self._trouver_colonne(colonnes, {"montant", "total", "ca", "prix", "amount", "revenue", "chiffre"})
        col_produit = self._trouver_colonne(colonnes, {"produit", "product", "article", "service", "item"})

        resume = [
            f"Données ventes — {periode} ({len(lignes)} lignes, {len(colonnes)} colonnes)",
            f"Colonnes : {', '.join(colonnes)}",
        ]

        if col_montant:
            montants = []
            for row in lignes:
                try:
                    montants.append(float(str(row[col_montant]).replace(" ", "").replace(",", ".")))
                except (ValueError, TypeError):
                    pass
            if montants:
                resume.append(
                    f"Montant total : {sum(montants):,.0f} | "
                    f"Moyenne : {sum(montants)/len(montants):,.0f} | "
                    f"Max : {max(montants):,.0f}"
                )

        if col_produit:
            from collections import Counter
            produits = Counter(row[col_produit].strip() for row in lignes if row.get(col_produit, "").strip())
            top = produits.most_common(5)
            resume.append("Top produits : " + ", ".join(f"{p} ({n})" for p, n in top))

        return "\n".join(resume)


# ---------------------------------------------------------------------------
# Registry et factory
# ---------------------------------------------------------------------------

class AnalyseSentimentFacebookTool(BaseTool):
    """Analyse les commentaires des posts récents de la page Facebook (positif/neutre/négatif + alerte)."""
    name: str = "analyse_sentiment_facebook"
    description: str = (
        "Analyse les commentaires des publications récentes de la page Facebook de la PME. "
        "Mesure la satisfaction client : répartition positif / neutre / négatif, et signale "
        "une alerte si trop de commentaires négatifs. Paramètre optionnel : nb_posts (défaut 5)."
    )
    page_id: str = ""
    access_token: str = ""

    def _run(self, nb_posts: int = 5) -> str:
        from tools.sentiment_core import analyser_sentiments_facebook, formater_rapport
        if not self.page_id or not self.access_token:
            return "[ERREUR] page_id et access_token (token de PAGE) manquants pour l'analyse de sentiment."
        try:
            nb = int(nb_posts)
        except (ValueError, TypeError):
            nb = 5
        resultat = analyser_sentiments_facebook(self.page_id, self.access_token, nb_posts=nb)
        return formater_rapport(resultat)


_TOOL_CLASSES: dict[str, type[BaseTool]] = {
    "recherche_web":                RechercheWebTool,
    "redaction_contenu":            RedactionContenuTool,
    "publication_reseaux_sociaux":  PublicationReseauxTool,
    "recherche_crm":                RechercheCRMTool,
    "generation_devis":             GenerationDevisTool,
    "generation_facture":           GenerationFactureTool,
    "suivi_paiement":               SuiviPaiementTool,
    "envoi_email":                  EnvoiEmailTool,
    "planification_calendrier":     PlanificationCalendrierTool,
    "analyse_donnees_ventes":       AnalyseDonneesVentesTool,
    "analyse_sentiment_facebook":   AnalyseSentimentFacebookTool,
}


def get_tools(noms_outils: list[str], credentials: dict[str, dict] | None = None) -> list[BaseTool]:
    """
    Crée des instances fraîches des outils demandés avec les credentials injectés.

    credentials = {
        "publication_reseaux_sociaux": {"page_id": "...", "access_token": "...", "page_name": "..."},
        "envoi_email": {"smtp_host": "...", "smtp_port": "587", "smtp_user": "...", "smtp_password": "..."},
        ...
    }

    Si un outil est inconnu → ignoré silencieusement.
    Si les credentials ne correspondent pas aux champs → instance vide (mode simulation).
    """
    credentials = credentials or {}
    tools = []
    for nom in noms_outils:
        cls = _TOOL_CLASSES.get(nom)
        if cls is None:
            continue
        creds = credentials.get(nom, {})
        try:
            tool = cls(**creds)
        except Exception:
            tool = cls()
        tools.append(tool)
    return tools
