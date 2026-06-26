-- ============================================================
-- FIX V12: Heute zurücknehmen, Punkte nur einmal/Tag, Feed-Voting, Admin löschen
-- Bitte im Supabase SQL Editor ausführen.
-- ============================================================

-- Abzeichen sicherstellen + bestehende Nutzer mit Start-Abzeichen versorgen
insert into badges (id, name, beschreibung, icon) values
  ('anfaenger', 'Anfänger', 'Die App zum ersten Mal geöffnet', '🌱'),
  ('streak_3', 'Drei Tage', '3 Tage in Folge die App geöffnet', '⚡'),
  ('streak_7', 'Eine Woche', '7 Tage in Folge die App geöffnet', '🔥'),
  ('streak_30', 'Ein Monat', '30 Tage in Folge die App geöffnet', '🏆'),
  ('first_favorite', 'Erster Favorit', 'Das erste Wort als Favorit gespeichert', '♥️'),
  ('five_favorites', 'Kleine Sammlung', '5 Wörter als Favoriten gespeichert', '📖'),
  ('ten_favorites', 'Sammler', '10 Wörter als Favoriten gespeichert', '📚'),
  ('first_usage', 'Erstanwender', 'Ein Wort zum ersten Mal im Alltag benutzt', '💬'),
  ('five_usage', 'Wortnutzer', '5 Wörter im Alltag benutzt', '🗣️'),
  ('ten_usage', 'Wortgewandt', '10 Wörter im Alltag benutzt', '🎯'),
  ('wortfinder', 'Wortfinder', 'Eigener Vorschlag wurde veröffentlicht', '🔍'),
  ('mein_wort', 'Tagebuchschreiber', 'Erstes persönliches Wort des Tages eingetragen', '✍️')
on conflict (id) do update set
  name = excluded.name,
  beschreibung = excluded.beschreibung,
  icon = excluded.icon;

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

-- Nutzung pro Tag ermöglichen und Punktvergabe unabhängig vom Zurücknehmen nur einmal pro Tag erlauben
create table if not exists word_usage_points_awarded (
  user_id uuid references profiles(id) on delete cascade,
  word_id uuid references words(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, word_id, date)
);
alter table word_usage_points_awarded enable row level security;
drop policy if exists "word_usage_points_awarded_own" on word_usage_points_awarded;
create policy "word_usage_points_awarded_own" on word_usage_points_awarded for select using (auth.uid() = user_id);

-- Alte Primärschlüssel-Definition war user_id + word_id. Für tägliche Nutzung muss date dazugehören.
alter table word_usage drop constraint if exists word_usage_pkey;
create unique index if not exists word_usage_user_word_date_idx on word_usage(user_id, word_id, date);

drop policy if exists "word_usage_own_delete" on word_usage;
create policy "word_usage_own_delete" on word_usage for delete using (auth.uid() = user_id);

create or replace function report_word_usage(p_word_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_usage_count integer;
  v_inserted_usage integer := 0;
  v_awarded_point integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into word_usage (user_id, word_id, date)
  values (auth.uid(), p_word_id, v_today)
  on conflict (user_id, word_id, date) do nothing;

  get diagnostics v_inserted_usage = row_count;

  insert into word_usage_points_awarded (user_id, word_id, date)
  values (auth.uid(), p_word_id, v_today)
  on conflict do nothing;

  get diagnostics v_awarded_point = row_count;

  if v_awarded_point > 0 then
    update profiles set xp = xp + 1 where id = auth.uid();
  end if;

  select count(*) into v_usage_count from word_usage where user_id = auth.uid();
  if v_usage_count >= 1 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'first_usage') on conflict do nothing; end if;
  if v_usage_count >= 5 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'five_usage') on conflict do nothing; end if;
  if v_usage_count >= 10 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'ten_usage') on conflict do nothing; end if;
end;
$$;
grant execute on function report_word_usage(uuid) to authenticated;

