import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api, isDemo, canPrint } from '../lib/api.js'
import { ETAPES, STATUTS, useLang } from '../lib/i18n.jsx'
import OrderForm from '../components/OrderForm.jsx'
import Recu, { dateFr, lienWhatsApp, texteRecu } from '../components/Recu.jsx'

export function PublicShell({ children }) {
  const { lang, setLang, t } = useLang()
  return (
    <div className="public">
      <header className="site-head">
        <div className="topbar">
          <Link to="/" className="brand-mark"><span className="dot" />BestClean{isDemo && <span className="demo-badge">{t.demo}</span>}</Link>
          <nav>
            <NavLink to="/" end>{t.order}</NavLink>
            <NavLink to="/suivi">{t.track}</NavLink>
            <button className="lang-btn" onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}>{lang === 'ar' ? 'FR' : 'عربي'}</button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="foot">
        <div className="rug-band" aria-hidden />
        <div className="foot-inner">
          <div className="brand-mark small"><span className="dot" />BestClean</div>
          <p>{t.tagline}</p>
          <p className="foot-links"><Link to="/suivi">{t.track}</Link> · <Link to="/admin">Espace équipe</Link></p>
        </div>
      </footer>
    </div>
  )
}

function Confirmation({ commande, onNew }) {
  const { lang, t } = useLang()
  return (
    <div className="confirm-wrap">
      <div className="confirm-card no-print">
        <div className="check" aria-hidden>✓</div>
        <h1>{t.thanks}</h1>
        <div className="ticket">
          <span className="muted small">{t.orderNumber}</span>
          <div className="big-num">{commande.numero}</div>
          <span className="muted small">{t.keepNumber}</span>
        </div>
        <p>{t.thanksText(commande.bus?.nom || '')}</p>
        <div className="btn-row">
          <a className="primary-btn wa" href={lienWhatsApp(texteRecu(commande, lang))} target="_blank" rel="noreferrer">{t.whatsapp}</a>
          {canPrint && <button className="ghost-btn" onClick={() => window.print()}>{t.print}</button>}
          <button className="ghost-btn" onClick={onNew}>{t.newOrder}</button>
        </div>
      </div>
      <div className="print-area"><Recu commande={commande} lang={lang} /></div>
    </div>
  )
}

export function Commander() {
  const { lang, t } = useLang()
  const [catalog, setCatalog] = useState(null)
  const [done, setDone] = useState(null)
  useEffect(() => { api.getCatalog().then(setCatalog) }, [])

  if (done) return <PublicShell><main className="container"><Confirmation commande={done} onNew={() => { setDone(null); window.scrollTo(0, 0) }} /></main></PublicShell>

  const seuils = catalog?.zones.filter((z) => z.actif).map((z) => z.seuil_gratuit) || []
  return (
    <PublicShell>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">{t.tagline}</p>
          <h1>{t.heroTitle}</h1>
          <p className="hero-text">{t.heroText}</p>
          <ol className="how">
            {t.how.map(([titre, texte], i) => (
              <li key={titre} style={{ '--i': i }}><b>{titre}</b><span>{texte}</span></li>
            ))}
          </ol>
          <div className="hero-actions">
            <button type="button" className="primary-btn sand" onClick={() => document.getElementById('commande')?.scrollIntoView({ behavior: 'smooth' })}>{t.start}</button>
            {seuils.length > 0 && <span className="chip">{t.freeFrom(Math.min(...seuils))}</span>}
          </div>
        </div>
        <div className="rug-band" aria-hidden />
      </section>
      <main className="container" id="commande">
        {catalog ? (
          <OrderForm catalog={catalog} lang={lang} t={t} onSubmit={async (c, l) => { const o = await api.createOrder(c, l); setDone(o); window.scrollTo(0, 0) }} />
        ) : <div className="loading">…</div>}
      </main>
    </PublicShell>
  )
}

export function Suivi() {
  const { lang, t } = useLang()
  const [numero, setNumero] = useState('')
  const [tel, setTel] = useState('')
  const [res, setRes] = useState(undefined)

  async function chercher(e) {
    e.preventDefault()
    setRes(await api.trackOrder(numero, tel))
  }
  const idx = res ? ETAPES.indexOf(res.statut) : -1

  return (
    <PublicShell>
      <main className="container narrow">
        <h1 className="page-title">{t.trackTitle}</h1>
        <form className="panel track-form" onSubmit={chercher}>
          <label className="field"><span>{t.orderNumber}</span><input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="BC-00012" dir="ltr" autoCapitalize="characters" /></label>
          <label className="field"><span>{t.phone}</span><input value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" dir="ltr" /></label>
          <button className="primary-btn">{t.search}</button>
        </form>
        {res === null && <p className="error">{t.notFound}</p>}
        {res && (
          <>
            <ol className={'timeline panel' + (res.statut === 'annulee' ? ' cancelled' : '')}>
              {ETAPES.map((s, i) => (
                <li key={s} className={i < idx ? 'past' : i === idx ? 'now' : ''}>
                  <span className="node" />
                  <span>{STATUTS[s][lang]}{s === 'planifiee' && res.date_collecte ? ` · ${dateFr(res.date_collecte)}` : ''}</span>
                </li>
              ))}
            </ol>
            {res.statut === 'annulee' && <p className="error">{STATUTS.annulee[lang]}</p>}
            <Recu commande={res} lang={lang} />
          </>
        )}
      </main>
    </PublicShell>
  )
}
