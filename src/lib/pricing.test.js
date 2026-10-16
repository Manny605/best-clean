import { describe, it, expect } from 'vitest'
import { calculerTotaux, prixUnitaire } from './pricing.js'

const tapis = { id: 't', mode: 'm2', prix_m2: 60 }
const couverture = { id: 'c', mode: 'fixe', prix_grand: 180, prix_petit: 100 }
const sajjada = { id: 's', mode: 'fixe', prix_grand: 150, prix_petit: null }
const byId = { t: tapis, c: couverture, s: sajjada }
const tvz = { frais_livraison: 200, seuil_gratuit: 700 }
const arafat = { frais_livraison: 200, seuil_gratuit: 1000 }

describe('prix', () => {
  it('tapis 3×2 = 360 MRU', () => {
    expect(prixUnitaire(tapis, { longueur: 3, largeur: 2 })).toBe(360)
  })
  it('dimensions décimales arrondies', () => {
    expect(prixUnitaire(tapis, { longueur: 2.5, largeur: 1.7 })).toBe(255)
  })
  it('petite taille et taille unique', () => {
    expect(prixUnitaire(couverture, { taille: 'petit' })).toBe(100)
    expect(prixUnitaire(couverture, { taille: 'grand' })).toBe(180)
    expect(prixUnitaire(sajjada, { taille: 'petit' })).toBe(150)
  })
})

describe('livraison', () => {
  it('TVZ sous 700 → +200', () => {
    const r = calculerTotaux([{ article_id: 't', longueur: 3, largeur: 2, quantite: 1 }], byId, tvz)
    expect(r).toEqual({ sousTotal: 360, frais: 200, total: 560, resteAvantGratuit: 340 })
  })
  it('TVZ à exactement 700 → gratuit', () => {
    const r = calculerTotaux([{ article_id: 'c', taille: 'grand', quantite: 3 }, { article_id: 'c', taille: 'petit', quantite: 1 }, { article_id: 's', quantite: 1 }, { article_id: 'c', taille: 'grand', quantite: 0 }], byId, tvz)
    expect(r.sousTotal).toBe(540 + 100 + 150 + 180)
    expect(r.frais).toBe(0)
  })
  it('Arafat 720 → payant, 1000 → gratuit', () => {
    expect(calculerTotaux([{ article_id: 't', longueur: 4, largeur: 3, quantite: 1 }], byId, arafat).frais).toBe(200)
    expect(calculerTotaux([{ article_id: 't', longueur: 5, largeur: 10 / 3, quantite: 1 }], byId, arafat).frais).toBe(0)
  })
})
