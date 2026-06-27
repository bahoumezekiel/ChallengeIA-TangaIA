import React, { useState, useEffect, useCallback } from 'react'
import { getVentes } from '../../api/client.js'
import { BarChart, RefreshCw, TrendingUp } from '../icons.jsx'
import { PanelHeader, ErrorBox, SkeletonCard } from './ReputationPanel.jsx'

const GRANULARITES = [
  { id: 'jour', label: 'Jour' },
  { id: 'mois', label: 'Mois' },
  { id: 'annee', label: 'Année' },
]

function formatFCFA(n) {
  const v = Math.round(Number(n) || 0)
  return v.toLocaleString('fr-FR').replace(/\u00A0/g, ' ')
}

export default function VentesPanel({ sessionId }) {
  const [granularite, setGranularite] = useState('mois')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const charger = useCallback(() => {
    if (!sessionId) { setError("Aucune session active."); return }
    setLoading(true); setError(null)
    getVentes(sessionId, { granularite })
      .then((res) => { setData(res); setError(res?.erreur || res?.message || null) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId, granularite])

  useEffect(() => { charger() }, [charger])

  const devise = data?.devise || 'FCFA'
  const tendance = data?.tendance_pourcent
  const maxCa = data?.evolution?.length ? Math.max(...data.evolution.map((e) => e.ca)) : 0

  return (
    <div className="space-y-5">
      <PanelHeader Icon={BarChart} titre="Tableau de bord ventes" sous="Chiffre d'affaires, évolution et meilleurs produits">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-tanga-sand overflow-hidden">
            {GRANULARITES.map((g) => (
              <button
                key={g.id}
                onClick={() => setGranularite(g.id)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  granularite === g.id ? 'bg-tanga-ochre text-white' : 'bg-white text-tanga-charcoal-light hover:bg-tanga-cream'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <button onClick={charger} disabled={loading} className="btn-ghost px-3 py-1.5 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </PanelHeader>

      {loading && <SkeletonCard />}

      {!loading && error && (
        <ErrorBox message={error} hint="Connectez une source de ventes (Google Sheet / CSV avec une colonne montant) via « Gérer les accès », outil « Contacts clients »." />
      )}

      {!loading && !error && data && (data.nb_ventes > 0 || data.total_ca > 0) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="tanga-card p-4">
              <div className="text-xs text-tanga-charcoal-light">Chiffre d'affaires</div>
              <div className="text-2xl font-bold text-tanga-charcoal mt-1">
                {formatFCFA(data.total_ca)} <span className="text-sm font-medium text-tanga-charcoal-light">{devise}</span>
              </div>
            </div>
            <div className="tanga-card p-4">
              <div className="text-xs text-tanga-charcoal-light">Ventes</div>
              <div className="text-2xl font-bold text-tanga-charcoal mt-1">{data.nb_ventes}</div>
            </div>
            <div className="tanga-card p-4 col-span-2 sm:col-span-1">
              <div className="text-xs text-tanga-charcoal-light">Panier moyen</div>
              <div className="text-2xl font-bold text-tanga-charcoal mt-1">
                {formatFCFA(data.panier_moyen)} <span className="text-sm font-medium text-tanga-charcoal-light">{devise}</span>
              </div>
            </div>
          </div>

          {tendance != null && (
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
              tendance >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              <TrendingUp className="w-4 h-4" style={{ transform: tendance >= 0 ? 'none' : 'scaleY(-1)' }} />
              {tendance >= 0 ? '+' : ''}{tendance}% vs période précédente
            </div>
          )}

          {data.evolution?.length > 0 && (
            <div className="tanga-card p-5">
              <h3 className="text-sm font-bold text-tanga-charcoal mb-4">Évolution du chiffre d'affaires</h3>
              <LineChart points={data.evolution} devise={devise} />
            </div>
          )}

          {data.top_produits?.length > 0 && (
            <div className="tanga-card p-5">
              <h3 className="text-sm font-bold text-tanga-charcoal mb-3">Top produits</h3>
              <div className="space-y-2">
                {data.top_produits.map((p, i) => (
                  <div key={p.produit} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-tanga-ochre/10 text-tanga-ochre text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-tanga-charcoal truncate">{p.produit}</span>
                    <span className="text-sm font-semibold text-tanga-charcoal">{formatFCFA(p.ca)} {devise}</span>
                    <span className="text-xs text-tanga-charcoal-light w-12 text-right">{p.nb} vte</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !error && data && data.nb_ventes === 0 && data.total_ca === 0 && (
        <div className="tanga-card p-8 text-center text-tanga-charcoal-light">
          <BarChart className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucune vente exploitable dans la source connectée.</p>
        </div>
      )}
    </div>
  )
}

function LineChart({ points, devise }) {
  const [hover, setHover] = React.useState(null)

  if (!points || points.length === 0) return null

  // Dimensions du repère (viewBox responsive)
  const W = 640
  const H = 240
  const padL = 56
  const padR = 16
  const padT = 16
  const padB = 32
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const cas = points.map((p) => p.ca)
  const maxCa = Math.max(...cas, 1)
  const minCa = 0
  const n = points.length

  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => padT + innerH - ((v - minCa) / (maxCa - minCa || 1)) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.ca).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

  // 4 lignes de grille horizontales + libellés Y
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: maxCa * t, yy: y(maxCa * t) }))

  const fmtShort = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`
    return String(Math.round(v))
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="ventesArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C17A3B" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#C17A3B" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grille + axe Y */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.yy} x2={W - padR} y2={t.yy} stroke="#E7DFD3" strokeWidth="1" />
            <text x={padL - 8} y={t.yy + 4} textAnchor="end" fontSize="11" fill="#9A8F80">{fmtShort(t.v)}</text>
          </g>
        ))}

        {/* Aire + courbe */}
        <path d={areaPath} fill="url(#ventesArea)" />
        <path d={linePath} fill="none" stroke="#C17A3B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Points + zone de survol */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.ca)} r={hover === i ? 5 : 3.5} fill="#fff" stroke="#C17A3B" strokeWidth="2.5" />
            <rect
              x={x(i) - (innerW / Math.max(n, 1)) / 2}
              y={padT}
              width={innerW / Math.max(n, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {/* Libellé X */}
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#9A8F80">{p.periode}</text>
          </g>
        ))}

        {/* Infobulle */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="#C17A3B" strokeWidth="1" strokeDasharray="3 3" />
            <g transform={`translate(${Math.min(Math.max(x(hover), padL + 50), W - padR - 50)}, ${Math.max(y(points[hover].ca) - 14, padT + 14)})`}>
              <rect x="-52" y="-30" width="104" height="34" rx="6" fill="#23201D" />
              <text x="0" y="-16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">
                {formatFCFA(points[hover].ca)} {devise}
              </text>
              <text x="0" y="-3" textAnchor="middle" fontSize="10" fill="#C9BCAC">
                {points[hover].periode} · {points[hover].nb} vente(s)
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
