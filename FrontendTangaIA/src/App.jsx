import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import Landing from './components/Landing.jsx'
import Auth from './components/Auth.jsx'
import OnboardingHub from './components/Onboarding/OnboardingHub.jsx'
import Loading from './components/Loading.jsx'
import Dashboard from './components/Dashboard/Dashboard.jsx'
import CredentialsModal from './components/CredentialsModal.jsx'
import SplashScreen from './components/SplashScreen.jsx'

function AppRouter() {
  const { appState, results, authLoading } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading) return   // attend la vérification du token

    // On lit window.location.pathname (toujours à jour) sans en faire une dep réactive.
    // Si on mettait location.pathname dans les deps, le bouton "retour" du navigateur
    // déclencherait l'effet et forcerait la navigation inverse — comportement non désiré.
    const currentPath = window.location.pathname

    const targets = {
      landing:     '/',
      auth:        '/auth',
      onboarding:  '/onboarding',
      loading:     '/loading',
      credentials: '/loading',
      dashboard:   '/dashboard',
    }
    const target = targets[appState]
    if (target && currentPath !== target) {
      navigate(target, { replace: true })
    }
  }, [appState, authLoading, navigate])   // eslint-disable-line react-hooks/exhaustive-deps

  // Spinner pendant la vérification du token au démarrage
  if (authLoading) {
    return (
      <div className="min-h-screen bg-tanga-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12">
            <img src="/logo.png" alt="TangaAI" className="w-full h-full object-contain animate-pulse" />
          </div>
          <p className="text-sm text-tanga-charcoal-light">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<OnboardingHub />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      {appState === 'credentials' && results?.notification && (
        <CredentialsModal />
      )}
    </>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)
  return (
    <>
      <AppRouter />
      {booting && <SplashScreen onFinish={() => setBooting(false)} />}
    </>
  )
}
