import React, { useState } from 'react'
import { genererFeuilleDeRoute, poserQuestionCreation } from '../api/client.js'
import {
  ArrowRight, ArrowLeft, Check, AlertTriangle, Globe, Clock,
  FileText, MessageCircle, RefreshCw,
} from './icons.jsx'

/**
 * Assistant de création d'entreprise (module RAG).
 * Parcours : 1) profil  ->  2) feuille de route personnalisée + questions de suivi.
 * Props : onBack (revenir en arrière), onGoCopilote (pont vers le copilote TangaAI).
 */
export default function CreationEntreprise({ onBack, onGoCopilote }) {
  const [profil, setProfil] = useState({
    type_entreprise: 'personnelle',
    activite: '',
    ville: '',
    nb_associes: '',
    details: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultat, setResultat] = useState(null) // { feuille_de_route, sources, avertissement }

  const majProfil = (champ, valeur) => setProfil((p) => ({ ...p, [champ]: valeur }))

  const lancer = async () => {
    setLoading(true); setError(null)
    try {
      const payload = {
        ...profil,
        nb_associes: profil.nb_associes ? Number(profil.nb_associes) : null,
        activite: profil.activite || null,
        ville: profil.ville || null,
        details: profil.details || null,
      }
      const res = await genererFeuilleDeRoute(payload)
      setResultat(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-tanga-cream">
      <div className="kente-stripe" />

      {/* En-tête */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-tanga-sand/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="btn-ghost p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-bold text-tanga-charcoal">Créer mon entreprise</h1>
            <p className="text-xs text-tanga-charcoal-light">Démarches officielles au Burkina Faso (OHADA / CEFORE)</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {!resultat && (
          <ProfilForm
            profil={profil}
            majProfil={majProfil}
            onSubmit={lancer}
            loading={loading}
            error={error}
          />
        )}

        {resultat && (
          <FeuilleDeRoute
            data={resultat}
            typeEntreprise={profil.type_entreprise}
            onRestart={() => { setResultat(null); setError(null) }}
            onGoCopilote={onGoCopilote}
          />
        )}
      </main>
    </div>
  )
}

/* ── Étape 1 : formulaire de profil ── */

function ProfilForm({ profil, majProfil, onSubmit, loading, error }) {
  return (
    <div className="tanga-card p-6 sm:p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-tanga-charcoal mb-1">Parlez-nous de votre projet</h2>
      <p className="text-sm text-tanga-charcoal-light mb-6">
        Quelques informations pour générer votre feuille de route personnalisée.
      </p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-tanga-charcoal mb-2">
            Type d'entreprise
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TypeChoice
              active={profil.type_entreprise === 'personnelle'}
              onClick={() => majProfil('type_entreprise', 'personnelle')}
              titre="Entreprise personnelle"
              sous="Entreprise individuelle (un seul promoteur)"
            />
            <TypeChoice
              active={profil.type_entreprise === 'societaire'}
              onClick={() => majProfil('type_entreprise', 'societaire')}
              titre="Entreprise sociétaire"
              sous="SARL, SA... (avec associés)"
            />
          </div>
        </div>

        <Field label="Activité (facultatif)">
          <input
            type="text"
            value={profil.activite}
            onChange={(e) => majProfil('activite', e.target.value)}
            placeholder="Ex : vente de vêtements, restauration..."
            className="tanga-input"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ville (facultatif)">
            <input
              type="text"
              value={profil.ville}
              onChange={(e) => majProfil('ville', e.target.value)}
              placeholder="Ex : Ouagadougou"
              className="tanga-input"
            />
          </Field>
          {profil.type_entreprise === 'societaire' && (
            <Field label="Nombre d'associés (facultatif)">
              <input
                type="number"
                min="1"
                value={profil.nb_associes}
                onChange={(e) => majProfil('nb_associes', e.target.value)}
                placeholder="Ex : 2"
                className="tanga-input"
              />
            </Field>
          )}
        </div>

        <Field label="Précisions (facultatif)">
          <textarea
            value={profil.details}
            onChange={(e) => majProfil('details', e.target.value)}
            placeholder="Toute information utile sur votre projet..."
            rows={3}
            className="tanga-input resize-none"
          />
        </Field>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={loading}
          className="btn-primary w-full py-3.5 disabled:opacity-60"
        >
          {loading ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /> Génération en cours...</>
          ) : (
            <>Générer ma feuille de route <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  )
}

function TypeChoice({ active, onClick, titre, sous }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        active
          ? 'border-tanga-ochre bg-tanga-ochre/5'
          : 'border-tanga-sand/60 hover:border-tanga-ochre/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-tanga-charcoal">{titre}</span>
        {active && <Check className="w-4 h-4 text-tanga-ochre" />}
      </div>
      <p className="text-xs text-tanga-charcoal-light mt-1">{sous}</p>
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-tanga-charcoal mb-2">{label}</label>
      {children}
    </div>
  )
}

/* ── Étape 2 : feuille de route ── */

function FeuilleDeRoute({ data, typeEntreprise, onRestart, onGoCopilote }) {
  const fdr = data.feuille_de_route || {}
  const etapes = fdr.etapes || []

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Bandeau récap */}
      <div className="tanga-card p-6">
        <div className="kente-border-top" />
        <h2 className="text-xl font-bold text-tanga-charcoal mt-2">{fdr.titre || 'Votre feuille de route'}</h2>
        {fdr.resume && <p className="text-tanga-charcoal-light mt-1">{fdr.resume}</p>}
        <div className="flex flex-wrap gap-3 mt-4">
          {fdr.cout_total_estime && (
            <Badge icon={FileText} label={`Coût estimé : ${fdr.cout_total_estime}`} />
          )}
          {fdr.delai_total_estime && (
            <Badge icon={Clock} label={`Délai estimé : ${fdr.delai_total_estime}`} />
          )}
          <Badge icon={Check} label={`${etapes.length} étape(s)`} />
        </div>
      </div>

      {/* Étapes */}
      <div className="space-y-4">
        {etapes.map((e, i) => (
          <EtapeCard key={i} etape={e} dernier={i === etapes.length - 1} />
        ))}
      </div>

      {/* Documents délivrés */}
      {fdr.documents_delivres?.length > 0 && (
        <div className="tanga-card p-5">
          <h3 className="font-bold text-tanga-charcoal mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-tanga-green" /> Documents obtenus à la fin
          </h3>
          <div className="flex flex-wrap gap-2">
            {fdr.documents_delivres.map((d, i) => (
              <span key={i} className="text-sm px-3 py-1.5 bg-tanga-green/10 text-tanga-green rounded-lg font-medium">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conseils */}
      {fdr.conseils?.length > 0 && (
        <div className="tanga-card p-5">
          <h3 className="font-bold text-tanga-charcoal mb-3">Conseils</h3>
          <ul className="space-y-2">
            {fdr.conseils.map((c, i) => (
              <li key={i} className="text-sm text-tanga-charcoal flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tanga-ochre mt-1.5 flex-shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Avertissement + sources */}
      <div className="px-4 py-3 bg-amber-50/60 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{data.avertissement}</span>
      </div>
      {data.sources?.length > 0 && (
        <p className="text-xs text-tanga-charcoal-light">
          Sources : {data.sources.map((s) => s.source).join(', ')}
        </p>
      )}

      {/* Questions de suivi */}
      <QuestionsSuivi typeEntreprise={typeEntreprise} />

      {/* Pont vers le copilote + recommencer */}
      <div className="tanga-card p-6 bg-tanga-charcoal text-center">
        <h3 className="text-lg font-bold text-white mb-1">Votre entreprise est prête ?</h3>
        <p className="text-tanga-sand text-sm mb-4">
          Laissez TangaAI composer votre équipe d'agents IA pour la faire grandir.
        </p>
        {onGoCopilote && (
          <button onClick={onGoCopilote} className="btn-primary">
            Composer mon équipe IA <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <button onClick={onRestart} className="btn-ghost w-full py-3">
        <RefreshCw className="w-4 h-4" /> Recommencer avec un autre profil
      </button>
    </div>
  )
}

function EtapeCard({ etape, dernier }) {
  return (
    <div className="relative pl-12">
      {/* Puce numérotée + ligne verticale */}
      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-tanga-ochre text-white font-bold flex items-center justify-center">
        {etape.numero}
      </div>
      {!dernier && <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-tanga-sand -mb-4" />}

      <div className="tanga-card p-5">
        <h3 className="font-bold text-tanga-charcoal">{etape.titre}</h3>
        {etape.description && (
          <p className="text-sm text-tanga-charcoal-light mt-1">{etape.description}</p>
        )}

        {etape.documents?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-tanga-charcoal-light uppercase tracking-wide mb-1.5">Documents</p>
            <ul className="space-y-1">
              {etape.documents.map((d, i) => (
                <li key={i} className="text-sm text-tanga-charcoal flex items-start gap-2">
                  <FileText className="w-3.5 h-3.5 text-tanga-ochre mt-0.5 flex-shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-3">
          {etape.ou && <MiniInfo icon={Globe} label={etape.ou} />}
          {etape.cout && <MiniInfo icon={FileText} label={etape.cout} />}
          {etape.delai && <MiniInfo icon={Clock} label={etape.delai} />}
        </div>
      </div>
    </div>
  )
}

function Badge({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-tanga-cream rounded-lg text-tanga-charcoal font-medium">
      <Icon className="w-4 h-4 text-tanga-ochre" /> {label}
    </span>
  )
}

function MiniInfo({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-tanga-charcoal-light">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  )
}

/* ── Questions de suivi (Q&R RAG) ── */

function QuestionsSuivi({ typeEntreprise }) {
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState(null)
  const [loading, setLoading] = useState(false)

  const envoyer = async () => {
    if (!question.trim()) return
    setLoading(true); setReponse(null)
    try {
      const res = await poserQuestionCreation(question.trim(), typeEntreprise)
      setReponse(res)
    } catch (e) {
      setReponse({ reponse: e.message, sources: [], avertissement: '' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tanga-card p-5">
      <h3 className="font-bold text-tanga-charcoal mb-3 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-tanga-ochre" /> Une question sur ces démarches ?
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && envoyer()}
          placeholder="Ex : combien coûte le casier judiciaire ?"
          className="tanga-input flex-1"
        />
        <button onClick={envoyer} disabled={loading} className="btn-primary px-4 disabled:opacity-60">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>

      {reponse && (
        <div className="mt-4 p-4 bg-tanga-cream rounded-xl">
          <p className="text-sm text-tanga-charcoal whitespace-pre-line leading-relaxed">{reponse.reponse}</p>
          {reponse.sources?.length > 0 && (
            <p className="text-xs text-tanga-charcoal-light mt-2">
              Sources : {reponse.sources.map((s) => s.source).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
