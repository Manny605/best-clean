import { mru } from '../lib/pricing.js'
import { STATUTS } from '../lib/i18n.jsx'

const T = {
  fr: { receipt: 'Reçu de commande', date: 'Date', client: 'Client', zone: 'Quartier', bus: 'Bus', item: 'Article', qty: 'Qté', amount: 'Montant', subtotal: 'Articles', delivery: 'Livraison', free: 'Gratuite', total: 'Total', status: 'Statut', collect: 'Collecte prévue', map: 'Voir sur la carte', big: 'grand', small: 'petit', thanks: 'Merci de votre confiance' },
  ar: { receipt: 'إيصال الطلب', date: 'التاريخ', client: 'الزبون', zone: 'الحي', bus: 'الباص', item: 'الغرض', qty: 'الكمية', amount: 'المبلغ', subtotal: 'الأغراض', delivery: 'التوصيل', free: 'مجاني', total: 'المجموع', status: 'الحالة', collect: 'موعد الاستلام', map: 'عرض على الخريطة', big: 'كبير', small: 'صغير', thanks: 'شكرًا لثقتكم' },
}

export function detailLigne(l, lang) {
  const t = T[lang]
  if (l.longueur) return `${Number(l.longueur)} × ${Number(l.largeur)} m`
  if (l.taille) return t[l.taille === 'petit' ? 'small' : 'big']
  return ''
}

export const dateFr = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export function texteRecu(o, lang = 'fr') {
  const t = T[lang]
  const lignes = o.lignes.map((l) => `• ${lang === 'ar' ? l.libelle_ar : l.libelle_fr} ${detailLigne(l, lang)} ×${l.quantite} = ${mru(l.montant)}`)
  return [
    `BestClean — ${t.receipt} ${o.numero}`,
    `${t.client} : ${o.client_nom} (${o.telephone})`,
    `${t.zone} : ${lang === 'ar' ? o.zone?.nom_ar : o.zone?.nom_fr}`,
    '', ...lignes, '',
    `${t.subtotal} : ${mru(o.sous_total)}`,
    `${t.delivery} : ${o.frais_livraison ? mru(o.frais_livraison) : t.free}`,
    `*${t.total} : ${mru(o.total)}*`,
  ].join('\n')
}

export const lienCarte = (o) => (o.latitude != null && o.longitude != null ? `https://www.google.com/maps?q=${o.latitude},${o.longitude}` : null)

// Numéros mauritaniens : 8 chiffres → indicatif 222
export function lienWhatsApp(texte, telephone) {
  let n = String(telephone || '').replace(/\D/g, '')
  if (n.length === 8) n = '222' + n
  return `https://wa.me/${n}?text=${encodeURIComponent(texte)}`
}

export default function Recu({ commande: o, lang = 'fr' }) {
  const t = T[lang]
  const st = STATUTS[o.statut]
  return (
    <div className="recu" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="recu-head">
        <div>
          <div className="brand-mark small"><span className="dot" />BestClean</div>
          <div className="muted">{t.receipt}</div>
        </div>
        <div className="recu-num">
          <div className="mono">{o.numero}</div>
          <div className="muted">{dateFr(o.created_at)}</div>
        </div>
      </div>
      <dl className="recu-meta">
        <div><dt>{t.client}</dt><dd>{o.client_nom}<br /><span className="mono">{o.telephone}</span></dd></div>
        <div><dt>{t.zone}</dt><dd>{lang === 'ar' ? o.zone?.nom_ar : o.zone?.nom_fr}{o.adresse ? <><br /><span className="muted">{o.adresse}</span></> : null}{lienCarte(o) ? <><br /><a href={lienCarte(o)} target="_blank" rel="noreferrer">📍 {t.map}</a></> : null}</dd></div>
        <div><dt>{t.bus}</dt><dd>{o.bus?.nom}</dd></div>
        <div><dt>{t.status}</dt><dd>{st?.[lang]}{o.date_collecte ? <><br /><span className="muted">{t.collect} : {dateFr(o.date_collecte)}</span></> : null}</dd></div>
      </dl>
      <table className="recu-table">
        <thead><tr><th>{t.item}</th><th className="num">{t.qty}</th><th className="num">{t.amount}</th></tr></thead>
        <tbody>
          {o.lignes.map((l) => (
            <tr key={l.id}>
              <td>{lang === 'ar' ? l.libelle_ar : l.libelle_fr} <span className="muted">{detailLigne(l, lang)}</span></td>
              <td className="num">{l.quantite}</td>
              <td className="num">{mru(l.montant)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan="2">{t.subtotal}</td><td className="num">{mru(o.sous_total)}</td></tr>
          <tr><td colSpan="2">{t.delivery}</td><td className="num">{o.frais_livraison ? mru(o.frais_livraison) : t.free}</td></tr>
          <tr className="grand"><td colSpan="2">{t.total}</td><td className="num">{mru(o.total)}</td></tr>
        </tfoot>
      </table>
      <p className="recu-foot muted">{t.thanks} · BestClean, Nouakchott</p>
    </div>
  )
}
