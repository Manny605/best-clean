import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api, isDemo, canPrint } from '../lib/api.js'
import { ETAPES, STATUTS, useLang } from '../lib/i18n.jsx'
import { TELEPHONES, WHATSAPP, lienTel } from '../lib/contact.js'
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
          <p className="foot-phones">{TELEPHONES.map((n) => <a key={n} href={lienTel(n)} dir="ltr">{n}</a>)}</p>
          <p className="foot-links"><Link to="/suivi">{t.track}</Link> · <Link to="/admin">Espace équipe</Link></p>
        </div>
      </footer>
    </div>
  )
}

// FAQ + contact, sous le formulaire de commande
function Infos({ seuil }) {
  const { t } = useLang()
  return (
    <section className="infos container">
      <div className="faq">
        <h2>{t.faqTitle}</h2>
        {t.faq(seuil).map(([q, r], i) => (
          <details key={q} open={i === 0}>
            <summary>{q}</summary>
            <p>{r}</p>
          </details>
        ))}
      </div>
      <aside className="contact-card">
        <h2>{t.contactTitle}</h2>
        <p>{t.contactText}</p>
        <div className="contact-actions">
          {TELEPHONES.map((n) => (
            <a key={n} className="contact-btn" href={lienTel(n)}>
              <svg viewBox="0 0 24 24" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
              <span><small>{t.call}</small><b dir="ltr">{n}</b></span>
            </a>
          ))}
          <a className="contact-btn wa" href={lienWhatsApp(t.waHello, WHATSAPP)} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
            <span><small>{t.whatsappUs}</small><b dir="ltr">{WHATSAPP}</b></span>
          </a>
        </div>
      </aside>
    </section>
  )
}

function Confirmation({ commande, onNew }) {
  const { lang, t } = useLang()
  const navigate = useNavigate()
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
          <a className="primary-btn wa" href={lienWhatsApp(texteRecu(commande, lang), WHATSAPP)} target="_blank" rel="noreferrer">{t.whatsapp}</a>
          <button className="ghost-btn" onClick={() => navigate('/suivi', { state: { numero: commande.numero, telephone: commande.telephone } })}>{t.track}</button>
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
  const seuil = seuils.length ? Math.min(...seuils) : null
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
            {seuil != null && <span className="chip">{t.freeFrom(seuil)}</span>}
            <span className="chip chip-sand">{t.delay}</span>
          </div>
        </div>
        <div className="rug-band" aria-hidden />
      </section>
      <main className="container" id="commande">
        {catalog ? (
          <OrderForm catalog={catalog} lang={lang} t={t} onSubmit={async (c, l) => { const o = await api.createOrder(c, l); setDone(o); window.scrollTo(0, 0) }} />
        ) : <div className="loading">…</div>}
      </main>
      {seuil != null && <Infos seuil={seuil} />}
    </PublicShell>
  )
}

export function Suivi() {
  const { lang, t } = useLang()
  const { state } = useLocation() // arrivée depuis la confirmation : numéro et téléphone déjà connus
  const [numero, setNumero] = useState(state?.numero || '')
  const [tel, setTel] = useState(state?.telephone || '')
  const [res, setRes] = useState(undefined)

  useEffect(() => { if (state?.numero && state?.telephone) api.trackOrder(state.numero, state.telephone).then(setRes) }, [state])

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
