-- Position GPS partagée par le client (facultative, en plus ou à la place de l'adresse écrite).

alter table commandes add column if not exists latitude  numeric(9,6);
alter table commandes add column if not exists longitude numeric(9,6);

-- p_client : {"nom","telephone","adresse","note","zone_id","source","latitude","longitude"}
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
