import { createContext, useContext, useEffect, useState } from 'react'

const fr = {
  tagline: 'Lavage de tapis et de linge, collecte à domicile',
  start: 'Commencer ma commande', freeFrom: (n) => `Livraison gratuite dès ${n} MRU`,
  how: [['Vous commandez', 'Choisissez vos articles, le prix s’affiche tout de suite.'], ['On collecte', 'Le bus de votre quartier passe chez vous.'], ['On rapporte', 'Propre, plié, livré à votre porte.']],
  byM2: 'Au mètre carré', byPiece: 'À la pièce', summary: 'Récapitulatif',
  delay: 'Prêt en 7 à 10 jours', summaryEmpty: 'Ajoutez des articles : ils s’affichent ici avec leur prix.',
  errName: 'Indiquez votre nom', errPhone: 'Numéro à 8 chiffres, ex. 22 11 22 33', errZone: 'Choisissez votre quartier',
  faqTitle: 'Questions fréquentes',
  faq: (seuil) => [
    ['Combien de temps dure le lavage ?', 'De 7 à 10 jours, pour un nettoyage et une désinfection complets.'],
    ['Comment mesurer mon tapis ?', 'Mesurez la longueur et la largeur en mètres. Le prix = longueur × largeur × prix au m².'],
    ['La livraison est-elle payante ?', `Elle est gratuite à partir de ${seuil} MRU de commande (le seuil dépend du quartier). En dessous, des frais de livraison s’ajoutent.`],
    ['Quand passe le bus ?', 'Chaque quartier a son bus. Nous vous appelons la veille du passage pour confirmer la collecte.'],
    ['Comment suivre ma commande ?', 'Avec votre numéro de commande et votre téléphone, sur la page « Suivre ma commande ».'],
  ],
  contactTitle: 'Une question ? Parlons-en', contactText: 'Notre équipe vous répond par téléphone ou sur WhatsApp.',
  call: 'Appeler', whatsappUs: 'Écrire sur WhatsApp', waHello: 'Bonjour BestClean, ',
  orderWa: 'Commander par WhatsApp', waOrder: 'Bonjour BestClean, je souhaite faire une commande de lavage.',
  errTooMany: 'Plusieurs commandes viennent déjà d’être passées avec ce numéro. Réessayez dans une heure ou appelez-nous.',
  errBusy: 'Le service est très sollicité. Réessayez dans quelques minutes.',
  heroTitle: 'On vient chercher, on lave, on vous rapporte.',
  heroText: 'Choisissez vos articles, le prix se calcule tout seul. On vous inscrit sur le bus de votre quartier.',
  articles: 'Vos articles', m2Hint: 'Prix au mètre carré : mesurez la longueur et la largeur.',
  addPiece: 'Ajouter une pièce', length: 'Longueur (m)', width: 'Largeur (m)',
  big: 'Grand', small: 'Petit', perM2: '/ m²', remove: 'Retirer', toConfirm: 'prix à confirmer',
  yourInfo: 'Vos coordonnées', name: 'Nom complet', phone: 'Téléphone', zone: 'Quartier',
  chooseZone: 'Choisir votre quartier', address: 'Où vous trouver ?', addressPh: 'Ex. : derrière la pharmacie, maison bleue',
  placeHint: 'Partagez votre position, ou décrivez votre adresse.', addressPhOpt: 'Détail facultatif : étage, porte…',
  geoUse: 'Partager ma position', geoLoading: 'Localisation…', geoSaved: 'Position enregistrée', geoSee: 'Voir sur la carte',
  geoDenied: 'Accès à la position refusé. Écrivez votre adresse ci-dessous.', geoError: 'Position introuvable. Écrivez votre adresse ci-dessous.',
  missingPlace: 'Partagez votre position ou écrivez votre adresse',
  note: 'Remarque (facultatif)', subtotal: 'Articles', delivery: 'Livraison', free: 'Gratuite', total: 'Total',
  toFree: (n) => `Encore ${n} MRU pour la livraison gratuite`, chooseZoneFirst: 'Choisissez votre quartier pour la livraison',
  confirm: 'Confirmer la commande', sending: 'Envoi…', empty: 'Ajoutez au moins un article',
  missing: 'Indiquez votre nom, téléphone et quartier', missingDims: 'Indiquez la longueur et la largeur de chaque pièce',
  thanks: 'Commande enregistrée', thanksText: (bus) => `Vous êtes inscrit sur la liste du ${bus}. Nous vous appelons la veille du passage pour la collecte.`,
  keepNumber: 'Gardez ce numéro pour suivre votre commande.',
  whatsapp: 'Envoyer sur WhatsApp', print: 'Imprimer', newOrder: 'Nouvelle commande',
  track: 'Suivre ma commande', trackTitle: 'Où en est ma commande ?', orderNumber: 'Numéro de commande', search: 'Rechercher',
  notFound: 'Aucune commande trouvée avec ce numéro et ce téléphone.', order: 'Commander',
  receipt: 'Reçu', date: 'Date', client: 'Client', qty: 'Qté', amount: 'Montant', item: 'Article',
  collectOn: 'Collecte prévue le', status: 'Statut', demo: 'Démo', footer: 'BestClean · Nouakchott',
}

