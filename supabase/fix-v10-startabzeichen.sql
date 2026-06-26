-- ============================================================
-- FIX V10: Start-Abzeichen immer vergeben
-- ============================================================
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

-- Bestehende Profile nachziehen
insert into user_badges (user_id, badge_id)
select id, 'anfaenger' from profiles
on conflict do nothing;

-- Client-Sicherheitsnetz: kann beim App-Start aufgerufen werden
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

-- Neuer Nutzer: Profil UND Start-Abzeichen direkt anlegen
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into user_badges (user_id, badge_id)
  values (new.id, 'anfaenger')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Tägliches Öffnen: Anfänger-Abzeichen auch dann vergeben, wenn der Tag schon registriert war
create or replace function register_daily_open()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
  v_today date := current_date;
  v_new_streak integer;
begin
  if auth.uid() is null then
    return;
  end if;

  insert into user_badges (user_id, badge_id)
  values (auth.uid(), 'anfaenger')
  on conflict do nothing;

  select last_opened_date into v_last from profiles where id = auth.uid();

  if v_last = v_today then
    return;
  elsif v_last = v_today - 1 then
    v_new_streak := coalesce((select streak_count from profiles where id = auth.uid()), 0) + 1;
  else
    v_new_streak := 1;
  end if;

  update profiles
  set streak_count = v_new_streak,
      best_streak = greatest(best_streak, v_new_streak),
      last_opened_date = v_today,
      xp = xp + 1
  where id = auth.uid();

  if v_new_streak >= 3 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_3') on conflict do nothing;
  end if;
  if v_new_streak >= 7 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_7') on conflict do nothing;
  end if;
  if v_new_streak >= 30 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_30') on conflict do nothing;
  end if;
end;
$$;

