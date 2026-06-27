import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import {
  DOMAIN_META, DomainGlyph, ToolGlyph,
  Link as LinkIcon, Lock, Info, Check, Settings, ArrowRight, ArrowLeft, AlertTriangle,
} from './icons.jsx'

const FIELD_PLACEHOLDERS = {
  page_id:       'ex : 123456789012345',
  page_name:     'ex : Saveurs du Sahel',
  access_token:  'EAAxxxx... (token de la PAGE, pas du compte)',
  api_key:       'sk-... ou votre clé API',
  base_url:      'https://api.hubspot.com',
  smtp_host:     'smtp.gmail.com',
  smtp_port:     '587',
  smtp_user:     'contact@votreentreprise.com',
  smtp_password: 'Mot de passe ou mot de passe d\'application Gmail',
  calendar_id:    'primary',
  source_url:     'https://docs.google.com/spreadsheets/d/VOTRE_ID/edit',
  smtp_from_name: 'Saveurs du Sahel',
}

const FIELD_HINTS = {
  page_id:        'Où trouver : Paramètres de la page Facebook puis Infos générales puis "ID de la page"',
  access_token:   'Où trouver : Meta Business Suite puis Paramètres puis Accès à l\'API puis Token de la page',
  smtp_password:  'Gmail : Compte Google puis Sécurité puis Authentification à 2 facteurs puis Mots de passe d\'application',
  smtp_from_name: 'Vos clients verront ce nom dans leur boîte mail — laissez vide pour afficher votre adresse brute',
  api_key:        'Disponible dans les paramètres développeur de votre outil (HubSpot, Pipedrive…)',
  source_url:     "Google Sheets : partagez la feuille en lecture publique, puis collez l'URL. La feuille doit avoir une colonne nommée 'email' ou 'mail'.",
}

function isPasswordField(key) {
  return ['token', 'secret', 'password', 'key'].some((k) => key.toLowerCase().includes(k))
}

// Un champ est optionnel si sa description le mentionne explicitement.
function isOptionalField(fieldLabel) {
  const l = fieldLabel.toLowerCase()
  return l.includes('optionnel') || l.includes('laisser vide') || l.includes('optional')
}

