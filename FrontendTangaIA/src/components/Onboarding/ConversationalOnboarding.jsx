import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { onboardingMessage } from '../../api/client.js'
import { Bot, User, Send, ArrowLeft, Rocket, Sparkles } from '../icons.jsx'

/**
 * Onboarding conversationnel : le dirigeant discute avec l'IA, qui construit
 * progressivement le ProfilPME via POST /onboarding/message. Quand le backend
 * renvoie complete=true + profil_pme, on propose de lancer l'équipe d'agents.
 */
export default function ConversationalOnboarding({ onBack }) {
  const { lancerAnalyse } = useApp()

  const [messages, setMessages] = useState([])          // {role:'user'|'assistant', content}
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profilComplet, setProfilComplet] = useState(null)

  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const initialised = useRef(false)

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  // Message d'accueil (liste vide → le backend renvoie le message d'accueil)
  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    setLoading(true)
    onboardingMessage([])
      .then((res) => setMessages([{ role: 'assistant', content: res.message }]))
      .catch((err) => setError(err.message || "Impossible de démarrer la conversation."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(scrollToBottom, [messages, loading])

  const envoyer = useCallback(async () => {
    const texte = input.trim()
    if (!texte || loading || profilComplet) return

    const nouveaux = [...messages, { role: 'user', content: texte }]
    setMessages(nouveaux)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const res = await onboardingMessage(nouveaux)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.message }])
      if (res.complete && res.profil_pme) {
        setProfilComplet(res.profil_pme)
      }
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi du message.")
    } finally {
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [input, loading, messages, profilComplet])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      envoyer()
    }
  }

  const launchedRef = useRef(false)
  const lancer = useCallback(() => {
    if (profilComplet && !launchedRef.current) {
      launchedRef.current = true
      lancerAnalyse(profilComplet)
    }
  }, [profilComplet, lancerAnalyse])

  // Bascule automatiquement vers la phase suivante une fois le profil complet
  useEffect(() => {
    if (profilComplet) {
      const t = setTimeout(() => lancer(), 1800)
      return () => clearTimeout(t)
    }
  }, [profilComplet, lancer])

  return (
    <div className="min-h-screen bg-tanga-cream flex flex-col">
      <div className="kente-stripe" />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Changer de mode</span>
          </button>
          <span className="font-bold text-lg text-tanga-charcoal tracking-tight">
            Tanga<span className="text-tanga-ochre">AI</span>
          </span>
          <div className="w-20 text-right">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-tanga-ochre">
              <Sparkles className="w-3.5 h-3.5" /> Assistant
            </span>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto custom-scroll">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white border border-tanga-sand/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tanga-ochre/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-tanga-ochre/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-tanga-ochre/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {profilComplet && (
            <div className="p-4 bg-tanga-green/5 border border-tanga-green/30 rounded-2xl animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-tanga-green"><Rocket className="w-5 h-5" /></span>
                <p className="text-sm font-semibold text-tanga-green">
                  Profil complet — préparation de votre équipe…
                </p>
              </div>

              <div className="bg-white rounded-xl border border-tanga-sand/50 p-3 space-y-1.5 text-sm">
                <RecapLigne label="Entreprise" valeur={profilComplet.nom_entreprise} />
                <RecapLigne label="Secteur" valeur={profilComplet.secteur} />
                <RecapLigne label="Effectif" valeur={profilComplet.taille_effectif ? `${profilComplet.taille_effectif} personne(s)` : null} />
                <RecapLigne label="Clientèle" valeur={profilComplet.cible_clientele} />
                <RecapLigne label="Services" valeur={(profilComplet.services_souhaites || []).join(', ')} />
                <RecapLigne label="Objectifs" valeur={(profilComplet.objectifs_court_terme || []).join(', ')} />
              </div>

              <button onClick={lancer} className="btn-primary w-full mt-3">
                <Rocket className="w-4 h-4" />
                Lancer mon équipe IA maintenant
              </button>
            </div>
          )}

          <div className="h-4" />
        </div>
      </main>

      {/* Saisie */}
      {!profilComplet && (
        <div className="sticky bottom-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-t border-tanga-sand/40">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez votre réponse..."
                rows={1}
                disabled={loading}
                className="tanga-input flex-1 resize-none max-h-32 py-3"
              />
              <button
                onClick={envoyer}
                disabled={loading || !input.trim()}
                className="btn-primary flex-shrink-0 px-4 py-3"
                title="Envoyer"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-tanga-charcoal-light text-center mt-2">
              L'assistant construit votre profil au fil de la discussion.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function RecapLigne({ label, valeur }) {
  if (!valeur) return null
  return (
    <div className="flex gap-2">
      <span className="text-tanga-charcoal-light w-24 flex-shrink-0">{label}</span>
      <span className="text-tanga-charcoal font-medium flex-1">{valeur}</span>
    </div>
  )
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-tanga-charcoal/10 text-tanga-charcoal' : 'bg-tanga-ochre/10 text-tanga-ochre'
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      <div
        className={`px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-tanga-ochre text-white rounded-2xl rounded-tr-sm'
            : 'bg-white border border-tanga-sand/50 text-tanga-charcoal rounded-2xl rounded-tl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
