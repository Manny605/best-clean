// Accès aux données. Avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, tout passe par Supabase.
// Sans ces variables, l'app tourne en "mode démo" : données gardées dans le navigateur.
import { createClient } from '@supabase/supabase-js'
import { ARTICLES, ZONES, BUS } from './seed.js'
import { prixUnitaire, calculerTotaux } from './pricing.js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isDemo = !URL || !KEY
// La version de démo publiée sur claude.ai ne peut pas ouvrir la fenêtre d'impression
export const canPrint = !import.meta.env.VITE_ARTIFACT
const sb = isDemo ? null : createClient(URL, KEY)
// Supabase Auth exige un email : un nom d'utilisateur devient "<nom>@bestclean.local"
export const loginEmail = (id) => (id.includes('@') ? id.trim() : `${id.trim().toLowerCase()}@bestclean.local`)

const tri = (x, y) => (x.ordre ?? 0) - (y.ordre ?? 0)
const FORMATS_LOGO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
function verifierLogo(file) {
  if (!FORMATS_LOGO[file.type]) throw new Error('Format accepté : PNG, JPEG ou WebP')
  if (file.size > 2 * 1024 * 1024) throw new Error('Image trop lourde : 2 Mo maximum')
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data }
const UTILISE = '23503' // code Postgres : la ligne est encore référencée ailleurs
// Supprime un article ou un quartier ; s'il est déjà dans des commandes, on le masque à la place.
async function supprimerOuMasquer(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id)
  if (!error) return 'supprime'
  if (error.code !== UTILISE) throw new Error(error.message)
  await sb.from(table).update({ actif: false }).eq('id', id).then(ok)
  return 'masque'
}

// ---------------------------------------------------------------- Supabase
const supabaseApi = {
  async getCatalog() {
    const [articles, zones, bus] = await Promise.all([
      sb.from('articles').select('*').order('ordre').then(ok),
      sb.from('zones').select('*').order('ordre').then(ok),
      sb.from('bus').select('*').order('nom').then(ok),
    ])
    return { articles, zones, bus }
  },
  createOrder: (client, lignes) => sb.rpc('creer_commande', { p_client: client, p_lignes: lignes }).then(ok),
  trackOrder: (numero, telephone) => sb.rpc('suivre_commande', { p_numero: numero, p_telephone: telephone }).then(ok),

  async getSession() { return (await sb.auth.getSession()).data.session },
  async signIn(identifiant, password) {
    const { error } = await sb.auth.signInWithPassword({ email: loginEmail(identifiant), password })
    if (error) throw new Error("Nom d'utilisateur ou mot de passe incorrect")
    const isAdmin = await sb.rpc('is_admin').then(ok)
    if (!isAdmin) { await sb.auth.signOut(); throw new Error("Ce compte n'est pas administrateur") }
  },
  signOut: () => sb.auth.signOut(),

  listOrders: () => sb.from('commandes')
    .select('*, lignes:lignes_commande(*), zone:zones(nom_fr,nom_ar), bus:bus(nom)')
    .order('created_at', { ascending: false }).limit(1000).then(ok),
  updateOrder: (id, patch) => sb.from('commandes').update(patch).eq('id', id).then(ok),
  // Remplace coordonnées et lignes ; prix et totaux recalculés par la base
  editOrder: (id, client, lignes) => sb.rpc('modifier_commande', { p_id: id, p_client: client, p_lignes: lignes }).then(ok),
  // Prévient à chaque création / modification de commande. Renvoie la fonction pour se désabonner.
  subscribeOrders(cb) {
    const ch = sb.channel('commandes-equipe')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, (p) => cb(p.eventType, p.new))
      .subscribe()
    return () => sb.removeChannel(ch)
  },
  sendBus: (busId, date) => sb.rpc('envoyer_bus', { p_bus_id: busId, p_date: date }).then(ok),
  updateArticle: (id, patch) => sb.from('articles').update(patch).eq('id', id).then(ok),
  createArticle: (row) => sb.from('articles').insert(row).then(ok),
  updateZone: (id, patch) => sb.from('zones').update(patch).eq('id', id).then(ok),
  createZone: (row) => sb.from('zones').insert(row).then(ok),
  updateBus: (id, patch) => sb.from('bus').update(patch).eq('id', id).then(ok),
  createBus: (row) => sb.from('bus').insert(row).then(ok),
  deleteArticle: (id) => supprimerOuMasquer('articles', id),
  deleteZone: (id) => supprimerOuMasquer('zones', id),
  async deleteBus(id) {
    const zones = await sb.from('zones').select('nom_fr').eq('bus_id', id).then(ok)
    if (zones.length) throw new Error(`Ce bus dessert encore : ${zones.map((z) => z.nom_fr).join(', ')}. Mettez ces quartiers sur un autre bus avant de le supprimer.`)
    const { error } = await sb.from('bus').delete().eq('id', id)
    if (error?.code === UTILISE) throw new Error('Ce bus a déjà des commandes : il ne peut pas être supprimé.')
    if (error) throw new Error(error.message)
    return 'supprime'
  },

  async getSettings() {
    const rows = await sb.from('reglages').select('cle, valeur').then(ok)
    return Object.fromEntries(rows.map((r) => [r.cle, r.valeur]))
  },
  // Le logo est rangé dans l'espace de stockage public « site » ; l'ancien fichier est supprimé
  async setLogo(file) {
    verifierLogo(file)
    const avant = (await this.getSettings()).logo_url
    const chemin = `logo/logo-${Date.now()}.${FORMATS_LOGO[file.type]}`
    const { error } = await sb.storage.from('site').upload(chemin, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) throw new Error(error.message)
    const url = sb.storage.from('site').getPublicUrl(chemin).data.publicUrl
    await sb.from('reglages').upsert({ cle: 'logo_url', valeur: url, updated_at: new Date().toISOString() }).then(ok)
    if (avant) this.supprimerFichier(avant)
    return url
  },
  async resetLogo() {
    const avant = (await this.getSettings()).logo_url
    await sb.from('reglages').delete().eq('cle', 'logo_url').then(ok)
    if (avant) this.supprimerFichier(avant)
  },
  supprimerFichier(url) {
    const chemin = url.split('/storage/v1/object/public/site/')[1]
    if (chemin) sb.storage.from('site').remove([chemin]) // sans attendre : un fichier orphelin n'est pas grave
  },
}

