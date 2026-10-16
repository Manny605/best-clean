// Données de départ — identiques à la fin de supabase/schema.sql.
export const BUS = [
  { id: 'bus-tvz', nom: 'Bus Tevragh Zeina', capacite: 30 },
  { id: 'bus-arafat', nom: 'Bus Arafat', capacite: 30 },
]

export const ZONES = [
  { id: 'z-tvz', nom_fr: 'Tevragh Zeina', nom_ar: 'تفرغ زينة', bus_id: 'bus-tvz', frais_livraison: 200, seuil_gratuit: 700, actif: true, ordre: 1 },
  { id: 'z-aintalh', nom_fr: 'Ain Talh', nom_ar: 'عين الطلح', bus_id: 'bus-tvz', frais_livraison: 200, seuil_gratuit: 700, actif: true, ordre: 2 },
  { id: 'z-cite', nom_fr: 'Cité Plage', nom_ar: 'سيتي بلاج', bus_id: 'bus-tvz', frais_livraison: 200, seuil_gratuit: 700, actif: true, ordre: 3 },
  { id: 'z-arafat', nom_fr: 'Arafat', nom_ar: 'عرفات', bus_id: 'bus-arafat', frais_livraison: 200, seuil_gratuit: 1000, actif: true, ordre: 4 },
  { id: 'z-pk', nom_fr: 'PK', nom_ar: 'بي كا', bus_id: 'bus-arafat', frais_livraison: 200, seuil_gratuit: 1000, actif: true, ordre: 5 },
  { id: 'z-madrid', nom_fr: 'Madrid', nom_ar: 'مدريد', bus_id: 'bus-arafat', frais_livraison: 200, seuil_gratuit: 1000, actif: true, ordre: 6 },
]

const a = (code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, ordre, a_confirmer = false) =>
  ({ id: 'a-' + code, code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, a_confirmer, actif: true, ordre })

export const ARTICLES = [
  a('tapis', 'Tapis', 'تركية', 'm2', 60, null, null, 1),
  a('moquette', 'Moquette', 'مكت', 'm2', 60, null, null, 2, true),
  a('natte', 'Natte', 'مفرشة', 'm2', 60, null, null, 3, true),
  a('couverture', 'Couverture', 'امبجو', 'fixe', null, 180, 100, 4),
  a('couvre_lit', 'Couvre-lit', 'كوفرلي', 'fixe', null, 200, 100, 5),
  a('drap', 'Drap', 'دراب', 'fixe', null, 100, 50, 6),
  a('rideau', 'Rideau', 'ريدوه', 'fixe', null, 200, 100, 7),
  a('oreiller', 'Oreiller', 'وسادة', 'fixe', null, 30, 20, 8),
  a('tapis_priere', 'Tapis de prière', 'مطلة صلوه', 'fixe', null, 200, 100, 9),
  a('sajjada', 'Petit tapis', 'سجادة', 'fixe', null, 150, null, 10),
  a('housse', 'Housse', 'هوس', 'fixe', null, 200, 100, 11),
]
