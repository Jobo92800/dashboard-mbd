-- ============================================================================
-- MA HQ · tâches partagées entre plusieurs personnes
-- Une tâche confiée à plusieurs personnes reste UNE tâche (plus de doublons) :
-- elle apparaît chez chacune et, cochée une fois, elle est faite pour tous.
-- `assignee_id` est conservé (première personne) pour la compatibilité.
-- ============================================================================

alter table public.tasks add column assignee_ids uuid[] not null default '{}';
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null;
create index on public.tasks using gin (assignee_ids);

-- Fusion des doublons créés par l'ancien fonctionnement (« une tâche chacune ») :
-- même titre, même projet, même auteur, créées dans la même minute.
with groupes as (
  select (array_agg(id order by created_at))[1] as garde,
         array_agg(id) as ids,
         array_agg(distinct assignee_id) filter (where assignee_id is not null) as personnes,
         bool_and(status = 'fait') as toutes_faites
  from public.tasks
  group by title, project_id, created_by, date_trunc('minute', created_at)
  having count(*) > 1
), commentaires as (
  update public.task_comments c set task_id = g.garde
  from groupes g where c.task_id = any(g.ids) and c.task_id <> g.garde
  returning c.id
), fusion as (
  update public.tasks t
     set assignee_ids = g.personnes,
         assignee_id = g.personnes[1],
         status = case when g.toutes_faites then 'fait' else 'a_faire' end,
         done_at = case when g.toutes_faites then t.done_at else null end
    from groupes g where t.id = g.garde
  returning t.id
)
delete from public.tasks t using groupes g where t.id = any(g.ids) and t.id <> g.garde;

-- Règles d'accès : on voit / modifie une tâche rapide si on fait partie des personnes concernées.
drop policy "tâches lisibles" on public.tasks;
create policy "tâches lisibles" on public.tasks for select using (
  public.is_admin() or (public.is_active() and (
    (project_id is not null and public.is_project_member(project_id))
    or (project_id is null and (auth.uid() = any(assignee_ids) or assignee_id = auth.uid() or created_by = auth.uid()))
  )));

drop policy "tâches modifiées" on public.tasks;
create policy "tâches modifiées" on public.tasks for update using (
  public.is_admin() or (public.is_active() and (
    (project_id is not null and public.is_project_member(project_id))
    or (project_id is null and (auth.uid() = any(assignee_ids) or assignee_id = auth.uid() or created_by = auth.uid()))
  )));

drop policy "tâches supprimées" on public.tasks;
create policy "tâches supprimées" on public.tasks for delete using (
  public.is_admin() or (public.is_active() and (
    created_by = auth.uid() or (project_id is null and (auth.uid() = any(assignee_ids) or assignee_id = auth.uid()))
  )));

-- Commentaires et pièces jointes suivent la même règle de visibilité.
create or replace function public.can_see_task(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tasks t where t.id = tid and (
      public.is_admin() or (public.is_active() and (
        (t.project_id is not null and public.is_project_member(t.project_id))
        or (t.project_id is null and (auth.uid() = any(t.assignee_ids) or t.assignee_id = auth.uid() or t.created_by = auth.uid()))
      ))
    )
  );
$$;
