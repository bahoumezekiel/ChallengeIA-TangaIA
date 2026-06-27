import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import {
  Megaphone, Briefcase, BarChart, Headset, Zap, Lock,
  ArrowRight, DomainGlyph, DOMAIN_META,
} from './icons.jsx'

function FeatureCard({ Icon, title, description, color }) {
  return (
    <div className="tanga-card p-6 flex flex-col gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-tanga-charcoal text-lg">{title}</h3>
      <p className="text-tanga-charcoal-light text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StepBadge({ number, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-tanga-ochre text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </div>
      <span className="text-tanga-charcoal font-medium">{label}</span>
    </div>
  )
}

export default function Landing() {
  const { setAppState } = useApp()

  const previewAgents = [
    { role: 'Marketing', domaine: 'marketing' },
    { role: 'Ventes', domaine: 'vente' },
    { role: 'Support', domaine: 'support' },
  ]

  return (
    <div className="min-h-screen bg-tanga-cream">
      <div className="kente-stripe" />

      {/* Navigation */}
      <nav className="sticky top-0 z-30 bg-tanga-cream/95 backdrop-blur-sm border-b border-tanga-sand/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12">
              <img src="/logo.png" alt="TangaAI" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl text-tanga-charcoal tracking-tight">
              Tanga<span className="text-tanga-ochre">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAppState('auth')} className="btn-ghost text-sm px-4 py-2.5">
              Connexion
            </button>
            <button onClick={() => setAppState('onboarding')} className="btn-primary text-sm px-5 py-2.5">
              Commencer gratuitement
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="kente-bg absolute inset-0 opacity-60" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-tanga-ochre/10 border border-tanga-ochre/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-tanga-green animate-pulse"></span>
            <span className="text-tanga-ochre text-sm font-medium">Intelligence artificielle pour l'Afrique</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-tanga-charcoal leading-tight mb-6">
            Votre équipe d'agents IA<br />
            <span className="text-tanga-ochre">taillée pour votre PME</span>
          </h1>

          <p className="text-lg sm:text-xl text-tanga-charcoal-light max-w-2xl mx-auto mb-10 leading-relaxed">
            TangaAI analyse votre profil et déploie une équipe d'agents spécialisés —
            marketing, ventes, finance, support — pour accélérer la croissance de votre entreprise africaine.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setAppState('onboarding')}
              className="btn-primary text-base px-8 py-4 w-full sm:w-auto shadow-lg shadow-tanga-ochre/20"
            >
              <span>Commencer</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a href="#comment-ca-marche" className="btn-ghost text-base px-8 py-4 w-full sm:w-auto">
              Comment ça marche ?
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { value: '5', label: 'Domaines couverts' },
              { value: '∞', label: 'Requêtes par session' },
              { value: '100%', label: 'Adapté Afrique' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-tanga-ochre">{stat.value}</div>
                <div className="text-xs sm:text-sm text-tanga-charcoal-light mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-tanga-charcoal mb-4">
              Une IA pensée pour les réalités africaines
            </h2>
            <p className="text-tanga-charcoal-light text-lg max-w-xl mx-auto">
              Des agents intelligents qui comprennent votre contexte, vos ressources et vos ambitions.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard Icon={Megaphone} title="Marketing & Visibilité" color="#C17A3B"
              description="Stratégies de contenu, gestion des réseaux sociaux et campagnes adaptées aux marchés locaux." />
            <FeatureCard Icon={Briefcase} title="Ventes & Croissance" color="#2D5A27"
              description="Prospection, suivi client et optimisation de votre pipeline commercial pour accélérer vos revenus." />
            <FeatureCard Icon={BarChart} title="Administration & Finance" color="#1E40AF"
              description="Gestion comptable simplifiée, reporting et conseils financiers adaptés aux PME africaines." />
            <FeatureCard Icon={Headset} title="Support Client" color="#7C3AED"
              description="Assistance pour vos clients, gestion des réclamations et amélioration continue de l'expérience." />
            <FeatureCard Icon={Zap} title="Déploiement Rapide" color="#E8521B"
              description="En quelques minutes, votre équipe d'agents est configurée et prête à travailler pour vous." />
            <FeatureCard Icon={Lock} title="Données Sécurisées" color="#6B7280"
              description="Vos informations restent confidentielles. Aucune donnée partagée sans votre accord explicite." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="comment-ca-marche" className="py-20 bg-tanga-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-tanga-charcoal mb-4">
                Simple, rapide,<br /><span className="text-tanga-ochre">efficace</span>
              </h2>
              <p className="text-tanga-charcoal-light text-lg mb-10">
                Trois étapes pour avoir votre équipe d'IA opérationnelle.
              </p>
              <div className="flex flex-col gap-6">
                <StepBadge number="1" label="Décrivez votre entreprise en répondant à quelques questions simples" />
                <div className="w-0.5 h-6 bg-tanga-sand ml-4" />
                <StepBadge number="2" label="TangaAI sélectionne et configure les meilleurs agents pour vos besoins" />
                <div className="w-0.5 h-6 bg-tanga-sand ml-4" />
                <StepBadge number="3" label="Consultez les résultats et livrables produits par votre équipe IA" />
              </div>
              <div className="mt-10">
                <button onClick={() => setAppState('onboarding')} className="btn-primary">
                  Lancer mon équipe IA
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Visual illustration */}
            <div className="relative">
              <div className="tanga-card p-6 max-w-sm mx-auto">
                <div className="kente-border-top" />
                <div className="flex items-center gap-3 mb-4 pt-2">
                  <div className="w-12 h-12">
                    <img src="/logo.png" alt="TangaAI" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="font-bold text-tanga-charcoal">Saveurs du Sahel</div>
                    <div className="text-xs text-tanga-charcoal-light">Restauration · 12 employés</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {previewAgents.map((agent) => {
                    const meta = DOMAIN_META[agent.domaine]
                    return (
                      <div
                        key={agent.role}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ backgroundColor: `${meta.color}0D` }}
                      >
                        <div className="flex items-center gap-2">
                          <span style={{ color: meta.color }}>
                            <DomainGlyph domaine={agent.domaine} className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-medium text-tanga-charcoal">Agent {agent.role}</span>
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                        >
                          Actif
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 p-3 bg-tanga-cream rounded-xl">
                  <div className="text-xs font-semibold text-tanga-charcoal-light mb-1">Synthèse</div>
                  <div className="text-sm text-tanga-charcoal leading-relaxed">
                    Équipe de 3 agents déployée avec succès. Stratégie marketing sur les réseaux sociaux en cours...
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-tanga-ochre/10 -z-10" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-tanga-green/10 -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-tanga-charcoal relative overflow-hidden">
        <div className="kente-bg absolute inset-0 opacity-20" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Prêt à booster votre PME ?</h2>
          <p className="text-tanga-sand text-lg mb-8">
            Rejoignez les entrepreneurs africains qui font confiance à TangaAI.
          </p>
          <button
            onClick={() => setAppState('onboarding')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-tanga-ochre text-white font-semibold rounded-xl text-lg
                       transition-all duration-200 hover:bg-tanga-ochre-light active:scale-95
                       focus:outline-none focus:ring-2 focus:ring-tanga-ochre focus:ring-offset-2 focus:ring-offset-tanga-charcoal"
          >
            Commencer maintenant — c'est gratuit
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-tanga-charcoal border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12">
              <img src="/logo.png" alt="TangaAI" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-bold">
              Tanga<span className="text-tanga-ochre">AI</span>
            </span>
          </div>
          <div className="text-tanga-sand text-sm">
            © 2026 TangaAI — Intelligence artificielle pour les PME africaines
          </div>
        </div>
      </footer>

      <div className="kente-stripe" />
    </div>
  )
}
