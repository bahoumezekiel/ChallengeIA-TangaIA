import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import AgentCard from './AgentCard.jsx'
import AgentEditor from './AgentEditor.jsx'
import Sidebar from './Sidebar.jsx'
import ToolsManager from './ToolsManager.jsx'
import {
  listerAgents,
  creerAgent,
  modifierAgent,
  basculerAgent,
  supprimerAgent,
} from '../../api/client.js'
import { ArrowRight, Clock, Globe, Bot, Users, MessageCircle, BarChart, Megaphone, History } from '../icons.jsx'
import Markdown from '../Markdown.jsx'
import ReputationPanel from './ReputationPanel.jsx'
import VentesPanel from './VentesPanel.jsx'
import PublicationsPanel from './PublicationsPanel.jsx'
import HistoriquePanel from './HistoriquePanel.jsx'
import NotificationBell from './NotificationBell.jsx'

const VIEWS = [
  { id: 'equipe',       label: 'Équipe',       Icon: Users },
  { id: 'reputation',   label: 'Réputation',   Icon: MessageCircle },
  { id: 'ventes',       label: 'Ventes',       Icon: BarChart },
  { id: 'publications', label: 'Publications', Icon: Megaphone },
  { id: 'historique',   label: 'Historique',   Icon: History },
]

