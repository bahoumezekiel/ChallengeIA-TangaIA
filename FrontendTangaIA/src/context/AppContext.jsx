import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  analyserProfil,
  reprendreSession,
  fournirCredentials,
  inscrire,
  seConnecter,
  verifierToken,
} from '../api/client.js'

const AppContext = createContext(null)

const INITIAL_PROFIL = {
  nom_entreprise: '',
  secteur: '',
  taille_effectif: 1,
  cible_clientele: '',
  objectifs_court_terme: [],
  objectifs_long_terme: [],
  services_souhaites: [],
  budget_indicatif: 'moyen',
  contraintes: [],
}

export function AppProvider({ children }) {
  const [appState, setAppState] = useState('landing')
  const [profilPme, setProfilPme] = useState(INITIAL_PROFIL)
  const [sessionId, setSessionId] = useState(null)
  const [results, setResults] = useState(null)
  const [loadingError, setLoadingError] = useState(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)      // { user_id, email }
  // Ne démarre en "loading" que si un token existe — évite le flash de spinner
  const [authLoading, setAuthLoading] = useState(
    () => !!localStorage.getItem('tanga_token')
  )

  // Restauration automatique au démarrage si un token existe en localStorage
  useEffect(() => {
    const token = localStorage.getItem('tanga_token')
    if (!token) return   // pas de token → authLoading déjà false

    verifierToken().then((data) => {
      if (!data) {
        // Token invalide ou expiré
        localStorage.removeItem('tanga_token')
        setAuthLoading(false)
        return
      }
      setUser({ user_id: data.user_id, email: data.email })
      _restoreSession(data.session)
      setAuthLoading(false)
    }).catch(() => {
      // Erreur réseau : on garde le token, on continue en mode non-connecté
      setAuthLoading(false)
    })
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // Applique une session sauvegardée au state React
  function _restoreSession(session) {
    if (session?.last_results?.statut === 'termine') {
      setSessionId(session.session_id)
      setProfilPme(session.profil_pme || INITIAL_PROFIL)
      setResults(session.last_results)
      setAppState('dashboard')
    } else if (session?.profil_pme) {
      setProfilPme(session.profil_pme)
      setSessionId(session.session_id)
      setAppState('onboarding')
    } else {
      setAppState('onboarding')
    }
  }

  const connexion = useCallback(async (email, password) => {
    const data = await seConnecter(email, password)
    localStorage.setItem('tanga_token', data.token)
    setUser({ user_id: data.user_id, email: data.email })
    _restoreSession(data.session)
    return data
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const inscription = useCallback(async (email, password) => {
    const data = await inscrire(email, password)
    localStorage.setItem('tanga_token', data.token)
    setUser({ user_id: data.user_id, email: data.email })
    setAppState('onboarding')
    return data
  }, [])

  const deconnexion = useCallback(() => {
    localStorage.removeItem('tanga_token')
    setUser(null)
    setProfilPme(INITIAL_PROFIL)
    setSessionId(null)
    setResults(null)
    setLoadingError(null)
    setAppState('landing')
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const updateProfil = useCallback((updates) => {
    setProfilPme((prev) => ({ ...prev, ...updates }))
  }, [])

  const resetSession = useCallback(() => {
    setProfilPme(INITIAL_PROFIL)
    setSessionId(null)
    setResults(null)
    setLoadingError(null)
    // Si connecté → retour onboarding, sinon landing
    setAppState(user ? 'onboarding' : 'landing')
  }, [user])

  const lancerAnalyse = useCallback(async (profil) => {
    setLoadingError(null)
    setAppState('loading')
    try {
      const response = await analyserProfil(profil, null)
      setSessionId(response.session_id)
      setResults(response)
      if (response.statut === 'en_attente_credentials') {
        setAppState('credentials')
      } else {
        setAppState('dashboard')
      }
    } catch (err) {
      setLoadingError(err.message || 'Une erreur inattendue est survenue.')
    }
  }, [])

  const soumettreCreds = useCallback(async (toolName, credentials) => {
    if (!sessionId) throw new Error('Session non initialisée')
    return fournirCredentials(sessionId, toolName, credentials)
  }, [sessionId])

  const reprendreAnalyse = useCallback(async () => {
    if (!sessionId) throw new Error('Session non initialisée')
    setLoadingError(null)
    setAppState('loading')
    try {
      const response = await reprendreSession(sessionId)
      setResults(response)
      if (response.statut === 'en_attente_credentials') {
        setAppState('credentials')
      } else {
        setAppState('dashboard')
      }
    } catch (err) {
      setLoadingError(err.message || 'Erreur lors de la reprise.')
      setAppState('loading')
    }
  }, [sessionId])

  const value = {
    appState,
    setAppState,
    profilPme,
    setProfilPme,
    updateProfil,
    sessionId,
    setSessionId,
    results,
    setResults,
    loadingError,
    setLoadingError,
    lancerAnalyse,
    soumettreCreds,
    reprendreAnalyse,
    resetSession,
    // Auth
    user,
    authLoading,
    connexion,
    inscription,
    deconnexion,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
