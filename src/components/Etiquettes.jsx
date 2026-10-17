// Une étiquette par pièce, à coller sur chaque article à la collecte pour ne jamais les mélanger.
import { detailLigne } from './Recu.jsx'
import { Logo } from '../lib/reglages.jsx'

export default function Etiquettes({ commande: o }) {
  const pieces = o.lignes.flatMap((l) => Array.from({ length: l.quantite }, () => l))
  return (
    <div className="etiquettes">
      {pieces.map((l, i) => (
        <div className="etiquette" key={i}>
          <div className="et-top">
            <span className="brand-mark small"><Logo />BestClean</span>
            <span className="et-n">{i + 1} / {pieces.length}</span>
          </div>
          <div className="et-num">{o.numero}</div>
          <div className="et-art">
            {l.libelle_fr} <span dir="rtl">{l.libelle_ar}</span>
            {detailLigne(l, 'fr') && <span className="et-detail"> · {detailLigne(l, 'fr')}</span>}
          </div>
          <div className="et-client">{o.client_nom} · <span dir="ltr">{o.telephone}</span></div>
          <div className="et-zone">{o.zone?.nom_fr} · {o.bus?.nom}</div>
        </div>
      ))}
    </div>
  )
}
