import React, { useState } from 'react'
import { DomainGlyph } from '../icons.jsx'

const OUTILS_DISPONIBLES = [
  { id: 'redaction_contenu',          label: 'Rédaction de contenu' },
  { id: 'recherche_web',              label: 'Recherche web' },
  { id: 'publication_reseaux_sociaux',label: 'Publication réseaux sociaux' },
  { id: 'recherche_crm',              label: 'Recherche CRM' },
  { id: 'generation_devis',           label: 'Génération de devis' },
  { id: 'generation_facture',         label: 'Génération de facture' },
  { id: 'suivi_paiement',             label: 'Suivi des paiements' },
  { id: 'envoi_email',                label: 'Envoi email (SMTP)' },
  { id: 'planification_calendrier',   label: 'Planification calendrier' },
  { id: 'analyse_donnees_ventes',     label: 'Analyse données de ventes' },
]

const DOMAINES = [
  { id: 'marketing',     label: 'Marketing' },
  { id: 'vente',         label: 'Ventes' },
  { id: 'admin_finance', label: 'Admin / Finance' },
  { id: 'support',       label: 'Support client' },
  { id: 'autre',         label: 'Autre' },
]

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

export default function AgentEditor({ agent, isNew, onSave, onDelete, onToggle, onClose, saving, deleting }) {
  const [form, setForm] = useState({
    nom:               agent?.nom || '',
    role:              agent?.role || '',
    backstory:         agent?.backstory || '',
    domaine:           agent?.domaine || 'autre',
    objectif:          agent?.objectif || '',
    outils_requis:     agent?.outils_requis || [],
    outils_en_attente: agent?.outils_en_attente || [],
    priorite:          agent?.priorite ?? 3,
  })
  const [outilLibre, setOutilLibre] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function toggleOutil(id) {
    setForm((f) => ({
      ...f,
      outils_requis: f.outils_requis.includes(id)
        ? f.outils_requis.filter((o) => o !== id)
        : [...f.outils_requis, id],
    }))
  }

  function ajouterOutilLibre() {
    const v = outilLibre.trim()
    if (!v || form.outils_en_attente.includes(v)) return
    setForm((f) => ({ ...f, outils_en_attente: [...f.outils_en_attente, v] }))
    setOutilLibre('')
  }

  function retirerOutilLibre(outil) {
    setForm((f) => ({ ...f, outils_en_attente: f.outils_en_attente.filter((o) => o !== outil) }))
  }

  async function handleSave() {
    setError(null)
    if (!form.nom.trim() || !form.role.trim() || !form.objectif.trim()) {
      setError("Le nom, le rôle et l'objectif sont obligatoires.")
      return
    }
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.')
    }
  }

  const isOriginalAuto = agent?.source === 'auto' && !isNew
  const isModified = agent?.source === 'manuel' && !isNew

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tanga-charcoal/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-tanga-sand/40">
          <div>
            <h2 className="font-bold text-tanga-charcoal text-lg">
              {isNew ? 'Nouvel agent' : 'Modifier l\'agent'}
            </h2>
            {!isNew && (
              <div className="flex items-center gap-2 mt-0.5">
                {isOriginalAuto && (
                  <span className="text-xs bg-tanga-ochre/15 text-tanga-ochre px-2 py-0.5 rounded-full font-medium">
                    Généré par IA
                  </span>
                )}
                {isModified && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Personnalisé
                  </span>
                )}
                {agent?.source === 'manuel' && isNew === false && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Manuel
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-tanga-charcoal-light hover:text-tanga-charcoal">
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto custom-scroll flex-1 px-5 py-4 space-y-4">

          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Nom de l'agent *
            </label>
            <input
              className="w-full border border-tanga-sand rounded-xl px-3 py-2.5 text-sm text-tanga-charcoal focus:outline-none focus:ring-2 focus:ring-tanga-ochre/40 focus:border-tanga-ochre transition"
              value={form.nom}
              onChange={set('nom')}
              placeholder="ex: Gestionnaire Réseaux Sociaux"
            />
          </div>

          {/* Domaine */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Domaine *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOMAINES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, domaine: d.id }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    form.domaine === d.id
                      ? 'border-tanga-ochre bg-tanga-ochre/10 text-tanga-ochre'
                      : 'border-tanga-sand bg-tanga-cream text-tanga-charcoal-light hover:border-tanga-ochre/40'
                  }`}
                >
                  <span className="flex items-center justify-center"><DomainGlyph domaine={d.id} className="w-5 h-5" /></span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Rôle *
            </label>
            <input
              className="w-full border border-tanga-sand rounded-xl px-3 py-2.5 text-sm text-tanga-charcoal focus:outline-none focus:ring-2 focus:ring-tanga-ochre/40 focus:border-tanga-ochre transition"
              value={form.role}
              onChange={set('role')}
              placeholder="ex: Spécialiste marketing digital pour PME africaines"
            />
          </div>

          {/* Objectif */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Objectif *
            </label>
            <textarea
              rows={3}
              className="w-full border border-tanga-sand rounded-xl px-3 py-2.5 text-sm text-tanga-charcoal focus:outline-none focus:ring-2 focus:ring-tanga-ochre/40 focus:border-tanga-ochre transition resize-none"
              value={form.objectif}
              onChange={set('objectif')}
              placeholder="Ce que l'agent doit accomplir de manière mesurable…"
            />
          </div>

          {/* Backstory */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Contexte / personnalité
            </label>
            <textarea
              rows={3}
              className="w-full border border-tanga-sand rounded-xl px-3 py-2.5 text-sm text-tanga-charcoal focus:outline-none focus:ring-2 focus:ring-tanga-ochre/40 focus:border-tanga-ochre transition resize-none"
              value={form.backstory}
              onChange={set('backstory')}
              placeholder="Contexte et personnalité de l'agent…"
            />
          </div>

          {/* Priorité */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Priorité d'exécution
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priorite: p }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.priorite === p
                      ? 'border-tanga-ochre bg-tanga-ochre text-white'
                      : 'border-tanga-sand bg-tanga-cream text-tanga-charcoal-light hover:border-tanga-ochre/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-tanga-charcoal-light mt-1">1 = critique (premier), 5 = optionnel</p>
          </div>

          {/* Outils catalogue */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Outils disponibles
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {OUTILS_DISPONIBLES.map((o) => {
                const selected = form.outils_requis.includes(o.id)
                return (
                  <label
                    key={o.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      selected
                        ? 'border-tanga-ochre/50 bg-tanga-ochre/8'
                        : 'border-tanga-sand bg-tanga-cream hover:border-tanga-ochre/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOutil(o.id)}
                      className="w-4 h-4 accent-tanga-ochre"
                    />
                    <span className="text-sm text-tanga-charcoal">{o.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Outils en attente */}
          <div>
            <label className="block text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">
              Décrire un outil non disponible
              <span className="ml-1.5 font-normal normal-case text-tanga-charcoal-light/70">(intention — nécessite intégration dev)</span>
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-tanga-sand rounded-xl px-3 py-2.5 text-sm text-tanga-charcoal focus:outline-none focus:ring-2 focus:ring-tanga-ochre/40 focus:border-tanga-ochre transition"
                value={outilLibre}
                onChange={(e) => setOutilLibre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), ajouterOutilLibre())}
                placeholder="ex: Connexion WhatsApp Business…"
              />
              <button
                type="button"
                onClick={ajouterOutilLibre}
                className="px-3 py-2.5 bg-tanga-sand rounded-xl text-sm font-semibold text-tanga-charcoal hover:bg-tanga-ochre/20 transition"
              >
                +
              </button>
            </div>
            {form.outils_en_attente.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.outils_en_attente.map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-50 border border-amber-200 text-amber-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    {o}
                    <button
                      type="button"
                      onClick={() => retirerOutilLibre(o)}
                      className="ml-0.5 text-amber-500 hover:text-amber-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {form.outils_en_attente.length > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                En attente de connexion — ces outils ne seront pas actifs lors de la prochaine exécution.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-tanga-sand/40 space-y-2">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 btn-primary py-3 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            {/* Toggle actif (edit only) */}
            {!isNew && onToggle && (
              <button
                onClick={onToggle}
                className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
                  agent?.actif
                    ? 'border-tanga-sand text-tanga-charcoal-light hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                    : 'border-green-300 text-green-600 hover:bg-green-50'
                }`}
              >
                {agent?.actif ? 'Désactiver' : 'Réactiver'}
              </button>
            )}
          </div>

          {/* Delete (edit only) */}
          {!isNew && onDelete && (
            confirmDelete ? (
              <div className="flex gap-2">
                <span className="flex-1 text-xs text-red-600 flex items-center">Supprimer définitivement ?</span>
                <button
                  onClick={() => { setConfirmDelete(false); onDelete() }}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition"
                >
                  {deleting ? '…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 border border-tanga-sand rounded-xl text-sm text-tanga-charcoal-light hover:bg-tanga-cream transition"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition"
              >
                <TrashIcon />
                Supprimer cet agent
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
