import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Auth() {
  const { connexion, inscription, setAppState } = useApp()
  const [mode, setMode] = useState('login')   // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await connexion(email, password)
      } else {
        await inscription(email, password)
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-tanga-cream flex flex-col">
      <div className="kente-stripe" />

      {/* Nav minimal */}
      <nav className="sticky top-0 z-30 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setAppState('landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8">
              <img src="/logo.png" alt="TangaAI" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl text-tanga-charcoal tracking-tight">
              Tanga<span className="text-tanga-ochre">AI</span>
            </span>
          </button>
        </div>
      </nav>

      {/* Formulaire centré */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="tanga-card p-8 relative overflow-hidden">
            <div className="kente-border-top" />

            {/* En-tête */}
            <div className="pt-3 mb-6 text-center">
              <h1 className="text-2xl font-bold text-tanga-charcoal">
                {mode === 'login' ? 'Bon retour !' : 'Créer un compte'}
              </h1>
              <p className="text-tanga-charcoal-light text-sm mt-1">
                {mode === 'login'
                  ? 'Retrouvez vos agents et vos sessions.'
                  : 'Vos agents vous attendent.'}
              </p>
            </div>

            {/* Onglets */}
            <div className="flex rounded-xl overflow-hidden border border-tanga-sand mb-6">
              {['login', 'register'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    mode === m
                      ? 'bg-tanga-ochre text-white'
                      : 'text-tanga-charcoal-light hover:bg-tanga-cream'
                  }`}
                >
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@entreprise.com"
                  className="tanga-input text-sm"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
                  Mot de passe
                  {mode === 'register' && (
                    <span className="font-normal text-tanga-charcoal-light ml-2 text-xs">
                      (6 caractères minimum)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="tanga-input text-sm"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? (mode === 'login' ? 'Connexion...' : 'Création...')
                  : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
              </button>
            </form>

            {/* Continuer sans compte */}
            <div className="mt-5 text-center">
              <button
                onClick={() => setAppState('onboarding')}
                className="text-xs text-tanga-charcoal-light hover:text-tanga-ochre transition-colors underline underline-offset-2"
              >
                Continuer sans compte
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="kente-stripe" />
    </div>
  )
}
