import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { api, isDemo } from '../lib/api.js'
import { ETAPES, STATUTS, useLang } from '../lib/i18n.jsx'
import { TELEPHONES, WHATSAPP, lienTel } from '../lib/contact.js'
import DemandeCollecte, { IconeWhatsApp } from '../components/DemandeCollecte.jsx'
import Feuille from '../components/Feuille.jsx'
import Onboarding from '../components/Onboarding.jsx'
import { Logo } from '../lib/reglages.jsx'
import Recu, { dateFr, lienWhatsApp } from '../components/Recu.jsx'

// Une base qui ne répond pas ne doit jamais laisser l'écran vide : on abandonne après 12 s
const avecDelai = (promesse, ms = 12000) => Promise.race([promesse, new Promise((_, ko) => setTimeout(() => ko(new Error('délai dépassé')), ms))])

function Chargement() {
  const { t } = useLang()
  return <div className="ecran-centre"><div className="chargement"><span className="spinner" aria-hidden />{t.loading}</div></div>
}

function Indisponible({ onRetry }) {
  const { t } = useLang()
  return (
    <div className="ecran-centre">
      <div className="indispo">
        <div className="indispo-icone" aria-hidden>!</div>
        <h1>{t.offlineTitle}</h1>
        <p className="muted">{t.offlineText}</p>
        <div className="btn-row">
          <button type="button" className="primary-btn" onClick={onRetry}>{t.retry}</button>
          <a className="primary-btn wa" href={lienWhatsApp(t.waOrder, WHATSAPP)} target="_blank" rel="noreferrer">{t.orderWa}</a>
          <a className="ghost-btn" href={lienTel(TELEPHONES[0])}>{t.call} <bdi>{TELEPHONES[0]}</bdi></a>
        </div>
      </div>
    </div>
  )
}

// Aide : délais, livraison, règle du m², contacts — dans un panneau, pour ne rien faire défiler
function Aide({ catalog }) {
  const { t } = useLang()
  const zones = catalog?.zones.filter((z) => z.actif) || []
  const ref = zones.reduce((m, z) => (!m || z.seuil_gratuit < m.seuil_gratuit ? z : m), null)
  return (
    <>
      <ul className="aide-liste">
        <li><span className="rq-ico" aria-hidden>⏱</span>{t.durationShort}</li>
        {ref && <li><span className="rq-ico" aria-hidden>🚚</span>{t.deliveryShort(ref.seuil_gratuit, ref.frais_livraison)}</li>}
        <li><span className="rq-ico" aria-hidden>📏</span>{t.m2Rule}</li>
        <li><span className="rq-ico" aria-hidden>📞</span>{t.callRule}</li>
        <li><span className="rq-ico" aria-hidden>🔎</span>{t.trackRule}</li>
      </ul>
      <div className="contacts-mini">
        {TELEPHONES.map((n) => <a key={n} href={lienTel(n)}><span aria-hidden>📞</span><bdi>{n}</bdi></a>)}
        <a href={lienWhatsApp(t.waHello, WHATSAPP)} target="_blank" rel="noreferrer"><IconeWhatsApp /><bdi>{WHATSAPP}</bdi></a>
      </div>
      <p className="muted small aide-pied">{t.footer} · <Link to="/admin">Espace équipe</Link></p>
    </>
  )
}

// Cadre commun : en-tête compact (logo + phrase de présentation), puis le contenu.
// « ecran » : la page occupe exactement la hauteur de l'écran (pas de défilement).
export function EcranShell({ children, ecran = false, catalog = null }) {
  const { lang, setLang, t } = useLang()
  const [aide, setAide] = useState(false)
  return (
    <div className={'app' + (ecran ? ' app-ecran' : '')}>
      <header className="app-top">
        <Link to="/" className="brand-bloc">
          <span className="brand-mark"><Logo /><span className="brand-txt">BestClean</span>{isDemo && <span className="demo-badge">{t.demo}</span>}</span>
          <span className="brand-slogan">{t.slogan}</span>
        </Link>
        <nav>
          <NavLink to="/" end className="nav-commander">{t.order}</NavLink>
          <NavLink to="/suivi"><span className="lg">{t.track}</span><span className="sm">{t.trackShort}</span></NavLink>
          <button type="button" className="lang-btn" onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}>{lang === 'ar' ? 'FR' : 'عربي'}</button>
          <button type="button" className="help-btn" onClick={() => setAide(true)} aria-label={t.help} title={t.help}>?</button>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      {aide && <Feuille titre={t.help} onClose={() => setAide(false)}><Aide catalog={catalog} /></Feuille>}
    </div>
  )
}

