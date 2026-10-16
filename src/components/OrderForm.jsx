import { useMemo, useState } from 'react'
import { calculerTotaux, mru, prixUnitaire, surface } from '../lib/pricing.js'
import { autreNom, nomArticle } from '../lib/i18n.jsx'
import { lienCarte } from './Recu.jsx'

const VIDE = { nom: '', telephone: '', zone_id: '', adresse: '', note: '', latitude: null, longitude: null }
let k = 0
const key = () => ++k

function Stepper({ value, onChange, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={!value} aria-label="−">−</button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="+">+</button>
    </div>
  )
}

export default function OrderForm({ catalog, lang, t, onSubmit, admin = false }) {
  const articles = catalog.articles.filter((a) => a.actif)
  const zones = catalog.zones.filter((z) => z.actif)
  const byId = useMemo(() => Object.fromEntries(catalog.articles.map((a) => [a.id, a])), [catalog])
  const [qty, setQty] = useState({}) // { [articleId]: { grand, petit } }
  const [pieces, setPieces] = useState([]) // [{ key, article_id, longueur, largeur }]
  const [client, setClient] = useState(VIDE)
  const [geo, setGeo] = useState('') // '' | 'loading' | 'denied' | 'error'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setQ = (id, taille, n) => setQty((q) => ({ ...q, [id]: { ...q[id], [taille]: n } }))
  const addPiece = (id) => setPieces((p) => [...p, { key: key(), article_id: id, longueur: '', largeur: '' }])
  const editPiece = (kk, patch) => setPieces((p) => p.map((x) => (x.key === kk ? { ...x, ...patch } : x)))
  const delPiece = (kk) => setPieces((p) => p.filter((x) => x.key !== kk))

  function localiser() {
    if (!navigator.geolocation) return setGeo('error')
    setGeo('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setClient((c) => ({ ...c, latitude: +coords.latitude.toFixed(6), longitude: +coords.longitude.toFixed(6) })); setGeo('') },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  const lignes = useMemo(() => {
    const out = pieces.map(({ article_id, longueur, largeur }) => ({ article_id, longueur, largeur, quantite: 1 }))
    for (const [id, q] of Object.entries(qty)) {
      for (const taille of ['grand', 'petit']) if (q[taille] > 0) out.push({ article_id: id, taille, quantite: q[taille] })
    }
    return out
  }, [pieces, qty])

  const zone = zones.find((z) => z.id === client.zone_id)
  const piecesOk = pieces.filter((p) => surface(p) > 0)
  const comptees = lignes.filter((l) => !l.longueur && !l.largeur ? true : surface(l) > 0)
  const tot = calculerTotaux(comptees, byId, zone)
  const nbArticles = comptees.reduce((s, l) => s + l.quantite, 0)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!lignes.length) return setError(t.empty)
    if (piecesOk.length !== pieces.length) return setError(t.missingDims)
    if (!client.nom.trim() || !client.telephone.trim() || !client.zone_id) return setError(t.missing)
    if (!admin && client.latitude == null && !client.adresse.trim()) return setError(t.missingPlace)
    setBusy(true)
    try {
      await onSubmit({ ...client, source: admin ? 'telephone' : 'web' }, lignes.map((l) => ({ ...l, longueur: l.longueur ? Number(String(l.longueur).replace(',', '.')) : undefined, largeur: l.largeur ? Number(String(l.largeur).replace(',', '.')) : undefined })))
      setQty({}); setPieces([]); setClient(VIDE)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const m2 = articles.filter((a) => a.mode === 'm2')
  const fixes = articles.filter((a) => a.mode === 'fixe')
  const num = (v) => String(v).replace(',', '.')

  return (
    <form className="order" onSubmit={submit} noValidate>
      <div className="order-main">
        <section className="panel">
          <h2 className="step-title"><span className="step-n">1</span>{t.articles}</h2>
          <h3 className="group-title">{t.byM2}</h3>
          <p className="muted small">{t.m2Hint}</p>
          <div className="m2-list">
            {m2.map((a) => {
              const mine = pieces.filter((p) => p.article_id === a.id)
              return (
                <div className={'m2-card' + (mine.length ? ' active' : '')} key={a.id}>
                  <div className="m2-head">
                    <span className="swatch" aria-hidden />
                    <div className="m2-names">
                      <div className="art-name">{nomArticle(a, lang)}</div>
                      <div className="art-alt">{autreNom(a, lang)}</div>
                    </div>
                    <div className="price-tag"><bdi>{a.prix_m2} <small>MRU {t.perM2}</small></bdi>{a.a_confirmer && admin ? <span className="flag">{t.toConfirm}</span> : null}</div>
                  </div>
                  {mine.map((p) => (
                    <div className="piece" key={p.key}>
                      <label><span>{t.length}</span><input inputMode="decimal" value={p.longueur} placeholder="3" onChange={(e) => editPiece(p.key, { longueur: num(e.target.value) })} /></label>
                      <span className="times">×</span>
                      <label><span>{t.width}</span><input inputMode="decimal" value={p.largeur} placeholder="2" onChange={(e) => editPiece(p.key, { largeur: num(e.target.value) })} /></label>
                      <div className="piece-price">
                        <span className="muted small">{surface(p) ? `${surface(p)} m²` : '—'}</span>
                        <strong>{mru(prixUnitaire(a, p))}</strong>
                      </div>
                      <button type="button" className="icon-btn" onClick={() => delPiece(p.key)} aria-label={t.remove} title={t.remove}>×</button>
                    </div>
                  ))}
                  <button type="button" className="ghost-btn" onClick={() => addPiece(a.id)}>+ {t.addPiece}</button>
                </div>
              )
            })}
          </div>

          <h3 className="group-title">{t.byPiece}</h3>
          <div className="fixe-list">
            {fixes.map((a) => {
              const q = qty[a.id] || {}
              const on = (q.grand || 0) + (q.petit || 0) > 0
              return (
                <div className={'fixe-row' + (on ? ' active' : '')} key={a.id}>
                  <div className="fixe-name">
                    <div className="art-name">{nomArticle(a, lang)}</div>
                    <div className="art-alt">{autreNom(a, lang)}</div>
                  </div>
                  <div className="fixe-sizes">
                    <div className="size">
                      <div className="size-label">{a.prix_petit != null ? t.big : ' '} <b><bdi>{a.prix_grand} MRU</bdi></b></div>
                      <Stepper value={q.grand || 0} onChange={(n) => setQ(a.id, 'grand', n)} label={`${a.nom_fr} ${t.big}`} />
                    </div>
                    {a.prix_petit != null && (
                      <div className="size">
                        <div className="size-label">{t.small} <b><bdi>{a.prix_petit} MRU</bdi></b></div>
                        <Stepper value={q.petit || 0} onChange={(n) => setQ(a.id, 'petit', n)} label={`${a.nom_fr} ${t.small}`} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <aside className="order-side">
        <section className="panel">
          <h2 className="step-title"><span className="step-n">2</span>{t.yourInfo}</h2>
          <div className="fields">
            <label className="field"><span>{t.name}</span><input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} autoComplete="name" /></label>
            <label className="field"><span>{t.phone}</span><input value={client.telephone} onChange={(e) => setClient({ ...client, telephone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="22 00 00 00" /></label>
            <label className="field"><span>{t.zone}</span>
              <select value={client.zone_id} onChange={(e) => setClient({ ...client, zone_id: e.target.value })}>
                <option value="">{t.chooseZone}</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{lang === 'ar' ? `${z.nom_ar} — ${z.nom_fr}` : `${z.nom_fr} — ${z.nom_ar}`}</option>)}
              </select>
            </label>
            <div className="field">
              <span>{t.address}</span>
              <p className="muted small hint">{t.placeHint}</p>
              {client.latitude != null ? (
                <div className="geo-ok">
                  <span>📍 {t.geoSaved}</span>
                  <a href={lienCarte(client)} target="_blank" rel="noreferrer">{t.geoSee}</a>
                  <button type="button" className="icon-btn" onClick={() => setClient({ ...client, latitude: null, longitude: null })} aria-label={t.remove} title={t.remove}>×</button>
                </div>
              ) : (
                <button type="button" className="ghost-btn geo-btn" onClick={localiser} disabled={geo === 'loading'}>📍 {geo === 'loading' ? t.geoLoading : t.geoUse}</button>
              )}
              {(geo === 'denied' || geo === 'error') && <p className="error small">{geo === 'denied' ? t.geoDenied : t.geoError}</p>}
              <input value={client.adresse} onChange={(e) => setClient({ ...client, adresse: e.target.value })} placeholder={client.latitude != null ? t.addressPhOpt : t.addressPh} aria-label={t.address} />
            </div>
            <label className="field"><span>{t.note}</span><textarea rows="2" value={client.note} onChange={(e) => setClient({ ...client, note: e.target.value })} /></label>
          </div>
        </section>

        <section className="panel summary">
          <h2 className="step-title"><span className="step-n">3</span>{t.summary}</h2>
          <div className="sum-row"><span>{t.subtotal} <span className="muted">({nbArticles})</span></span><span className="mono">{mru(tot.sousTotal)}</span></div>
          <div className="sum-row"><span>{t.delivery}</span><span className="mono">{zone ? (tot.frais ? mru(tot.frais) : <span className="ok">{t.free}</span>) : '—'}</span></div>
          {zone && tot.resteAvantGratuit > 0 && (
            <div className="progress-free">
              <div className="bar"><i style={{ width: `${Math.min(100, (tot.sousTotal / zone.seuil_gratuit) * 100)}%` }} /></div>
              <span>{t.toFree(tot.resteAvantGratuit)}</span>
            </div>
          )}
          {!zone && <p className="muted small">{t.chooseZoneFirst}</p>}
          <div className="sum-row grand"><span>{t.total}</span><span className="mono">{mru(tot.total)}</span></div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary-btn" disabled={busy}>{busy ? t.sending : t.confirm}</button>
        </section>
      </aside>

      <div className="mobile-bar">
        {error && <p className="error mobile-error" role="alert">{error}</p>}
        <div><span className="muted small">{t.total} · {nbArticles}</span><strong className="mono">{mru(tot.total)}</strong></div>
        <button className="primary-btn" disabled={busy}>{busy ? t.sending : t.confirm}</button>
      </div>
    </form>
  )
}
