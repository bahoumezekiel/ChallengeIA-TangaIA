/**
 * ToolsManager.jsx — Gestionnaire de connexions depuis le dashboard.
 * Organisation par OUTIL (pas par agent) pour éviter toute duplication.
 */

import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { TOOLS_SCHEMA, TOOLS_NO_CREDENTIALS, isPasswordField } from '../../api/toolsSchema.js'
import {
  DOMAIN_META, DomainGlyph, ToolGlyph,
  Eye, EyeOff, Info, Lock, Save, Link as LinkIcon, ArrowRight, Check, AlertTriangle, X, Pencil,
} from '../icons.jsx'

function CredentialField({ fieldKey, fieldLabel, value, onChange, schema }) {
  const [show, setShow] = useState(false)
  const hint = schema.hints?.[fieldKey]
  const placeholder = schema.placeholders?.[fieldKey] || ''
  const isPass = isPasswordField(fieldKey)

  return (
    <div>
      <label className="block text-sm font-semibold text-tanga-charcoal mb-1.5">
        {fieldLabel}
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="relative">
        <input
          type={isPass && !show ? 'password' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="tanga-input text-sm pr-10"
          autoComplete="off"
          spellCheck={false}
        />
        {isPass && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tanga-charcoal-light hover:text-tanga-charcoal"
            title={show ? 'Masquer' : 'Afficher'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && (
        <p className="mt-1.5 text-xs text-tanga-charcoal-light flex items-start gap-1 leading-relaxed">
          <span className="flex-shrink-0 mt-0.5"><Info className="w-3.5 h-3.5" /></span>
          <span>{hint}</span>
        </p>
      )}
    </div>
  )
}

function ToolCard({ toolName, agentsUsing, values, onChange, isSaved }) {
  const schema = TOOLS_SCHEMA[toolName]
  if (!schema) return null

  const fieldKeys = Object.keys(schema.fields)
  const filledCount = fieldKeys.filter((k) => values[k]?.trim()).length
  const allFilled = filledCount === fieldKeys.length

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
      isSaved ? 'border-green-300 shadow-sm shadow-green-100'
        : allFilled ? 'border-tanga-ochre/50' : 'border-tanga-sand/60'
    }`}>
      <div className={`px-4 py-3 flex items-center justify-between gap-3 ${isSaved ? 'bg-green-50' : 'bg-tanga-cream/70'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-tanga-charcoal flex-shrink-0"><ToolGlyph tool={toolName} className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-tanga-charcoal">{schema.label}</p>
            {agentsUsing.length > 0 && (
              <p className="text-xs text-tanga-charcoal-light truncate">Utilisé par : {agentsUsing.join(', ')}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSaved ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <Check className="w-3 h-3" /> Sauvegardé
            </span>
          ) : (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              allFilled ? 'text-tanga-ochre bg-tanga-ochre/10' : 'text-tanga-charcoal-light bg-tanga-sand/40'
            }`}>
              {filledCount}/{fieldKeys.length}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 bg-white space-y-4">
        {fieldKeys.map((fieldKey) => (
          <CredentialField
            key={fieldKey}
            fieldKey={fieldKey}
            fieldLabel={schema.fields[fieldKey]}
            value={values[fieldKey]}
            onChange={(val) => onChange(fieldKey, val)}
            schema={schema}
          />
        ))}
      </div>
    </div>
  )
}

function AgentsSummary({ agents }) {
  if (!agents?.length) return null

  return (
    <div className="rounded-xl border border-tanga-sand/50 overflow-hidden">
      <div className="px-4 py-3 bg-tanga-cream/70 border-b border-tanga-sand/30">
        <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider">
          Agents de cette session
        </p>
      </div>
      <div className="bg-white divide-y divide-tanga-sand/20">
        {agents.map((agent) => {
          const domain = DOMAIN_META[agent.domaine] || DOMAIN_META.autre
          const toolsWithCreds = (agent.outils_requis || []).filter((t) => TOOLS_SCHEMA[t] && !TOOLS_NO_CREDENTIALS.has(t))
          const toolsNoCreds = (agent.outils_requis || []).filter((t) => TOOLS_NO_CREDENTIALS.has(t))

          return (
            <div key={agent.nom} className="px-4 py-3 flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${domain.color}18`, color: domain.color }}
              >
                <DomainGlyph domaine={agent.domaine} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-tanga-charcoal">{agent.nom}</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: domain.color }}>
                    {domain.label}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {toolsWithCreds.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-tanga-ochre/10 text-tanga-ochre font-medium">
                      <ToolGlyph tool={t} className="w-3 h-3" /> {TOOLS_SCHEMA[t]?.label}
                    </span>
                  ))}
                  {toolsNoCreds.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-tanga-sand/50 text-tanga-charcoal-light font-medium">
                      <Pencil className="w-3 h-3" /> Rédaction IA
                    </span>
                  ))}
                  {toolsWithCreds.length === 0 && toolsNoCreds.length === 0 && (
                    <span className="text-xs text-tanga-charcoal-light italic">Autonome (LLM uniquement)</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ToolsManager({ onClose }) {
  const { results, soumettreCreds, lancerAnalyse, profilPme } = useApp()
  const agents = results?.agents_crees || []

  const uniqueTools = useMemo(() => {
    const ordered = []
    const seen = new Set()
    for (const agent of agents) {
      for (const tool of agent.outils_requis || []) {
        if (TOOLS_SCHEMA[tool] && !TOOLS_NO_CREDENTIALS.has(tool) && !seen.has(tool)) {
          ordered.push(tool)
          seen.add(tool)
        }
      }
    }
    return ordered
  }, [agents])

  const toolAgentsMap = useMemo(() => {
    const map = {}
    for (const tool of uniqueTools) {
      map[tool] = agents.filter((a) => a.outils_requis?.includes(tool)).map((a) => a.nom)
    }
    return map
  }, [uniqueTools, agents])

  const [values, setValues] = useState(() => {
    const init = {}
    for (const toolName of uniqueTools) {
      init[toolName] = {}
      for (const fieldKey of Object.keys(TOOLS_SCHEMA[toolName]?.fields || {})) init[toolName][fieldKey] = ''
    }
    return init
  })

  const [savedTools, setSavedTools] = useState(new Set())
  const [isSaving, setIsSaving]     = useState(false)
  const [isRelaunch, setIsRelaunch] = useState(false)
  const [saveStep, setSaveStep]     = useState(null)
  const [error, setError]           = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const { filledCount, totalCount } = useMemo(() => {
    let filled = 0, total = 0
    for (const toolName of uniqueTools) {
      for (const fieldKey of Object.keys(TOOLS_SCHEMA[toolName]?.fields || {})) {
        total++
        if (values[toolName]?.[fieldKey]?.trim()) filled++
      }
    }
    return { filledCount: filled, totalCount: total }
  }, [values, uniqueTools])

  const hasAnyValue = filledCount > 0

  const handleChange = (toolName, fieldKey, val) => {
    setValues((prev) => ({ ...prev, [toolName]: { ...prev[toolName], [fieldKey]: val } }))
    setError(null)
    setSuccessMsg(null)
  }

  const saveFilledTools = async () => {
    const toSave = uniqueTools.filter((toolName) =>
      Object.keys(TOOLS_SCHEMA[toolName]?.fields || {}).some((k) => values[toolName]?.[k]?.trim())
    )
    if (toSave.length === 0) throw new Error('Renseignez au moins un champ pour pouvoir sauvegarder.')
    for (const toolName of toSave) {
      const schema = TOOLS_SCHEMA[toolName]
      setSaveStep(`Connexion de ${schema.label}…`)
      const creds = {}
      for (const fieldKey of Object.keys(schema.fields)) {
        const v = values[toolName]?.[fieldKey]?.trim()
        if (v) creds[fieldKey] = v
      }
      await soumettreCreds(toolName, creds)
      setSavedTools((prev) => new Set([...prev, toolName]))
    }
    setSaveStep(null)
    return toSave
  }

  const handleSaveOnly = async () => {
    if (!hasAnyValue) { setError('Renseignez au moins un champ.'); return }
    setIsSaving(true); setError(null)
    try {
      const saved = await saveFilledTools()
      setSuccessMsg(`${saved.length} connexion(s) sauvegardée(s). Cliquez "Sauvegarder et relancer" pour lancer les agents avec ces accès.`)
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAndRelaunch = async () => {
    if (!profilPme?.nom_entreprise) {
      setError('Profil introuvable. Lancez une nouvelle demande depuis l\'accueil.')
      return
    }
    if (!hasAnyValue) { setError('Renseignez au moins un champ avant de relancer.'); return }
    setIsRelaunch(true); setError(null)
    try {
      await saveFilledTools()
      setSaveStep('Lancement des agents avec les nouvelles connexions…')
      onClose()
      await lancerAnalyse(profilPme)
    } catch (err) {
      setError(err.message || 'Erreur lors du relancement.')
      setIsRelaunch(false)
      setSaveStep(null)
    }
  }

  const isLoading = isSaving || isRelaunch

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-tanga-charcoal/70 backdrop-blur-sm" onClick={!isLoading ? onClose : undefined} />

      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="bg-white border-b border-tanga-sand/40 flex-shrink-0">
          <div className="kente-stripe" />
          <div className="px-6 pt-4 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-tanga-ochre/10 text-tanga-ochre flex items-center justify-center flex-shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-tanga-charcoal text-lg leading-tight">Gérer les connexions</h2>
                  <p className="text-sm text-tanga-charcoal-light mt-0.5">
                    Renseignez les accès pour chaque outil utilisé par vos agents.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-tanga-charcoal-light hover:bg-tanga-sand/50 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {totalCount > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-tanga-charcoal-light">
                    {filledCount} / {totalCount} champs renseignés
                  </span>
                  {savedTools.size > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> {savedTools.size} outil(s) sauvegardé(s)
                    </span>
                  )}
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill transition-all duration-500"
                    style={{
                      width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%`,
                      backgroundColor: filledCount === totalCount && totalCount > 0 ? '#2D5A27' : '#C17A3B',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll bg-tanga-cream/50 px-6 py-5 space-y-4">

          {uniqueTools.length === 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7" />
              </div>
              <p className="font-semibold text-tanga-charcoal">Tous les agents sont autonomes</p>
              <p className="text-sm text-tanga-charcoal-light mt-1">
                Aucun outil externe ne nécessite de connexion pour cette session.
              </p>
            </div>
          )}

          {uniqueTools.length > 0 && (
            <div>
              <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider mb-3 px-1">
                Outils à connecter ({uniqueTools.length})
              </p>
              <div className="space-y-4">
                {uniqueTools.map((toolName) => (
                  <ToolCard
                    key={toolName}
                    toolName={toolName}
                    agentsUsing={toolAgentsMap[toolName] || []}
                    values={values[toolName] || {}}
                    onChange={(fieldKey, val) => handleChange(toolName, fieldKey, val)}
                    isSaved={savedTools.has(toolName)}
                  />
                ))}
              </div>
            </div>
          )}

          {agents.length > 0 && (
            <div>
              <p className="text-xs font-bold text-tanga-charcoal-light uppercase tracking-wider mb-3 px-1 mt-2">
                Vos agents
              </p>
              <AgentsSummary agents={agents} />
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-tanga-green/5 border border-tanga-green/20 rounded-xl text-xs text-tanga-charcoal-light">
            <span className="text-tanga-green flex-shrink-0 mt-0.5"><Lock className="w-3.5 h-3.5" /></span>
            <span>
              Vos identifiants sont sauvegardés localement pour cette session uniquement.
              Seuls les agents configurés peuvent accéder à ces services.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-tanga-sand/40 px-6 py-4 flex-shrink-0">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-start gap-2">
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{successMsg}</span>
            </div>
          )}
          {isLoading && saveStep && (
            <div className="mb-3 flex items-center gap-2 text-sm text-tanga-ochre font-medium">
              <span className="w-4 h-4 border-2 border-tanga-ochre/30 border-t-tanga-ochre rounded-full animate-spin flex-shrink-0" />
              {saveStep}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSaveOnly} disabled={isLoading || !hasAnyValue} className="btn-secondary flex-1 py-3 text-sm">
              {isSaving && !isRelaunch ? (
                <><span className="w-4 h-4 border-2 border-tanga-ochre/40 border-t-tanga-ochre rounded-full animate-spin" /><span>Sauvegarde…</span></>
              ) : (
                <><Save className="w-4 h-4" /><span>Sauvegarder</span></>
              )}
            </button>
            <button onClick={handleSaveAndRelaunch} disabled={isLoading || !hasAnyValue} className="btn-primary flex-1 py-3 text-sm">
              {isRelaunch ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Relancement…</span></>
              ) : (
                <><span>Sauvegarder et relancer</span><ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-tanga-charcoal-light mt-2">
            "Relancer" réexécute les agents avec vos nouvelles connexions.
          </p>
        </div>
      </div>
    </div>
  )
}
