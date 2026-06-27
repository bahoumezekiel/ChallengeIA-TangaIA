// En dev local : '/api' → proxié par Vite vers localhost:8000
// Pour mobile / ngrok : définir VITE_API_URL=https://xxxx.ngrok-free.app dans .env.local
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function authHeader() {
  const token = localStorage.getItem('tanga_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse(res, defaultMsg) {
  if (!res.ok) {
    let msg = `${defaultMsg} (${res.status})`
    try {
      const err = await res.json()
      msg = err.detail || err.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function inscrire(email, password) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(res, "Erreur lors de l'inscription")
}

export async function seConnecter(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(res, 'Email ou mot de passe incorrect')
}

export async function verifierToken() {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  if (!res.ok) return null
  return res.json()
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export async function analyserProfil(profilPme, sessionId = null) {
  const res = await fetch(`${BASE_URL}/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ profil_pme: profilPme, session_id: sessionId }),
  })
  return handleResponse(res, 'Erreur serveur')
}

export async function fournirCredentials(sessionId, toolName, credentials) {
  const res = await fetch(`${BASE_URL}/session/${encodeURIComponent(sessionId)}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ tool_name: toolName, credentials }),
  })
  return handleResponse(res, "Erreur lors de l'envoi des credentials")
}

export async function reprendreSession(sessionId) {
  const res = await fetch(`${BASE_URL}/session/${encodeURIComponent(sessionId)}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Erreur lors de la reprise de session')
}

export async function obtenirEtatSession(sessionId) {
  const res = await fetch(`${BASE_URL}/session/${encodeURIComponent(sessionId)}/etat`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, "Impossible de récupérer l'état de la session")
}

// ── Agents CRUD ────────────────────────────────────────────────────────────────

export async function listerAgents(sessionId) {
  const res = await fetch(`${BASE_URL}/session/${encodeURIComponent(sessionId)}/agents`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Impossible de récupérer les agents')
}

export async function creerAgent(sessionId, spec) {
  const res = await fetch(`${BASE_URL}/session/${encodeURIComponent(sessionId)}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(spec),
  })
  return handleResponse(res, "Erreur lors de la création de l'agent")
}

export async function modifierAgent(agentId, partialSpec) {
  const res = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(partialSpec),
  })
  return handleResponse(res, "Erreur lors de la modification de l'agent")
}

export async function basculerAgent(agentId) {
  const res = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/statut`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, "Erreur lors du changement de statut de l'agent")
}

export async function supprimerAgent(agentId) {
  const res = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (res.status === 204) return true
  return handleResponse(res, "Erreur lors de la suppression de l'agent")
}

// ── Onboarding conversationnel (NOS features) ───────────────────────────────────

export async function onboardingMessage(messages = []) {
  const res = await fetch(`${BASE_URL}/onboarding/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ messages }),
  })
  return handleResponse(res, "Erreur lors de l'onboarding")
}

// ── Historique (NOS features) ───────────────────────────────────────────────────

export async function getHistorique(sessionId = null, limit = 50) {
  const params = new URLSearchParams()
  if (sessionId) params.set('session_id', sessionId)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  const res = await fetch(`${BASE_URL}/historique${qs ? `?${qs}` : ''}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, "Impossible de récupérer l'historique")
}

// ── Analyse de sentiment Facebook (NOS features) ────────────────────────────────

export async function getSentiment(sessionId, nbPosts = 5) {
  const res = await fetch(`${BASE_URL}/sentiment/${encodeURIComponent(sessionId)}?nb_posts=${nbPosts}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, "Impossible d'analyser les avis Facebook")
}

// ── Tableau de bord ventes (NOS features) ───────────────────────────────────────

export async function getVentes(sessionId, { granularite = 'mois', sourceUrl = null } = {}) {
  const params = new URLSearchParams({ granularite })
  if (sourceUrl) params.set('source_url', sourceUrl)
  const res = await fetch(`${BASE_URL}/ventes/${encodeURIComponent(sessionId)}?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Impossible de charger les ventes')
}

// ── Publications programmées (NOS features) ─────────────────────────────────────

export async function programmerPublication(payload) {
  const res = await fetch(`${BASE_URL}/publications/programmer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  return handleResponse(res, 'Erreur lors de la programmation')
}

export async function listerPublications(sessionId = null) {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
  const res = await fetch(`${BASE_URL}/publications${qs}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Impossible de récupérer les publications')
}

export async function getPublication(pubId) {
  const res = await fetch(`${BASE_URL}/publications/${encodeURIComponent(pubId)}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Publication introuvable')
}

export async function annulerPublication(pubId) {
  const res = await fetch(`${BASE_URL}/publications/${encodeURIComponent(pubId)}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  return handleResponse(res, "Impossible d'annuler la publication")
}

// ── Notifications (NOS features) ────────────────────────────────────────────────

export async function getNotifications(sessionId = null) {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
  const res = await fetch(`${BASE_URL}/notifications${qs}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  return handleResponse(res, 'Impossible de récupérer les notifications')
}

export async function markNotificationRead(notifId) {
  const res = await fetch(`${BASE_URL}/notifications/${encodeURIComponent(notifId)}/lue`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  return handleResponse(res, 'Erreur')
}

export async function markAllNotificationsRead(sessionId = null) {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
  const res = await fetch(`${BASE_URL}/notifications/lues${qs}`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  return handleResponse(res, 'Erreur')
}
