// Commande sur un seul écran : articles (quantités), coordonnées, puis envoi sur WhatsApp.
// La commande est aussi enregistrée dans la base : l'équipe la voit même si le client n'envoie pas le message.
// Les articles au m² sont comptés en pièces : l'équipe les mesure à la collecte (onglet Modifier).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mru, prixUnitaire } from '../lib/pricing.js'
import { nomArticle } from '../lib/i18n.jsx'
import { lienCarte, lienWhatsApp } from './Recu.jsx'
import { telephoneValide } from './OrderForm.jsx'
import { IconeArticle } from './Icones.jsx'
import Feuille from './Feuille.jsx'
import { WHATSAPP } from '../lib/contact.js'

const VIDE = { nom: '', telephone: '', zone_id: '', adresse: '', latitude: null, longitude: null }

// Petites icônes au trait affichées dans les champs
const TRACES = {
  nom: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  tel: <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.2 1z" />,
  quartier: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  adresse: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
}
const Ico = ({ n }) => <svg className="inp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{TRACES[n]}</svg>

export const IconeWhatsApp = () => (
  <svg className="ico-wa" viewBox="0 0 24 24" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>
)

function Stepper({ value, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={!value} aria-label="−">−</button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="+">+</button>
    </div>
  )
}

// Message que le client envoie à BestClean depuis WhatsApp
const montant = (n) => `${Number(n || 0).toLocaleString('fr-FR')} MRU` // sans caractères invisibles (WhatsApp)

function messageCommande(o, c, zone, choix, estimation, lang, t) {
  const ar = lang === 'ar'
  const ligne = (fr, arabe, valeur) => (valeur ? `${ar ? arabe : fr} : ${valeur}` : null)
  return [
    ar ? 'السلام عليكم BestClean، أريد استلام أغراض للغسيل.' : 'Bonjour BestClean, je souhaite une collecte pour lavage.',
    '',
    ligne('N° de commande', 'رقم الطلب', o.numero),
    ligne('Nom', 'الاسم', c.nom.trim()),
    ligne('Téléphone', 'الهاتف', c.telephone.trim()),
    ligne('Quartier', 'الحي', ar ? zone.nom_ar : zone.nom_fr),
    ligne('Adresse', 'العنوان', c.adresse.trim()),
    ligne('Position', 'الموقع', lienCarte(c)),
    '',
    ar ? 'الأغراض :' : 'Articles :',
    ...choix.map((x) => `• ${x.nom}${x.taille ? ` (${x.taille})` : ''} ×${x.quantite}${x.m2 ? ` — ${t.toMeasure}` : ''}`),
    estimation > 0 ? `${ar ? 'المجموع التقديري' : 'Total estimé'} : ${montant(estimation)}${choix.some((x) => x.m2) ? ` + ${t.m2Pending}` : ''}` : null,
  ].filter((x) => x !== null).join('\n')
}

function DerniereEtape({ envoi, t, onFait }) {
  return (
    <div className="ecran-centre">
      <div className="panel etape-wa" role="status">
        <span className="etape-badge">{t.lastStep}</span>
        <h1>{t.pressSendTitle}</h1>
        <div className="wa-apercu" aria-hidden>
          <span className="wa-bulle">{envoi.apercu}</span>
          <span className="wa-envoyer">➤</span>
        </div>
        <p>{t.pressSend}</p>
        <a className="primary-btn wa wa-send" href={envoi.url} target="_blank" rel="noreferrer"><span className="wa-rond"><IconeWhatsApp /></span>{t.openWa}</a>
        <button type="button" className="ghost-btn" onClick={onFait}>✓ {t.sentDone}</button>
        <p className="muted small">{t.requestNumber} : <b className="mono" dir="ltr">{envoi.commande.numero}</b></p>
      </div>
    </div>
  )
}

function Merci({ envoi, t, onNouvelle }) {
  const navigate = useNavigate()
  const o = envoi.commande
  return (
    <div className="ecran-centre">
      <div className="panel merci">
        <div className="check" aria-hidden>✓</div>
        <h1>{t.requestSent}</h1>
        <div className="ticket">
          <span className="muted small">{t.requestNumber}</span>
          <div className="big-num">{o.numero}</div>
          <span className="muted small">{t.keepNumber}</span>
        </div>
        <p>{t.thanksFinal}</p>
        <div className="btn-row">
          <button type="button" className="ghost-btn" onClick={() => navigate('/suivi', { state: { numero: o.numero, telephone: o.telephone } })}>{t.track}</button>
          <button type="button" className="ghost-btn" onClick={onNouvelle}>{t.newRequest}</button>
        </div>
      </div>
    </div>
  )
}

