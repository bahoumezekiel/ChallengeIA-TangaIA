import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import {
  Plus as PlusIcon, Trash as TrashIcon, Check as CheckIcon, ArrowLeft, ArrowRight, Rocket,
  Megaphone, Briefcase, BarChart, Headset, Settings, Leaf, Sprout, Gem, DOMAIN_META,
} from '../icons.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICES = [
  { value: 'marketing',     label: 'Marketing & Communication',   Icon: Megaphone, color: '#C17A3B', desc: 'Stratégie de contenu, réseaux sociaux, visibilité' },
  { value: 'vente',         label: 'Ventes & Commerce',           Icon: Briefcase, color: '#2D5A27', desc: 'Prospection, CRM, pipeline commercial' },
  { value: 'admin_finance', label: 'Administration & Finance',    Icon: BarChart,  color: '#1E40AF', desc: 'Comptabilité, reporting, gestion administrative' },
  { value: 'support',       label: 'Support Client',              Icon: Headset,   color: '#7C3AED', desc: 'Service client, réclamations, fidélisation' },
  { value: 'autre',         label: 'Autre / Personnalisé',        Icon: Settings,  color: '#6B7280', desc: 'Besoins spécifiques à votre secteur' },
]

const BUDGETS = [
  { value: 'faible', label: 'Économique', sublabel: 'Outils gratuits prioritaires', Icon: Leaf },
  { value: 'moyen',  label: 'Modéré',     sublabel: 'Bon rapport qualité/prix',      Icon: Sprout },
  { value: 'eleve',  label: 'Premium',    sublabel: 'Meilleurs outils disponibles',  Icon: Gem },
]

const TOTAL_STEPS = 7

