-- Réglages du site modifiables par l'équipe (pour commencer : le logo).

create table if not exists reglages (
  cle        text primary key,
  valeur     text,
  updated_at timestamptz not null default now()
);
alter table reglages enable row level security;
drop policy if exists "lecture publique reglages" on reglages;
create policy "lecture publique reglages" on reglages for select using (true);
drop policy if exists "admin reglages" on reglages;
create policy "admin reglages" on reglages for all using (is_admin()) with check (is_admin());

-- Espace de stockage public pour les images du site (logo…). Lecture publique, écriture équipe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe ajoute images site" on storage.objects;
create policy "equipe ajoute images site" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and public.is_admin());
drop policy if exists "equipe modifie images site" on storage.objects;
create policy "equipe modifie images site" on storage.objects for update to authenticated
  using (bucket_id = 'site' and public.is_admin()) with check (bucket_id = 'site' and public.is_admin());
drop policy if exists "equipe supprime images site" on storage.objects;
create policy "equipe supprime images site" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and public.is_admin());
