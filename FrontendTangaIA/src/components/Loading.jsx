import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Search, Bot, Users, Rocket, Zap, BarChart, Check, AlertTriangle } from './icons.jsx'

const MESSAGES = [
  { text: 'Analyse de votre profil...', Icon: Search },
  { text: 'Sélection des agents...', Icon: Bot },
  { text: 'Constitution de l\'équipe...', Icon: Users },
  { text: 'Lancement des agents...', Icon: Rocket },
  { text: 'Traitement en cours...', Icon: Zap },
  { text: 'Optimisation des stratégies...', Icon: BarChart },
  { text: 'Finalisation des livrables...', Icon: Check },
]

function AfricaSpinner() {
  return (
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 rounded-full border-4 border-tanga-sand animate-spin"
           style={{ borderTopColor: '#C17A3B', animationDuration: '1.2s' }} />
      <div className="absolute inset-2 rounded-full border-tanga-sand/50 animate-spin"
           style={{ borderBottomColor: '#2D5A27', animationDuration: '1.8s', animationDirection: 'reverse', borderWidth: '3px' }} />
      <div className="absolute inset-6 rounded-full bg-tanga-ochre/10 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-tanga-ochre animate-pulse" />
      </div>
    </div>
  )
}

function AgentDot({ label, color, delay }) {
  return (
    <div className="flex flex-col items-center gap-2" style={{ animationDelay: delay }}>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold animate-pulse"
        style={{ backgroundColor: color, animationDelay: delay }}
      >
        {label[0].toUpperCase()}
      </div>
      <span className="text-xs text-tanga-charcoal-light font-medium">{label}</span>
    </div>
  )
}

export default function Loading() {
  const { loadingError, setAppState, resetSession } = useApp()
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (loadingError) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % MESSAGES.length)
        setVisible(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [loadingError])

  const current = MESSAGES[msgIndex]
  const CurrentIcon = current.Icon

  if (loadingError) {
    return (
      <div className="min-h-screen bg-tanga-cream flex flex-col items-center justify-center p-6">
        <div className="tanga-card max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-tanga-charcoal mb-2">Une erreur est survenue</h2>
          <p className="text-tanga-charcoal-light text-sm mb-6 leading-relaxed">{loadingError}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setAppState('onboarding')} className="btn-primary w-full">Réessayer</button>
            <button onClick={resetSession} className="btn-ghost w-full">Retour à l'accueil</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-tanga-cream flex flex-col items-center justify-center p-6">
      <div className="fixed top-0 left-0 right-0 kente-stripe" />

      <div className="max-w-lg w-full text-center">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="font-bold text-2xl text-tanga-charcoal tracking-tight">
              Tanga<span className="text-tanga-ochre">AI</span>
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-10">
          <AfricaSpinner />
        </div>

        <div className="mb-8 min-h-[60px] flex flex-col items-center justify-center">
          <div
            className="transition-all duration-300 flex flex-col items-center"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center mb-2">
              <CurrentIcon className="w-6 h-6" />
            </div>
            <p className="text-xl font-semibold text-tanga-charcoal">{current.text}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-10">
          {MESSAGES.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === msgIndex ? '24px' : '8px',
                height: '8px',
                backgroundColor: i === msgIndex ? '#C17A3B' : '#E8D5B7',
              }}
            />
          ))}
        </div>

        <div className="tanga-card p-6 mb-6">
          <p className="text-sm font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-4">
            Équipe en cours de formation
          </p>
          <div className="flex items-center justify-center gap-6">
            <AgentDot label="Marketing" color="#C17A3B" delay="0s" />
            <AgentDot label="Ventes" color="#2D5A27" delay="0.3s" />
            <AgentDot label="Finance" color="#1E40AF" delay="0.6s" />
            <AgentDot label="Support" color="#7C3AED" delay="0.9s" />
          </div>
        </div>

        <p className="text-sm text-tanga-charcoal-light">
          Cette opération peut prendre quelques minutes selon la complexité de votre profil.
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 kente-stripe" />
    </div>
  )
}
