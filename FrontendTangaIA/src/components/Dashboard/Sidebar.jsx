import React from 'react'
import {
  DOMAIN_META, DomainGlyph, STATUS_META,
  RefreshCw, Link as LinkIcon, Home as HomeIcon,
  ClipboardList, Clock, ArrowRight, LogOut,
  Users, MessageCircle, BarChart, Megaphone, History,
} from '../icons.jsx'

const VIEWS = [
  { id: 'equipe',       label: 'Équipe',       Icon: Users },
  { id: 'reputation',   label: 'Réputation',   Icon: MessageCircle },
  { id: 'ventes',       label: 'Ventes',       Icon: BarChart },
  { id: 'publications', label: 'Publications', Icon: Megaphone },
  { id: 'historique',   label: 'Historique',   Icon: History },
]

export default function Sidebar({ agents, resultats, activeId, view, setView, onSelect, onReset, onOpenTools, sessionInfo, user, onLogout }) {
  const getResultatForAgent = (nomAgent) => resultats?.find((r) => r.nom_agent === nomAgent)
  const successCount = resultats?.filter((r) => r.statut === 'succes').length ?? 0
  const toolsCount = new Set((agents || []).flatMap((a) => a.outils_requis || [])).size

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-white border-r border-tanga-sand/50 h-full">

      {/* Header */}
      <div className="p-4 border-b border-tanga-sand/40">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-lg text-tanga-charcoal tracking-tight">
            Tanga<span className="text-tanga-ochre">AI</span>
          </span>
        </div>
        {sessionInfo?.nom && (
          <p className="text-xs text-tanga-charcoal-light font-medium truncate">{sessionInfo.nom}</p>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-tanga-sand/30">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-tanga-cream rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold text-tanga-charcoal">{agents?.length ?? 0}</div>
            <div className="text-xs text-tanga-charcoal-light">Agents</div>
          </div>
          <div className="bg-green-50 rounded-xl p-2.5 text-center">
            <div className="text-xl font-bold text-green-700">{successCount}</div>
            <div className="text-xs text-green-600">Succès</div>
          </div>
        </div>
        {sessionInfo?.duree && (
          <p className="text-xs text-tanga-charcoal-light text-center mt-2 inline-flex items-center justify-center gap-1 w-full">
            <Clock className="w-3.5 h-3.5" />
            {Math.round(sessionInfo.duree)}s de traitement
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scroll p-3">

        {/* Navigation principale : les 5 vues */}
        <div className="mb-4">
          <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider px-2 mb-2">
            Navigation
          </p>
          <div className="space-y-1">
            {VIEWS.map((v) => {
              const Icon = v.Icon
              const active = view === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setView && setView(v.id)}
                  className={active ? 'sidebar-item-active w-full' : 'sidebar-item-inactive w-full'}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{v.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sous-navigation : visible uniquement sous la vue Équipe */}
        {view === 'equipe' && (
          <>
            <div className="mb-4">
              <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider px-2 mb-2">
                Vue d'ensemble
              </p>
              <button
                onClick={() => onSelect('synthese')}
                className={activeId === 'synthese' ? 'sidebar-item-active w-full' : 'sidebar-item-inactive w-full'}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Synthèse</span>
              </button>
            </div>

            {agents && agents.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider px-2 mb-2">
                  Agents ({agents.length})
                </p>
                <div className="space-y-1">
                  {agents.map((agent, index) => {
                    const domain = DOMAIN_META[agent.domaine] || DOMAIN_META.autre
                    const resultat = getResultatForAgent(agent.nom)
                    const statusConf = resultat ? (STATUS_META[resultat.statut] || STATUS_META.partiel) : null
                    const StatusIcon = statusConf?.Icon
                    const agentId = `agent-${index}`
                    const isActive = activeId === agentId

                    return (
                      <button
                        key={agentId}
                        onClick={() => onSelect(agentId)}
                        className={`w-full text-left ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${agent.actif === false ? 'opacity-50' : ''}`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${domain.color}18`, color: domain.color }}
                        >
                          <DomainGlyph domaine={agent.domaine} className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{agent.nom}</div>
                          <div className="text-xs font-medium" style={{ color: domain.color }}>
                            {domain.label}
                          </div>
                        </div>
                        {statusConf && StatusIcon && (
                          <span className="flex-shrink-0" style={{ color: statusConf.color }} title={resultat.statut}>
                            <StatusIcon className="w-4 h-4" strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Connexions : toujours visible */}
        {agents && agents.length > 0 && (
          <div>
            <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider px-2 mb-2">
              Connexions
            </p>
            <button onClick={onOpenTools} className="sidebar-item-inactive w-full group">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-tanga-ochre/10 text-tanga-ochre group-hover:bg-tanga-ochre/20 transition-colors">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-tanga-charcoal">Gérer les accès</div>
                <div className="text-xs text-tanga-charcoal-light">
                  {toolsCount} outil{toolsCount !== 1 ? 's' : ''} à configurer
                </div>
              </div>
              <span className="text-tanga-ochre flex-shrink-0"><ArrowRight className="w-4 h-4" /></span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-tanga-sand/40 space-y-2">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-tanga-ochre rounded-xl hover:bg-tanga-ochre-dark transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Nouvelle demande
        </button>

        {/* Compte utilisateur */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-tanga-cream">
            <div className="w-6 h-6 rounded-full bg-tanga-ochre/20 flex items-center justify-center flex-shrink-0">
              <span className="text-tanga-ochre text-xs font-bold">
                {user.email[0].toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-tanga-charcoal-light flex-1 min-w-0 truncate">
              {user.email}
            </span>
            <button
              onClick={onLogout}
              title="Déconnexion"
              className="text-tanga-charcoal-light hover:text-red-500 transition-colors flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