// ─── Helper components ────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-tanga-ochre uppercase tracking-wide">
          Étape {step} sur {TOTAL_STEPS}
        </span>
        <span className="text-xs text-tanga-charcoal-light font-medium">
          {Math.round((step / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i + 1 <= step ? '#C17A3B' : '#E8D5B7',
              transform: i + 1 === step ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function StepHeader({ step, title, subtitle }) {
  return (
    <div className="mb-8 animate-fade-in">
      <div className="inline-flex items-center gap-2 bg-tanga-ochre/10 rounded-full px-3 py-1 mb-3">
        <span className="text-tanga-ochre text-xs font-bold">Étape {step}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-tanga-charcoal mb-2 leading-tight">{title}</h2>
      {subtitle && <p className="text-tanga-charcoal-light leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function ListEditor({ items, onChange, placeholder, label }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setInputValue('')
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  const handleRemove = (index) => onChange(items.filter((_, i) => i !== index))

  return (
    <div>
      <label className="block text-sm font-semibold text-tanga-charcoal mb-2">{label}</label>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="tanga-input flex-1"
        />
        <button type="button" onClick={handleAdd} disabled={!inputValue.trim()} className="btn-primary px-4 py-3 flex-shrink-0" title="Ajouter">
          <PlusIcon className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2 p-2.5 bg-tanga-cream rounded-xl border border-tanga-sand/50 group animate-fade-in">
              <span className="w-5 h-5 rounded-full bg-tanga-ochre/15 text-tanga-ochre flex items-center justify-center flex-shrink-0">
                <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-sm text-tanga-charcoal font-medium">{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-tanga-charcoal-light/40 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <p className="text-sm text-tanga-charcoal-light/60 italic text-center py-3">
          Aucun élément ajouté — écrivez puis appuyez sur Entrée ou cliquez sur +
        </p>
      )}
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ profil, update }) {
  return (
    <div className="space-y-5 animate-slide-up">
      <StepHeader step={1} title="Parlez-nous de votre entreprise" subtitle="Ces informations nous permettent de mieux comprendre votre contexte." />
      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
          Nom de l'entreprise <span className="text-tanga-ember">*</span>
        </label>
        <input type="text" value={profil.nom_entreprise} onChange={(e) => update({ nom_entreprise: e.target.value })}
          placeholder="Ex: Saveurs du Sahel, TechAfrika..." className="tanga-input" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
          Secteur d'activité <span className="text-tanga-ember">*</span>
        </label>
        <input type="text" value={profil.secteur} onChange={(e) => update({ secteur: e.target.value })}
          placeholder="Ex: Restauration, Agriculture, Commerce, Technologie..." className="tanga-input" />
      </div>
    </div>
  )
}

function Step2({ profil, update }) {
  return (
    <div className="space-y-5 animate-slide-up">
      <StepHeader step={2} title="Votre équipe et vos clients" subtitle="Décrivez la taille de votre équipe et votre clientèle cible." />
      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
          Nombre d'employés <span className="text-tanga-ember">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => update({ taille_effectif: Math.max(1, profil.taille_effectif - 1) })}
            className="w-11 h-11 rounded-xl border-2 border-tanga-sand text-tanga-charcoal flex items-center justify-center hover:border-tanga-ochre hover:text-tanga-ochre transition-colors flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
          <input type="number" min="1" max="9999" value={profil.taille_effectif}
            onChange={(e) => update({ taille_effectif: Math.max(1, parseInt(e.target.value) || 1) })}
            className="tanga-input text-center text-xl font-bold" />
          <button type="button" onClick={() => update({ taille_effectif: profil.taille_effectif + 1 })}
            className="w-11 h-11 rounded-xl border-2 border-tanga-sand text-tanga-charcoal flex items-center justify-center hover:border-tanga-ochre hover:text-tanga-ochre transition-colors flex-shrink-0">
            <PlusIcon className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {[1, 5, 10, 25, 50, 100].map((n) => (
            <button key={n} type="button" onClick={() => update({ taille_effectif: n })}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-tanga-sand hover:border-tanga-ochre hover:text-tanga-ochre transition-colors"
              style={{
                backgroundColor: profil.taille_effectif === n ? '#C17A3B10' : 'white',
                borderColor: profil.taille_effectif === n ? '#C17A3B' : undefined,
                color: profil.taille_effectif === n ? '#C17A3B' : undefined,
              }}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
          Clientèle cible <span className="text-tanga-ember">*</span>
        </label>
        <textarea value={profil.cible_clientele} onChange={(e) => update({ cible_clientele: e.target.value })}
          placeholder="Ex: Particuliers urbains de 25-45 ans, PME locales, restaurants et hôtels..."
          className="tanga-input resize-none h-24" rows={3} />
      </div>
    </div>
  )
}

function Step3({ profil, update }) {
  return (
    <div className="animate-slide-up">
      <StepHeader step={3} title="Objectifs à court terme" subtitle="Qu'espérez-vous accomplir dans les 6 à 12 prochains mois ?" />
      <ListEditor items={profil.objectifs_court_terme} onChange={(val) => update({ objectifs_court_terme: val })}
        placeholder="Ex: Augmenter les ventes de 20%, lancer notre page Instagram..." label="Ajoutez vos objectifs (un par un)" />
    </div>
  )
}

function Step4({ profil, update }) {
  return (
    <div className="animate-slide-up">
      <StepHeader step={4} title="Vision à long terme" subtitle="Où souhaitez-vous que votre entreprise soit dans 2 à 5 ans ?" />
      <ListEditor items={profil.objectifs_long_terme} onChange={(val) => update({ objectifs_long_terme: val })}
        placeholder="Ex: Devenir le leader régional, ouvrir 3 nouvelles agences..." label="Ajoutez vos objectifs (un par un)" />
    </div>
  )
}

function Step5({ profil, update }) {
  const toggle = (value) => {
    const current = profil.services_souhaites
    if (current.includes(value)) update({ services_souhaites: current.filter((s) => s !== value) })
    else update({ services_souhaites: [...current, value] })
  }

  return (
    <div className="animate-slide-up">
      <StepHeader step={5} title="Domaines d'expertise souhaités" subtitle="Sélectionnez les domaines dans lesquels vous souhaitez être assisté par des agents IA." />
      <div className="space-y-3">
        {SERVICES.map((service) => {
          const isSelected = profil.services_souhaites.includes(service.value)
          const Icon = service.Icon
          return (
            <button key={service.value} type="button" onClick={() => toggle(service.value)}
              className="w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4"
              style={{ borderColor: isSelected ? service.color : '#E8D5B7', backgroundColor: isSelected ? `${service.color}0D` : 'white' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${service.color}18`, color: service.color }}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-tanga-charcoal">{service.label}</div>
                <div className="text-xs text-tanga-charcoal-light mt-0.5">{service.desc}</div>
              </div>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{ borderColor: isSelected ? service.color : '#E8D5B7', backgroundColor: isSelected ? service.color : 'white' }}>
                {isSelected && <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Step6({ profil, update }) {
  return (
    <div className="animate-slide-up space-y-6">
      <StepHeader step={6} title="Budget et contraintes" subtitle="Indiquez votre budget et éventuelles contraintes spécifiques." />

      <div>
        <label className="block text-sm font-semibold text-tanga-charcoal mb-3">
          Budget indicatif <span className="text-tanga-ember">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {BUDGETS.map((budget) => {
            const isSelected = profil.budget_indicatif === budget.value
            const Icon = budget.Icon
            return (
              <button key={budget.value} type="button" onClick={() => update({ budget_indicatif: budget.value })}
                className="p-3 sm:p-4 rounded-xl border-2 text-center transition-all duration-200 flex flex-col items-center gap-1.5"
                style={{ borderColor: isSelected ? '#C17A3B' : '#E8D5B7', backgroundColor: isSelected ? '#C17A3B0D' : 'white' }}>
                <span style={{ color: isSelected ? '#C17A3B' : '#8A7F6B' }}><Icon className="w-7 h-7" /></span>
                <span className="font-semibold text-sm transition-colors" style={{ color: isSelected ? '#C17A3B' : '#2C2416' }}>
                  {budget.label}
                </span>
                <span className="text-xs text-tanga-charcoal-light hidden sm:block">{budget.sublabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      <ListEditor items={profil.contraintes} onChange={(val) => update({ contraintes: val })}
        placeholder="Ex: Pas de budget pour des abonnements payants, langue locale requise..." label="Contraintes spécifiques (optionnel)" />
    </div>
  )
}

function RecapItem({ label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-tanga-sand/40 last:border-0">
      <span className="text-sm text-tanga-charcoal-light font-medium w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-tanga-charcoal font-semibold flex-1">
        {Array.isArray(value) ? (
          <ul className="space-y-1">
            {value.map((v, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-tanga-ochre mt-0.5">•</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        ) : value}
      </span>
    </div>
  )
}

function Step7({ profil }) {
  const selectedServices = SERVICES.filter((s) => profil.services_souhaites.includes(s.value))
  const selectedBudget = BUDGETS.find((b) => b.value === profil.budget_indicatif)

  return (
    <div className="animate-slide-up">
      <StepHeader step={7} title="Récapitulatif" subtitle="Vérifiez vos informations avant de lancer vos agents IA." />

      <div className="tanga-card p-5 mb-4">
        <RecapItem label="Entreprise" value={profil.nom_entreprise} />
        <RecapItem label="Secteur" value={profil.secteur} />
        <RecapItem label="Effectif" value={`${profil.taille_effectif} employé${profil.taille_effectif > 1 ? 's' : ''}`} />
        <RecapItem label="Clientèle cible" value={profil.cible_clientele} />
        <RecapItem label="Objectifs court terme" value={profil.objectifs_court_terme} />
        <RecapItem label="Objectifs long terme" value={profil.objectifs_long_terme} />
        <div className="flex gap-3 py-2.5 border-b border-tanga-sand/40">
          <span className="text-sm text-tanga-charcoal-light font-medium w-40 flex-shrink-0">Domaines</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedServices.map((s) => {
              const Icon = s.Icon
              return (
                <span key={s.value} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: s.color }}>
                  <Icon className="w-3 h-3" /> {s.label}
                </span>
              )
            })}
          </div>
        </div>
        {selectedBudget && (
          <div className="flex gap-3 py-2.5 border-b border-tanga-sand/40 last:border-0">
            <span className="text-sm text-tanga-charcoal-light font-medium w-40 flex-shrink-0">Budget</span>
            <span className="text-sm text-tanga-charcoal font-semibold flex-1 inline-flex items-center gap-1.5">
              <selectedBudget.Icon className="w-4 h-4 text-tanga-ochre" /> {selectedBudget.label}
            </span>
          </div>
        )}
        {profil.contraintes.length > 0 && <RecapItem label="Contraintes" value={profil.contraintes} />}
      </div>

      <div className="p-4 bg-tanga-green/5 border border-tanga-green/20 rounded-xl flex gap-3 items-start">
        <span className="text-tanga-green flex-shrink-0"><Rocket className="w-6 h-6" /></span>
        <div>
          <p className="text-sm font-semibold text-tanga-green">Prêt pour le lancement</p>
          <p className="text-sm text-tanga-charcoal-light mt-0.5">
            TangaAI va analyser votre profil et constituer votre équipe d'agents IA personnalisée.
            Cette opération prend généralement 1 à 3 minutes.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main OnboardingFlow ──────────────────────────────────────────────────────

function validateStep(step, profil) {
  switch (step) {
    case 1: return profil.nom_entreprise.trim() !== '' && profil.secteur.trim() !== ''
    case 2: return profil.taille_effectif >= 1 && profil.cible_clientele.trim() !== ''
    case 3: return true
    case 4: return true
    case 5: return profil.services_souhaites.length > 0
    case 6: return profil.budget_indicatif !== ''
    case 7: return true
    default: return true
  }
}

export default function OnboardingFlow({ onBack }) {
  const { profilPme, updateProfil, setAppState, lancerAnalyse } = useApp()
  const [step, setStep] = useState(1)
  const containerRef = useRef(null)

  const canProceed = validateStep(step, profilPme)

  const scrollToTop = () => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

  const handleNext = () => {
    if (!canProceed) return
    if (step < TOTAL_STEPS) { setStep((s) => s + 1); scrollToTop() }
  }

  const handlePrev = () => {
    if (step > 1) { setStep((s) => s - 1); scrollToTop() }
    else if (onBack) { onBack() }
    else { setAppState('landing') }
  }

  const handleLaunch = () => lancerAnalyse(profilPme)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && step < TOTAL_STEPS && canProceed && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleNext()
    }
  }, [step, canProceed])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="min-h-screen bg-tanga-cream flex flex-col">
      <div className="kente-stripe" />

      <header className="sticky top-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={handlePrev} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{step === 1 ? (onBack ? 'Choix' : 'Accueil') : 'Retour'}</span>
          </button>
          <span className="font-bold text-lg text-tanga-charcoal tracking-tight">
            Tanga<span className="text-tanga-ochre">AI</span>
          </span>
          <div className="w-20 text-right text-xs text-tanga-charcoal-light font-medium">
            {step}/{TOTAL_STEPS}
          </div>
        </div>
      </header>

      <main ref={containerRef} className="flex-1 overflow-y-auto custom-scroll">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32">
          <ProgressBar step={step} />

          {step === 1 && <Step1 profil={profilPme} update={updateProfil} />}
          {step === 2 && <Step2 profil={profilPme} update={updateProfil} />}
          {step === 3 && <Step3 profil={profilPme} update={updateProfil} />}
          {step === 4 && <Step4 profil={profilPme} update={updateProfil} />}
          {step === 5 && <Step5 profil={profilPme} update={updateProfil} />}
          {step === 6 && <Step6 profil={profilPme} update={updateProfil} />}
          {step === 7 && <Step7 profil={profilPme} />}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-tanga-cream/95 backdrop-blur-sm border-t border-tanga-sand/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex gap-3">
          {step > 1 && (
            <button onClick={handlePrev} className="btn-secondary flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button onClick={handleNext} disabled={!canProceed} className="btn-primary flex-1">
              Continuer
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={handleLaunch} className="btn-primary flex-1 text-base py-4 shadow-lg shadow-tanga-ochre/25">
              <Rocket className="w-5 h-5" />
              Lancer les agents IA
            </button>
          )}
        </div>

        {!canProceed && step < TOTAL_STEPS && (
          <div className="text-center pb-2">
            <p className="text-xs text-tanga-ember">
              {step === 5 ? 'Sélectionnez au moins un domaine pour continuer' : 'Remplissez les champs requis pour continuer'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
