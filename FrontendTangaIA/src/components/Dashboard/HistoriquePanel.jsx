import React, { useState, useEffect, useCallback } from 'react'
import { getHistorique } from '../../api/client.js'
import { History, RefreshCw, Clock, Check, X, Minus } from '../icons.jsx'
import { PanelHeader, ErrorBox, SkeletonCard } from './ReputationPanel.jsx'
import Markdown from '../Markdown.jsx'

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d)) return s
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoriquePanel({ sessionId }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scope, setScope] = useState('session')   // 'session' | 'tous'

  const charger = useCallback(() => {
    setLoading(true); setError(null)
    const sid = scope === 'session' ? sessionId : null
    getHistorique(sid, 50)
      .then((res) => setRuns(res?.runs || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId, scope])

  useEffect(() => { charger() }, [charger])

  return (
    <div className="space-y-5">
      <PanelHeader Icon={History} titre="Historique des analyses" sous="Vos exécutions d'équipes d'agents passées">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-tanga-sand overflow-hidden">
            {[['session', 'Cette session'], ['tous', 'Tout']].map(([id, label]) => (
              <button key={id} onClick={() => setScope(id)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  scope === id ? 'bg-tanga-ochre text-white' : 'bg-white text-tanga-charcoal-light hover:bg-tanga-cream'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={charger} disabled={loading} className="btn-ghost px-3 py-1.5 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </PanelHeader>

      {loading && <SkeletonCard />}
      {!loading && error && <ErrorBox message={error} />}

      {!loading && !error && runs.length === 0 && (
        <div className="tanga-card p-8 text-center text-tanga-charcoal-light">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucune analyse enregistrée pour le moment.</p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}

function RunCard({ run }) {
  const [open, setOpen] = useState(false)
  const resultats = run.resultats || []
  const compteur = (statut) => resultats.filter((r) => r.statut === statut).length

  return (
    <div className="tanga-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4 hover:bg-tanga-cream/40 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-tanga-charcoal">{run.nom_entreprise || 'Entreprise'}</span>
              {run.secteur && (
                <span className="text-xs text-tanga-charcoal-light bg-tanga-cream px-2 py-0.5 rounded-full">{run.secteur}</span>
              )}
            </div>
            <p className="text-xs text-tanga-charcoal-light mt-1 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDate(run.created_at)} · {run.nb_agents} agent(s)
              {run.duree_secondes ? ` · ${Math.round(run.duree_secondes)}s` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 text-xs font-semibold">
            {compteur('succes') > 0 && <span className="inline-flex items-center gap-0.5 text-green-700"><Check className="w-3.5 h-3.5" />{compteur('succes')}</span>}
            {compteur('partiel') > 0 && <span className="inline-flex items-center gap-0.5 text-amber-600"><Minus className="w-3.5 h-3.5" />{compteur('partiel')}</span>}
            {compteur('echec') > 0 && <span className="inline-flex items-center gap-0.5 text-red-600"><X className="w-3.5 h-3.5" />{compteur('echec')}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-tanga-sand/40 p-4 space-y-3 animate-fade-in">
          {run.synthese && (
            <Markdown text={run.synthese} />
          )}
          {resultats.length > 0 && (
            <div className="space-y-1.5">
              {resultats.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    r.statut === 'succes' ? 'bg-green-500' : r.statut === 'echec' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-tanga-charcoal-light">{r.nom_agent}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