function ViewTabs({ view, setView }) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 mb-6">
      {VIEWS.map((v) => {
        const Icon = v.Icon
        const active = view === v.id
        return (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex items-center justify-center sm:justify-start gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
              active
                ? 'bg-tanga-ochre text-white shadow-sm'
                : 'bg-white text-tanga-charcoal-light border border-tanga-sand/60 hover:border-tanga-ochre/40 hover:text-tanga-charcoal'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

const LIMIT_AGENTS_ACTIFS = 8

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ProcessTypeBadge({ type }) {
  const labels = {
    sequential: { label: 'Séquentiel', color: '#2D5A27' },
    parallel:   { label: 'Parallèle',  color: '#1E40AF' },
  }
  const conf = labels[type] || { label: type, color: '#6B7280' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: conf.color }}
    >
      <ArrowRight className="w-3.5 h-3.5" />
      <span>{conf.label}</span>
    </span>
  )
}

function SyntheseSection({ results }) {
  return (
    <div id="synthese" className="tanga-card mb-6 overflow-hidden scroll-mt-20">
      <div className="kente-stripe" />
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-tanga-charcoal">Synthèse globale</h2>
            <p className="text-sm text-tanga-charcoal-light mt-0.5">
              Résumé des travaux réalisés par votre équipe d'agents IA
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {results.process_type && <ProcessTypeBadge type={results.process_type} />}
            {results.duree_secondes && (
              <span className="text-sm text-tanga-charcoal-light bg-tanga-cream px-3 py-1 rounded-full font-medium">
                <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Math.round(results.duree_secondes)}s</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 bg-tanga-cream rounded-xl">
            <div className="text-2xl font-bold text-tanga-ochre">{results.nb_agents || results.agents_crees?.length || 0}</div>
            <div className="text-xs text-tanga-charcoal-light mt-0.5">Agents</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-700">
              {results.resultats_agents?.filter((r) => r.statut === 'succes').length ?? 0}
            </div>
            <div className="text-xs text-green-600 mt-0.5">Succès</div>
          </div>
          <div className="text-center p-3 bg-tanga-cream rounded-xl">
            <div className="text-2xl font-bold text-tanga-charcoal">{results.retry_count ?? 0}</div>
            <div className="text-xs text-tanga-charcoal-light mt-0.5">Tentatives</div>
          </div>
        </div>

        {results.synthese && (
          <div className="p-4 bg-tanga-cream rounded-xl border border-tanga-sand/50">
            <Markdown text={results.synthese} />
          </div>
        )}

        {results.session_id && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-tanga-charcoal-light">Session :</span>
            <code className="text-xs bg-tanga-cream px-2 py-0.5 rounded font-mono text-tanga-charcoal border border-tanga-sand">
              {results.session_id}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { results, profilPme, sessionId, resetSession, lancerAnalyse, user, deconnexion, appState } = useApp()
  const [activeId, setActiveId] = useState('synthese')
  const [view, setView] = useState('equipe')
  const [displayedView, setDisplayedView] = useState('equipe')
  const [mountedViews, setMountedViews] = useState({ equipe: true })
  const [contentVisible, setContentVisible] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toolsManagerOpen, setToolsManagerOpen] = useState(false)

  // ── Agent local state ─────────────────────────────────────────────────────
  const [agents, setAgents] = useState([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)   // null = new agent
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Transition fluide entre vues : les panneaux restent montés (pas de rechargement
  // ni de clignotement à chaque clic), avec un fondu croisé au changement d'onglet.
  useEffect(() => {
    setMountedViews((m) => (m[view] ? m : { ...m, [view]: true }))
    if (view !== displayedView) {
      setContentVisible(false)
      const t = setTimeout(() => { setDisplayedView(view); setContentVisible(true) }, 160)
      return () => clearTimeout(t)
    }
  }, [view, displayedView])
  // Signale qu'au moins un agent a été modifié depuis la dernière exécution
  const [agentsModified, setAgentsModified] = useState(false)

  const mainRef = useRef(null)

  // ── Fetch agents from API on mount / sessionId change ─────────────────────
  useEffect(() => {
    if (!sessionId) {
      // Initialise depuis results si pas de sessionId en DB encore
      setAgents(results?.agents_crees || [])
      return
    }
    listerAgents(sessionId)
      .then((rows) => {
        if (rows && rows.length > 0) {
          setAgents(rows)
        } else {
          setAgents(results?.agents_crees || [])
        }
      })
      .catch(() => {
        setAgents(results?.agents_crees || [])
      })
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const resultats = results?.resultats_agents || []
  const activeCount = agents.filter((a) => a.actif !== false).length
  const limitAtteinte = activeCount >= LIMIT_AGENTS_ACTIFS

  // ── Editor handlers ───────────────────────────────────────────────────────
  function openCreate() {
    setEditingAgent(null)
    setEditorOpen(true)
  }

  function openEdit(agent) {
    setEditingAgent(agent)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingAgent(null)
  }

  async function handleSave(form) {
    setSaving(true)
    try {
      if (editingAgent?.agent_id) {
        const updated = await modifierAgent(editingAgent.agent_id, form)
        setAgents((prev) => prev.map((a) => (a.agent_id === updated.agent_id ? updated : a)))
      } else {
        const created = await creerAgent(sessionId, form)
        setAgents((prev) => [...prev, created])
      }
      setAgentsModified(true)
      closeEditor()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!editingAgent?.agent_id) return
    try {
      const updated = await basculerAgent(editingAgent.agent_id)
      setAgents((prev) => prev.map((a) => (a.agent_id === updated.agent_id ? updated : a)))
      setEditingAgent(updated)
      setAgentsModified(true)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete() {
    if (!editingAgent?.agent_id) return
    setDeleting(true)
    try {
      await supprimerAgent(editingAgent.agent_id)
      setAgents((prev) => prev.filter((a) => a.agent_id !== editingAgent.agent_id))
      setAgentsModified(true)
      closeEditor()
    } finally {
      setDeleting(false)
    }
  }

  function handleRelancer() {
    if (profilPme?.nom_entreprise) {
      setAgentsModified(false)
      lancerAnalyse(profilPme)
    }
  }

  // ── Section scroll tracking ───────────────────────────────────────────────
  const scrollToSection = useCallback((id) => {
    setActiveId(id)
    setSidebarOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
    const sections = document.querySelectorAll('[id^="agent-"], #synthese')
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [agents])

  // ── Guard: no results yet ─────────────────────────────────────────────────
  if (!results) {
    if (appState !== 'dashboard') return null
    return (
      <div className="min-h-screen bg-tanga-cream flex items-center justify-center p-6">
        <div className="tanga-card p-8 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center mx-auto mb-4"><Globe className="w-8 h-8" /></div>
          <h2 className="text-xl font-bold text-tanga-charcoal mb-2">Aucune session active</h2>
          <p className="text-tanga-charcoal-light text-sm mb-6">
            Commencez par analyser le profil de votre entreprise.
          </p>
          <button onClick={resetSession} className="btn-primary w-full">
            Commencer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-tanga-cream flex flex-col">
      <div className="kente-stripe" />

      {/* Mobile top bar */}
      <header className="lg:hidden flex-shrink-0 z-30 bg-white/95 backdrop-blur-sm border-b border-tanga-sand/40">
        <div className="px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen((o) => !o)} className="btn-ghost p-2">
            <MenuIcon />
          </button>
          <span className="font-bold text-lg text-tanga-charcoal">
            Tanga<span className="text-tanga-ochre">AI</span>
          </span>
          <div className="flex items-center gap-1">
            <NotificationBell sessionId={sessionId || results?.session_id} />
            <button
              onClick={resetSession}
              className="text-xs font-semibold text-tanga-ochre px-3 py-1.5 rounded-lg hover:bg-tanga-ochre/10 transition-colors"
            >
              Nouveau
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-tanga-charcoal/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`
            fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-transform duration-300
            lg:relative lg:translate-x-0 lg:z-auto lg:flex
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-3 right-3 z-10 p-1.5 bg-tanga-sand/50 rounded-lg"
          >
            <CloseIcon />
          </button>

          <Sidebar
            agents={agents}
            resultats={resultats}
            activeId={activeId}
            view={view}
            setView={setView}
            onSelect={scrollToSection}
            onReset={resetSession}
            onOpenTools={() => { setSidebarOpen(false); setToolsManagerOpen(true) }}
            sessionInfo={{
              nom: profilPme?.nom_entreprise,
              duree: results?.duree_secondes,
            }}
            user={user}
            onLogout={deconnexion}
          />
        </div>

        {/* Main content */}
        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto custom-scroll">
          {/* Desktop header */}
          <div className="hidden lg:flex sticky top-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/30 px-6 py-3 items-center justify-between">
            <div>
              <h1 className="font-bold text-tanga-charcoal text-lg">
                {profilPme?.nom_entreprise ? `Résultats — ${profilPme.nom_entreprise}` : 'Tableau de bord'}
              </h1>
              {profilPme?.secteur && (
                <p className="text-sm text-tanga-charcoal-light">{profilPme.secteur}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell sessionId={sessionId || results?.session_id} />
              <button onClick={resetSession} className="btn-primary text-sm px-5 py-2.5">
                <span>+</span>
                Nouvelle demande
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            <div className="lg:hidden">
              <ViewTabs view={view} setView={setView} />
            </div>

            <div className={`transition-opacity duration-200 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div style={{ display: displayedView === 'equipe' ? 'block' : 'none' }}>
            <SyntheseSection results={results} />

            {/* Agents section header */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-tanga-charcoal">
                Vos agents ({agents.length})
                {activeCount < agents.length && (
                  <span className="ml-2 text-sm font-normal text-tanga-charcoal-light">
                    · {activeCount} actifs
                  </span>
                )}
              </h2>
              <div className="flex-1 h-px bg-tanga-sand/50" />

              {/* Ajouter un agent */}
              {sessionId && (
                <button
                  onClick={openCreate}
                  disabled={limitAtteinte}
                  title={limitAtteinte ? `Limite de ${LIMIT_AGENTS_ACTIFS} agents actifs atteinte` : 'Ajouter un agent'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                    limitAtteinte
                      ? 'border-tanga-sand text-tanga-charcoal-light/50 cursor-not-allowed bg-tanga-cream'
                      : 'border-tanga-ochre/40 text-tanga-ochre hover:bg-tanga-ochre/10'
                  }`}
                >
                  <PlusIcon />
                  <span className="hidden sm:inline">Ajouter un agent</span>
                  <span className="sm:hidden">Ajouter</span>
                </button>
              )}
            </div>

            {/* Banniere modification puis invite à relancer */}
            {agentsModified && (
              <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="text-sm text-blue-700">
                  <span className="font-semibold">Équipe modifiée.</span>{' '}
                  Relancez l'analyse pour que les nouvelles connexions soient demandées et les agents exécutés.
                </div>
                <button
                  onClick={handleRelancer}
                  className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Re-lancer <ArrowRight className="w-3.5 h-3.5 inline" />
                </button>
              </div>
            )}

            {limitAtteinte && !agentsModified && (
              <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                Limite de {LIMIT_AGENTS_ACTIFS} agents actifs atteinte. Désactivez un agent pour en créer un nouveau.
              </div>
            )}

            {/* Agent cards */}
            <div className="space-y-4">
              {agents.map((agent, index) => {
                const agentId = `agent-${index}`
                const resultat = resultats.find((r) => r.nom_agent === agent.nom)
                return (
                  <AgentCard
                    key={agent.agent_id || agentId}
                    id={agentId}
                    agent={agent}
                    resultat={resultat}
                    onEdit={sessionId ? openEdit : undefined}
                  />
                )
              })}
            </div>

            {agents.length === 0 && (
              <div className="text-center py-12 text-tanga-charcoal-light">
                <div className="w-14 h-14 rounded-2xl bg-tanga-sand/40 text-tanga-charcoal-light flex items-center justify-center mx-auto mb-3"><Bot className="w-7 h-7" /></div>
                <p className="font-medium">Aucun agent créé pour cette session.</p>
              </div>
            )}
            </div>

            {mountedViews.reputation && (
              <div style={{ display: displayedView === 'reputation' ? 'block' : 'none' }}>
                <ReputationPanel sessionId={sessionId || results?.session_id} />
              </div>
            )}
            {mountedViews.ventes && (
              <div style={{ display: displayedView === 'ventes' ? 'block' : 'none' }}>
                <VentesPanel sessionId={sessionId || results?.session_id} />
              </div>
            )}
            {mountedViews.publications && (
              <div style={{ display: displayedView === 'publications' ? 'block' : 'none' }}>
                <PublicationsPanel sessionId={sessionId || results?.session_id} />
              </div>
            )}
            {mountedViews.historique && (
              <div style={{ display: displayedView === 'historique' ? 'block' : 'none' }}>
                <HistoriquePanel sessionId={sessionId || results?.session_id} />
              </div>
            )}
            </div>

            <div className="h-12" />
          </div>
        </main>
      </div>

      {/* Gestionnaire de connexions */}
      {toolsManagerOpen && (
        <ToolsManager onClose={() => setToolsManagerOpen(false)} />
      )}

      {/* Agent editor modal */}
      {editorOpen && (
        <AgentEditor
          agent={editingAgent}
          isNew={!editingAgent}
          onSave={handleSave}
          onDelete={editingAgent ? handleDelete : undefined}
          onToggle={editingAgent ? handleToggle : undefined}
          onClose={closeEditor}
          saving={saving}
          deleting={deleting}
        />
      )}
    </div>
  )
}
