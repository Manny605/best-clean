import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, isDemo, canPrint } from '../lib/api.js'
import { STATUTS } from '../lib/i18n.jsx'
import { mru } from '../lib/pricing.js'
import OrderForm from '../components/OrderForm.jsx'
import Recu, { dateFr, lienWhatsApp, texteRecu } from '../components/Recu.jsx'
import EditionCommande from '../components/EditionCommande.jsx'
import Etiquettes from '../components/Etiquettes.jsx'
import { messageStatut } from '../lib/messages.js'
import { Logo, useReglages } from '../lib/reglages.jsx'

// Petit signal sonore à l'arrivée d'une commande (sans fichier audio)
function bip() {
  try {
    const ctx = new AudioContext()
    for (const [f, t] of [[880, 0], [1320, 0.18]]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.18, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.35)
    }
  } catch { /* son indisponible */ }
}

// Textes du formulaire de commande côté équipe (toujours en français)
const tFR = {
  articles: 'Articles', m2Hint: 'Au mètre carré : longueur × largeur.', addPiece: 'Ajouter une pièce', length: 'Longueur (m)', width: 'Largeur (m)',
  big: 'Grand', small: 'Petit', perM2: '/ m²', remove: 'Retirer', toConfirm: 'à confirmer', yourInfo: 'Client', name: 'Nom', phone: 'Téléphone',
  zone: 'Quartier', chooseZone: 'Choisir…', address: 'Adresse / repère', addressPh: 'Repère', note: 'Remarque', subtotal: 'Articles', delivery: 'Livraison',
  free: 'Gratuite', total: 'Total', toFree: (n) => `Encore ${n} MRU pour la livraison gratuite`, chooseZoneFirst: 'Choisir le quartier',
  confirm: 'Enregistrer la commande', sending: 'Enregistrement…', empty: 'Ajoutez au moins un article', missing: 'Nom, téléphone et quartier obligatoires',
  missingDims: 'Longueur et largeur manquantes', byM2: 'Au mètre carré', byPiece: 'À la pièce', summary: 'Récapitulatif',
  summaryEmpty: 'Aucun article', emptyCatalog: 'Aucun article dans le catalogue : ajoutez-en dans l’onglet « Tarifs et quartiers ».', errName: 'Nom obligatoire', errPhone: 'Numéro à 8 chiffres', errZone: 'Quartier obligatoire',
}

const demain = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
const resume = (o) => o.lignes.map((l) => `${l.libelle_fr}${l.longueur ? ` ${Number(l.longueur)}×${Number(l.largeur)}` : l.taille === 'petit' ? ' (P)' : ''}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`).join(', ')

function Pill({ statut }) {
  const s = STATUTS[statut]
  return <span className={`pill tone-${s.tone}`}>{s.fr}</span>
}

function Login({ onDone }) {
  const [email, setEmail] = useState(isDemo ? 'admin' : '')
  const [pw, setPw] = useState(isDemo ? 'demo' : '')
  const [err, setErr] = useState('')
  return (
    <div className="login-wrap" dir="ltr" lang="fr">
      <form className="panel login" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await api.signIn(email, pw); onDone() } catch (x) { setErr(x.message) } }}>
        <div className="brand-mark login-brand"><Logo />BestClean</div>
        <h1>Espace équipe</h1>
        {isDemo && <p className="muted small">Mode démo : n'importe quel nom d'utilisateur et mot de passe.</p>}
        <label className="field"><span>Nom d'utilisateur</span><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" dir="ltr" /></label>
        <label className="field"><span>Mot de passe</span><input value={pw} onChange={(e) => setPw(e.target.value)} type="password" dir="ltr" /></label>
        {err && <p className="error">{err}</p>}
        <button className="primary-btn">Se connecter</button>
        <Link to="/" className="muted small">← Site client</Link>
      </form>
    </div>
  )
}

