// Coordonnées affichées sur le site. Numéros mauritaniens à 8 chiffres (l'indicatif 222 est ajouté pour WhatsApp).
// Appels : numéros de l'enseigne de la boutique. WhatsApp : numéro qui reçoit les commandes sur l'ancien site.
export const TELEPHONES = ['41 38 75 75', '31 38 75 75']
export const WHATSAPP = '41 38 75 85'

export const lienTel = (n) => `tel:+222${n.replace(/\D/g, '')}`
