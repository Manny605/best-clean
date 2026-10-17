-- =====================================================================
-- BestClean — schéma Supabase
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Peut être relancé sans risque (idempotent pour les tables et fonctions).
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists bus (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  capacite   int  not null default 30,          -- on envoie le bus au-delà de ce nombre de clients
  created_at timestamptz not null default now()
);

create table if not exists zones (
  id              uuid primary key default gen_random_uuid(),
  nom_fr          text not null,
  nom_ar          text not null,
  bus_id          uuid references bus(id) on delete set null,
  frais_livraison int  not null default 200,     -- MRU, appliqués si la facture est sous le seuil
  seuil_gratuit   int  not null default 700,     -- MRU, livraison gratuite à partir de ce montant
  actif           boolean not null default true,
  ordre           int not null default 0
);

-- mode = 'm2'   : prix = longueur × largeur × prix_m2
-- mode = 'fixe' : prix_grand / prix_petit (prix_petit null = taille unique)
create table if not exists articles (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  nom_fr      text not null,
  nom_ar      text not null,
  mode        text not null check (mode in ('m2','fixe')),
  prix_m2     int,
  prix_grand  int,
  prix_petit  int,
  a_confirmer boolean not null default false,    -- prix provisoire, à valider par le gérant
  actif       boolean not null default true,
  ordre       int not null default 0
);

create sequence if not exists commande_seq start 1;

create table if not exists commandes (
  id              uuid primary key default gen_random_uuid(),
  numero          text unique not null default ('BC-' || lpad(nextval('commande_seq')::text, 5, '0')),
  client_nom      text not null,
  telephone       text not null,
  adresse         text,
  note            text,
  zone_id         uuid references zones(id),
  bus_id          uuid references bus(id),
  sous_total      int not null default 0,
  frais_livraison int not null default 0,
  total           int not null default 0,
  statut          text not null default 'en_attente'
                  check (statut in ('en_attente','planifiee','collectee','en_lavage','prete','livree','annulee')),
  date_collecte   date,
  source          text not null default 'web' check (source in ('web','telephone')),
  created_at      timestamptz not null default now()
);
create index if not exists commandes_bus_statut on commandes (bus_id, statut);
-- position GPS partagée par le client (facultative)
alter table commandes add column if not exists latitude  numeric(9,6);
alter table commandes add column if not exists longitude numeric(9,6);

create table if not exists lignes_commande (
  id            uuid primary key default gen_random_uuid(),
  commande_id   uuid not null references commandes(id) on delete cascade,
  article_id    uuid references articles(id),
  libelle_fr    text not null,
  libelle_ar    text not null,
  taille        text check (taille in ('grand','petit')),
  longueur      numeric(6,2),
  largeur       numeric(6,2),
  quantite      int not null default 1 check (quantite > 0),
  prix_unitaire int not null,
  montant       int not null
);

-- Comptes administrateurs : ajouter l'id d'un utilisateur Supabase Auth ici.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- Sécurité (RLS) --------------------------------------------

alter table bus             enable row level security;
alter table zones           enable row level security;
alter table articles        enable row level security;
alter table commandes       enable row level security;
alter table lignes_commande enable row level security;
alter table admins          enable row level security;

drop policy if exists "lecture publique bus" on bus;
create policy "lecture publique bus" on bus for select using (true);
drop policy if exists "admin bus" on bus;
create policy "admin bus" on bus for all using (is_admin()) with check (is_admin());

drop policy if exists "lecture publique zones" on zones;
create policy "lecture publique zones" on zones for select using (actif or is_admin());
drop policy if exists "admin zones" on zones;
create policy "admin zones" on zones for all using (is_admin()) with check (is_admin());

drop policy if exists "lecture publique articles" on articles;
create policy "lecture publique articles" on articles for select using (actif or is_admin());
drop policy if exists "admin articles" on articles;
create policy "admin articles" on articles for all using (is_admin()) with check (is_admin());

-- Les clients ne lisent jamais directement les commandes : ils passent par
-- creer_commande() et suivre_commande(). Seuls les admins ont accès aux tables.
drop policy if exists "admin commandes" on commandes;
create policy "admin commandes" on commandes for all using (is_admin()) with check (is_admin());
drop policy if exists "admin lignes" on lignes_commande;
create policy "admin lignes" on lignes_commande for all using (is_admin()) with check (is_admin());
drop policy if exists "admin voit admins" on admins;
create policy "admin voit admins" on admins for select using (is_admin());

-- ---------- Création d'une commande (prix recalculés côté serveur) ----
-- p_client : {"nom","telephone","adresse","note","zone_id","source","latitude","longitude"}
-- p_lignes : [{"article_id","taille","longueur","largeur","quantite"}]

