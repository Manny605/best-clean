-- Catalogue et quartiers alignés sur l'offre réelle de BestClean.
-- Relançable sans risque. Les prix restent modifiables dans l'onglet « Tarifs et quartiers ».

-- ---------- Articles
update articles set prix_grand = 100, prix_petit = 50 where code = 'rideau';
update articles set prix_grand = 200, prix_petit = null where code = 'couvre_lit';   -- taille unique
update articles set a_confirmer = false where code in ('moquette', 'natte');          -- 60 MRU/m² confirmés

insert into articles (code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, ordre) values
  ('zarbiya', 'Zarbiya', 'زربية', 'm2',   100,  null, null, 4),
  ('outaya',  'Outaya',  'وطاية', 'fixe', null, 50,   null, 13)
on conflict (code) do nothing;

update articles a set ordre = v.o from (values
  ('tapis', 1), ('moquette', 2), ('natte', 3), ('zarbiya', 4), ('couverture', 5), ('couvre_lit', 6),
  ('drap', 7), ('rideau', 8), ('oreiller', 9), ('tapis_priere', 10), ('sajjada', 11), ('housse', 12), ('outaya', 13)
) v(code, o) where a.code = v.code;

-- ---------- Quartiers : les 9 moughataas de Nouakchott + « autre »
-- Chaque moughataa suit le bus de son secteur : celui de Tevragh Zeina (nord-ouest)
-- ou celui d'Arafat (sud-est). Les anciens quartiers sont masqués, pas supprimés.
with ref as (
  select (select bus_id from zones where nom_fr = 'Tevragh Zeina' limit 1) as nord,
         (select bus_id from zones where nom_fr = 'Arafat' limit 1)        as sud
)
insert into zones (nom_fr, nom_ar, bus_id, frais_livraison, seuil_gratuit, ordre)
select v.fr, v.ar, case v.secteur when 'nord' then ref.nord else ref.sud end, 200, v.seuil, v.o
from ref, (values
  ('Ksar',       'لكصر',      'nord', 700,  2),
  ('Sebkha',     'السبخة',    'nord', 700,  3),
  ('Teyarett',   'تيارت',     'nord', 700,  4),
  ('Dar Naim',   'دار النعيم', 'nord', 700,  5),
  ('El Mina',    'الميناء',   'sud',  1000, 7),
  ('Riyad',      'الرياض',    'sud',  1000, 8),
  ('Toujounine', 'توجنين',    'sud',  1000, 9),
  ('Autre (préciser l''adresse)', 'مكان آخر (حدد العنوان)', 'nord', 1000, 10)
) v(fr, ar, secteur, seuil, o)
where not exists (select 1 from zones z where z.nom_fr = v.fr);

update zones set ordre = 1 where nom_fr = 'Tevragh Zeina';
update zones set ordre = 6 where nom_fr = 'Arafat';
update zones set actif = false where nom_fr in ('Ain Talh', 'Cité Plage', 'PK', 'Madrid');