function ToolSection({ toolName, schema, values, onChange }) {
  return (
    <div className="border border-tanga-sand/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-tanga-cream/60 border-b border-tanga-sand/30">
        <span className="text-tanga-charcoal"><ToolGlyph tool={toolName} className="w-4 h-4" /></span>
        <span className="font-semibold text-sm text-tanga-charcoal">{schema.label}</span>
      </div>

      <div className="px-4 py-4 space-y-4 bg-white">
        {Object.entries(schema.fields).map(([fieldKey, fieldLabel]) => {
          const optional = isOptionalField(fieldLabel)
          return (
            <div key={fieldKey}>
              <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
                {fieldLabel}
                {optional
                  ? <span className="ml-1.5 text-xs font-normal text-tanga-charcoal-light">(optionnel)</span>
                  : <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={isPasswordField(fieldKey) ? 'password' : 'text'}
                value={values[fieldKey] || ''}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[fieldKey] || ''}
                className={`tanga-input text-sm ${optional ? 'opacity-80' : ''}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {FIELD_HINTS[fieldKey] && (
                <p className="mt-1.5 text-xs text-tanga-charcoal-light flex items-start gap-1">
                  <span className="flex-shrink-0 mt-0.5"><Info className="w-3.5 h-3.5" /></span>
                  <span>{FIELD_HINTS[fieldKey]}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AgentCredentialCard({ agent, outisMaqs, toolsToShow, toolsAlreadyShown, values, onChange }) {
  const domain = DOMAIN_META[agent.domaine] || DOMAIN_META.autre

  const needsCredentials = toolsToShow.length > 0 || toolsAlreadyShown.length > 0

  return (
    <div className="rounded-2xl overflow-hidden border border-tanga-sand/50 shadow-sm">
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ backgroundColor: `${domain.color}15`, borderLeft: `4px solid ${domain.color}` }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: domain.color + '25', color: domain.color }}
        >
          <DomainGlyph domaine={agent.domaine} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-tanga-charcoal">{agent.nom}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: domain.color }}>
              {domain.label}
            </span>
          </div>
          <p className="text-xs text-tanga-charcoal-light mt-0.5 truncate">{agent.role}</p>
        </div>

        {!needsCredentials ? (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
            <Check className="w-3.5 h-3.5" /> Prêt
          </span>
        ) : (
          <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-tanga-ochre bg-tanga-ochre/10 px-2.5 py-1 rounded-full">
            <Settings className="w-3.5 h-3.5" /> {toolsToShow.length + toolsAlreadyShown.length} outil(s)
          </span>
        )}
      </div>

      {!needsCredentials && (
        <div className="px-5 py-3 bg-white text-sm text-tanga-charcoal-light flex items-center gap-2">
          <span className="text-green-500"><Check className="w-4 h-4" /></span>
          Aucune connexion externe requise — cet agent est autonome avec ses outils intégrés.
        </div>
      )}

      {toolsToShow.length > 0 && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-3">
          {toolsToShow.map((toolName) => (
            <ToolSection
              key={toolName}
              toolName={toolName}
              schema={outisMaqs[toolName]}
              values={values[toolName] || {}}
              onChange={(fieldKey, val) => onChange(toolName, fieldKey, val)}
            />
          ))}
        </div>
      )}

      {toolsAlreadyShown.length > 0 && (
        <div className="px-4 pb-3 pt-2 bg-white space-y-1.5">
          {toolsAlreadyShown.map((toolName) => (
            <div key={toolName} className="flex items-center gap-2 text-xs text-tanga-charcoal-light bg-tanga-cream rounded-lg px-3 py-2">
              <span><ToolGlyph tool={toolName} className="w-3.5 h-3.5" /></span>
              <span><strong>{outisMaqs[toolName].label}</strong> — identifiants partagés avec un autre agent</span>
              <span className="ml-auto inline-flex items-center gap-1 text-tanga-charcoal-light text-xs">
                <ArrowLeft className="w-3 h-3" style={{ transform: 'rotate(90deg)' }} /> Formulaire partagé ci-dessus
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CredentialsModal() {
  const { results, soumettreCreds, reprendreAnalyse } = useApp()

  const agents = results?.agents_crees || []
  const outisMaqs = results?.notification?.outils_manquants || {}
  const toolKeys = Object.keys(outisMaqs)

  const [allValues, setAllValues] = useState(() => {
    const init = {}
    for (const [toolName, schema] of Object.entries(outisMaqs)) {
      init[toolName] = {}
      for (const fieldKey of Object.keys(schema.fields)) init[toolName][fieldKey] = ''
    }
    return init
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState(null)
  const [error, setError] = useState(null)

  // Progression : seuls les champs REQUIS comptent.
  const { filledCount, totalCount } = useMemo(() => {
    let filled = 0, total = 0
    for (const [toolName, schema] of Object.entries(outisMaqs)) {
      for (const [fieldKey, fieldLabel] of Object.entries(schema.fields)) {
        if (isOptionalField(fieldLabel)) continue
        total++
        if (allValues[toolName]?.[fieldKey]?.trim()) filled++
      }
    }
    return { filledCount: filled, totalCount: total }
  }, [allValues, outisMaqs])

  const allFilled = filledCount === totalCount && totalCount > 0

  const handleChange = (toolName, fieldKey, value) => {
    setAllValues((prev) => ({ ...prev, [toolName]: { ...prev[toolName], [fieldKey]: value } }))
    setError(null)
  }

  const validate = () => {
    for (const [toolName, schema] of Object.entries(outisMaqs)) {
      for (const [fieldKey, fieldLabel] of Object.entries(schema.fields)) {
        if (isOptionalField(fieldLabel)) continue   // optionnels non bloquants
        if (!allValues[toolName]?.[fieldKey]?.trim()) {
          return `Champ manquant : "${fieldLabel}" (${schema.label})`
        }
      }
    }
    return null
  }

  const handleSubmit = async () => {
    const validationErr = validate()
    if (validationErr) { setError(validationErr); return }
    setIsSubmitting(true); setError(null)
    try {
      for (const [toolName, creds] of Object.entries(allValues)) {
        const schema = outisMaqs[toolName]
        if (schema) {
          setSubmitStep(`Connexion : ${schema.label}…`)
          await soumettreCreds(toolName, creds)
        }
      }
      setSubmitStep('Lancement des agents…')
      await reprendreAnalyse()
    } catch (err) {
      setError(err.message || 'Erreur lors de la soumission.')
      setIsSubmitting(false)
      setSubmitStep(null)
    }
  }

  const handleSkip = async () => {
    setIsSubmitting(true); setError(null)
    try {
      await reprendreAnalyse()
    } catch (err) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  // Assignation déterministe : chaque outil n'affiche son formulaire qu'UNE seule fois,
  // sur le premier agent qui le requiert. Calculé en amont (pas pendant le rendu) pour
  // éviter que le double-rendu de React (StrictMode) ne masque le formulaire.
  const assignations = useMemo(() => {
    const vus = new Set()
    return agents.map((agent) => {
      const requis = (agent.outils_requis || []).filter((t) => outisMaqs[t])
      const show = requis.filter((t) => !vus.has(t))
      const shared = requis.filter((t) => vus.has(t))
      show.forEach((t) => vus.add(t))
      return { show, shared }
    })
  }, [agents, outisMaqs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-tanga-charcoal/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-slide-up">

        <div className="bg-white border-b border-tanga-sand/40 flex-shrink-0">
          <div className="kente-stripe" />
          <div className="px-6 pt-4 pb-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center flex-shrink-0">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-tanga-charcoal text-lg leading-tight">Connexion des outils</h2>
                <p className="text-sm text-tanga-charcoal-light mt-0.5">
                  {results?.notification?.message || 'Vos agents ont besoin de ces accès pour agir de façon autonome.'}
                </p>
              </div>
            </div>

            {totalCount > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-tanga-charcoal-light">
                    {filledCount} / {totalCount} champs requis renseignés
                  </span>
                  {allFilled && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Prêt à lancer
                    </span>
                  )}
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill transition-all duration-300"
                    style={{
                      width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%`,
                      backgroundColor: allFilled ? '#2D5A27' : '#C17A3B',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll bg-tanga-cream/60 px-6 py-5 space-y-4">
          {agents.length > 0 ? (
            agents.map((agent, idx) => (
              <AgentCredentialCard
                key={agent.nom}
                agent={agent}
                outisMaqs={outisMaqs}
                toolsToShow={assignations[idx].show}
                toolsAlreadyShown={assignations[idx].shared}
                values={allValues}
                onChange={handleChange}
              />
            ))
          ) : (
            toolKeys.map((toolName) => (
              <div key={toolName} className="tanga-card overflow-hidden">
                <ToolSection
                  toolName={toolName}
                  schema={outisMaqs[toolName]}
                  values={allValues[toolName] || {}}
                  onChange={(fieldKey, val) => handleChange(toolName, fieldKey, val)}
                />
              </div>
            ))
          )}

          <div className="flex items-start gap-2 p-3 bg-tanga-green/5 border border-tanga-green/20 rounded-xl text-xs text-tanga-charcoal-light">
            <span className="text-tanga-green flex-shrink-0 mt-0.5"><Lock className="w-3.5 h-3.5" /></span>
            <span>
              Vos identifiants sont transmis directement à votre session et stockés
              localement. Ils ne sont jamais partagés avec des tiers.
            </span>
          </div>
        </div>

        <div className="bg-white border-t border-tanga-sand/40 px-6 py-4 flex-shrink-0">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          {isSubmitting && submitStep && (
            <div className="mb-3 flex items-center gap-2 text-sm text-tanga-ochre font-medium">
              <span className="w-4 h-4 border-2 border-tanga-ochre/30 border-t-tanga-ochre rounded-full animate-spin flex-shrink-0" />
              <span>{submitStep}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={isSubmitting || !allFilled} className="btn-primary flex-1 py-3">
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Connexion en cours…</span>
                </>
              ) : (
                <>
                  <span>Valider et lancer les agents</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="btn-ghost flex-shrink-0 px-4 text-sm"
              title="Lancer les agents sans connecter les outils (mode simulation)"
            >
              Ignorer
            </button>
          </div>

          <p className="text-center text-xs text-tanga-charcoal-light mt-2">
            "Ignorer" lance les agents en mode simulation — aucune action réelle ne sera effectuée.
          </p>
        </div>
      </div>
    </div>
  )
}
