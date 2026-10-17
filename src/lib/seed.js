// Données du mode démo — mêmes articles, prix et quartiers que la base Supabase.
export const BUS = [
  { id: 'bus-nord', nom: 'Bus Tevragh Zeina', capacite: 30 },
  { id: 'bus-sud', nom: 'Bus Arafat', capacite: 30 },
]

const z = (id, nom_fr, nom_ar, bus_id, seuil_gratuit, ordre) => ({ id, nom_fr, nom_ar, bus_id, frais_livraison: 200, seuil_gratuit, actif: true, ordre })

// Les 9 moughataas de Nouakchott + « autre » : nord-ouest sur un bus, sud-est sur l'autre
export const ZONES = [
  z('z-tvz', 'Tevragh Zeina', 'تفرغ زينة', 'bus-nord', 700, 1),
  z('z-ksar', 'Ksar', 'لكصر', 'bus-nord', 700, 2),
  z('z-sebkha', 'Sebkha', 'السبخة', 'bus-nord', 700, 3),
  z('z-teyarett', 'Teyarett', 'تيارت', 'bus-nord', 700, 4),
  z('z-darnaim', 'Dar Naim', 'دار النعيم', 'bus-nord', 700, 5),
  z('z-arafat', 'Arafat', 'عرفات', 'bus-sud', 1000, 6),
  z('z-mina', 'El Mina', 'الميناء', 'bus-sud', 1000, 7),
  z('z-riyad', 'Riyad', 'الرياض', 'bus-sud', 1000, 8),
  z('z-toujounine', 'Toujounine', 'توجنين', 'bus-sud', 1000, 9),
  z('z-autre', "Autre (préciser l'adresse)", 'مكان آخر (حدد العنوان)', 'bus-nord', 1000, 10),
]

const a = (code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, ordre) =>
  ({ id: 'a-' + code, code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, a_confirmer: false, actif: true, ordre })

export const ARTICLES = [
  a('tapis', 'Tapis', 'تركية', 'm2', 60, null, null, 1),
  a('moquette', 'Moquette', 'مكت', 'm2', 60, null, null, 2),
  a('natte', 'Natte', 'مفرشة', 'm2', 60, null, null, 3),
  a('zarbiya', 'Zarbiya', 'زربية', 'm2', 100, null, null, 4),
  a('couverture', 'Couverture', 'امبجو', 'fixe', null, 180, 100, 5),
  a('couvre_lit', 'Couvre-lit', 'كوفرلي', 'fixe', null, 200, null, 6),
  a('drap', 'Drap', 'دراب', 'fixe', null, 100, 50, 7),
  a('rideau', 'Rideau', 'ريدوه', 'fixe', null, 100, 50, 8),
  a('oreiller', 'Oreiller', 'وسادة', 'fixe', null, 30, 20, 9),
  a('tapis_priere', 'Tapis de prière', 'مطلة صلوه', 'fixe', null, 200, 100, 10),
  a('sajjada', 'Petit tapis', 'سجادة', 'fixe', null, 150, null, 11),
  a('housse', 'Housse', 'هوس', 'fixe', null, 200, 100, 12),
  a('outaya', 'Outaya', 'وطاية', 'fixe', null, 50, null, 13),
]
