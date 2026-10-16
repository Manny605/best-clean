// Commandes de test dans Supabase, pour voir le tableau de bord rempli.
//   npm run donnees:test             → ajoute les commandes de test
//   npm run donnees:test:supprimer   → les supprime (et seulement elles)
// Il faut la clé service_role (Supabase > Project Settings > API) dans SUPABASE_SERVICE_ROLE_KEY.
// Les prix sont calculés par la base (creer_commande), comme pour une vraie commande.
import { readFileSync } from 'node:fs'

const MARQUE = '[données de test]'
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const URL_SB = env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SB || !KEY) {
  console.error('VITE_SUPABASE_URL (.env) et SUPABASE_SERVICE_ROLE_KEY (variable d\'environnement) sont obligatoires.')
  process.exit(1)
}

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(prefer && { Prefer: prefer }) },
    body: body && JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

if (process.argv.includes('--supprimer')) {
  const supprimees = await sb(`commandes?note=eq.${encodeURIComponent(MARQUE)}&select=numero`, { method: 'DELETE', prefer: 'return=representation' })
  console.log(`${supprimees.length} commandes de test supprimées.`)
  process.exit(0)
}

const deja = await sb(`commandes?note=eq.${encodeURIComponent(MARQUE)}&select=id`)
if (deja.length) {
  console.log(`${deja.length} commandes de test existent déjà. Lancez d'abord : npm run donnees:test:supprimer`)
  process.exit(0)
}

const articles = Object.fromEntries((await sb('articles?select=id,code')).map((a) => [a.code, a.id]))
const zones = Object.fromEntries((await sb('zones?select=id,nom_fr')).map((z) => [z.nom_fr, z.id]))
const A = (code, extra) => ({ article_id: articles[code], ...extra })

const paniers = [
  [A('tapis', { longueur: 3, largeur: 2 }), A('couverture', { taille: 'grand', quantite: 2 })],
  [A('rideau', { taille: 'grand', quantite: 3 })],
  [A('tapis', { longueur: 4, largeur: 3 }), A('oreiller', { taille: 'petit', quantite: 4 })],
  [A('couvre_lit', { taille: 'petit' }), A('drap', { taille: 'grand', quantite: 2 })],
  [A('sajjada', { quantite: 2 }), A('housse', { taille: 'grand' })],
  [A('moquette', { longueur: 5, largeur: 4 })],
  [A('tapis_priere', { taille: 'petit', quantite: 3 }), A('drap', { taille: 'petit', quantite: 2 })],
  [A('natte', { longueur: 2.5, largeur: 2 }), A('couverture', { taille: 'petit' })],
]
const noms = ['Mariem Sall', 'Ahmed Salem', 'Fatimetou Mint Ely', 'Sidi Mohamed', 'Aïchetou Ba', 'Cheikh Brahim', 'Khadijetou Vall', 'Moussa Diop',
  'Lemine Ahmed', 'Zeinabou Sy', 'Oumar Kane', 'Vatma Mint Sidi', 'Yahya Abdallahi', 'Mekfoula Bah', 'Brahim Ould Cheikh', 'Salka Mint Ahmed',
  'Hawa Sow', 'El Hacen Moctar', 'Aminetou Diallo', 'Mohamed Lemine', 'Toutou Mint Abdi', 'Abdallahi Sidina']
const quartiers = ['Tevragh Zeina', 'Ain Talh', 'Cité Plage', 'Arafat', 'PK', 'Madrid']
// Beaucoup en attente pour voir les bus se remplir, puis toutes les autres étapes
const statuts = ['en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente',
  'planifiee', 'planifiee', 'planifiee', 'collectee', 'collectee', 'en_lavage', 'en_lavage', 'en_lavage', 'prete', 'prete', 'livree', 'annulee']
const reperes = ['Près de la mosquée', 'Derrière la pharmacie, maison bleue', 'Face à l\'école', '', 'À côté de la boutique Ely', '']
const demain = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

for (const [i, nom] of noms.entries()) {
  const gps = i % 3 === 0
  const commande = await sb('rpc/creer_commande', {
    method: 'POST',
    body: {
      p_client: {
        nom,
        telephone: `00 00 00 ${String(i + 1).padStart(2, '0')}`, // faux numéros : aucun numéro mauritanien ne commence par 0
        zone_id: zones[quartiers[i % quartiers.length]],
        adresse: reperes[i % reperes.length] || (gps ? '' : 'Rue principale'),
        note: MARQUE,
        ...(gps && { latitude: 18.0858 + ((i * 37) % 50) / 1000, longitude: -15.9785 + ((i * 53) % 50) / 1000 }),
      },
      p_lignes: paniers[i % paniers.length],
    },
  })
  const statut = statuts[i]
  await sb(`commandes?id=eq.${commande.id}`, {
    method: 'PATCH',
    body: {
      statut,
      source: i % 3 === 1 ? 'telephone' : 'web',
      date_collecte: statut === 'planifiee' ? demain : null,
      created_at: new Date(Date.now() - (noms.length - i) * 7 * 3.6e6).toISOString(), // étalées sur ~6 jours
    },
  })
  console.log(`${commande.numero}  ${statut.padEnd(10)}  ${String(commande.total).padStart(5)} MRU  ${nom}`)
}
console.log(`\n${noms.length} commandes de test ajoutées. Pour les retirer : npm run donnees:test:supprimer`)
