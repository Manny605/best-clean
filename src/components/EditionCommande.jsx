// Modification d'une commande par l'équipe : mesures réelles, articles, quantités, coordonnées.
// Les totaux affichés sont indicatifs : la base les recalcule à l'enregistrement.
import { useMemo, useState } from 'react'
import { calculerTotaux, mru, prixUnitaire, surface } from '../lib/pricing.js'

let k = 0
const num = (v) => String(v).replace(',', '.')

export default function EditionCommande({ commande: o, catalog, onSave, onCancel }) {
  const byId = useMemo(() => Object.fromEntries(catalog.articles.map((a) => [a.id, a])), [catalog])
  const [c, setC] = useState({ nom: o.client_nom, telephone: o.telephone, zone_id: o.zone_id, adresse: o.adresse || '', note: o.note || '' })
  // Les lignes d'articles supprimés du catalogue ne peuvent pas être recalculées : on les signale
  const perdues = o.lignes.filter((l) => !byId[l.article_id])
  const [lignes, setLignes] = useState(() => o.lignes.filter((l) => byId[l.article_id]).map((l) => ({
    key: ++k, article_id: l.article_id, taille: l.taille || 'grand', longueur: l.longueur ?? '', largeur: l.largeur ?? '', quantite: l.quantite,
  })))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const edit = (kk, patch) => setLignes((ls) => ls.map((l) => (l.key === kk ? { ...l, ...patch } : l)))
  const ajouter = (id) => id && setLignes((ls) => [...ls, { key: ++k, article_id: id, taille: 'grand', longueur: '', largeur: '', quantite: 1 }])
  const zone = catalog.zones.find((z) => z.id === c.zone_id)
  const tot = calculerTotaux(lignes.filter((l) => byId[l.article_id].mode !== 'm2' || surface(l) > 0), byId, zone)

  async function enregistrer() {
    setErr('')
    if (!c.nom.trim() || !c.telephone.trim()) return setErr('Nom et téléphone obligatoires')
    if (!lignes.length) return setErr('La commande doit garder au moins un article')
    if (lignes.some((l) => byId[l.article_id].mode === 'm2' && !surface(l))) return setErr('Indiquez la longueur et la largeur de chaque pièce au m²')
    setBusy(true)
    try {
      await onSave(c, lignes.map(({ article_id, taille, longueur, largeur, quantite }) => {
        const a = byId[article_id]
        return a.mode === 'm2'
          ? { article_id, longueur: Number(num(longueur)), largeur: Number(num(largeur)), quantite: 1 }
          : { article_id, taille: a.prix_petit != null ? taille : null, quantite: Math.max(1, Number(quantite) || 1) }
      }))
    } catch (x) { setErr(x.message); setBusy(false) }
  }

  return (
    <div className="edition">
      <h3>Client</h3>
      <div className="edition-grid">
        <label className="field"><span>Nom</span><input value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} /></label>
        <label className="field"><span>Téléphone</span><input value={c.telephone} onChange={(e) => setC({ ...c, telephone: e.target.value })} type="tel" dir="ltr" /></label>
        <label className="field"><span>Quartier</span>
          <select value={c.zone_id} onChange={(e) => setC({ ...c, zone_id: e.target.value })}>
            {catalog.zones.map((z) => <option key={z.id} value={z.id}>{z.nom_fr}</option>)}
          </select>
        </label>
        <label className="field"><span>Adresse / repère</span><input value={c.adresse} onChange={(e) => setC({ ...c, adresse: e.target.value })} /></label>
      </div>
      {c.zone_id !== o.zone_id && <p className="warn small">La commande passera sur le bus du nouveau quartier.</p>}
      <label className="field"><span>Remarque</span><textarea rows="2" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} /></label>

      <h3>Articles</h3>
      {perdues.length > 0 && <p className="warn small">Article(s) retiré(s) du catalogue, supprimé(s) à l'enregistrement : {perdues.map((l) => l.libelle_fr).join(', ')}</p>}
      <div className="edit-lines">
        {lignes.map((l) => {
          const a = byId[l.article_id]
          return (
            <div className="edit-line" key={l.key}>
              <div className="edit-name"><b>{a.nom_fr}</b><span className="muted small">{a.mode === 'm2' ? `${a.prix_m2} MRU/m²` : 'prix fixe'}</span></div>
              {a.mode === 'm2' ? (
                <div className="edit-dims">
                  <input className="cell" inputMode="decimal" value={l.longueur} onChange={(e) => edit(l.key, { longueur: num(e.target.value) })} aria-label="Longueur (m)" placeholder="L" />
                  <span className="muted">×</span>
                  <input className="cell" inputMode="decimal" value={l.largeur} onChange={(e) => edit(l.key, { largeur: num(e.target.value) })} aria-label="Largeur (m)" placeholder="l" />
                  <span className="muted small">{surface(l) ? `${surface(l)} m²` : 'm'}</span>
                </div>
              ) : (
                <div className="edit-dims">
                  {a.prix_petit != null && (
                    <select value={l.taille} onChange={(e) => edit(l.key, { taille: e.target.value })} aria-label="Taille">
                      <option value="grand">Grand</option><option value="petit">Petit</option>
                    </select>
                  )}
                  <span className="muted">×</span>
                  <input className="cell" inputMode="numeric" value={l.quantite} onChange={(e) => edit(l.key, { quantite: e.target.value.replace(/\D/g, '') })} aria-label="Quantité" />
                </div>
              )}
              <span className="mono edit-amount">{mru(prixUnitaire(a, l) * (a.mode === 'm2' ? 1 : Math.max(1, Number(l.quantite) || 1)))}</span>
              <button type="button" className="icon-btn" onClick={() => setLignes((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Retirer" title="Retirer">×</button>
            </div>
          )
        })}
      </div>
      <select className="add-article" value="" onChange={(e) => ajouter(e.target.value)}>
        <option value="">+ Ajouter un article…</option>
        {catalog.articles.map((a) => <option key={a.id} value={a.id}>{a.nom_fr}{a.actif ? '' : ' (masqué)'}</option>)}
      </select>

      <div className="edit-total">
        <span>Articles {mru(tot.sousTotal)} · Livraison {tot.frais ? mru(tot.frais) : 'gratuite'}</span>
        <b className="mono">{mru(tot.total)}</b>
      </div>
      <p className="muted small">Ancien total : {mru(o.total)}. Les prix sont recalculés avec les tarifs actuels.</p>
      {err && <p className="error">{err}</p>}
      <div className="btn-row">
        <button className="primary-btn" onClick={enregistrer} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
        <button className="ghost-btn" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </div>
  )
}
