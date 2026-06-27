/**
 * toolsSchema.js — Miroir frontend du TOOL_CREDENTIALS_SCHEMA backend.
 * Doit rester synchronisé avec memory/credentials.py côté Python.
 *
 * Note : plus de champ `icon` (emoji). Les icônes sont rendues par <ToolGlyph tool=... />
 * depuis components/icons.jsx, à partir du nom de l'outil.
 */

export const TOOLS_SCHEMA = {
  publication_reseaux_sociaux: {
    label: 'Réseaux sociaux (Facebook / Instagram)',
    fields: {
      page_id:      'ID numérique de votre page Facebook (Paramètres → Infos → "ID de la page")',
      access_token: "Token d'accès de la PAGE (Meta Business Suite → Paramètres → Accès à l'API)",
      page_name:    'Nom de votre page (ex : Saveurs du Sahel)',
    },
    hints: {
      page_id:      'Paramètres de la page → Infos générales → "ID de la page"',
      access_token: "Meta Business Suite → Paramètres → Accès à l'API → Token de la page",
    },
    placeholders: {
      page_id:      'ex : 123456789012345',
      access_token: 'EAAxxxx...',
      page_name:    'ex : Saveurs du Sahel',
    },
  },
  analyse_sentiment_facebook: {
    label: 'Analyse des avis Facebook',
    fields: {
      page_id:      'ID numérique de votre page Facebook',
      access_token: "Token d'accès de la PAGE (le même que pour la publication)",
    },
    hints: {
      access_token: 'Identique à celui de la publication Facebook — token de PAGE',
    },
    placeholders: {
      page_id:      'ex : 123456789012345',
      access_token: 'EAAxxxx...',
    },
  },
  recherche_crm: {
    label: 'CRM (HubSpot, Pipedrive, Zoho…)',
    fields: {
      api_key:  'Clé API de votre CRM',
      base_url: 'URL de votre CRM (ex : https://api.hubspot.com)',
    },
    hints: {
      api_key: 'Disponible dans les paramètres développeur de votre CRM',
    },
    placeholders: {
      api_key:  'sk-... ou votre clé API',
      base_url: 'https://api.hubspot.com',
    },
  },
  envoi_email: {
    label: 'Email (SMTP)',
    fields: {
      smtp_host:      'Serveur SMTP (ex : smtp.gmail.com)',
      smtp_port:      'Port SMTP (587 = TLS recommandé, 465 = SSL)',
      smtp_user:      "Votre adresse email d'envoi (aussi pour recevoir les résumés)",
      smtp_password:  "Mot de passe d'application (16 caractères) — pas votre mot de passe habituel",
      smtp_from_name: "Nom affiché comme expéditeur (optionnel, ex : Saveurs du Sahel)",
    },
    hints: {
      smtp_password:  "Gmail : Compte Google → Sécurité → Authentification en 2 étapes → Mots de passe d'application",
      smtp_from_name: "Vos clients verront ce nom dans leur boîte mail au lieu de votre adresse brute",
    },
    placeholders: {
      smtp_host:      'smtp.gmail.com',
      smtp_port:      '587',
      smtp_user:      'contact@votreentreprise.com',
      smtp_password:  'abcd efgh ijkl mnop',
      smtp_from_name: 'Saveurs du Sahel',
    },
  },
  planification_calendrier: {
    label: 'Calendrier (Google Calendar, Outlook…)',
    fields: {
      api_key:     'Clé API calendrier',
      calendar_id: 'ID du calendrier (ex : primary pour Google)',
    },
    placeholders: {
      api_key:     'votre-clé-api',
      calendar_id: 'primary',
    },
  },
  generation_devis: {
    label: 'Outil de devis (Pennylane, Sellsy, Dolibarr…)',
    fields: {
      api_key:  'Clé API de votre outil de facturation',
      base_url: "URL de l'API (si auto-hébergé)",
    },
    placeholders: {
      api_key:  'votre-clé-api',
      base_url: 'https://api.pennylane.com',
    },
  },
  generation_facture: {
    label: 'Outil de facturation',
    fields: {
      api_key:  'Clé API de votre outil de facturation',
      base_url: "URL de l'API (si auto-hébergé)",
    },
    placeholders: {
      api_key:  'votre-clé-api',
      base_url: 'https://api.pennylane.com',
    },
  },
  suivi_paiement: {
    label: 'Suivi des paiements',
    fields: {
      api_key: 'Clé API de votre outil de facturation',
    },
    placeholders: {
      api_key: 'votre-clé-api',
    },
  },
  recherche_web: {
    label: 'Moteur de recherche web (Serper.dev)',
    fields: {
      api_key: 'Clé API Serper.dev (laisser vide = recherche désactivée, pas d\'invention)',
    },
    hints: {
      api_key: 'Créez un compte gratuit sur serper.dev pour obtenir une clé API',
    },
    placeholders: {
      api_key: 'votre-clé-serper',
    },
  },
  analyse_donnees_ventes: {
    label: 'Contacts clients (Google Sheets / CSV)',
    fields: {
      source_url: 'URL de votre Google Sheet ou fichier CSV avec vos clients',
      api_key:    'Clé API si votre source nécessite une authentification (optionnel)',
    },
    hints: {
      source_url: "Google Sheets : partagez la feuille en lecture publique, puis collez l'URL. Votre feuille doit avoir une colonne nommée 'email' ou 'mail'.",
    },
    placeholders: {
      source_url: 'https://docs.google.com/spreadsheets/d/VOTRE_ID/edit',
      api_key:    'optionnel',
    },
  },
}

// Outils qui n'ont pas besoin de credentials (LLM only)
export const TOOLS_NO_CREDENTIALS = new Set(['redaction_contenu'])

export function isPasswordField(key) {
  return ['token', 'secret', 'password', 'key'].some((k) => key.toLowerCase().includes(k))
}
