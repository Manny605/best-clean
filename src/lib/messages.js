// Messages WhatsApp envoyés au client selon l'étape de sa commande (l'équipe choisit la langue).
import { mru } from './pricing.js'
import { TELEPHONES } from './contact.js'

const date = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const dateAr = (d) => new Date(d).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn' })

const M = {
  fr: {
    en_attente: (o) => `Bonjour ${o.client_nom}, nous avons bien reçu votre commande ${o.numero} (${mru(o.total)}). Nous vous appelons la veille du passage du bus pour la collecte.`,
    planifiee: (o) => `Bonjour ${o.client_nom}, la collecte de votre commande ${o.numero} est prévue ${o.date_collecte ? `le ${date(o.date_collecte)}` : 'très bientôt'}. Merci de préparer vos articles.`,
    collectee: (o) => `Bonjour ${o.client_nom}, nous avons bien récupéré vos articles (commande ${o.numero}). Le lavage prend de 7 à 10 jours.`,
    en_lavage: (o) => `Bonjour ${o.client_nom}, votre commande ${o.numero} est en cours de lavage.`,
    prete: (o) => `Bonjour ${o.client_nom}, bonne nouvelle : votre commande ${o.numero} est prête ! Montant : ${mru(o.total)}. Nous vous contactons pour la livraison.`,
    livree: (o) => `Bonjour ${o.client_nom}, votre commande ${o.numero} a été livrée. Merci de votre confiance !`,
    annulee: (o) => `Bonjour ${o.client_nom}, votre commande ${o.numero} a été annulée. Pour toute question, appelez-nous au ${TELEPHONES[0]}.`,
  },
  ar: {
    en_attente: (o) => `السلام عليكم ${o.client_nom}، استلمنا طلبكم ${o.numero} (${mru(o.total)}). سنتصل بكم قبل يوم من مرور الباص للاستلام.`,
    planifiee: (o) => `السلام عليكم ${o.client_nom}، موعد استلام طلبكم ${o.numero} ${o.date_collecte ? `يوم ${dateAr(o.date_collecte)}` : 'قريبًا جدًا'}. نرجو تجهيز أغراضكم.`,
    collectee: (o) => `السلام عليكم ${o.client_nom}، استلمنا أغراضكم (الطلب ${o.numero}). يستغرق الغسيل من 7 إلى 10 أيام.`,
    en_lavage: (o) => `السلام عليكم ${o.client_nom}، طلبكم ${o.numero} قيد الغسيل الآن.`,
    prete: (o) => `السلام عليكم ${o.client_nom}، خبر سار: طلبكم ${o.numero} جاهز! المبلغ: ${mru(o.total)}. سنتصل بكم للتوصيل.`,
    livree: (o) => `السلام عليكم ${o.client_nom}، تم توصيل طلبكم ${o.numero}. شكرًا لثقتكم!`,
    annulee: (o) => `السلام عليكم ${o.client_nom}، تم إلغاء طلبكم ${o.numero}. لأي استفسار اتصلوا بنا على ${TELEPHONES[0]}.`,
  },
}

export const messageStatut = (o, lang = 'fr') => `${M[lang][o.statut](o)}\n\nBestClean`
