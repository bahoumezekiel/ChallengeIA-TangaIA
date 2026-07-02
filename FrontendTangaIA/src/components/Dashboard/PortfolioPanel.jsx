import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { genererPortfolio, statutPortfolio } from '../../api/client.js'
import {
  Globe, RefreshCw, Save, Check, AlertTriangle, ArrowRight, Sparkles,
} from '../icons.jsx'

/**
 * Vue « Site vitrine » : génère le portfolio de l'entreprise via le crew
 * multi-agents. Pré-rempli avec le profil PME connu, puis génération en
 * arrière-plan (1 à 3 min) avec sondage du statut, aperçu et téléchargement.
 */
export default function PortfolioPanel() {
  const { profilPme, user } = useApp()

  const [form, setForm] = useState(() => ({
    name: profilPme?.nom_entreprise || '',
    title: '',
    sector: profilPme?.secteur || '',
    bio: '',
    skills: (profilPme?.services_souhaites || []).join(', '),
    target_audience: profilPme?.cible_clientele || '',
    contact_email: user?.email || '',
    contact_phone: '',
    contact_whatsapp: '',
    address: '',
    business_hours: '',
    contact_linkedin: '',
    contact_facebook: '',
    primary_color: '',
    secondary_color: '',
  }))

  const [phase, setPhase] = useState('form')      // form | generation | resultat | erreur
  const [erreur, setErreur] = useState(null)
  const [html, setHtml] = useState('')
  const [rapport, setRapport] = useState('')
  const [showRapport, setShowRapport] = useState(false)
  const pollRef = useRef(null)

  const maj = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))

  // Nettoyage du sondage si on quitte la vue
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const sonder = (jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const job = await statutPortfolio(jobId)
        if (job.statut === 'termine') {
          clearInterval(pollRef.current)
          setHtml(job.html || '')
          setRapport(job.rapport || '')
          setPhase('resultat')
        } else if (job.statut === 'echec') {
          clearInterval(pollRef.current)
          setErreur(job.erreur || 'La génération a échoué.')
          setPhase('erreur')
        }
      } catch (e) {
        clearInterval(pollRef.current)
        setErreur(e.message)
        setPhase('erreur')
      }
    }, 4000)
  }

  const lancer = async () => {
    setErreur(null)
    setPhase('generation')
    try {
      const profil = {
        ...form,
        skills: form.skills
          ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      }
      const { job_id } = await genererPortfolio(profil)
      sonder(job_id)
    } catch (e) {
      setErreur(e.message)
      setPhase('erreur')
    }
  }

  const telecharger = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(form.name || 'site-vitrine').toLowerCase().replace(/\s+/g, '-')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const recommencer = () => {
    setHtml(''); setRapport(''); setErreur(null); setPhase('form')
  }

  return (
    <div className="space-y-4">
      {/* En-tête de la vue */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-tanga-charcoal">Site vitrine</h2>
          <p className="text-sm text-tanga-charcoal-light">
            Générez le site web de votre entreprise à partir de son profil.
          </p>
        </div>
      </div>

      {phase === 'form' && (
        <PortfolioForm form={form} maj={maj} onSubmit={lancer} />
      )}

      {phase === 'generation' && <EcranGeneration />}

      {phase === 'erreur' && (
        <div className="tanga-card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="font-semibold text-tanga-charcoal">La génération a échoué</p>
          <p className="text-sm text-tanga-charcoal-light mt-1">{erreur}</p>
          <button onClick={recommencer} className="btn-primary mt-4">
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      )}

      {phase === 'resultat' && (
        <div className="space-y-4">
          <div className="tanga-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-tanga-green font-semibold">
              <Check className="w-5 h-5" /> Votre site est prêt
            </div>
            <div className="flex gap-2">
              <button onClick={telecharger} className="btn-primary text-sm px-4 py-2.5">
                <Save className="w-4 h-4" /> Télécharger le HTML
              </button>
              <button onClick={recommencer} className="btn-ghost text-sm px-4 py-2.5">
                <RefreshCw className="w-4 h-4" /> Regénérer
              </button>
            </div>
          </div>

          {/* Aperçu du site dans une iframe isolée */}
          <div className="tanga-card p-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-tanga-sand/50 text-xs text-tanga-charcoal-light">
              Aperçu
            </div>
            <iframe
              title="Aperçu du site vitrine"
              srcDoc={html}
              sandbox="allow-scripts"
              className="w-full h-[600px] bg-white"
            />
          </div>

          {/* Rapport qualité (repliable) */}
          {rapport && (
            <div className="tanga-card p-4">
              <button
                onClick={() => setShowRapport((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-tanga-charcoal"
              >
                <Sparkles className="w-4 h-4 text-tanga-ochre" />
                Rapport de contrôle qualité
                <span className="text-tanga-charcoal-light">{showRapport ? '▲' : '▼'}</span>
              </button>
              {showRapport && (
                <pre className="mt-3 text-xs text-tanga-charcoal-light whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {rapport}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formulaire ── */

function PortfolioForm({ form, maj, onSubmit }) {
  const pret = form.name.trim() && form.sector.trim()
  return (
    <div className="tanga-card p-6 space-y-5">
      <p className="text-sm text-tanga-charcoal-light">
        Les informations connues sont pré-remplies. Complétez-les pour un site plus riche
        (seuls les champs renseignés apparaîtront — rien n'est inventé).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nom de l'entreprise *">
          <input className="tanga-input" value={form.name} onChange={(e) => maj('name', e.target.value)} placeholder="Ex : Plomberie Diallo" />
        </Field>
        <Field label="Secteur *">
          <input className="tanga-input" value={form.sector} onChange={(e) => maj('sector', e.target.value)} placeholder="Ex : Plomberie" />
        </Field>
        <Field label="Titre / slogan">
          <input className="tanga-input" value={form.title} onChange={(e) => maj('title', e.target.value)} placeholder="Ex : Plombier chauffagiste à Ouagadougou" />
        </Field>
        <Field label="Clientèle cible">
          <input className="tanga-input" value={form.target_audience} onChange={(e) => maj('target_audience', e.target.value)} placeholder="Ex : particuliers et entreprises" />
        </Field>
      </div>

      <Field label="Présentation (bio)">
        <textarea className="tanga-input resize-none" rows={3} value={form.bio} onChange={(e) => maj('bio', e.target.value)} placeholder="Quelques phrases qui présentent l'entreprise..." />
      </Field>

      <Field label="Services / compétences (séparés par des virgules)">
        <input className="tanga-input" value={form.skills} onChange={(e) => maj('skills', e.target.value)} placeholder="Dépannage, Installation, Entretien..." />
      </Field>

      <div className="pt-2 border-t border-tanga-sand/50">
        <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wide mb-3">Contacts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email"><input className="tanga-input" value={form.contact_email} onChange={(e) => maj('contact_email', e.target.value)} placeholder="contact@entreprise.bf" /></Field>
          <Field label="Téléphone"><input className="tanga-input" value={form.contact_phone} onChange={(e) => maj('contact_phone', e.target.value)} placeholder="+226 ..." /></Field>
          <Field label="WhatsApp"><input className="tanga-input" value={form.contact_whatsapp} onChange={(e) => maj('contact_whatsapp', e.target.value)} placeholder="+226 ..." /></Field>
          <Field label="Adresse"><input className="tanga-input" value={form.address} onChange={(e) => maj('address', e.target.value)} placeholder="Ouagadougou, secteur ..." /></Field>
          <Field label="Horaires"><input className="tanga-input" value={form.business_hours} onChange={(e) => maj('business_hours', e.target.value)} placeholder="Lun-Sam 8h-18h" /></Field>
          <Field label="Facebook"><input className="tanga-input" value={form.contact_facebook} onChange={(e) => maj('contact_facebook', e.target.value)} placeholder="lien Facebook" /></Field>
        </div>
      </div>

      <div className="pt-2 border-t border-tanga-sand/50">
        <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wide mb-3">Couleurs (facultatif)</p>
        <div className="grid grid-cols-2 gap-4 max-w-xs">
          <Field label="Principale"><input type="color" className="w-full h-10 rounded-lg border border-tanga-sand/60 cursor-pointer" value={form.primary_color || '#C17A3B'} onChange={(e) => maj('primary_color', e.target.value)} /></Field>
          <Field label="Secondaire"><input type="color" className="w-full h-10 rounded-lg border border-tanga-sand/60 cursor-pointer" value={form.secondary_color || '#2D5A27'} onChange={(e) => maj('secondary_color', e.target.value)} /></Field>
        </div>
      </div>

      <button onClick={onSubmit} disabled={!pret} className="btn-primary w-full py-3.5 disabled:opacity-50">
        Générer mon site vitrine <ArrowRight className="w-5 h-5" />
      </button>
      {!pret && (
        <p className="text-xs text-tanga-charcoal-light text-center">Le nom et le secteur sont obligatoires.</p>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/* ── Écran d'attente ── */

function EcranGeneration() {
  const messages = [
    'Analyse du profil de votre entreprise...',
    'Conception de la structure du site...',
    'Rédaction et mise en forme du contenu...',
    'Contrôle qualité final...',
  ]
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="tanga-card p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center mx-auto mb-4">
        <RefreshCw className="w-7 h-7 animate-spin" />
      </div>
      <p className="font-semibold text-tanga-charcoal">Votre équipe génère le site...</p>
      <p className="text-sm text-tanga-charcoal-light mt-1">{messages[i]}</p>
      <p className="text-xs text-tanga-charcoal-light mt-4">
        Cela prend généralement 1 à 3 minutes. Vous pouvez continuer à naviguer.
      </p>
    </div>
  )
}
