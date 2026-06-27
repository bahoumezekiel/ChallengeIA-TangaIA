import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import OnboardingFlow from './OnboardingFlow.jsx'
import ConversationalOnboarding from './ConversationalOnboarding.jsx'
import { MessageCircle, ClipboardList, ArrowLeft, ArrowRight, Sparkles, Clock } from '../icons.jsx'

/**
 * Point d'entrée de l'onboarding : l'utilisateur choisit entre
 *  - discuter avec l'IA (onboarding conversationnel)
 *  - remplir le formulaire guidé (7 étapes)
 */
export default function OnboardingHub() {
  const { setAppState } = useApp()
  const [mode, setMode] = useState(null)   // null | 'chat' | 'form'

  if (mode === 'chat') return <ConversationalOnboarding onBack={() => setMode(null)} />
  if (mode === 'form') return <OnboardingFlow onBack={() => setMode(null)} />

  return (
    <div className="min-h-screen bg-tanga-cream flex flex-col">
      <div className="kente-stripe" />

      <header className="sticky top-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => setAppState('landing')} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Accueil</span>
          </button>
          <span className="font-bold text-lg text-tanga-charcoal tracking-tight">
            Tanga<span className="text-tanga-ochre">AI</span>
          </span>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-tanga-charcoal mb-2">
              Comment voulez-vous commencer ?
            </h1>
            <p className="text-tanga-charcoal-light">
              Deux façons de présenter votre entreprise — choisissez celle qui vous convient.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Chat IA */}
            <button
              onClick={() => setMode('chat')}
              className="group text-left tanga-card p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-2 border-transparent hover:border-tanga-ochre/40"
            >
              <div className="w-12 h-12 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="font-bold text-tanga-charcoal text-lg">Discuter avec l'IA</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-tanga-ochre bg-tanga-ochre/10 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" /> Recommandé
                </span>
              </div>
              <p className="text-sm text-tanga-charcoal-light leading-relaxed mb-4">
                Répondez à quelques questions en discutant naturellement. L'assistant construit
                votre profil pour vous.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-tanga-ochre">
                Démarrer la discussion
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>

            {/* Formulaire */}
            <button
              onClick={() => setMode('form')}
              className="group text-left tanga-card p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-2 border-transparent hover:border-tanga-green/40"
            >
              <div className="w-12 h-12 rounded-xl bg-tanga-green/10 text-tanga-green flex items-center justify-center mb-4">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="font-bold text-tanga-charcoal text-lg">Remplir le formulaire</h2>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-tanga-charcoal-light bg-tanga-sand/50 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> 7 étapes
                </span>
              </div>
              <p className="text-sm text-tanga-charcoal-light leading-relaxed mb-4">
                Un parcours guidé, étape par étape, si vous préférez renseigner vos informations
                directement dans des champs.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-tanga-green">
                Ouvrir le formulaire
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>

          <p className="text-center text-xs text-tanga-charcoal-light mt-8">
            Vous pourrez changer de mode à tout moment.
          </p>
        </div>
      </main>
    </div>
  )
}
