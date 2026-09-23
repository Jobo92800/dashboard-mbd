-- ============================================================================
-- MA HQ · photos de profil
-- Espace « avatars » en lecture publique (une photo de profil n'est pas
-- confidentielle) ; chacun ne peut déposer ou supprimer que dans son dossier.
-- ============================================================================

alter table public.profiles add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- avatars/<id de la personne>/<fichier>.jpg
create policy "je dépose ma photo" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
create policy "je remplace ma photo" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "je supprime ma photo" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