// ------------------------------------------------------------------ Commandes
function Commandes({ orders, catalog, reload, openOrder, nouveaux }) {
  const [statut, setStatut] = useState('actives')
  const [bus, setBus] = useState('')
  const [q, setQ] = useState('')
  const rows = orders.filter((o) =>
    (statut === 'toutes' || (statut === 'actives' ? !['livree', 'annulee'].includes(o.statut) : o.statut === statut)) &&
    (!bus || o.bus_id === bus) &&
    (!q || `${o.numero} ${o.client_nom} ${o.telephone}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <div className="filters">
        <input placeholder="Rechercher nom, téléphone, n°…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="actives">En cours</option>
          <option value="toutes">Toutes</option>
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.fr}</option>)}
        </select>
        <select value={bus} onChange={(e) => setBus(e.target.value)}>
          <option value="">Tous les bus</option>
          {catalog.bus.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>N°</th><th>Client</th><th>Quartier</th><th>Articles</th><th className="num">Total</th><th>Statut</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} onClick={() => openOrder(o)} className={'clickable' + (nouveaux.includes(o.id) ? ' is-new' : '')}>
                <td><span className="mono">{o.numero}</span><div className="muted small">{dateFr(o.created_at)}{o.source === 'telephone' ? ' · ☎' : ''}</div></td>
                <td>{o.client_nom}<div className="muted small mono">{o.telephone}</div></td>
                <td>{o.zone?.nom_fr}<div className="muted small">{o.bus?.nom}</div></td>
                <td className="clip">{resume(o)}</td>
                <td className="num mono">{mru(o.total)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select className={`pill-select tone-${STATUTS[o.statut].tone}`} value={o.statut} onChange={async (e) => { await api.updateOrder(o.id, { statut: e.target.value }); reload() }}>
                    {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.fr}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="6" className="empty">Aucune commande</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Drawer({ order, catalog, onClose, reload, print }) {
  const [edition, setEdition] = useState(false)
  const [lg, setLg] = useState('fr') // langue des messages envoyés au client
  if (!order) return null
  // Le panneau reste ouvert après un changement de statut, pour prévenir le client tout de suite
  const set = async (statut) => { await api.updateOrder(order.id, { statut }); await reload() }
  const nbPieces = order.lignes.reduce((s, l) => s + l.quantite, 0)
  const message = messageStatut(order, lg)
  return (
    <div className="drawer-bg no-print" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div><span className="mono strong">{order.numero}</span> <Pill statut={order.statut} /></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {edition ? (
          <EditionCommande commande={order} catalog={catalog} onCancel={() => setEdition(false)}
            onSave={async (c, l) => { await api.editOrder(order.id, c, l); await reload(); setEdition(false) }} />
        ) : (
          <>
            <Recu commande={order} lang="fr" />
            {order.note && <p className="note-box"><b>Remarque :</b> {order.note}</p>}
            <div className="btn-row">
              <button className="ghost-btn" onClick={() => setEdition(true)}>✎ Modifier</button>
              {canPrint && <button className="ghost-btn" onClick={() => print(<Etiquettes commande={order} />)}>Étiquettes ({nbPieces})</button>}
              {canPrint && <button className="ghost-btn" onClick={() => print(<Recu commande={order} lang="fr" />)}>Imprimer le reçu</button>}
              <a className="ghost-btn" href={lienWhatsApp(texteRecu(order, lg), order.telephone)} target="_blank" rel="noreferrer">Reçu WhatsApp</a>
            </div>

            <div className="notify">
              <div className="notify-head">
                <b>Prévenir le client · {STATUTS[order.statut].fr}</b>
                <div className="seg" role="group" aria-label="Langue du message">
                  <button className={lg === 'fr' ? 'on' : ''} onClick={() => setLg('fr')}>FR</button>
                  <button className={lg === 'ar' ? 'on' : ''} onClick={() => setLg('ar')}>عربي</button>
                </div>
              </div>
              <p className="notify-msg" dir={lg === 'ar' ? 'rtl' : 'ltr'}>{message}</p>
              <a className="primary-btn wa" href={lienWhatsApp(message, order.telephone)} target="_blank" rel="noreferrer">Envoyer sur WhatsApp</a>
            </div>

            <h3>Changer le statut</h3>
            <div className="status-grid">
              {Object.entries(STATUTS).map(([k, v]) => (
                <button key={k} className={`status-btn tone-${v.tone}` + (order.statut === k ? ' on' : '')} onClick={() => set(k)}>{v.fr}</button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

// ------------------------------------------------------------------ Bus
function ListeBus({ titre, orders }) {
  const total = orders.reduce((s, o) => s + o.total, 0)
  return (
    <div className="bus-print">
      <h2>{titre}</h2>
      <p>{orders.length} clients · {mru(total)} · imprimé le {dateFr(new Date())}</p>
      <table>
        <thead><tr><th>#</th><th>N°</th><th>Client</th><th>Téléphone</th><th>Quartier / repère</th><th>Articles</th><th>Total</th><th>✓</th></tr></thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={o.id}><td>{i + 1}</td><td>{o.numero}</td><td>{o.client_nom}</td><td>{o.telephone}</td><td>{o.zone?.nom_fr}{o.adresse ? ` — ${o.adresse}` : ''}{o.latitude != null ? ' 📍' : ''}</td><td>{resume(o)}</td><td>{mru(o.total)}</td><td /></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bus({ orders, catalog, reload, print }) {
  const [dates, setDates] = useState({})
  const [aConfirmer, setAConfirmer] = useState(null) // id du bus en attente de confirmation
  const planifiees = orders.filter((o) => o.statut === 'planifiee')
  const groupes = Object.values(planifiees.reduce((g, o) => {
    const k = `${o.date_collecte}|${o.bus_id}`
    ;(g[k] ||= { date: o.date_collecte, bus_id: o.bus_id, nom: o.bus?.nom, orders: [] }).orders.push(o)
    return g
  }, {})).sort((a, b) => String(a.date).localeCompare(String(b.date)))

  return (
    <>
      <div className="bus-grid">
        {catalog.bus.map((b) => {
          const att = orders.filter((o) => o.bus_id === b.id && o.statut === 'en_attente')
          const pct = Math.min(100, (att.length / b.capacite) * 100)
          const pret = att.length >= b.capacite
          const zones = catalog.zones.filter((z) => z.bus_id === b.id).map((z) => z.nom_fr).join(', ')
          const date = dates[b.id] || demain()
          return (
            <div key={b.id} className={'panel bus-card' + (pret ? ' ready' : '')}>
              <div className="bus-top">
                <div><h3>{b.nom}</h3><div className="muted small">{zones || 'Aucun quartier'}</div></div>
                {pret && <span className="pill tone-green">Prêt à partir</span>}
              </div>
              <div className="bus-count"><span className="mono">{att.length}</span><span className="muted"> / {b.capacite} clients</span></div>
              <div className="bar big"><i style={{ width: `${pct}%` }} /></div>
              <div className="muted small">{mru(att.reduce((s, o) => s + o.total, 0))} en attente</div>
              <div className="bus-actions">
                <label className="field inline"><span>Collecte le</span><input type="date" value={date} onChange={(e) => setDates({ ...dates, [b.id]: e.target.value })} /></label>
                {aConfirmer === b.id ? (
                  <div className="confirm-inline">
                    <span>Planifier {att.length} clients le {dateFr(date)} ?</span>
                    <button className="primary-btn" onClick={async () => { await api.sendBus(b.id, date); setAConfirmer(null); reload() }}>Oui, envoyer</button>
                    <button className="ghost-btn" onClick={() => setAConfirmer(null)}>Annuler</button>
                  </div>
                ) : (
                  <button className="primary-btn" disabled={!att.length} onClick={() => setAConfirmer(b.id)}>Envoyer le bus</button>
                )}
                {canPrint && <button className="ghost-btn" disabled={!att.length} onClick={() => print(<ListeBus titre={`${b.nom} — liste d'attente`} orders={[...att].reverse()} />)}>Imprimer la liste</button>}
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="section-title">Collectes planifiées</h2>
      {!groupes.length && <p className="muted">Aucune collecte planifiée.</p>}
      {groupes.map((g) => (
        <div key={g.date + g.bus_id} className="panel planned">
          <div>
            <strong>{g.nom}</strong> · {dateFr(g.date)}
            <div className="muted small">{g.orders.length} clients · {mru(g.orders.reduce((s, o) => s + o.total, 0))}</div>
          </div>
          <div className="btn-row">
            {canPrint && <button className="ghost-btn" onClick={() => print(<ListeBus titre={`${g.nom} — collecte du ${dateFr(g.date)}`} orders={[...g.orders].reverse()} />)}>Imprimer</button>}
            <button className="primary-btn" onClick={async () => { for (const o of g.orders) await api.updateOrder(o.id, { statut: 'collectee' }); reload() }}>Tout marquer collecté</button>
          </div>
        </div>
      ))}
    </>
  )
}

// ------------------------------------------------------------------ Tarifs
function NumCell({ value, onSave, allowNull }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  return <input className="cell" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))}
    onBlur={() => { const n = v === '' ? (allowNull ? null : 0) : Number(v); if (n !== value) onSave(n) }} />
}
function TextCell({ value, onSave, dir }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  return <input className="cell wide" dir={dir} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
}

