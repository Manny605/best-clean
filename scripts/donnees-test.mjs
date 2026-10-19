// Commandes de test dans Supabase, pour voir le tableau de bord rempli.
//   npm run donnees:test             → ajoute les commandes de test
//   npm run donnees:tout             → remet aussi le catalogue réel (articles manquants seulement)
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

// Catalogue réel de BestClean : seuls les articles absents (par code) sont ajoutés, rien n'est écrasé
const CATALOGUE = [
  ['tapis', 'Tapis', 'تركية', 'm2', 60, null, null], ['moquette', 'Moquette', 'مكت', 'm2', 60, null, null],
  ['natte', 'Natte', 'مفرشة', 'm2', 60, null, null], ['zarbiya', 'Zarbiya', 'زربية', 'm2', 100, null, null],
  ['couverture', 'Couverture', 'امبجو', 'fixe', null, 180, 100], ['couvre_lit', 'Couvre-lit', 'كوفرلي', 'fixe', null, 200, null],
  ['drap', 'Drap', 'دراب', 'fixe', null, 100, 50], ['rideau', 'Rideau', 'ريدوه', 'fixe', null, 100, 50],
  ['oreiller', 'Oreiller', 'وسادة', 'fixe', null, 30, 20], ['tapis_priere', 'Tapis de prière', 'مطلة صلوه', 'fixe', null, 200, 100],
  ['sajjada', 'Petit tapis', 'سجادة', 'fixe', null, 150, null], ['housse', 'Housse', 'هوس', 'fixe', null, 200, 100],
  ['outaya', 'Outaya', 'وطاية', 'fixe', null, 50, null],
]
if (process.argv.includes('--catalogue')) {
  const lignes = CATALOGUE.map(([code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit], i) => ({ code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, ordre: i + 1 }))
  const ajoutes = await sb('articles?on_conflict=code', { method: 'POST', body: lignes, prefer: 'resolution=ignore-duplicates,return=representation' })
  console.log(`Catalogue : ${ajoutes.length} article(s) ajouté(s), ${CATALOGUE.length - ajoutes.length} déjà présent(s).
`)
}

const deja = await sb(`commandes?note=eq.${encodeURIComponent(MARQUE)}&select=id`)
if (deja.length) {
  console.log(`${deja.length} commandes de test existent déjà. Lancez d'abord : npm run donnees:test:supprimer`)
  process.exit(0)
}

const actifs = await sb('articles?select=id,code,mode,prix_petit&actif=eq.true')
const articles = Object.fromEntries(actifs.map((a) => [a.code, a.id]))
const zones = (await sb('zones?select=id&actif=eq.true&order=ordre')).map((z) => z.id)
if (!actifs.length || !zones.length) { console.error('Il faut au moins un article et un quartier visibles (ou lancez npm run donnees:tout).'); process.exit(1) }
const A = (code, extra) => articles[code] && { article_id: articles[code], ...extra }

const paniers = [
  [A('tapis', { longueur: 3, largeur: 2 }), A('couverture', { taille: 'grand', quantite: 2 })],
  [A('rideau', { taille: 'grand', quantite: 3 })],
  [A('tapis', { longueur: 4, largeur: 3 }), A('oreiller', { taille: 'petit', quantite: 4 })],
  [A('couvre_lit', { taille: 'petit' }), A('drap', { taille: 'grand', quantite: 2 })],
  [A('sajjada', { quantite: 2 }), A('housse', { taille: 'grand' })],
  [A('moquette', { longueur: 5, largeur: 4 })],
  [A('tapis_priere', { taille: 'petit', quantite: 3 }), A('drap', { taille: 'petit', quantite: 2 })],
  [A('natte', { longueur: 2.5, largeur: 2 }), A('couverture', { taille: 'petit' })],
].map((p) => p.filter(Boolean))
// Paniers impossibles (articles absents du catalogue) : on prend les articles présents à la place
const auHasard = (i) => { const a = actifs[i % actifs.length]; return [a.mode === 'm2' ? { article_id: a.id, longueur: 3, largeur: 2 } : { article_id: a.id, taille: a.prix_petit != null ? 'grand' : undefined, quantite: 1 + (i % 3) }] }
const noms = ['Mariem Sall', 'Ahmed Salem', 'Fatimetou Mint Ely', 'Sidi Mohamed', 'Aïchetou Ba', 'Cheikh Brahim', 'Khadijetou Vall', 'Moussa Diop',
  'Lemine Ahmed', 'Zeinabou Sy', 'Oumar Kane', 'Vatma Mint Sidi', 'Yahya Abdallahi', 'Mekfoula Bah', 'Brahim Ould Cheikh', 'Salka Mint Ahmed',
  'Hawa Sow', 'El Hacen Moctar', 'Aminetou Diallo', 'Mohamed Lemine', 'Toutou Mint Abdi', 'Abdallahi Sidina']
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
        zone_id: zones[i % zones.length],
        adresse: reperes[i % reperes.length] || (gps ? '' : 'Rue principale'),
        note: MARQUE,
        ...(gps && { latitude: 18.0858 + ((i * 37) % 50) / 1000, longitude: -15.9785 + ((i * 53) % 50) / 1000 }),
      },
      p_lignes: paniers[i % paniers.length].length ? paniers[i % paniers.length] : auHasard(i),
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
