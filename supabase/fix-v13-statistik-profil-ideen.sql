-- ============================================================
-- FIX V13: Statistik/Profil/App-Ideen/Freunde
-- Bitte im Supabase SQL Editor nach den V10-V12-Skripten ausführen.
-- ============================================================

-- Start-Abzeichen für bestehende und neue Nutzer absichern
insert into user_badges (user_id, badge_id)
select id, 'anfaenger'
from profiles
on conflict do nothing;

create or replace function ensure_initial_badge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into user_badges (user_id, badge_id)
  values (auth.uid(), 'anfaenger')
  on conflict do nothing;
end;
$$;
grant execute on function ensure_initial_badge() to authenticated;

-- Freunde eines Profils anzeigen
create or replace function get_profile_friends(p_user_id uuid)
returns table(id uuid, name text, avatar_url text, xp integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Eigenes Profil darf immer die eigenen Freunde sehen.
  -- Fremde Profile nur, wenn man mit dem Profil befreundet ist oder Admin ist.
  if p_user_id <> auth.uid()
     and not coalesce((select is_admin from profiles where id = auth.uid()), false)
     and not exists (select 1 from friendships where user_id = auth.uid() and friend_id = p_user_id) then
    raise exception 'Not friends';
  end if;

  return query
  select p.id, p.name, p.avatar_url, p.xp
  from friendships f
  join profiles p on p.id = f.friend_id
  where f.user_id = p_user_id
  order by coalesce(p.name, p.email), p.xp desc;
end;
$$;
grant execute on function get_profile_friends(uuid) to authenticated;

-- App-Ideen / Entwicklungsvorschläge
create table if not exists app_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'offen' check (status in ('offen', 'abgeschlossen')),
  admin_response text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table app_ideas enable row level security;

drop policy if exists "app_ideas_select_own_or_admin" on app_ideas;
drop policy if exists "app_ideas_insert_own" on app_ideas;
drop policy if exists "app_ideas_update_admin" on app_ideas;

create policy "app_ideas_select_own_or_admin" on app_ideas
  for select using (auth.uid() = user_id or coalesce((select is_admin from profiles where id = auth.uid()), false));

create policy "app_ideas_insert_own" on app_ideas
  for insert with check (auth.uid() = user_id);

create policy "app_ideas_update_admin" on app_ideas
  for update using (coalesce((select is_admin from profiles where id = auth.uid()), false));

create or replace function complete_app_idea(p_idea_id uuid, p_admin_response text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not coalesce((select is_admin from profiles where id = auth.uid()), false) then
    raise exception 'Only admins can complete app ideas';
  end if;

  update app_ideas
  set status = 'abgeschlossen',
      admin_response = nullif(trim(p_admin_response), ''),
      reviewed_at = now()
  where id = p_idea_id;
end;
$$;
grant execute on function complete_app_idea(uuid, text) to authenticated;
