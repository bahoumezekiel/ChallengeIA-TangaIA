import React, { useState } from 'react'
import {
  DOMAIN_META, DomainGlyph, StatusGlyph,
  ChevronDown as ChevronDownIcon, Pencil, Sparkles, X,
} from '../icons.jsx'
import Markdown from '../Markdown.jsx'

const STATUS_LABELS = {
  succes:  { label: 'Succès',  className: 'badge-succes' },
  echec:   { label: 'Échec',   className: 'badge-echec' },
  partiel: { label: 'Partiel', className: 'badge-partiel' },
}

function ChevronDown({ isOpen }) {
  return (
    <span className="inline-flex transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <ChevronDownIcon className="w-4 h-4" strokeWidth={2.5} />
    </span>
  )
}

function PriorityBadge({ priority }) {
  if (!priority) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-tanga-sand/60 text-tanga-charcoal-light">
      #{priority}
    </span>
  )
}

function OriginBadge({ source, actif }) {
  if (!actif) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
        Inactif
      </span>
    )
  }
  if (source === 'manuel') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
        Personnalisé
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-tanga-ochre/10 text-tanga-ochre">
      <Sparkles className="w-3 h-3" /> IA
    </span>
  )
}

export default function AgentCard({ agent, resultat, id, onEdit }) {
  const [showModal, setShowModal] = useState(false)
  const domain = DOMAIN_META[agent.domaine] || DOMAIN_META.autre
  const statusConf = resultat ? (STATUS_LABELS[resultat.statut] || STATUS_LABELS.partiel) : null

  const hasLivrable = resultat?.livrable && resultat.livrable.trim().length > 0
  const hasErrors = resultat?.erreurs && resultat.erreurs.length > 0
  const livrablePreview = hasLivrable
    ? resultat.livrable.slice(0, 200) + (resultat.livrable.length > 200 ? '...' : '')
    : null

  const isInactive = agent.actif === false

  return (
    <div id={id} className={`tanga-card scroll-mt-24 transition-all duration-200 hover:shadow-md ${isInactive ? 'opacity-50' : ''}`}>
      {/* Domain color accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: isInactive ? '#9CA3AF' : domain.color }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isInactive ? '#F3F4F6' : `${domain.color}18`, color: isInactive ? '#9CA3AF' : domain.color }}
            >
              <DomainGlyph domaine={agent.domaine} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-tanga-charcoal truncate">{agent.nom}</h3>
                <PriorityBadge priority={agent.priorite} />
                <OriginBadge source={agent.source} actif={agent.actif !== false} />
              </div>
              <p className="text-xs text-tanga-charcoal-light truncate mt-0.5">{agent.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="badge text-white hidden sm:inline-flex" style={{ backgroundColor: isInactive ? '#9CA3AF' : domain.color }}>
              {domain.label}
            </span>
            {statusConf && (
              <span className={`${statusConf.className} inline-flex items-center gap-1`}>
                <StatusGlyph statut={resultat.statut} className="w-3.5 h-3.5" />
                {statusConf.label}
              </span>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(agent)}
                className="p-1.5 rounded-lg hover:bg-tanga-cream transition-colors text-tanga-charcoal-light hover:text-tanga-charcoal"
                title="Modifier l'agent"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {agent.objectif && (
          <p className="text-sm text-tanga-charcoal-light leading-relaxed mb-3 pl-14">
            {agent.objectif}
          </p>
        )}

        {agent.outils_requis && agent.outils_requis.length > 0 && (
          <div className="pl-14 flex flex-wrap gap-1.5 mb-2">
            {agent.outils_requis.map((tool) => (
              <span key={tool} className="px-2 py-0.5 bg-tanga-cream text-tanga-charcoal-light text-xs rounded-lg border border-tanga-sand/60 font-mono">
                {tool}
              </span>
            ))}
          </div>
        )}

        {agent.outils_en_attente && agent.outils_en_attente.length > 0 && (
          <div className="pl-14 flex flex-wrap gap-1.5 mb-2">
            {agent.outils_en_attente.map((tool) => (
              <span key={tool} className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-lg border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {tool}
              </span>
            ))}
          </div>
        )}

        {hasLivrable && (
          <div className="pl-14">
            <div className="p-3 bg-tanga-cream rounded-xl border border-tanga-sand/40">
              <p className="text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">Livrable</p>
              <p className="text-sm text-tanga-charcoal leading-relaxed line-clamp-3">{livrablePreview}</p>
            </div>
          </div>
        )}

        {(hasLivrable || hasErrors) && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 ml-14 flex items-center gap-1.5 text-sm font-medium text-tanga-ochre hover:text-tanga-ochre-dark transition-colors"
          >
            <span>Voir le livrable complet</span>
            <ChevronDownIcon className="w-4 h-4 -rotate-90" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-tanga-charcoal/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête du modal */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-tanga-sand/40 flex-shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${domain.color}18`, color: domain.color }}
              >
                <DomainGlyph domaine={agent.domaine} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-tanga-charcoal truncate">{agent.nom}</h3>
                <p className="text-xs text-tanga-charcoal-light truncate">{agent.role}</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-tanga-cream text-tanga-charcoal-light hover:text-tanga-charcoal transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenu défilant */}
            <div className="flex-1 overflow-y-auto custom-scroll px-5 py-5">
              {hasLivrable && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wide mb-2">Livrable complet</h4>
                  <div className="p-4 bg-tanga-cream rounded-xl border border-tanga-sand/40">
                    <Markdown text={resultat.livrable} />
                  </div>
                </div>
              )}
              {hasErrors && (
                <div>
                  <h4 className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Erreurs rencontrées</h4>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700 leading-relaxed whitespace-pre-wrap">
                      {Array.isArray(resultat.erreurs) ? resultat.erreurs.join('\n') : resultat.erreurs}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
