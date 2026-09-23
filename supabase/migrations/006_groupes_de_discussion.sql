-- ============================================================================
-- MA HQ · groupes de discussion : photo, description, admins du groupe,
-- sourdine / épingle par personne, « Vu par », suppression de groupe
-- ============================================================================

alter table public.conversations
  add column avatar_url text,
  add column description text not null default '',
  add column admin_ids uuid[] not null default '{}';

-- Groupes existants : le créateur devient admin ; discussions à deux : les deux.
update public.conversations
  set admin_ids = case
    when title is null and cardinality(member_ids) <= 2 then member_ids
    when created_by is not null then array[created_by]
    else member_ids[1:1] end;

alter table public.reads
  add column muted boolean not null default false,
  add column pinned boolean not null default false;

-- « Vu par » : les membres d'une conversation voient la dernière lecture des autres.
drop policy "lectures lisibles" on public.reads;
create policy "lectures lisibles" on public.reads for select using (public.in_conversation(conversation_id));

create or replace function public.is_conv_manager(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from conversations where id = cid and auth.uid() = any(admin_ids) and public.is_active()
  );
$$;

-- Un simple membre d'un groupe peut épingler des messages et quitter le groupe,
-- mais pas le renommer, changer sa photo, gérer les membres ou les admins.
create or replace function public.protect_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() = any(old.admin_ids)
     or (old.title is null and cardinality(old.member_ids) <= 2) then
    return new;
  end if;
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.avatar_url is distinct from old.avatar_url
     or new.admin_ids is distinct from old.admin_ids
     or not (new.member_ids = old.member_ids or new.member_ids = array_remove(old.member_ids, auth.uid())) then
    raise exception 'Seul un administrateur du groupe peut faire cette modification.';
  end if;
  return new;
end $$;

create trigger protect_conversation before update on public.conversations
for each row execute function public.protect_conversation();

-- Supprimer : admins du groupe (ou de MA HQ) ; une discussion à deux, par l'un des deux.
drop policy "conversations supprimées" on public.conversations;
create policy "conversations supprimées" on public.conversations for delete using (
  public.is_conv_manager(id)
  or (title is null and cardinality(member_ids) <= 2 and auth.uid() = any(member_ids) and public.is_active()));

-- Photos de groupe : avatars/groupes/<id du groupe>/<fichier>.jpg
create policy "photo de groupe déposée" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'groupes'
              and public.is_conv_manager(((storage.foldername(name))[2])::uuid));
create policy "photo de groupe remplacée" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'groupes'
         and public.is_conv_manager(((storage.foldername(name))[2])::uuid));
create policy "photo de groupe supprimée" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'groupes'
         and public.is_conv_manager(((storage.foldername(name))[2])::uuid));
