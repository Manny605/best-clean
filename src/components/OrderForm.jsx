import { useMemo, useRef, useState } from 'react'
import { calculerTotaux, mru, prixUnitaire, surface } from '../lib/pricing.js'
import { autreNom, nomArticle } from '../lib/i18n.jsx'
import { lienCarte } from './Recu.jsx'
import { IconeArticle, SchemaMesure } from './Icones.jsx'

const VIDE = { nom: '', telephone: '', zone_id: '', adresse: '', note: '', latitude: null, longitude: null }
let k = 0
const key = () => ++k

// Numéro mauritanien : 8 chiffres commençant par 2, 3 ou 4 (indicatif 222 accepté)
export const telephoneValide = (tel) => /^[234]\d{7}$/.test(String(tel).replace(/\D/g, '').replace(/^(00)?222(?=\d{8}$)/, ''))

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
  const [errs, setErrs] = useState({}) // erreurs par champ : { nom, telephone, zone_id, lieu }
  const [busy, setBusy] = useState(false)
  const [nouvelle, setNouvelle] = useState(null) // pièce qu'on vient d'ajouter : on place le curseur dedans
  const infoRef = useRef(null)

  const setQ = (id, taille, n) => setQty((q) => ({ ...q, [id]: { ...q[id], [taille]: n } }))
  const addPiece = (id) => { const kk = key(); setNouvelle(kk); setPieces((p) => [...p, { key: kk, article_id: id, longueur: '', largeur: '' }]) }
  const editPiece = (kk, patch) => setPieces((p) => p.map((x) => (x.key === kk ? { ...x, ...patch } : x)))
  const delPiece = (kk) => setPieces((p) => p.filter((x) => x.key !== kk))
  const champ = (nom, valeur) => { setClient((c) => ({ ...c, [nom]: valeur })); if (errs[nom]) setErrs((e) => ({ ...e, [nom]: null })) }

  function localiser() {
    if (!navigator.geolocation) return setGeo('error')
    setGeo('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setClient((c) => ({ ...c, latitude: +coords.latitude.toFixed(6), longitude: +coords.longitude.toFixed(6) })); setErrs((e) => ({ ...e, lieu: null })); setGeo('') },
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

  // Détail du récapitulatif : une ligne par pièce mesurée ou par article/taille
  const detail = comptees.map((l, i) => {
    const a = byId[l.article_id]
    const precision = l.longueur ? `${num(l.longueur)} × ${num(l.largeur)} m` : a.prix_petit != null ? (l.taille === 'petit' ? t.small : t.big) : ''
    return { i, nom: nomArticle(a, lang), precision, quantite: l.quantite, montant: prixUnitaire(a, l) * l.quantite }
  })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!lignes.length) return setError(t.empty)
    if (piecesOk.length !== pieces.length) return setError(t.missingDims)
    const ee = {
      nom: !client.nom.trim() && t.errName,
      telephone: !telephoneValide(client.telephone) && t.errPhone,
      zone_id: !client.zone_id && t.errZone,
      lieu: !admin && client.latitude == null && !client.adresse.trim() && t.missingPlace,
    }
    setErrs(ee)
    const premiere = Object.keys(ee).find((k) => ee[k])
    if (premiere) {
      setError(ee[premiere])
      infoRef.current?.querySelector(`[data-champ="${premiere}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    try {
      await onSubmit({ ...client, source: admin ? 'telephone' : 'web' }, lignes.map((l) => ({ ...l, longueur: l.longueur ? Number(String(l.longueur).replace(',', '.')) : undefined, largeur: l.largeur ? Number(String(l.largeur).replace(',', '.')) : undefined })))
      setQty({}); setPieces([]); setClient(VIDE); setErrs({})
    } catch (err) {
      // Messages du serveur (en français) traduits pour le client
      const m = err.message || ''
      setError(m.includes('Trop de commandes') ? (t.errTooMany || m) : m.includes('saturé') ? (t.errBusy || m) : m.includes('téléphone invalide') ? t.errPhone : m)
    } finally { setBusy(false) }
  }

  const m2 = articles.filter((a) => a.mode === 'm2')
  const fixes = articles.filter((a) => a.mode === 'fixe')
  const err = (nom) => errs[nom] ? <small className="field-err" role="alert">{errs[nom]}</small> : null

  return (
    <form className="order" onSubmit={submit} noValidate>
      <div className="order-main">
        <section className="panel">
          <h2 className="step-title"><span className="step-n">1</span>{t.articles}</h2>
          <h3 className="group-title">{t.byM2}</h3>
          <div className="measure-hint">
            <SchemaMesure longueur={t.length.replace(/\s*\(.*\)/, '')} largeur={t.width.replace(/\s*\(.*\)/, '')} />
            <p className="muted small">{t.m2Hint}</p>
          </div>
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
                      <label><span>{t.length}</span><input inputMode="decimal" value={p.longueur} placeholder="3" autoFocus={p.key === nouvelle} onChange={(e) => editPiece(p.key, { longueur: num(e.target.value) })} /></label>
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
                    <IconeArticle code={a.code} />
                    <div>
                      <div className="art-name">{nomArticle(a, lang)}</div>
                      <div className="art-alt">{autreNom(a, lang)}</div>
                    </div>
                  </div>
                  <div className="fixe-sizes">
                    <div className="size">
                      <div className="size-label">{a.prix_petit != null ? t.big : ' '} <b><bdi>{a.prix_grand} MRU</bdi></b></div>
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
        <section className="panel" ref={infoRef}>
          <h2 className="step-title"><span className="step-n">2</span>{t.yourInfo}</h2>
          <div className="fields">
            <label className="field" data-champ="nom"><span>{t.name}</span><input value={client.nom} onChange={(e) => champ('nom', e.target.value)} autoComplete="name" aria-invalid={!!errs.nom} />{err('nom')}</label>
            <label className="field" data-champ="telephone"><span>{t.phone}</span><input value={client.telephone} onChange={(e) => champ('telephone', e.target.value)} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="22 00 00 00" aria-invalid={!!errs.telephone} />{err('telephone')}</label>
            <label className="field" data-champ="zone_id"><span>{t.zone}</span>
              <select value={client.zone_id} onChange={(e) => champ('zone_id', e.target.value)} aria-invalid={!!errs.zone_id}>
                <option value="">{t.chooseZone}</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{lang === 'ar' ? `${z.nom_ar} — ${z.nom_fr}` : `${z.nom_fr} — ${z.nom_ar}`}</option>)}
              </select>
              {err('zone_id')}
            </label>
            <div className="field" data-champ="lieu">
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
              <input value={client.adresse} onChange={(e) => { champ('adresse', e.target.value); if (errs.lieu) setErrs((x) => ({ ...x, lieu: null })) }} placeholder={client.latitude != null ? t.addressPhOpt : t.addressPh} aria-label={t.address} aria-invalid={!!errs.lieu} />
              {err('lieu')}
            </div>
            <label className="field"><span>{t.note}</span><textarea rows="2" value={client.note} onChange={(e) => champ('note', e.target.value)} /></label>
          </div>
        </section>

        <section className="panel summary">
          <h2 className="step-title"><span className="step-n">3</span>{t.summary}</h2>
          {detail.length ? (
            <ul className="sum-lines">
              {detail.map((d) => (
                <li key={d.i}>
                  <span>{d.nom}{d.precision && <small> · <bdi>{d.precision}</bdi></small>}{d.quantite > 1 && <small> ×{d.quantite}</small>}</span>
                  <span className="mono">{mru(d.montant)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted small sum-empty">{t.summaryEmpty}</p>}
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

function num(v) { return String(v).replace(',', '.') }
