-- Demande de collecte : le client envoie ses coordonnées sans choisir d'articles.
-- L'équipe mesure et ajoute les articles à la collecte (modifier_commande), ce qui calcule les prix.
-- Livraison : gratuite à partir de 900 MRU, sinon 200 MRU, pour tous les quartiers.

update zones set seuil_gratuit = 900, frais_livraison = 200;

create or replace function creer_commande(p_client jsonb, p_lignes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_zone   zones%rowtype;
  v_cmd    commandes%rowtype;
  v_sous   int := 0;
  v_frais  int := 0;
  v_admin  boolean := is_admin();
  v_tel    text := telephone_normalise(p_client->>'telephone');
  v_source text := coalesce(p_client->>'source', 'web');
  v_lat    numeric := (p_client->>'latitude')::numeric;
  v_lng    numeric := (p_client->>'longitude')::numeric;
begin
  if coalesce(trim(p_client->>'nom'), '') = '' or coalesce(trim(p_client->>'telephone'), '') = '' then
    raise exception 'Nom et téléphone obligatoires';
  end if;
  -- seule l'équipe peut enregistrer une commande prise par téléphone
  if v_source <> 'web' and not v_admin then v_source := 'web'; end if;

  if not v_admin then
    if v_tel !~ '^[234]\d{7}$' then
      raise exception 'Numéro de téléphone invalide';
    end if;
    if (select count(*) from commandes
        where telephone_normalise(telephone) = v_tel and created_at > now() - interval '1 hour') >= 3 then
      raise exception 'Trop de commandes avec ce numéro';
    end if;
    if (select count(*) from commandes where source = 'web' and created_at > now() - interval '10 minutes') >= 30 then
      raise exception 'Service momentanément saturé';
    end if;
  end if;

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

  -- Sans articles (demande de collecte), les montants restent à 0 jusqu'à la saisie par l'équipe
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 0 then
    v_sous := _inserer_lignes(v_cmd.id, p_lignes, true);
    v_frais := case when v_sous >= v_zone.seuil_gratuit then 0 else v_zone.frais_livraison end;
  end if;
  update commandes set sous_total = v_sous, frais_livraison = v_frais, total = v_sous + v_frais
  where id = v_cmd.id;

  return suivre_commande(v_cmd.numero, v_cmd.telephone);
end $$;
