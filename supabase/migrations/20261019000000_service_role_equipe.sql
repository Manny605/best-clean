-- La clé serveur secrète (service_role) est traitée comme l'équipe : elle contourne déjà
-- toutes les règles d'accès, elle doit aussi passer les contrôles anti-abus de creer_commande()
-- (utile pour les scripts d'administration, ex. npm run donnees:test).
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.role() = 'service_role', false)
      or exists (select 1 from admins where user_id = auth.uid());
$$;
