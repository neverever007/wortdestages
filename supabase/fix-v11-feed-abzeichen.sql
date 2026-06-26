-- ============================================================
-- FIX V11: Feed zeigt eigene Wörter + Start-Abzeichen für alle
-- Bitte im Supabase SQL Editor ausführen.
-- ============================================================

-- 1) Standard-Abzeichen sicher anlegen/aktualisieren
insert into badges (id, name, beschreibung, icon) values
  ('anfaenger', 'Anfänger', 'Die App zum ersten Mal geöffnet', '🌱'),
  ('streak_3', 'Drei Tage', '3 Tage in Folge die App geöffnet', '⚡'),
  ('streak_7', 'Eine Woche', '7 Tage in Folge die App geöffnet', '🔥'),
  ('streak_30', 'Ein Monat', '30 Tage in Folge die App geöffnet', '🏆'),
  ('first_favorite', 'Erster Favorit', 'Das erste Wort als Favorit gespeichert', '♥️'),
  ('ten_favorites', 'Sammler', '10 Wörter als Favoriten gespeichert', '📚'),
  ('first_usage', 'Erstanwender', 'Ein Wort zum ersten Mal im Alltag benutzt', '💬'),
  ('ten_usage', 'Wortgewandt', '10 Wörter im Alltag benutzt', '🎯'),
  ('wortfinder', 'Wortfinder', 'Eigener Vorschlag wurde veröffentlicht', '🔍'),
  ('mein_wort', 'Tagebuchschreiber', 'Erstes persönliches Wort des Tages eingetragen', '✍️')
on conflict (id) do update set
  name = excluded.name,
  beschreibung = excluded.beschreibung,
  icon = excluded.icon;

-- 2) Bestehende Nutzer bekommen ab sofort das Start-Abzeichen
insert into user_badges (user_id, badge_id)
select id, 'anfaenger'
from profiles
on conflict do nothing;

-- 3) Sicherheitsfunktion: eingeloggter Nutzer bekommt Anfänger-Abzeichen
create or replace function ensure_initial_badge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into user_badges (user_id, badge_id)
  values (auth.uid(), 'anfaenger')
  on conflict do nothing;
end;
$$;

grant execute on function ensure_initial_badge() to authenticated;

-- 4) Persönliches Wort speichern: vergibt Anfänger + Mein-Wort-Abzeichen
create or replace function register_personal_word(p_wort text, p_datum date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into user_badges (user_id, badge_id)
  values (auth.uid(), 'anfaenger')
  on conflict do nothing;

  insert into daily_words_personal (user_id, datum, wort)
  values (auth.uid(), p_datum, trim(p_wort))
  on conflict (user_id, datum) do update
    set wort = excluded.wort,
        created_at = now();

  select count(*) into v_count
  from daily_words_personal
  where user_id = auth.uid();

  if v_count >= 1 then
    insert into user_badges (user_id, badge_id)
    values (auth.uid(), 'mein_wort')
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function register_personal_word(text, date) to authenticated;

-- 5) Globaler Feed über alle Tage, inklusive eigenem Wort
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

-- 6) Freunde-Feed über alle Tage, inklusive eigenem Wort
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

-- 7) Voting: eigenes Wort nicht bewerten
create or replace function cast_vote(
  p_entry_user_id uuid,
  p_entry_datum date,
  p_vote smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing smallint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_entry_user_id = auth.uid() then
    return;
  end if;

  if p_vote not in (1, -1) then
    raise exception 'Invalid vote';
  end if;

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
