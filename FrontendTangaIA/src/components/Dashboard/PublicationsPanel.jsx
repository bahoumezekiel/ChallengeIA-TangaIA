import React, { useState, useEffect, useCallback } from 'react'
import { listerPublications, programmerPublication, annulerPublication } from '../../api/client.js'
import { Megaphone, RefreshCw, Plus, Trash, Clock, Check, AlertTriangle, Sparkles } from '../icons.jsx'
import { PanelHeader, ErrorBox, SkeletonCard } from './ReputationPanel.jsx'

const STATUTS = {
  en_attente: { label: 'Programmée', color: '#d97706', bg: '#d9770618' },
  publie:     { label: 'Publiée',    color: '#16a34a', bg: '#16a34a18' },
  echec:      { label: 'Échec',      color: '#dc2626', bg: '#dc262618' },
  annule:     { label: 'Annulée',    color: '#6B7280', bg: '#6B728018' },
}

export default function PublicationsPanel({ sessionId }) {
  const [pubs, setPubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  const charger = useCallback(() => {
    if (!sessionId) { setError("Aucune session active."); return }
    setLoading(true); setError(null)
    listerPublications(sessionId)
      .then((res) => setPubs(res?.publications || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => { charger() }, [charger])

  const annuler = async (id) => {
    try { await annulerPublication(id); charger() }
    catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5">
      <PanelHeader Icon={Megaphone} titre="Publications programmées" sous="Planifiez vos posts Facebook à l'avance">
        <div className="flex items-center gap-2">
          <button onClick={charger} disabled={loading} className="btn-ghost px-3 py-1.5 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setFormOpen((v) => !v)} className="btn-primary px-3 py-1.5 text-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Programmer</span>
          </button>
        </div>
      </PanelHeader>

      {formOpen && (
        <PublicationForm
          sessionId={sessionId}
          onDone={() => { setFormOpen(false); charger() }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {loading && <SkeletonCard />}
      {!loading && error && <ErrorBox message={error} />}

      {!loading && !error && pubs.length === 0 && (
        <div className="tanga-card p-8 text-center text-tanga-charcoal-light">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucune publication programmée.</p>
          <p className="text-sm mt-1">Cliquez sur « Programmer » pour planifier votre premier post.</p>
        </div>
      )}

      {!loading && !error && pubs.length > 0 && (
        <div className="space-y-3">
          {pubs.map((p) => {
            const st = STATUTS[p.statut] || STATUTS.en_attente
            return (
              <div key={p.id} className="tanga-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ color: st.color, backgroundColor: st.bg }}
                  >
                    {p.statut === 'publie' ? <Check className="w-3 h-3" /> :
                     p.statut === 'echec' ? <AlertTriangle className="w-3 h-3" /> :
                     <Clock className="w-3 h-3" />}
                    {st.label}
                  </span>
                  {p.mode === 'ia' && (
                    <span className="inline-flex items-center gap-1 text-xs text-tanga-ochre">
                      <Sparkles className="w-3 h-3" /> IA
                    </span>
                  )}
                  {p.statut === 'en_attente' && (
                    <button
                      onClick={() => annuler(p.id)}
                      className="ml-auto text-tanga-charcoal-light/50 hover:text-red-500 transition-colors p-1"
                      title="Annuler"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-tanga-charcoal whitespace-pre-wrap line-clamp-4">{p.contenu || p.brief}</p>
                {p.publier_le && (
                  <p className="text-xs text-tanga-charcoal-light mt-2 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Prévue le {p.publier_le}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PublicationForm({ sessionId, onDone, onCancel }) {
  const [mode, setMode] = useState('texte')
  const [contenu, setContenu] = useState('')
  const [brief, setBrief] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [avecImage, setAvecImage] = useState(false)
  const [motsClesImage, setMotsClesImage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  const valider = async () => {
    setErr(null)
    if (mode === 'texte' && !contenu.trim()) { setErr('Le texte à publier est requis.'); return }
    if (mode === 'ia' && !brief.trim()) { setErr('Le brief est requis en mode IA.'); return }
    setSubmitting(true)
    try {
      const res = await programmerPublication({
        session_id: sessionId,
        mode,
        contenu: mode === 'texte' ? contenu : undefined,
        brief: mode === 'ia' ? brief : undefined,
        publier_dans_minutes: Number(minutes),
        avec_image: avecImage,
        image_prompt: avecImage && motsClesImage.trim() ? motsClesImage.trim() : undefined,
      })
      if (res?.erreur) { setErr(res.erreur); setSubmitting(false); return }
      onDone()
    } catch (e) {
      setErr(e.message); setSubmitting(false)
    }
  }

  return (
    <div className="tanga-card p-5 space-y-4 border-2 border-tanga-ochre/30">
      <div className="flex rounded-lg border border-tanga-sand overflow-hidden w-fit">
        {[['texte', 'Mon texte'], ['ia', 'Générer par IA']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === id ? 'bg-tanga-ochre text-white' : 'bg-white text-tanga-charcoal-light hover:bg-tanga-cream'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'texte' ? (
        <div>
          <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">Texte du post</label>
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            rows={4}
            placeholder="Écrivez le contenu exact à publier sur Facebook..."
            className="tanga-input resize-none"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">Brief (l'IA rédige le post)</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="Ex : annoncer une promotion -20% sur les jus naturels ce week-end"
            className="tanga-input resize-none"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">Publier dans</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="tanga-input w-24"
          />
          <span className="text-sm text-tanga-charcoal-light">minutes</span>
          <div className="flex gap-1.5 ml-2">
            {[1, 60, 1440].map((m) => (
              <button key={m} onClick={() => setMinutes(m)}
                className="px-2 py-1 text-xs rounded-lg border border-tanga-sand hover:border-tanga-ochre hover:text-tanga-ochre transition-colors">
                {m === 1 ? '1 min' : m === 60 ? '1 h' : '24 h'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={avecImage}
            onChange={(e) => setAvecImage(e.target.checked)}
            className="w-4 h-4 accent-tanga-ochre"
          />
          <span className="text-sm text-tanga-charcoal inline-flex items-center gap-1">
            Joindre une image <Sparkles className="w-3 h-3 text-tanga-ochre" />
          </span>
        </label>
        {avecImage && (
          <div className="mt-2 pl-6">
            <input
              type="text"
              value={motsClesImage}
              onChange={(e) => setMotsClesImage(e.target.value)}
              placeholder="Mots-clés de l'image (optionnel) — ex : jus de fruits, marché africain"
              className="tanga-input text-sm"
            />
            <p className="text-xs text-tanga-charcoal-light mt-1">
              Laissez vide : le système lira votre message et trouvera une image associée automatiquement.
            </p>
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button onClick={valider} disabled={submitting} className="btn-primary flex-1">
          {submitting ? 'Programmation…' : 'Programmer la publication'}
        </button>
        <button onClick={onCancel} disabled={submitting} className="btn-ghost px-4">Annuler</button>
      </div>
    </div>
  )
}