// ---------------------------------------------------------------- Démo
const KEY_DEMO = 'bestclean-demo-v3' // v3 : livraison gratuite dès 900 MRU
const clone = (x) => JSON.parse(JSON.stringify(x))
let mem = null

function load() {
  if (mem) return mem
  try { mem = JSON.parse(localStorage.getItem(KEY_DEMO)) } catch { /* stockage indisponible */ }
  if (!mem) { mem = { articles: clone(ARTICLES), zones: clone(ZONES), bus: clone(BUS), commandes: [], seq: 0, session: null }; seedOrders(mem) }
  return mem
}
function save() { try { localStorage.setItem(KEY_DEMO, JSON.stringify(mem)) } catch { /* ignore */ } }
const uid = () => Math.random().toString(36).slice(2, 10)
const wait = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 150))

function construireLignes(db, lignes) {
  const byId = Object.fromEntries(db.articles.map((x) => [x.id, x]))
  const out = lignes.map((l) => {
    const art = byId[l.article_id]
    const q = Math.max(1, Number(l.quantite) || 1)
    const pu = prixUnitaire(art, l)
    const m2 = art.mode === 'm2'
    return {
      id: uid(), article_id: art.id, libelle_fr: art.nom_fr, libelle_ar: art.nom_ar,
      taille: m2 || art.prix_petit == null ? null : (l.taille || 'grand'),
      longueur: m2 ? Number(l.longueur) : null, largeur: m2 ? Number(l.largeur) : null,
      quantite: q, prix_unitaire: pu, montant: pu * q,
    }
  })
  return { out, byId }
}