// L'écran d'accueil s'affiche une fois par visite (pas au retour depuis « Suivi »)
const ACCUEIL_VU = 'bc-accueil-vu'
const accueilDejaVu = () => { try { return sessionStorage.getItem(ACCUEIL_VU) === '1' } catch { return false } }

export function Commander() {
  const { lang, t } = useLang()
  const [catalog, setCatalog] = useState(null)
  const [accueil, setAccueil] = useState(() => !accueilDejaVu())
  const finAccueil = useCallback(() => { setAccueil(false); try { sessionStorage.setItem(ACCUEIL_VU, '1') } catch { /* stockage indisponible */ } }, [])
  const [indispo, setIndispo] = useState(false)
  const charger = useCallback(() => {
    setIndispo(false)
    avecDelai(api.getCatalog()).then(setCatalog).catch(() => setIndispo(true))
  }, [])
  useEffect(() => { charger() }, [charger])

  // Le catalogue se charge pendant que le client regarde l'écran d'accueil
  const seuils = catalog?.zones.filter((z) => z.actif).map((z) => z.seuil_gratuit) || []
  return (
    <EcranShell ecran catalog={catalog}>
      {!catalog ? (indispo ? <Indisponible onRetry={charger} /> : <Chargement />)
        : <DemandeCollecte catalog={catalog} lang={lang} t={t} onSubmit={(c, l) => api.createOrder(c, l)} />}
      {accueil && <Onboarding seuil={seuils.length ? Math.min(...seuils) : null} onFin={finAccueil} />}
    </EcranShell>
  )
}

export function Suivi() {
  const { lang, t } = useLang()
  const { state } = useLocation() // arrivée depuis la confirmation : numéro et téléphone déjà connus
  const [numero, setNumero] = useState(state?.numero || '')
  const [tel, setTel] = useState(state?.telephone || '')
  const [res, setRes] = useState(undefined)
  const [recu, setRecu] = useState(false)
  const [indispo, setIndispo] = useState(false)
  const suivre = useCallback((n, tl) => { setIndispo(false); avecDelai(api.trackOrder(n, tl)).then(setRes).catch(() => setIndispo(true)) }, [])
  useEffect(() => { if (state?.numero && state?.telephone) suivre(state.numero, state.telephone) }, [state, suivre])

  function chercher(e) {
    e.preventDefault()
    suivre(numero, tel)
  }
  const idx = res ? ETAPES.indexOf(res.statut) : -1

  return (
    <EcranShell>
      <div className="suivi-ecran">
        <h1 className="page-title">{t.trackTitle}</h1>
        <form className="panel track-form" onSubmit={chercher}>
          <label className="field"><span>{t.orderNumber}</span><input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="BC-00012" dir="ltr" autoCapitalize="characters" /></label>
          <label className="field"><span>{t.phone}</span><input value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" dir="ltr" /></label>
          <button className="primary-btn">{t.search}</button>
        </form>
        {indispo && <p className="error">{t.offlineTitle}. {t.retry} ?</p>}
        {res === null && <p className="error">{t.notFound}</p>}
        {res && (
          <div className="panel suivi-res">
            <div className="suivi-head">
              <b className="mono">{res.numero}</b>
              {res.total > 0 && <span className="mono">{mru0(res.total)}</span>}
            </div>
            <ol className={'timeline' + (res.statut === 'annulee' ? ' cancelled' : '')}>
              {ETAPES.map((s, i) => (
                <li key={s} className={i < idx ? 'past' : i === idx ? 'now' : ''}>
                  <span className="node" />
                  <span>{STATUTS[s][lang]}{s === 'planifiee' && res.date_collecte ? ` · ${dateFr(res.date_collecte)}` : ''}</span>
                </li>
              ))}
            </ol>
            {res.statut === 'annulee' && <p className="error">{STATUTS.annulee[lang]}</p>}
            <button type="button" className="ghost-btn" onClick={() => setRecu(true)}>{t.seeReceipt}</button>
          </div>
        )}
      </div>
      {recu && res && <Feuille titre={t.receipt} onClose={() => setRecu(false)}><Recu commande={res} lang={lang} /></Feuille>}
    </EcranShell>
  )
}

const mru0 = (n) => `${Number(n || 0).toLocaleString('fr-FR')} MRU`
