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