function buildOrder(db, client, lignes, extra = {}) {
  const zone = db.zones.find((z) => z.id === client.zone_id)
  if (!client.nom?.trim() || !client.telephone?.trim()) throw new Error('Nom et téléphone obligatoires')
  if (!zone) throw new Error('Zone inconnue')
  const { out, byId } = construireLignes(db, lignes)
  // Demande de collecte sans articles : montants à 0 jusqu'à la saisie par l'équipe (comme la base)
  const t = lignes.length ? calculerTotaux(lignes, byId, zone) : { sousTotal: 0, frais: 0, total: 0 }
  db.seq += 1
  const bus = db.bus.find((b) => b.id === zone.bus_id)
  return {
    id: uid(), numero: 'BC-' + String(db.seq).padStart(5, '0'),
    client_nom: client.nom.trim(), telephone: client.telephone.trim(), adresse: client.adresse || '', note: client.note || '',
    latitude: client.latitude ?? null, longitude: client.longitude ?? null,
    zone_id: zone.id, bus_id: zone.bus_id, sous_total: t.sousTotal, frais_livraison: t.frais, total: t.total,
    statut: 'en_attente', date_collecte: null, source: client.source || 'web', created_at: new Date().toISOString(),
    lignes: out, zone: { nom_fr: zone.nom_fr, nom_ar: zone.nom_ar }, bus: { nom: bus?.nom }, ...extra,
  }
}

function seedOrders(db) {
  const noms = ['Mariem Sall', 'Ahmed Salem', 'Fatimetou Mint Ely', 'Sidi Mohamed', 'Aïchetou Ba', 'Cheikh Brahim', 'Khadijetou Vall', 'Moussa Diop', 'Lemine Ahmed', 'Zeinabou Sy', 'Oumar Kane', 'Vatma Mint Sidi', 'Yahya Abdallahi', 'Mekfoula Bah', 'Brahim Ould Cheikh', 'Salka Mint Ahmed', 'Hawa Sow', 'El Hacen Moctar']
  const paniers = [
    [{ article_id: 'a-tapis', longueur: 3, largeur: 2 }, { article_id: 'a-couverture', taille: 'grand', quantite: 2 }],
    [{ article_id: 'a-rideau', taille: 'grand', quantite: 3 }],
    [{ article_id: 'a-tapis', longueur: 4, largeur: 3 }, { article_id: 'a-oreiller', taille: 'petit', quantite: 4 }],
    [{ article_id: 'a-couvre_lit', taille: 'petit', quantite: 1 }, { article_id: 'a-drap', taille: 'grand', quantite: 2 }],
    [{ article_id: 'a-sajjada', quantite: 2 }, { article_id: 'a-housse', taille: 'grand', quantite: 1 }],
  ]
  const zones = ['z-tvz', 'z-ksar', 'z-sebkha', 'z-tvz', 'z-arafat', 'z-mina', 'z-tvz', 'z-riyad', 'z-teyarett']
  const statuts = ['en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_attente', 'en_lavage', 'en_lavage', 'prete', 'livree', 'collectee', 'livree']
  noms.forEach((nom, i) => {
    const o = buildOrder(db, { nom, telephone: `4${(i * 7919 + 2210000) % 10000000}`.padEnd(8, '0'), zone_id: zones[i % zones.length], adresse: 'Près de la mosquée', source: i % 3 ? 'telephone' : 'web' }, paniers[i % paniers.length])
    o.statut = statuts[i]
    o.created_at = new Date(Date.now() - (noms.length - i) * 3.6e6 * 5).toISOString()
    db.commandes.unshift(o)
  })
}