const ar = {
  tagline: 'غسيل الزرابي والأفرشة، مع الاستلام من المنزل',
  start: 'ابدأ طلبي', freeFrom: (n) => `توصيل مجاني ابتداءً من ${n} أوقية`,
  how: [['تطلب', 'اختر أغراضك ويظهر السعر فورًا.'], ['نستلم', 'باص حيّك يمرّ عليك.'], ['نعيد', 'نظيفة ومطوية حتى باب بيتك.']],
  byM2: 'بالمتر المربع', byPiece: 'بالقطعة', summary: 'ملخص الطلب',
  delay: 'جاهز خلال 7 إلى 10 أيام', summaryEmpty: 'أضف أغراضك وستظهر هنا مع أسعارها.',
  errName: 'أدخل اسمك', errPhone: 'رقم من 8 أرقام، مثال: 22 11 22 33', errZone: 'اختر حيّك',
  faqTitle: 'أسئلة شائعة',
  faq: (seuil) => [
    ['كم تستغرق مدة الغسيل؟', 'من 7 إلى 10 أيام، لضمان تنظيف وتعقيم كاملين.'],
    ['كيف أقيس زربيتي؟', 'قِس الطول والعرض بالمتر. السعر = الطول × العرض × سعر المتر المربع.'],
    ['هل التوصيل مدفوع؟', `مجاني ابتداءً من ${seuil} أوقية (يختلف الحد حسب الحي). وتحت هذا المبلغ تُضاف رسوم التوصيل.`],
    ['متى يمرّ الباص؟', 'لكل حي باص خاص به. نتصل بك قبل يوم من مروره لتأكيد الاستلام.'],
    ['كيف أتابع طلبي؟', 'برقم الطلب ورقم هاتفك، في صفحة «تتبع طلبي».'],
  ],
  contactTitle: 'لديك سؤال؟ تواصل معنا', contactText: 'فريقنا يجيبك عبر الهاتف أو واتساب.',
  call: 'اتصال', whatsappUs: 'راسلنا على واتساب', waHello: 'السلام عليكم BestClean، ',
  orderWa: 'اطلب عبر واتساب', waOrder: 'السلام عليكم BestClean، أريد طلب غسيل.',
  errTooMany: 'تم تسجيل عدة طلبات بهذا الرقم مؤخرًا. حاول بعد ساعة أو اتصل بنا.',
  errBusy: 'الخدمة مزدحمة حاليًا. حاول بعد بضع دقائق.',
  heroTitle: 'نأتي لأخذها، نغسلها، ونعيدها إليك.',
  heroText: 'اختر أغراضك ويُحسب السعر تلقائيًا. نسجلك في قائمة باص حيّك.',
  articles: 'أغراضك', m2Hint: 'السعر بالمتر المربع: قِس الطول والعرض.',
  addPiece: 'إضافة قطعة', length: 'الطول (م)', width: 'العرض (م)',
  big: 'كبير', small: 'صغير', perM2: '/ م²', remove: 'حذف', toConfirm: 'السعر قيد التأكيد',
  yourInfo: 'معلوماتك', name: 'الاسم الكامل', phone: 'الهاتف', zone: 'الحي',
  chooseZone: 'اختر حيّك', address: 'أين نجدك؟', addressPh: 'مثال: خلف الصيدلية، المنزل الأزرق',
  placeHint: 'شارك موقعك، أو صف عنوانك.', addressPhOpt: 'تفاصيل اختيارية: الطابق، الباب…',
  geoUse: 'مشاركة موقعي', geoLoading: 'جارٍ تحديد الموقع…', geoSaved: 'تم حفظ الموقع', geoSee: 'عرض على الخريطة',
  geoDenied: 'تم رفض الوصول إلى الموقع. اكتب عنوانك أدناه.', geoError: 'تعذّر تحديد الموقع. اكتب عنوانك أدناه.',
  missingPlace: 'شارك موقعك أو اكتب عنوانك',
  note: 'ملاحظة (اختياري)', subtotal: 'الأغراض', delivery: 'التوصيل', free: 'مجاني', total: 'المجموع',
  toFree: (n) => `باقي ${n} أوقية للتوصيل المجاني`, chooseZoneFirst: 'اختر حيّك لحساب التوصيل',
  confirm: 'تأكيد الطلب', sending: 'جارٍ الإرسال…', empty: 'أضف غرضًا واحدًا على الأقل',
  missing: 'أدخل الاسم والهاتف والحي', missingDims: 'أدخل طول وعرض كل قطعة',
  thanks: 'تم تسجيل الطلب', thanksText: (bus) => `تم تسجيلك في قائمة ${bus}. سنتصل بك قبل يوم من مرور الباص.`,
  keepNumber: 'احتفظ بهذا الرقم لمتابعة طلبك.',
  whatsapp: 'إرسال عبر واتساب', print: 'طباعة', newOrder: 'طلب جديد',
  track: 'تتبع طلبي', trackTitle: 'أين وصل طلبي؟', orderNumber: 'رقم الطلب', search: 'بحث',
  notFound: 'لا يوجد طلب بهذا الرقم وهذا الهاتف.', order: 'اطلب',
  receipt: 'إيصال', date: 'التاريخ', client: 'الزبون', qty: 'الكمية', amount: 'المبلغ', item: 'الغرض',
  collectOn: 'موعد الاستلام', status: 'الحالة', demo: 'تجريبي', footer: 'BestClean · نواكشوط',
}

