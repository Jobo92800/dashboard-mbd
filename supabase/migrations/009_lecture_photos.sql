-- ============================================================================
-- MA HQ · correctif photos de profil / de groupe
-- L'espace « avatars » est public en téléchargement, mais l'API de stockage
-- exige aussi une règle de LECTURE pour certaines opérations (remplacer,
-- supprimer). Sans elle, l'envoi d'une photo était refusé.
-- ============================================================================

create policy "photos lisibles par l'équipe" on storage.objects for select
  using (bucket_id = 'avatars' and public.is_active());
