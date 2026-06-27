import React, { useState, useEffect, useCallback } from 'react'
import { getSentiment } from '../../api/client.js'
import { MessageCircle, AlertTriangle, RefreshCw, Check } from '../icons.jsx'

const NBPOSTS = [5, 10, 15]

export default function ReputationPanel({ sessionId }) {
  const [nbPosts, setNbPosts] = useState(5)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const charger = useCallback(() => {
    if (!sessionId) { setError("Aucune session active."); return }
    setLoading(true); setError(null)
    getSentiment(sessionId, nbPosts)
      .then((res) => { setData(res); setError(res?.erreur || null) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId, nbPosts])

  useEffect(() => { charger() }, [charger])

  const total = data?.total ?? 0
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0)

  return (
    <div className="space-y-5">
      <PanelHeader
        Icon={MessageCircle}
        titre="Réputation en ligne"
        sous="Sentiment des commentaires de votre page Facebook"
      >
        <div className="flex items-center gap-2">
          <select
            value={nbPosts}
            onChange={(e) => setNbPosts(Number(e.target.value))}
            className="text-sm border border-tanga-sand rounded-lg px-2 py-1.5 bg-white text-tanga-charcoal"
          >
            {NBPOSTS.map((n) => <option key={n} value={n}>{n} posts</option>)}
          </select>
          <button onClick={charger} disabled={loading} className="btn-ghost px-3 py-1.5 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </PanelHeader>

      {loading && <SkeletonCard />}

      {!loading && error && (
        <ErrorBox message={error} hint="Connectez votre page Facebook (page_id + access_token) via « Gérer les accès » pour analyser vos avis." />
      )}

      {!loading && !error && data && total === 0 && (
        <div className="tanga-card p-8 text-center text-tanga-charcoal-light">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucun commentaire à analyser pour le moment.</p>
          <p className="text-sm mt-1">{data.nb_posts_analyses ?? 0} post(s) parcouru(s).</p>
        </div>
      )}

      {!loading && !error && data && total > 0 && (
        <>
          {data.alerte && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Alerte réputation :</strong> {Math.round((data.pourcentage_negatif || 0) * 100)}% des
                commentaires sont négatifs. Une réponse rapide est recommandée.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard value={data.positif} pct={pct(data.positif)} label="Positifs" color="#16a34a" bg="#16a34a14" />
            <StatCard value={data.neutre} pct={pct(data.neutre)} label="Neutres" color="#6B7280" bg="#6B728014" />
            <StatCard value={data.negatif} pct={pct(data.negatif)} label="Négatifs" color="#dc2626" bg="#dc262614" />
          </div>

          {/* Barre de répartition */}
          <div className="tanga-card p-4">
            <div className="flex h-3 rounded-full overflow-hidden bg-tanga-cream">
              <div style={{ width: `${pct(data.positif)}%`, backgroundColor: '#16a34a' }} />
              <div style={{ width: `${pct(data.neutre)}%`, backgroundColor: '#9CA3AF' }} />
              <div style={{ width: `${pct(data.negatif)}%`, backgroundColor: '#dc2626' }} />
            </div>
            <p className="text-xs text-tanga-charcoal-light mt-2 text-center">
              {total} commentaire(s) analysé(s) sur {data.nb_posts_analyses} post(s)
            </p>
          </div>

          {data.commentaires_negatifs?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-tanga-charcoal mb-2">Commentaires négatifs à traiter</h3>
              <div className="space-y-2">
                {data.commentaires_negatifs.map((c, i) => (
                  <div key={i} className="tanga-card p-3 border-l-4" style={{ borderLeftColor: '#dc2626' }}>
                    <p className="text-sm text-tanga-charcoal">{c.texte}</p>
                    <p className="text-xs text-tanga-charcoal-light mt-1">— {c.auteur || 'Anonyme'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.negatif === 0 && (
            <div className="tanga-card p-4 flex items-center gap-2 text-sm text-green-700 bg-green-50/40">
              <Check className="w-4 h-4" /> Aucun commentaire négatif détecté. Belle réputation !
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Sous-composants partagés (réutilisés par les autres panneaux) ── */

export function PanelHeader({ Icon, titre, sous, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-tanga-charcoal">{titre}</h2>
          <p className="text-sm text-tanga-charcoal-light">{sous}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function StatCard({ value, pct, label, color, bg }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color }}>{label}</div>
      {pct != null && <div className="text-xs text-tanga-charcoal-light">{pct}%</div>}
    </div>
  )
}

export function ErrorBox({ message, hint }) {
  return (
    <div className="tanga-card p-5 border border-amber-200 bg-amber-50/40">
      <div className="flex items-start gap-2 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{message}</p>
          {hint && <p className="text-amber-700/80 mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="tanga-card p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-tanga-sand/50 rounded w-1/3" />
        <div className="h-20 bg-tanga-sand/30 rounded" />
        <div className="h-4 bg-tanga-sand/40 rounded w-2/3" />
      </div>
    </div>
  )
}
