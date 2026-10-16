// Règles de prix BestClean — doivent rester identiques à creer_commande() dans supabase/schema.sql.
// Le serveur recalcule toujours les prix : ce fichier sert à l'affichage en direct.

export function prixUnitaire(article, ligne) {
  if (!article) return 0
  if (article.mode === 'm2') {
    const l = Number(ligne.longueur), w = Number(ligne.largeur)
    if (!(l > 0) || !(w > 0)) return 0
    return Math.round(l * w * article.prix_m2)
  }
  if (ligne.taille === 'petit' && article.prix_petit != null) return article.prix_petit
  return article.prix_grand ?? 0
}

export function montantLigne(article, ligne) {
  return prixUnitaire(article, ligne) * Math.max(1, Number(ligne.quantite) || 1)
}

// lignes : [{ article_id, taille?, longueur?, largeur?, quantite }]
export function calculerTotaux(lignes, articlesById, zone) {
  const sousTotal = lignes.reduce((s, l) => s + montantLigne(articlesById[l.article_id], l), 0)
  if (!zone) return { sousTotal, frais: 0, total: sousTotal, resteAvantGratuit: null }
  const gratuit = sousTotal >= zone.seuil_gratuit
  const frais = gratuit ? 0 : zone.frais_livraison
  return {
    sousTotal,
    frais,
    total: sousTotal + frais,
    resteAvantGratuit: gratuit ? 0 : zone.seuil_gratuit - sousTotal,
  }
}

export function surface(ligne) {
  const l = Number(ligne.longueur), w = Number(ligne.largeur)
  return l > 0 && w > 0 ? Math.round(l * w * 100) / 100 : 0
}

// \u2066…\u2069 isole le montant pour que « 200 MRU » reste dans le bon ordre en arabe
export const mru = (n) => `\u2066${Number(n || 0).toLocaleString('fr-FR')} MRU\u2069`