create or replace function undo_word_usage(p_word_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from word_usage
  where user_id = auth.uid()
    and word_id = p_word_id
    and date = current_date;
  -- Der Punkt bleibt absichtlich in word_usage_points_awarded gesperrt, damit erneutes Melden am selben Tag keinen zweiten Punkt gibt.
end;
$$;
grant execute on function undo_word_usage(uuid) to authenticated;

create or replace function get_word_usage_count_today(p_word_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from word_usage where word_id = p_word_id and date = current_date;
$$;
grant execute on function get_word_usage_count_today(uuid) to authenticated;

-- Persönliche Wörter + Feed-Votes
create table if not exists daily_words_personal (
  user_id uuid references profiles(id) on delete cascade,
  datum date not null default current_date,
  wort text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, datum)
);
alter table daily_words_personal enable row level security;
drop policy if exists "own_daily_word" on daily_words_personal;
create policy "own_daily_word" on daily_words_personal for all using (auth.uid() = user_id);
drop policy if exists "daily_words_personal_select_all" on daily_words_personal;
create policy "daily_words_personal_select_all" on daily_words_personal for select using (true);

create table if not exists daily_word_votes (
  voter_id uuid references profiles(id) on delete cascade,
  entry_user_id uuid references profiles(id) on delete cascade,
  entry_datum date not null,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (voter_id, entry_user_id, entry_datum)
);
alter table daily_word_votes enable row level security;
drop policy if exists "vote_own" on daily_word_votes;
drop policy if exists "vote_read" on daily_word_votes;
create policy "vote_own" on daily_word_votes for all using (auth.uid() = voter_id);
create policy "vote_read" on daily_word_votes for select using (true);

create or replace function register_personal_word(p_wort text, p_datum date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into user_badges (user_id, badge_id) values (auth.uid(), 'anfaenger') on conflict do nothing;

  insert into daily_words_personal (user_id, datum, wort)
  values (auth.uid(), p_datum, trim(p_wort))
  on conflict (user_id, datum) do update
    set wort = excluded.wort,
        created_at = now();

  -- Standard: eigenes Wort hat direkt den eigenen Upvote.
  insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
  values (auth.uid(), auth.uid(), p_datum, 1)
  on conflict (voter_id, entry_user_id, entry_datum) do update set vote = 1;

  select count(*) into v_count from daily_words_personal where user_id = auth.uid();
  if v_count >= 1 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'mein_wort') on conflict do nothing; end if;
end;
$$;
grant execute on function register_personal_word(text, date) to authenticated;

create or replace function cast_vote(p_entry_user_id uuid, p_entry_datum date, p_vote smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing smallint;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_vote not in (1, -1) then raise exception 'Invalid vote'; end if;

  select vote into v_existing
  from daily_word_votes
  where voter_id = auth.uid()
    and entry_user_id = p_entry_user_id
    and entry_datum = p_entry_datum;

  if found then
    if v_existing = p_vote then
      delete from daily_word_votes
      where voter_id = auth.uid()
        and entry_user_id = p_entry_user_id
        and entry_datum = p_entry_datum;
    else
      update daily_word_votes
      set vote = p_vote
      where voter_id = auth.uid()
        and entry_user_id = p_entry_user_id
        and entry_datum = p_entry_datum;
    end if;
  else
    insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
    values (auth.uid(), p_entry_user_id, p_entry_datum, p_vote);
  end if;
end;
$$;
grant execute on function cast_vote(uuid, date, smallint) to authenticated;

create or replace function delete_feed_entry(p_entry_user_id uuid, p_entry_datum date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not coalesce((select is_admin from profiles where id = auth.uid()), false) then
    raise exception 'Only admins can delete feed entries';
  end if;

  delete from daily_word_votes
  where entry_user_id = p_entry_user_id
    and entry_datum = p_entry_datum;

  delete from daily_words_personal
  where user_id = p_entry_user_id
    and datum = p_entry_datum;
end;
$$;
grant execute on function delete_feed_entry(uuid, date) to authenticated;

-- Feed-Funktionen inkl. eigenem Wort und eigenen Votes
create or replace function get_global_feed_all()
returns table(
  entry_user_id uuid,
  user_name text,
  user_avatar text,
  datum date,
  wort text,
  upvotes bigint,
  downvotes bigint,
  score bigint,
  my_vote smallint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      d.user_id,
      p.name,
      p.avatar_url,
      d.datum,
      d.wort,
      count(case when v.vote = 1 then 1 end),
      count(case when v.vote = -1 then 1 end),
      coalesce(sum(v.vote), 0),
      max(case when v.voter_id = auth.uid() then v.vote end)::smallint
    from daily_words_personal d
    join profiles p on p.id = d.user_id
    left join daily_word_votes v on v.entry_user_id = d.user_id and v.entry_datum = d.datum
    group by d.user_id, p.name, p.avatar_url, d.datum, d.wort, d.created_at
    order by d.datum desc, coalesce(sum(v.vote), 0) desc, d.created_at desc
    limit 100;
end;
$$;
grant execute on function get_global_feed_all() to authenticated;

create or replace function get_friends_feed_all()
returns table(
  entry_user_id uuid,
  user_name text,
  user_avatar text,
  datum date,
  wort text,
  upvotes bigint,
  downvotes bigint,
  score bigint,
  my_vote smallint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      d.user_id,
      p.name,
      p.avatar_url,
      d.datum,
      d.wort,
      count(case when v.vote = 1 then 1 end),
      count(case when v.vote = -1 then 1 end),
      coalesce(sum(v.vote), 0),
      max(case when v.voter_id = auth.uid() then v.vote end)::smallint
    from daily_words_personal d
    join profiles p on p.id = d.user_id
    left join friendships f on f.user_id = auth.uid() and f.friend_id = d.user_id
    left join daily_word_votes v on v.entry_user_id = d.user_id and v.entry_datum = d.datum
    where d.user_id = auth.uid() or f.friend_id is not null
    group by d.user_id, p.name, p.avatar_url, d.datum, d.wort, d.created_at
    order by d.datum desc, coalesce(sum(v.vote), 0) desc, d.created_at desc
    limit 100;
end;
$$;
grant execute on function get_friends_feed_all() to authenticated;