export const STATUTS = {
  en_attente: { fr: 'En attente du bus', ar: 'في انتظار الباص', tone: 'sand' },
  planifiee: { fr: 'Collecte planifiée', ar: 'الاستلام مبرمج', tone: 'sky' },
  collectee: { fr: 'Collectée', ar: 'تم الاستلام', tone: 'sky' },
  en_lavage: { fr: 'En lavage', ar: 'قيد الغسيل', tone: 'teal' },
  prete: { fr: 'Prête à livrer', ar: 'جاهز للتوصيل', tone: 'green' },
  livree: { fr: 'Livrée', ar: 'تم التوصيل', tone: 'done' },
  annulee: { fr: 'Annulée', ar: 'ملغى', tone: 'red' },
}
export const ETAPES = ['en_attente', 'planifiee', 'collectee', 'en_lavage', 'prete', 'livree']

const Ctx = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('bc-lang') || 'ar' } catch { return 'ar' } })
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try { localStorage.setItem('bc-lang', lang) } catch { /* ignore */ }
  }, [lang])
  const t = lang === 'ar' ? ar : fr
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
export const nomArticle = (x, lang) => (lang === 'ar' ? x.nom_ar ?? x.libelle_ar : x.nom_fr ?? x.libelle_fr)
export const autreNom = (x, lang) => (lang === 'ar' ? x.nom_fr ?? x.libelle_fr : x.nom_ar ?? x.libelle_ar)
