// Écran d'accueil : photo de la boutique, logo, trois promesses, et un gros bouton à faire glisser
// pour arriver sur la page de demande. Un simple appui sur le bouton fonctionne aussi.
import { useRef, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { Logo } from '../lib/reglages.jsx'

const POUCE = 60 // diamètre du bouton à faire glisser (px)

function Glisser({ texte, rtl, onFin }) {
  const piste = useRef(null)
  const depart = useRef(0)
  const bouge = useRef(false)
  const [x, setX] = useState(0)
  const [glisse, setGlisse] = useState(false)
  const sens = rtl ? -1 : 1
  const course = () => (piste.current ? piste.current.clientWidth - POUCE - 8 : 1)

  function pose(e) {
    depart.current = e.clientX
    bouge.current = false
    setGlisse(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function deplace(e) {
    if (!glisse) return
    const d = (e.clientX - depart.current) * sens
    if (Math.abs(d) > 4) bouge.current = true
    setX(Math.max(0, Math.min(course(), d)))
  }
  function lache() {
    if (!glisse) return
    setGlisse(false)
    if (x >= course() * 0.75) { setX(course()); onFin() } else setX(0)
  }

  const avance = Math.min(1, x / course())
  return (
    <div className="glisser" ref={piste} style={{ '--avance': avance }}>
      <span className="glisser-remplissage" style={{ width: x + POUCE + 4 }} aria-hidden />
      <span className="glisser-texte" style={{ opacity: 1 - avance * 1.4 }}>{texte}<span className="glisser-fleches" aria-hidden>›››</span></span>
      <button type="button" className="glisser-pouce" aria-label={texte}
        style={{ transform: `translateX(${x * sens}px)`, transition: glisse ? 'none' : undefined }}
        onPointerDown={pose} onPointerMove={deplace} onPointerUp={lache} onPointerCancel={lache}
        onClick={() => { if (!bouge.current) onFin() }}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  )
}

export default function Onboarding({ seuil, onFin }) {
  const { lang, setLang, t } = useLang()
  const [sortie, setSortie] = useState(false)
  function terminer() {
    setSortie(true)
    setTimeout(onFin, 450) // le temps que l'écran glisse hors de vue
  }
  const points = [t.obPickup, t.obWash, seuil != null && t.freeFrom(seuil)].filter(Boolean)
  return (
    <div className={'onboarding' + (sortie ? ' sortie' : '')} role="dialog" aria-label="BestClean">
      <div className="ob-haut">
        <button type="button" className="lang-btn ob-lang" onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}>{lang === 'ar' ? 'FR' : 'عربي'}</button>
      </div>
      <div className="ob-centre">
        <Logo className="ob-logo" />
        <p className="ob-bienvenue">{t.obWelcome}</p>
        <h1>BestClean</h1>
        <p className="ob-slogan">{t.slogan}</p>
        <ul className="ob-points">
          {points.map((p) => <li key={p}><span aria-hidden>✓</span>{p}</li>)}
        </ul>
      </div>
      <div className="ob-bas">
        <Glisser texte={t.obCta} rtl={lang === 'ar'} onFin={terminer} />
      </div>
    </div>
  )
}