// Supprimer en deux clics : le premier arme le bouton, le second confirme (3 s pour se décider)
function BoutonSupprimer({ onConfirm }) {
  const [arme, setArme] = useState(false)
  useEffect(() => { if (!arme) return; const t = setTimeout(() => setArme(false), 3000); return () => clearTimeout(t) }, [arme])
  return arme
    ? <button className="del-btn armed" onClick={() => { setArme(false); onConfirm() }}>Confirmer ?</button>
    : <button className="del-btn" onClick={() => setArme(true)} title="Supprimer" aria-label="Supprimer">Supprimer</button>
}

function Tarifs({ catalog, reloadCatalog }) {
  const [info, setInfo] = useState(null) // { type: 'ok' | 'warn' | 'error', texte }
  async function supprimer(action, nom, quoi) {
    setInfo(null)
    try {
      const r = await action()
      setInfo(r === 'masque'
        ? { type: 'warn', texte: `« ${nom} » apparaît dans des commandes : ${quoi} a été masqué au lieu d’être supprimé, pour garder l’historique.` }
        : { type: 'ok', texte: `« ${nom} » a été supprimé.` })
    } catch (x) { setInfo({ type: 'error', texte: x.message }) }
    reloadCatalog()
  }
  const upA = async (id, patch) => { await api.updateArticle(id, patch); reloadCatalog() }
  const upZ = async (id, patch) => { await api.updateZone(id, patch); reloadCatalog() }
  const upB = async (id, patch) => { await api.updateBus(id, patch); reloadCatalog() }
  const aConf = catalog.articles.filter((a) => a.a_confirmer)
  return (
    <>
      {info && <p className={`flash flash-${info.type}`} role="status">{info.texte}<button className="icon-btn" onClick={() => setInfo(null)} aria-label="Fermer">×</button></p>}
      {aConf.length > 0 && <p className="warn">Prix provisoires à vérifier : {aConf.map((a) => a.nom_fr).join(', ')}. Corrigez-les puis décochez « à confirmer ».</p>}
      <h2 className="section-title">Articles</h2>
      <div className="table-wrap">
        <table className="data edit">
          <thead><tr><th>Nom (FR)</th><th>Nom (AR)</th><th>Calcul</th><th className="num">Prix m²</th><th className="num">Grand / unique</th><th className="num">Petit</th><th>À confirmer</th><th>Visible</th><th /></tr></thead>
          <tbody>
            {catalog.articles.map((a) => (
              <tr key={a.id} className={a.actif ? '' : 'off'}>
                <td><TextCell value={a.nom_fr} onSave={(v) => upA(a.id, { nom_fr: v })} /></td>
                <td><TextCell value={a.nom_ar} dir="rtl" onSave={(v) => upA(a.id, { nom_ar: v })} /></td>
                <td>{a.mode === 'm2' ? 'Au m²' : 'Prix fixe'}</td>
                <td className="num">{a.mode === 'm2' ? <NumCell value={a.prix_m2} onSave={(v) => upA(a.id, { prix_m2: v })} /> : '—'}</td>
                <td className="num">{a.mode === 'fixe' ? <NumCell value={a.prix_grand} onSave={(v) => upA(a.id, { prix_grand: v })} /> : '—'}</td>
                <td className="num">{a.mode === 'fixe' ? <NumCell value={a.prix_petit} allowNull onSave={(v) => upA(a.id, { prix_petit: v })} /> : '—'}</td>
                <td><input type="checkbox" checked={a.a_confirmer} onChange={(e) => upA(a.id, { a_confirmer: e.target.checked })} /></td>
                <td><input type="checkbox" checked={a.actif} onChange={(e) => upA(a.id, { actif: e.target.checked })} /></td>
                <td><BoutonSupprimer onConfirm={() => supprimer(() => api.deleteArticle(a.id), a.nom_fr, 'l’article')} /></td>
              </tr>
            ))}
            {!catalog.articles.length && <tr><td colSpan="9" className="empty">Aucun article : ajoutez-en avec les boutons ci-dessous.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="btn-row">
        <button className="ghost-btn" onClick={async () => { await api.createArticle({ code: 'art_' + Date.now(), nom_fr: 'Nouvel article', nom_ar: 'غرض جديد', mode: 'fixe', prix_grand: 100, prix_petit: null, ordre: 99 }); reloadCatalog() }}>+ Article à prix fixe</button>
        <button className="ghost-btn" onClick={async () => { await api.createArticle({ code: 'art_' + Date.now(), nom_fr: 'Nouvel article', nom_ar: 'غرض جديد', mode: 'm2', prix_m2: 60, ordre: 99 }); reloadCatalog() }}>+ Article au m²</button>
      </div>
      <p className="muted small">Laissez « Petit » vide pour un article à taille unique.</p>

      <h2 className="section-title">Quartiers et livraison</h2>
      <div className="table-wrap">
        <table className="data edit">
          <thead><tr><th>Quartier (FR)</th><th>Quartier (AR)</th><th>Bus</th><th className="num">Frais livraison</th><th className="num">Gratuite dès</th><th>Visible</th><th /></tr></thead>
          <tbody>
            {catalog.zones.map((z) => (
              <tr key={z.id} className={z.actif ? '' : 'off'}>
                <td><TextCell value={z.nom_fr} onSave={(v) => upZ(z.id, { nom_fr: v })} /></td>
                <td><TextCell value={z.nom_ar} dir="rtl" onSave={(v) => upZ(z.id, { nom_ar: v })} /></td>
                <td><select value={z.bus_id || ''} onChange={(e) => upZ(z.id, { bus_id: e.target.value || null })}>{catalog.bus.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}</select></td>
                <td className="num"><NumCell value={z.frais_livraison} onSave={(v) => upZ(z.id, { frais_livraison: v })} /></td>
                <td className="num"><NumCell value={z.seuil_gratuit} onSave={(v) => upZ(z.id, { seuil_gratuit: v })} /></td>
                <td><input type="checkbox" checked={z.actif} onChange={(e) => upZ(z.id, { actif: e.target.checked })} /></td>
                <td><BoutonSupprimer onConfirm={() => supprimer(() => api.deleteZone(z.id), z.nom_fr, 'le quartier')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="ghost-btn" onClick={async () => { await api.createZone({ nom_fr: 'Nouveau quartier', nom_ar: 'حي جديد', bus_id: catalog.bus[0]?.id, frais_livraison: 200, seuil_gratuit: 700, ordre: 99 }); reloadCatalog() }}>+ Quartier</button>

      <h2 className="section-title">Bus</h2>
      <div className="table-wrap">
        <table className="data edit">
          <thead><tr><th>Nom</th><th className="num">Capacité (clients)</th><th>Quartiers desservis</th><th /></tr></thead>
          <tbody>{catalog.bus.map((b) => (
            <tr key={b.id}><td><TextCell value={b.nom} onSave={(v) => upB(b.id, { nom: v })} /></td><td className="num"><NumCell value={b.capacite} onSave={(v) => upB(b.id, { capacite: v || 30 })} /></td><td className="muted small">{catalog.zones.filter((z) => z.bus_id === b.id).map((z) => z.nom_fr).join(', ') || '—'}</td><td><BoutonSupprimer onConfirm={() => supprimer(() => api.deleteBus(b.id), b.nom, 'le bus')} /></td></tr>
          ))}</tbody>
        </table>
      </div>
      <button className="ghost-btn" onClick={async () => { await api.createBus({ nom: 'Nouveau bus', capacite: 30 }); reloadCatalog() }}>+ Bus</button>
    </>
  )
}

// ------------------------------------------------------------------ Réglages
function Reglages() {
  const { logo, perso, reload } = useReglages()
  const [etat, setEtat] = useState({ busy: false, ok: '', err: '' })
  async function changer(action, message) {
    setEtat({ busy: true, ok: '', err: '' })
    try { await action(); await reload(); setEtat({ busy: false, ok: message, err: '' }) } catch (x) { setEtat({ busy: false, ok: '', err: x.message }) }
  }
  function choisir(e) {
    const fichier = e.target.files[0]
    e.target.value = '' // permet de reprendre le même fichier
    if (fichier) changer(() => api.setLogo(fichier), 'Logo mis à jour sur tout le site.')
  }
  return (
    <>
      <h2 className="section-title">Logo</h2>
      <div className="panel logo-panel">
        <div className="logo-apercus">
          <div className="logo-apercu clair"><img src={logo} alt="Logo actuel sur fond clair" /><span>En-tête, reçus</span></div>
          <div className="logo-apercu sombre"><img src={logo} alt="Logo actuel sur fond sombre" /><span>Pied de page</span></div>
        </div>
        <div className="logo-actions">
          <p className="muted small">PNG, JPEG ou WebP, 2 Mo maximum. Un fond transparent (PNG ou WebP) rend mieux. Le logo apparaît en haut du site, dans le pied de page, sur les reçus, les étiquettes et l'onglet du navigateur.</p>
          <div className="btn-row">
            <label className={'primary-btn file-btn' + (etat.busy ? ' disabled' : '')}>
              {etat.busy ? 'Envoi…' : 'Choisir un nouveau logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={choisir} disabled={etat.busy} hidden />
            </label>
            {perso && <button className="ghost-btn" disabled={etat.busy} onClick={() => changer(() => api.resetLogo(), 'Logo d’origine rétabli.')}>Revenir au logo d’origine</button>}
          </div>
          {etat.ok && <p className="ok">{etat.ok}</p>}
          {etat.err && <p className="error">{etat.err}</p>}
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ Shell
export default function Admin() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('commandes')
  const [orders, setOrders] = useState([])
  const [catalog, setCatalog] = useState(null)
  const [open, setOpen] = useState(null)
  const [printNode, setPrintNode] = useState(null)
  const [toast, setToast] = useState(null)
  const [nouveaux, setNouveaux] = useState([]) // commandes arrivées du site depuis l'ouverture, pas encore consultées

  useEffect(() => { document.documentElement.dir = 'ltr'; document.documentElement.lang = 'fr' }, [])
  useEffect(() => { api.getSession().then((s) => setSession(s || null)) }, [])
  const reload = useCallback(async () => { setOrders(await api.listOrders()) }, [])
  const reloadCatalog = useCallback(async () => { setCatalog(await api.getCatalog()) }, [])
  useEffect(() => { if (session) { reload(); reloadCatalog() } }, [session, reload, reloadCatalog])
  useEffect(() => { if (open) setOpen(orders.find((o) => o.id === open.id) || null) }, [orders]) // eslint-disable-line

  // Temps réel : la liste se met à jour seule, avec un son pour chaque commande passée sur le site
  useEffect(() => {
    if (!session) return
    let t
    const stop = api.subscribeOrders((evt, row) => {
      clearTimeout(t); t = setTimeout(reload, 400) // une création envoie plusieurs évènements : un seul rechargement
      if (evt === 'INSERT' && row?.source === 'web') { setNouveaux((n) => (n.includes(row.id) ? n : [...n, row.id])); bip() }
    })
    const filet = setInterval(reload, 60000) // au cas où la connexion temps réel tombe
    return () => { stop(); clearInterval(filet); clearTimeout(t) }
  }, [session, reload])
  useEffect(() => {
    document.title = nouveaux.length ? `(${nouveaux.length}) BestClean · équipe` : 'BestClean · équipe'
    return () => { document.title = 'BestClean' }
  }, [nouveaux.length])
  const ouvrir = (o) => { setOpen(o); setNouveaux((n) => n.filter((x) => x !== o.id)) }

  const print = (node) => { setPrintNode(node); setTimeout(() => window.print(), 50) }

  const kpi = useMemo(() => {
    const c = (s) => orders.filter((o) => o.statut === s).length
    const today = new Date().toDateString()
    return [
      ['Aujourd’hui', orders.filter((o) => new Date(o.created_at).toDateString() === today).length],
      ['En attente du bus', c('en_attente')], ['Collecte planifiée', c('planifiee')],
      ['En lavage', c('collectee') + c('en_lavage')], ['Prêtes à livrer', c('prete')],
    ]
  }, [orders])

  if (session === undefined) return <div className="loading">…</div>
  if (!session) return <Login onDone={() => api.getSession().then(setSession)} />

  const tabs = [['commandes', 'Commandes'], ['bus', 'Bus'], ['nouvelle', 'Nouvelle commande'], ['tarifs', 'Tarifs et quartiers'], ['reglages', 'Réglages']]
  return (
    <div className="admin" dir="ltr" lang="fr">
      <header className="admin-top no-print">
        <div className="brand-mark"><Logo />BestClean <span className="muted small">équipe</span>{isDemo && <span className="demo-badge">Démo</span>}</div>
        <nav className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'commandes' && nouveaux.length > 0 && <span className="tab-badge">{nouveaux.length}</span>}</button>)}</nav>
        <div className="admin-right">
          <Link to="/" className="muted small">Site client</Link>
          {isDemo && <button className="link-btn small" onClick={() => { api.resetDemo(); location.reload() }}>Réinitialiser la démo</button>}
          <button className="link-btn small" onClick={async () => { await api.signOut(); setSession(null) }}>Déconnexion</button>
        </div>
      </header>

      <main className="admin-main no-print">
        {nouveaux.length > 0 && (() => {
          const derniere = orders.find((o) => o.id === nouveaux[nouveaux.length - 1])
          return (
            <div className="alerte" role="status">
              <span className="alerte-dot" aria-hidden />
              <span><b>{nouveaux.length > 1 ? `${nouveaux.length} nouvelles commandes` : 'Nouvelle commande'}</b>{derniere && <> · {derniere.numero} · {derniere.client_nom} ({derniere.zone?.nom_fr}) · {mru(derniere.total)}</>}</span>
              {derniere && <button className="primary-btn" onClick={() => { setTab('commandes'); ouvrir(derniere) }}>Voir</button>}
              <button className="link-btn small" onClick={() => setNouveaux([])}>Tout marquer vu</button>
            </div>
          )
        })()}
        <div className="kpis">{kpi.map(([l, n]) => <div key={l} className="kpi"><span className="mono">{n}</span><span className="muted small">{l}</span></div>)}</div>
        {!catalog ? <div className="loading">…</div> : (
          <>
            {tab === 'commandes' && <Commandes orders={orders} catalog={catalog} reload={reload} openOrder={ouvrir} nouveaux={nouveaux} />}
            {tab === 'bus' && <Bus orders={orders} catalog={catalog} reload={reload} print={print} />}
            {tab === 'nouvelle' && (
              <>
                <p className="muted">Commande reçue par téléphone ou message : elle est ajoutée directement sur la liste du bus du quartier.</p>
                <OrderForm catalog={catalog} lang="fr" t={tFR} admin onSubmit={async (c, l) => { const o = await api.createOrder(c, l); await reload(); setToast(o) }} />
              </>
            )}
            {tab === 'tarifs' && <Tarifs catalog={catalog} reloadCatalog={reloadCatalog} />}
            {tab === 'reglages' && <Reglages />}
          </>
        )}
      </main>

      {toast && (
        <div className="toast no-print">
          <span><b className="mono">{toast.numero}</b> enregistrée · {mru(toast.total)} · {toast.bus?.nom}</span>
          <a href={lienWhatsApp(texteRecu(toast, 'ar'), toast.telephone)} target="_blank" rel="noreferrer">Envoyer le reçu</a>
          <button className="link-btn" onClick={() => { setOpen(toast); setToast(null) }}>Voir</button>
          <button className="icon-btn" onClick={() => setToast(null)} aria-label="Fermer">×</button>
        </div>
      )}
      <Drawer key={open?.id} order={open} catalog={catalog} onClose={() => setOpen(null)} reload={reload} print={print} />
      <div className="print-only">{printNode}</div>
    </div>
  )
}

