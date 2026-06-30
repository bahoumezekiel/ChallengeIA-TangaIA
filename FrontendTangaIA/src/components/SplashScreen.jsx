import React, { useEffect, useState } from 'react'

/**
 * SplashScreen — écran de démarrage affiché au tout premier chargement du site.
 * Logo animé (flottement + anneaux kente) puis disparition en fondu.
 * Autonome : les keyframes sont incluses, aucun ajout dans index.css nécessaire.
 */
export default function SplashScreen({ onFinish }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 3000)        // démarre le fondu
    const t2 = setTimeout(() => onFinish && onFinish(), 3050)  // retire le splash
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onFinish])

  return (
    <div className={`tanga-splash${leaving ? ' is-leaving' : ''}`}>
      <style>{`
        .tanga-splash {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 38%, #FFFDF9 0%, #FAF6F0 55%, #F1E7D8 100%);
          transition: opacity .45s ease, visibility .45s ease;
        }
        .tanga-splash.is-leaving { opacity: 0; visibility: hidden; }
        .splash-logo-wrap { position: relative; width: 120px; height: 120px;
          display: flex; align-items: center; justify-content: center; }
        .splash-ring { position: absolute; inset: -8px; border-radius: 9999px; border: 2px solid; opacity: 0; }
        .splash-ring.r1 { border-color: #C17A3B; animation: splashRing 1.8s ease-out infinite; }
        .splash-ring.r2 { border-color: #2D5A27; animation: splashRing 1.8s ease-out .6s infinite; }
        .splash-logo-fallback {
          width: 84px; height: 84px; border-radius: 22px;
          background: linear-gradient(135deg, #C17A3B, #2D5A27);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800; font-size: 34px;
        }
        .splash-logo, .splash-logo-fallback { animation: splashFloat 2.2s ease-in-out infinite; }
        .splash-logo { width: 84px; height: 84px; object-fit: contain; }
        .splash-word { margin-top: 26px; font-size: 26px; font-weight: 800;
          letter-spacing: -.02em; color: #23201D; opacity: 0; animation: splashFade .8s ease forwards .25s; }
        .splash-word span { color: #C17A3B; }
        .splash-tag { margin-top: 6px; font-size: 13px; color: #8a7d6b;
          opacity: 0; animation: splashFade .8s ease forwards .5s; }
        .splash-bar { margin-top: 28px; width: 150px; height: 4px; border-radius: 9999px;
          background: #EADFCD; overflow: hidden; }
        .splash-bar i { display: block; height: 100%; width: 40%; border-radius: 9999px;
          background: linear-gradient(90deg, #C17A3B, #2D5A27); animation: splashBar 1.1s ease-in-out infinite; }
        @keyframes splashFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.04); } }
        @keyframes splashRing { 0% { transform: scale(.7); opacity: .55; } 100% { transform: scale(1.55); opacity: 0; } }
        @keyframes splashFade { to { opacity: 1; } }
        @keyframes splashBar { 0% { transform: translateX(-130%); } 100% { transform: translateX(340%); } }
      `}</style>

      <div className="splash-logo-wrap">
        <span className="splash-ring r1" />
        <span className="splash-ring r2" />
        <img
          src="/logo.png"
          alt="TangaAI"
          className="splash-logo"
          onError={(e) => {
            // Pas de logo.png : on bascule sur un monogramme animé
            e.currentTarget.outerHTML = '<div class="splash-logo-fallback">T</div>'
          }}
        />
      </div>

      <div className="splash-word">Tanga<span>AI</span></div>
      <div className="splash-tag">Votre copilote IA pour PME</div>
      <div className="splash-bar"><i /></div>
    </div>
  )
}