create or replace function creer_commande(p_client jsonb, p_lignes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_zone   zones%rowtype;
  v_art    articles%rowtype;
  v_ligne  jsonb;
  v_qte    int;
  v_pu     int;
  v_l      numeric;
  v_w      numeric;
  v_taille text;
  v_sous   int := 0;
  v_frais  int;
  v_cmd    commandes%rowtype;
  v_source text := coalesce(p_client->>'source', 'web');
  v_lat    numeric := (p_client->>'latitude')::numeric;
  v_lng    numeric := (p_client->>'longitude')::numeric;
begin
  if coalesce(trim(p_client->>'nom'), '') = '' or coalesce(trim(p_client->>'telephone'), '') = '' then
    raise exception 'Nom et téléphone obligatoires';
  end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'La commande est vide';
  end if;
  -- seule l'équipe peut enregistrer une commande prise par téléphone
  if v_source <> 'web' and not is_admin() then v_source := 'web'; end if;
  -- position incohérente : on l'ignore plutôt que de bloquer la commande
  if v_lat is null or v_lng is null or abs(v_lat) > 90 or abs(v_lng) > 180 then
    v_lat := null; v_lng := null;
  end if;

  select * into v_zone from zones where id = (p_client->>'zone_id')::uuid and actif;
  if not found then raise exception 'Zone inconnue'; end if;

  insert into commandes (client_nom, telephone, adresse, note, zone_id, bus_id, source, latitude, longitude)
  values (trim(p_client->>'nom'), trim(p_client->>'telephone'), p_client->>'adresse',
          p_client->>'note', v_zone.id, v_zone.bus_id, v_source, round(v_lat, 6), round(v_lng, 6))
  returning * into v_cmd;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    select * into v_art from articles where id = (v_ligne->>'article_id')::uuid and actif;
    if not found then raise exception 'Article inconnu'; end if;
    v_qte := greatest(coalesce((v_ligne->>'quantite')::int, 1), 1);
    v_taille := null; v_l := null; v_w := null;

    if v_art.mode = 'm2' then
      v_l := (v_ligne->>'longueur')::numeric;
      v_w := (v_ligne->>'largeur')::numeric;
      if v_l is null or v_w is null or v_l <= 0 or v_w <= 0 then
        raise exception 'Dimensions manquantes pour %', v_art.nom_fr;
      end if;
      v_pu := round(v_l * v_w * v_art.prix_m2);
    else
      v_taille := case when v_art.prix_petit is null then null
                       else coalesce(v_ligne->>'taille', 'grand') end;
      v_pu := case when v_taille = 'petit' then v_art.prix_petit else v_art.prix_grand end;
    end if;

    insert into lignes_commande (commande_id, article_id, libelle_fr, libelle_ar, taille,
                                 longueur, largeur, quantite, prix_unitaire, montant)
    values (v_cmd.id, v_art.id, v_art.nom_fr, v_art.nom_ar, v_taille, v_l, v_w, v_qte, v_pu, v_pu * v_qte);
    v_sous := v_sous + v_pu * v_qte;
  end loop;

  v_frais := case when v_sous >= v_zone.seuil_gratuit then 0 else v_zone.frais_livraison end;

  update commandes set sous_total = v_sous, frais_livraison = v_frais, total = v_sous + v_frais
  where id = v_cmd.id;

  return suivre_commande(v_cmd.numero, v_cmd.telephone);
end $$;

-- Suivi par le client : il faut le numéro ET le téléphone de la commande.
create or replace function suivre_commande(p_numero text, p_telephone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'numero', c.numero, 'client_nom', c.client_nom, 'telephone', c.telephone,
    'adresse', c.adresse, 'note', c.note, 'statut', c.statut, 'date_collecte', c.date_collecte,
    'latitude', c.latitude, 'longitude', c.longitude,
    'sous_total', c.sous_total, 'frais_livraison', c.frais_livraison, 'total', c.total,
    'created_at', c.created_at,
    'zone', jsonb_build_object('nom_fr', z.nom_fr, 'nom_ar', z.nom_ar),
    'bus',  jsonb_build_object('nom', b.nom),
    'lignes', coalesce((select jsonb_agg(to_jsonb(l) order by l.libelle_fr)
                        from lignes_commande l where l.commande_id = c.id), '[]'::jsonb)
  )
  from commandes c
  left join zones z on z.id = c.zone_id
  left join bus b on b.id = c.bus_id
  where upper(c.numero) = upper(trim(p_numero))
    and regexp_replace(c.telephone, '\D', '', 'g') = regexp_replace(p_telephone, '\D', '', 'g');
$$;

-- Envoi d'un bus : toutes les commandes en attente du bus passent en "collecte planifiée".
create or replace function envoyer_bus(p_bus_id uuid, p_date date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Accès refusé'; end if;
  update commandes set statut = 'planifiee', date_collecte = p_date
  where bus_id = p_bus_id and statut = 'en_attente';
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function creer_commande(jsonb, jsonb) to anon, authenticated;
grant execute on function suivre_commande(text, text)  to anon, authenticated;
grant execute on function envoyer_bus(uuid, date)       to authenticated;

-- ---------- Données de départ -----------------------------------------
-- Les prix marqués a_confirmer = true sont provisoires : à corriger dans
-- l'onglet "Tarifs" du tableau de bord.

insert into bus (nom)
select v from (values ('Bus Tevragh Zeina'), ('Bus Arafat')) t(v)
where not exists (select 1 from bus);

insert into zones (nom_fr, nom_ar, bus_id, frais_livraison, seuil_gratuit, ordre)
select z.nom_fr, z.nom_ar, b.id, z.frais, z.seuil, z.ordre
from (values
  ('Tevragh Zeina', 'تفرغ زينة', 'Bus Tevragh Zeina', 200, 700, 1),
  ('Ain Talh',      'عين الطلح', 'Bus Tevragh Zeina', 200, 700, 2),
  ('Cité Plage',    'سيتي بلاج', 'Bus Tevragh Zeina', 200, 700, 3),
  ('Arafat',        'عرفات',     'Bus Arafat',        200, 1000, 4),
  ('PK',            'بي كا',      'Bus Arafat',        200, 1000, 5),
  ('Madrid',        'مدريد',     'Bus Arafat',        200, 1000, 6)
) z(nom_fr, nom_ar, bus_nom, frais, seuil, ordre)
join bus b on b.nom = z.bus_nom
where not exists (select 1 from zones);

insert into articles (code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, a_confirmer, ordre)
select * from (values
  ('tapis',        'Tapis',            'تركية',     'm2',   60,   null::int, null::int, false, 1),
  ('moquette',     'Moquette',         'مكت',       'm2',   60,   null, null, true,  2),
  ('natte',        'Natte',            'مفرشة',     'm2',   60,   null, null, true,  3),
  ('couverture',   'Couverture',       'امبجو',     'fixe', null, 180,  100,  false, 4),
  ('couvre_lit',   'Couvre-lit',       'كوفرلي',    'fixe', null, 200,  100,  false, 5),
  ('drap',         'Drap',             'دراب',      'fixe', null, 100,  50,   false, 6),
  ('rideau',       'Rideau',           'ريدوه',     'fixe', null, 200,  100,  false, 7),
  ('oreiller',     'Oreiller',         'وسادة',     'fixe', null, 30,   20,   false, 8),
  ('tapis_priere', 'Tapis de prière',  'مطلة صلوه', 'fixe', null, 200,  100,  false, 9),
  ('sajjada',      'Petit tapis',      'سجادة',     'fixe', null, 150,  null, false, 10),
  ('housse',       'Housse',           'هوس',       'fixe', null, 200,  100,  false, 11)
) a(code, nom_fr, nom_ar, mode, prix_m2, prix_grand, prix_petit, a_confirmer, ordre)
on conflict (code) do nothing;

-- =====================================================================
-- Ajouts ultérieurs (identiques aux migrations, relançables sans risque)
-- =====================================================================

-- Modification d'une commande par l'équipe (mesures réelles à la collecte, articles, coordonnées)
-- + temps réel sur les commandes pour l'espace équipe.

-- Calcul et insertion des lignes : une seule version des règles de prix, partagée par
-- creer_commande() et modifier_commande(). Renvoie le sous-total.
create or replace function _inserer_lignes(p_commande uuid, p_lignes jsonb, p_actifs_seulement boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_art    articles%rowtype;
  v_ligne  jsonb;
  v_qte    int;
  v_pu     int;
  v_l      numeric;
  v_w      numeric;
  v_taille text;
  v_sous   int := 0;
begin
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'La commande est vide';
  end if;
  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    select * into v_art from articles
    where id = (v_ligne->>'article_id')::uuid and (actif or not p_actifs_seulement);
    if not found then raise exception 'Article inconnu'; end if;
    v_qte := greatest(coalesce((v_ligne->>'quantite')::int, 1), 1);
    v_taille := null; v_l := null; v_w := null;

    if v_art.mode = 'm2' then
      v_l := (v_ligne->>'longueur')::numeric;
      v_w := (v_ligne->>'largeur')::numeric;
      if v_l is null or v_w is null or v_l <= 0 or v_w <= 0 then
        raise exception 'Dimensions manquantes pour %', v_art.nom_fr;
      end if;
      v_pu := round(v_l * v_w * v_art.prix_m2);
    else
      v_taille := case when v_art.prix_petit is null then null
                       else coalesce(v_ligne->>'taille', 'grand') end;
      v_pu := case when v_taille = 'petit' then v_art.prix_petit else v_art.prix_grand end;
    end if;

    insert into lignes_commande (commande_id, article_id, libelle_fr, libelle_ar, taille,
                                 longueur, largeur, quantite, prix_unitaire, montant)
    values (p_commande, v_art.id, v_art.nom_fr, v_art.nom_ar, v_taille, v_l, v_w, v_qte, v_pu, v_pu * v_qte);
    v_sous := v_sous + v_pu * v_qte;
  end loop;
  return v_sous;
end $$;
-- Fonction interne : jamais appelable directement depuis le site
revoke execute on function _inserer_lignes(uuid, jsonb, boolean) from public, anon, authenticated;

-- p_client : {"nom","telephone","adresse","note","zone_id","source","latitude","longitude"}
create or replace function creer_commande(p_client jsonb, p_lignes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_zone   zones%rowtype;
  v_cmd    commandes%rowtype;
  v_sous   int;
  v_frais  int;
  v_source text := coalesce(p_client->>'source', 'web');
  v_lat    numeric := (p_client->>'latitude')::numeric;
  v_lng    numeric := (p_client->>'longitude')::numeric;
begin
  if coalesce(trim(p_client->>'nom'), '') = '' or coalesce(trim(p_client->>'telephone'), '') = '' then
    raise exception 'Nom et téléphone obligatoires';
  end if;
  -- seule l'équipe peut enregistrer une commande prise par téléphone
  if v_source <> 'web' and not is_admin() then v_source := 'web'; end if;
  -- position incohérente : on l'ignore plutôt que de bloquer la commande
  if v_lat is null or v_lng is null or abs(v_lat) > 90 or abs(v_lng) > 180 then
    v_lat := null; v_lng := null;
  end if;

  select * into v_zone from zones where id = (p_client->>'zone_id')::uuid and actif;
  if not found then raise exception 'Zone inconnue'; end if;

  insert into commandes (client_nom, telephone, adresse, note, zone_id, bus_id, source, latitude, longitude)
  values (trim(p_client->>'nom'), trim(p_client->>'telephone'), p_client->>'adresse',
          p_client->>'note', v_zone.id, v_zone.bus_id, v_source, round(v_lat, 6), round(v_lng, 6))
  returning * into v_cmd;

  v_sous := _inserer_lignes(v_cmd.id, p_lignes, true);
  v_frais := case when v_sous >= v_zone.seuil_gratuit then 0 else v_zone.frais_livraison end;
  update commandes set sous_total = v_sous, frais_livraison = v_frais, total = v_sous + v_frais
  where id = v_cmd.id;

  return suivre_commande(v_cmd.numero, v_cmd.telephone);
end $$;

-- Réservé à l'équipe. Remplace les coordonnées et toutes les lignes, puis recalcule les totaux.
-- Si le quartier change, la commande suit le bus du nouveau quartier.
create or replace function modifier_commande(p_id uuid, p_client jsonb, p_lignes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cmd   commandes%rowtype;
  v_zone  zones%rowtype;
  v_sous  int;
  v_frais int;
begin
  if not is_admin() then raise exception 'Accès refusé'; end if;
  select * into v_cmd from commandes where id = p_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if coalesce(trim(p_client->>'nom'), '') = '' or coalesce(trim(p_client->>'telephone'), '') = '' then
    raise exception 'Nom et téléphone obligatoires';
  end if;
  select * into v_zone from zones where id = coalesce((p_client->>'zone_id')::uuid, v_cmd.zone_id);
  if not found then raise exception 'Zone inconnue'; end if;

  delete from lignes_commande where commande_id = p_id;
  v_sous := _inserer_lignes(p_id, p_lignes, false);
  v_frais := case when v_sous >= v_zone.seuil_gratuit then 0 else v_zone.frais_livraison end;

  update commandes set
    client_nom = trim(p_client->>'nom'),
    telephone  = trim(p_client->>'telephone'),
    adresse    = p_client->>'adresse',
    note       = p_client->>'note',
    zone_id    = v_zone.id,
    bus_id     = case when v_zone.id <> v_cmd.zone_id then v_zone.bus_id else v_cmd.bus_id end,
    sous_total = v_sous, frais_livraison = v_frais, total = v_sous + v_frais
  where id = p_id;
end $$;

grant execute on function modifier_commande(uuid, jsonb, jsonb) to authenticated;

-- Temps réel : l'espace équipe est prévenu des nouvelles commandes (les règles RLS s'appliquent)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'commandes') then
    alter publication supabase_realtime add table commandes;
  end if;
end $$;
