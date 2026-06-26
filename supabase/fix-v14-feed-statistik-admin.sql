-- ============================================================
-- FIX V14: Feed-Zeitfilter/Upvotes/Freunde-Anzeige
-- Bitte nach V10-V13 im Supabase SQL Editor ausführen.
-- ============================================================

-- Eigene Upvotes als Liste für Statistik > Meine Wörter > Upvotes
create or replace function get_my_upvoted_words()
returns table(
  entry_user_id uuid,
  datum date,
  wort text,
  user_name text,
  user_avatar text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return query
  select
    d.user_id,
    d.datum,
    d.wort,
    p.name,
    p.avatar_url
  from daily_word_votes v
  join daily_words_personal d
    on d.user_id = v.entry_user_id
   and d.datum = v.entry_datum
  join profiles p on p.id = d.user_id
  where v.voter_id = auth.uid()
    and v.vote = 1
  order by d.datum desc, d.created_at desc
  limit 200;
end;
$$;
grant execute on function get_my_upvoted_words() to authenticated;

-- Freunde eines Profils robuster anzeigen
create or replace function get_profile_friends(p_user_id uuid)
returns table(id uuid, name text, avatar_url text, xp integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

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

-- Start-Upvote für eigene persönliche Wörter absichern.
-- Wenn Nutzer ein eigenes Wort eintragen, zählt es standardmäßig als eigener Upvote.
insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
select d.user_id, d.user_id, d.datum, 1
from daily_words_personal d
on conflict (voter_id, entry_user_id, entry_datum) do nothing;