const demoApi = {
  getCatalog: async () => { const db = load(); return wait({ articles: [...db.articles].sort(tri), zones: [...db.zones].sort(tri), bus: db.bus }) },
  async createOrder(client, lignes) {
    const db = load()
    const o = buildOrder(db, { ...client, source: db.session ? client.source : 'web' }, lignes)
    db.commandes.unshift(o); save(); return wait(o)
  },
  async trackOrder(numero, tel) {
    const d = (s) => String(s).replace(/\D/g, '')
    return wait(load().commandes.find((c) => c.numero.toUpperCase() === numero.trim().toUpperCase() && d(c.telephone) === d(tel)) || null)
  },
  getSession: async () => load().session,
  async signIn(identifiant, password) {
    if (!identifiant || !password) throw new Error("Nom d'utilisateur et mot de passe requis")
    load().session = { email: loginEmail(identifiant) }; save()
  },
  async signOut() { load().session = null; save() },
  listOrders: async () => wait(load().commandes),
  async updateOrder(id, patch) { Object.assign(load().commandes.find((c) => c.id === id), patch); save(); return wait(null) },
  async editOrder(id, client, lignes) {
    const db = load()
    const o = db.commandes.find((c) => c.id === id)
    if (!lignes.length) throw new Error('La commande est vide')
    if (!client.nom?.trim() || !client.telephone?.trim()) throw new Error('Nom et téléphone obligatoires')
    const zone = db.zones.find((z) => z.id === (client.zone_id || o.zone_id))
    const { out, byId } = construireLignes(db, lignes)
    const t = calculerTotaux(lignes, byId, zone)
    const bus = zone.id !== o.zone_id ? db.bus.find((b) => b.id === zone.bus_id) : null
    Object.assign(o, {
      client_nom: client.nom.trim(), telephone: client.telephone.trim(), adresse: client.adresse || '', note: client.note || '',
      zone_id: zone.id, zone: { nom_fr: zone.nom_fr, nom_ar: zone.nom_ar }, lignes: out,
      sous_total: t.sousTotal, frais_livraison: t.frais, total: t.total,
      ...(bus && { bus_id: bus.id, bus: { nom: bus.nom } }),
    })
    save(); return wait(null)
  },
  subscribeOrders: () => () => {}, // une seule personne en démo : rien à écouter
  async sendBus(busId, date) {
    let n = 0
    for (const c of load().commandes) if (c.bus_id === busId && c.statut === 'en_attente') { c.statut = 'planifiee'; c.date_collecte = date; n++ }
    save(); return wait(n)
  },
  async updateArticle(id, patch) { Object.assign(load().articles.find((x) => x.id === id), patch); save() },
  async createArticle(row) { load().articles.push({ id: uid(), actif: true, a_confirmer: false, ...row }); save() },
  async updateZone(id, patch) { Object.assign(load().zones.find((x) => x.id === id), patch); save() },
  async createZone(row) { load().zones.push({ id: uid(), actif: true, ...row }); save() },
  async updateBus(id, patch) { Object.assign(load().bus.find((x) => x.id === id), patch); save() },
  async createBus(row) { load().bus.push({ id: uid(), capacite: 30, ...row }); save() },
  async deleteArticle(id) {
    const db = load()
    if (db.commandes.some((c) => c.lignes.some((l) => l.article_id === id))) { db.articles.find((x) => x.id === id).actif = false; save(); return 'masque' }
    db.articles = db.articles.filter((x) => x.id !== id); save(); return 'supprime'
  },
  async deleteZone(id) {
    const db = load()
    if (db.commandes.some((c) => c.zone_id === id)) { db.zones.find((x) => x.id === id).actif = false; save(); return 'masque' }
    db.zones = db.zones.filter((x) => x.id !== id); save(); return 'supprime'
  },
  async deleteBus(id) {
    const db = load()
    const zones = db.zones.filter((z) => z.bus_id === id)
    if (zones.length) throw new Error(`Ce bus dessert encore : ${zones.map((z) => z.nom_fr).join(', ')}. Mettez ces quartiers sur un autre bus avant de le supprimer.`)
    if (db.commandes.some((c) => c.bus_id === id)) throw new Error('Ce bus a déjà des commandes : il ne peut pas être supprimé.')
    db.bus = db.bus.filter((x) => x.id !== id); save(); return 'supprime'
  },
  getSettings: async () => wait(load().reglages || {}),
  async setLogo(file) {
    verifierLogo(file)
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })
    const db = load(); db.reglages = { ...db.reglages, logo_url: url }; save(); return url
  },
  async resetLogo() { const db = load(); if (db.reglages) delete db.reglages.logo_url; save() },
  resetDemo() { mem = null; try { localStorage.removeItem(KEY_DEMO) } catch { /* ignore */ } },
}

export const api = isDemo ? demoApi : supabaseApi