export default function DemandeCollecte({ catalog, lang, t, onSubmit }) {
  const articles = catalog.articles.filter((a) => a.actif)
  const zones = catalog.zones.filter((z) => z.actif)
  const byId = useMemo(() => Object.fromEntries(catalog.articles.map((a) => [a.id, a])), [catalog])
  const [qty, setQty] = useState({}) // { [articleId]: { grand, petit } } — pour les articles au m² : grand = nombre de pièces
  const [ouvert, setOuvert] = useState(null)
  const [c, setC] = useState(VIDE)
  const [geo, setGeo] = useState('')
  const [errs, setErrs] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [envoi, setEnvoi] = useState(null) // { commande, url, apercu, fait }

  const setQ = (id, taille, n) => setQty((q) => ({ ...q, [id]: { ...q[id], [taille]: n } }))
  const nb = (a) => (qty[a.id]?.grand || 0) + (qty[a.id]?.petit || 0)
  const champ = (nom, valeur) => { setC((x) => ({ ...x, [nom]: valeur })); if (errs[nom]) setErrs((e) => ({ ...e, [nom]: null })); setError('') }

  function localiser() {
    if (!navigator.geolocation) return setGeo('error')
    setGeo('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setC((x) => ({ ...x, latitude: +coords.latitude.toFixed(6), longitude: +coords.longitude.toFixed(6) })); setErrs((e) => ({ ...e, lieu: null })); setGeo('') },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  // Ce que le client a choisi : une entrée par article et par taille
  const choix = articles.flatMap((a) => ['grand', 'petit'].filter((tl) => (qty[a.id]?.[tl] || 0) > 0).map((tl) => ({
    a, m2: a.mode === 'm2', quantite: qty[a.id][tl], nom: nomArticle(a, lang),
    tailleCode: a.mode === 'fixe' && a.prix_petit != null ? tl : null,
    taille: a.mode === 'fixe' && a.prix_petit != null ? (tl === 'petit' ? t.small : t.big) : null,
  })))
  const nbArticles = choix.reduce((s, x) => s + x.quantite, 0)
  const lignesFixes = choix.filter((x) => !x.m2).map((x) => ({ article_id: x.a.id, taille: x.tailleCode, quantite: x.quantite }))
  const sousTotal = lignesFixes.reduce((s, l) => s + prixUnitaire(byId[l.article_id], l) * l.quantite, 0)
  const avecM2 = choix.some((x) => x.m2)
  const zone = zones.find((z) => z.id === c.zone_id)
  const ref = zone || zones.reduce((m, z) => (!m || z.seuil_gratuit < m.seuil_gratuit ? z : m), null)
  const frais = ref && sousTotal > 0 && sousTotal < ref.seuil_gratuit && !avecM2 ? ref.frais_livraison : 0

  async function envoyer(e) {
    e.preventDefault()
    setError('')
    if (!nbArticles) return setError(t.empty)
    const ee = {
      nom: !c.nom.trim() && t.errName,
      telephone: !telephoneValide(c.telephone) && t.errPhone,
      zone_id: !c.zone_id && t.errZone,
      lieu: c.latitude == null && !c.adresse.trim() && t.missingPlace,
    }
    setErrs(ee)
    const premiere = Object.values(ee).find(Boolean)
    if (premiere) return setError(premiere)
    setBusy(true)
    try {
      const aMesurer = choix.filter((x) => x.m2).map((x) => `${x.a.nom_fr} ×${x.quantite}`)
      const note = aMesurer.length ? `À mesurer à la collecte : ${aMesurer.join(', ')}` : ''
      const commande = await onSubmit({ ...c, note, source: 'web' }, lignesFixes)
      const message = messageCommande(commande, c, zone, choix, sousTotal + frais, lang, t)
      const url = lienWhatsApp(message, WHATSAPP)
      setEnvoi({ commande, url, apercu: message.split('\n')[0], fait: false })
      window.open(url, '_blank', 'noopener') // si le navigateur bloque l'ouverture, le bouton de l'écran suivant prend le relais
    } catch (err) {
      const m = err.message || ''
      setError(m.includes('Trop de commandes') ? t.errTooMany : m.includes('saturé') ? t.errBusy : m.includes('téléphone invalide') ? t.errPhone : m)
    } finally { setBusy(false) }
  }

  if (envoi && !envoi.fait) return <DerniereEtape envoi={envoi} t={t} onFait={() => setEnvoi({ ...envoi, fait: true })} />
  if (envoi) return <Merci envoi={envoi} t={t} onNouvelle={() => { setEnvoi(null); setC(VIDE); setQty({}) }} />

  const art = ouvert && byId[ouvert]
  const prixTuile = (a) => (a.mode === 'm2' ? `${a.prix_m2}/m²` : a.prix_petit != null ? `${a.prix_petit}–${a.prix_grand}` : `${a.prix_grand}`)
  return (
    <form className="cr" onSubmit={envoyer} noValidate>
      <div className="cr-corps">
        {ref && <p className="cr-infos"><span>⏱ {t.delayShort}</span><span>🚚 {t.deliveryStrip(ref.seuil_gratuit, ref.frais_livraison)}</span></p>}

        <section className="cr-bloc cr-articles">
          <h2 className="cr-titre"><span className="cr-n">1</span>{t.articles}<small>{articles.length ? t.tapToAdd : ''}</small></h2>
          {!articles.length && <p className="muted small">{t.emptyCatalog}</p>}
          <div className="tuiles">
            {articles.map((a) => {
              const n = nb(a)
              return (
                <button type="button" key={a.id} className={'tuile' + (n ? ' on' : '')} onClick={() => { setError(''); setOuvert(a.id) }}>
                  {a.mode === 'm2' ? <span className="swatch" aria-hidden /> : <IconeArticle code={a.code} />}
                  <span className="tuile-nom">{nomArticle(a, lang)}</span>
                  <span className="tuile-prix"><bdi>{prixTuile(a)}</bdi></span>
                  {n > 0 && <span className="tuile-badge">{n}</span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="cr-bloc cr-infos-client">
          <h2 className="cr-titre"><span className="cr-n">2</span>{t.yourInfo}</h2>
          <div className="cr-champs">
            <span className="inp"><Ico n="nom" /><input value={c.nom} onChange={(e) => champ('nom', e.target.value)} placeholder={t.name} aria-label={t.name} autoComplete="name" aria-invalid={!!errs.nom} /></span>
            <span className="inp"><Ico n="tel" /><input value={c.telephone} onChange={(e) => champ('telephone', e.target.value)} placeholder={t.phone} aria-label={t.phone} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" aria-invalid={!!errs.telephone} /></span>
            <span className="inp"><Ico n="quartier" />
              <select value={c.zone_id} onChange={(e) => champ('zone_id', e.target.value)} aria-label={t.zone} aria-invalid={!!errs.zone_id} className={c.zone_id ? '' : 'vide'}>
                <option value="">{t.chooseZone}</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{lang === 'ar' ? z.nom_ar : z.nom_fr}</option>)}
              </select>
            </span>
            {c.latitude != null ? (
              <span className="geo-ok">
                <a href={lienCarte(c)} target="_blank" rel="noreferrer">📍 {t.geoSavedShort}</a>
                <button type="button" className="icon-btn" onClick={() => setC({ ...c, latitude: null, longitude: null })} aria-label={t.remove}>×</button>
              </span>
            ) : (
              <button type="button" className={'geo-btn' + (errs.lieu ? ' invalide' : '')} onClick={localiser} disabled={geo === 'loading'}>📍 {geo === 'loading' ? t.geoLoading : t.geoUseShort}</button>
            )}
            <span className="inp plein"><Ico n="adresse" /><input value={c.adresse} onChange={(e) => { champ('adresse', e.target.value); if (errs.lieu) setErrs((x) => ({ ...x, lieu: null })) }} placeholder={c.latitude != null ? t.addressPhOpt : t.addressLabel} aria-label={t.addressLabel} aria-invalid={!!errs.lieu} /></span>
          </div>
          {(geo === 'denied' || geo === 'error') && <small className="field-err">{geo === 'denied' ? t.geoDenied : t.geoError}</small>}
        </section>
      </div>

      {/* Barre d'envoi, toujours visible */}
      <div className="cr-barre">
        {error && <p className="cr-erreur" role="alert">{error}</p>}
        <div className="cr-total">
          <span className="muted small">{nbArticles ? t.itemsCount(nbArticles) : t.noItems}</span>
          <strong className="mono">{sousTotal ? mru(sousTotal + frais) : avecM2 ? t.toMeasure : mru(0)}</strong>
          {sousTotal > 0 && avecM2 && <small className="muted">+ {t.m2Pending}</small>}
        </div>
        <button className="primary-btn wa wa-send" disabled={busy}><span className="wa-rond"><IconeWhatsApp /></span>{busy ? t.sending : t.sendWaShort}</button>
        <p className="cr-astuce">{t.sendHint}</p>
      </div>

      {/* Panneau de quantité d'un article */}
      {art && (
        <Feuille titre={nomArticle(art, lang)} onClose={() => setOuvert(null)}
          pied={<>
            <span className="sheet-sum">{art.mode === 'fixe' && nb(art) > 0 && <b className="mono">{mru((qty[art.id]?.grand || 0) * art.prix_grand + (qty[art.id]?.petit || 0) * (art.prix_petit || 0))}</b>}</span>
            <button type="button" className="primary-btn" onClick={() => setOuvert(null)}>{t.done}</button>
          </>}>
          {art.mode === 'm2' ? (
            <div className="size-rows">
              <div className="size-row">
                <div><b>{t.piecesCount}</b><span className="muted small">{t.measuredAtPickup(art.prix_m2)}</span></div>
                <Stepper value={qty[art.id]?.grand || 0} onChange={(n) => setQ(art.id, 'grand', n)} label={art.nom_fr} />
              </div>
            </div>
          ) : (
            <div className="size-rows">
              {(art.prix_petit != null ? ['grand', 'petit'] : ['grand']).map((taille) => (
                <div className="size-row" key={taille}>
                  <div>
                    {art.prix_petit != null && <b>{taille === 'grand' ? t.big : t.small}</b>}
                    <span className="mono"><bdi>{taille === 'grand' ? art.prix_grand : art.prix_petit} MRU</bdi></span>
                  </div>
                  <Stepper value={qty[art.id]?.[taille] || 0} onChange={(n) => setQ(art.id, taille, n)} label={`${art.nom_fr} ${taille}`} />
                </div>
              ))}
            </div>
          )}
        </Feuille>
      )}
    </form>
  )
}
