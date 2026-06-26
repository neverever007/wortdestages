-- ============================================================
-- Wort des Tages — Supabase Schema
-- ============================================================

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  is_admin boolean not null default false,
  xp integer not null default 0,
  level_key text not null default 'wortneuling',
  streak_count integer not null default 0,
  best_streak integer not null default 0,
  last_opened_date date,
  notification_time time default '08:00',
  notifications_enabled boolean not null default true,
  friend_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  expo_push_token text,
  created_at timestamptz not null default now()
);

-- ---------- WORDS ----------
create table words (
  id uuid primary key default gen_random_uuid(),
  wort text not null,
  lautschrift text,
  wortart text,
  definition text not null,
  beispielsatz text,
  synonyme text[],
  datum date not null unique,
  is_community boolean not null default false,
  suggested_by uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_words_datum on words(datum);

-- ---------- FAVORITES ----------
create table favorites (
  user_id uuid references profiles(id) on delete cascade,
  word_id uuid references words(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

-- ---------- WORD USAGE ("Heute benutzt") ----------
create table word_usage (
  user_id uuid references profiles(id) on delete cascade,
  word_id uuid references words(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index idx_word_usage_word on word_usage(word_id);

-- ---------- NOTIFICATION CLICKS ----------
create table notification_clicks (
  user_id uuid references profiles(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- WORD SUGGESTIONS ----------
create table word_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  wort text not null,
  begruendung text not null,
  status text not null default 'offen' check (status in ('offen', 'angenommen', 'abgelehnt')),
  resulting_word_id uuid references words(id) on delete set null,
  review_note text,
  awarded_points integer,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index idx_suggestions_status on word_suggestions(status);

-- ---------- FRIENDSHIPS ----------
create table friendships (
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------- BADGES ----------
create table badges (
  id text primary key,
  name text not null,
  beschreibung text not null,
  icon text not null
);

insert into badges (id, name, beschreibung, icon) values
  ('anfaenger', 'Anfänger', 'Die App zum ersten Mal geöffnet', '🌱'),
  ('wortfinder', 'Wortfinder', 'Ein eigener Wortvorschlag wurde veröffentlicht', '🔍'),
  ('streak_7', 'Eine Woche dabei', '7 Tage in Folge geöffnet', '🔥'),
  ('streak_30', 'Ein Monat dabei', '30 Tage in Folge geöffnet', '🏆'),
  ('first_favorite', 'Erster Favorit', 'Das erste Wort gemerkt', '♥'),
  ('ten_favorites', 'Sammler', '10 Wörter gemerkt', '📚'),
  ('first_usage', 'Angewendet', 'Das erste Mal ein Wort im Alltag benutzt gemeldet', '💬');

create table user_badges (
  user_id uuid references profiles(id) on delete cascade,
  badge_id text references badges(id) on delete cascade,
  erreicht_am timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ---------- MONTHLY RECAPS ----------
create table monthly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  monat date not null, -- erster Tag des Monats
  pdf_url text,
  created_at timestamptz not null default now(),
  unique (user_id, monat)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table words enable row level security;
alter table favorites enable row level security;
alter table word_usage enable row level security;
alter table notification_clicks enable row level security;
alter table word_suggestions enable row level security;
alter table friendships enable row level security;
alter table user_badges enable row level security;
alter table monthly_recaps enable row level security;

-- Helper: ist der aktuelle Nutzer Admin?
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- PROFILES: jeder darf alle Profile lesen (für Leaderboard/Freunde), nur eigenes Profil bearbeiten
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- WORDS: alle dürfen lesen, nur Admin darf schreiben
create policy "words_select_all" on words for select using (true);
create policy "words_insert_admin" on words for insert with check (is_admin());
create policy "words_update_admin" on words for update using (is_admin());
create policy "words_delete_admin" on words for delete using (is_admin());

-- FAVORITES: nur eigene sichtbar/bearbeitbar
create policy "favorites_own" on favorites for all using (auth.uid() = user_id);

-- WORD USAGE: eigene Einträge verwalten, Zählung (count) für alle per RPC sichtbar (siehe Funktion unten)
create policy "word_usage_own_select" on word_usage for select using (auth.uid() = user_id);
create policy "word_usage_own_insert" on word_usage for insert with check (auth.uid() = user_id);

-- NOTIFICATION CLICKS: nur eigene
create policy "notification_clicks_own" on notification_clicks for all using (auth.uid() = user_id);

-- WORD SUGGESTIONS: eigene lesen/erstellen, Admin alles lesen/bearbeiten
create policy "suggestions_select_own_or_admin" on word_suggestions
  for select using (auth.uid() = user_id or is_admin());
create policy "suggestions_insert_own" on word_suggestions
  for insert with check (auth.uid() = user_id);
create policy "suggestions_update_admin" on word_suggestions
  for update using (is_admin());

-- FRIENDSHIPS: nur eigene Freundschaften sichtbar/erstellbar
create policy "friendships_select_own" on friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friendships_insert_own" on friendships
  for insert with check (auth.uid() = user_id);
create policy "friendships_delete_own" on friendships
  for delete using (auth.uid() = user_id);

-- USER BADGES: jeder darf alle lesen (für Profile/Vergleich), nur System (Funktionen) schreibt
create policy "user_badges_select_all" on user_badges for select using (true);

-- MONTHLY RECAPS: nur eigene
create policy "monthly_recaps_own" on monthly_recaps for select using (auth.uid() = user_id);

-- ============================================================
-- FUNKTIONEN (RPC)
-- ============================================================

-- Wort-Nutzungszähler (öffentlich lesbar, ohne Namen)
create or replace function get_word_usage_count(p_word_id uuid)
returns integer
language sql
security definer
stable
as $$
  select count(*)::integer from word_usage where word_id = p_word_id;
$$;

-- "Heute benutzt" melden + XP vergeben + Badge prüfen
create or replace function report_word_usage(p_word_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_today date := current_date;
  v_count integer;
begin
  insert into word_usage (user_id, word_id, date)
  values (auth.uid(), p_word_id, v_today)
  on conflict (user_id, word_id) do nothing;

  update profiles set xp = xp + 1 where id = auth.uid();

  select count(*) into v_count from word_usage where user_id = auth.uid();
  if v_count = 1 then
    insert into user_badges (user_id, badge_id)
    values (auth.uid(), 'first_usage')
    on conflict do nothing;
  end if;
end;
$$;

-- Notification-Klick melden + XP vergeben
create or replace function report_notification_click()
returns void
language plpgsql
security definer
as $$
begin
  insert into notification_clicks (user_id, date)
  values (auth.uid(), current_date)
  on conflict (user_id, date) do nothing;

  update profiles set xp = xp + 1 where id = auth.uid();
end;
$$;

-- App geöffnet -> Streak berechnen + XP
create or replace function register_daily_open()
returns void
language plpgsql
security definer
as $$
declare
  v_last date;
  v_today date := current_date;
  v_new_streak integer;
  v_is_first_open boolean;
begin
  select last_opened_date into v_last from profiles where id = auth.uid();
  v_is_first_open := (v_last is null);

  if v_last = v_today then
    return; -- heute schon registriert
  elsif v_last = v_today - 1 then
    v_new_streak := (select streak_count from profiles where id = auth.uid()) + 1;
  else
    v_new_streak := 1;
  end if;

  update profiles
  set streak_count = v_new_streak,
      best_streak = greatest(best_streak, v_new_streak),
      last_opened_date = v_today,
      xp = xp + 1
  where id = auth.uid();

  if v_is_first_open then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'anfaenger') on conflict do nothing;
  end if;

  if v_new_streak = 7 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_7') on conflict do nothing;
  elsif v_new_streak = 30 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_30') on conflict do nothing;
  end if;
end;
$$;

-- Vorschlag annehmen (Admin) -> Wort erstellen, XP + Badge für Einreicher
create or replace function accept_suggestion(
  p_suggestion_id uuid,
  p_lautschrift text,
  p_wortart text,
  p_definition text,
  p_beispielsatz text,
  p_synonyme text[],
  p_datum date,
  p_points integer default 20,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_suggestion word_suggestions;
  v_word_id uuid;
begin
  if not is_admin() then
    raise exception 'Nur Admin darf Vorschläge annehmen';
  end if;

  select * into v_suggestion from word_suggestions where id = p_suggestion_id;

  insert into words (wort, lautschrift, wortart, definition, beispielsatz, synonyme, datum, is_community, suggested_by, created_by)
  values (v_suggestion.wort, p_lautschrift, p_wortart, p_definition, p_beispielsatz, p_synonyme, p_datum, true, v_suggestion.user_id, auth.uid())
  returning id into v_word_id;

  update word_suggestions
  set status = 'angenommen', reviewed_at = now(), resulting_word_id = v_word_id,
      review_note = p_review_note, awarded_points = p_points
  where id = p_suggestion_id;

  update profiles set xp = xp + p_points where id = v_suggestion.user_id;

  insert into user_badges (user_id, badge_id)
  values (v_suggestion.user_id, 'wortfinder')
  on conflict do nothing;

  return v_word_id;
end;
$$;

-- Vorschlag ablehnen (Admin)
create or replace function reject_suggestion(p_suggestion_id uuid, p_review_note text default null)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Nur Admin darf Vorschläge ablehnen';
  end if;

  update word_suggestions
  set status = 'abgelehnt', reviewed_at = now(), review_note = p_review_note
  where id = p_suggestion_id;
end;
$$;

-- Freund per Code hinzufügen (erstellt beidseitige Freundschaft)
create or replace function add_friend_by_code(p_code text)
returns void
language plpgsql
security definer
as $$
declare
  v_friend_id uuid;
begin
  select id into v_friend_id from profiles where friend_code = p_code;

  if v_friend_id is null then
    raise exception 'Kein Nutzer mit diesem Code gefunden';
  end if;

  if v_friend_id = auth.uid() then
    raise exception 'Du kannst dich nicht selbst hinzufügen';
  end if;

  insert into friendships (user_id, friend_id) values (auth.uid(), v_friend_id) on conflict do nothing;
  insert into friendships (user_id, friend_id) values (v_friend_id, auth.uid()) on conflict do nothing;
end;
$$;

-- Globales Leaderboard (Top 50 nach XP)
create or replace function get_global_leaderboard()
returns table (user_id uuid, name text, avatar_url text, xp integer)
language sql
security definer
stable
as $$
  select id, name, avatar_url, xp from profiles order by xp desc limit 50;
$$;

-- Freunde-Leaderboard (eigene Freunde + man selbst, nach XP)
create or replace function get_friends_leaderboard()
returns table (user_id uuid, name text, avatar_url text, xp integer)
language sql
security definer
stable
as $$
  select p.id, p.name, p.avatar_url, p.xp
  from profiles p
  where p.id = auth.uid()
     or p.id in (select friend_id from friendships where user_id = auth.uid())
  order by p.xp desc;
$$;

-- Trigger: bei neuem Auth-User automatisch Profil anlegen
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- SEED: 5 Beispielwörter (heute + 4 vorherige Tage)
-- Optional — einfach diesen Block weglassen, falls nicht gewünscht.
-- ============================================================
insert into words (wort, lautschrift, wortart, definition, beispielsatz, synonyme, datum) values
('Fernweh', '[ˈfɛʁnveː]', 'Substantiv, n.',
 'Die starke Sehnsucht, ferne Orte zu sehen und die eigene Umgebung zu verlassen.',
 'Beim Anblick der Landkarte packte sie ein plötzliches Fernweh.',
 array['Wanderlust', 'Sehnsucht', 'Reiselust'],
 current_date - 4),

('Augenblick', '[ˈaʊ̯ɡənˌblɪk]', 'Substantiv, m.',
 'Ein sehr kurzer Zeitraum; Moment.',
 'In diesem einen Augenblick schien die Zeit stillzustehen.',
 array['Moment', 'Sekunde', 'Nu'],
 current_date - 3),

('Geborgenheit', '[ɡəˈbɔʁɡənhaɪ̯t]', 'Substantiv, f.',
 'Ein Gefühl von Sicherheit, Schutz und Wärme, meist durch Nähe zu vertrauten Menschen.',
 'Am Lagerfeuer mit der Familie spürte er eine tiefe Geborgenheit.',
 array['Sicherheit', 'Schutz', 'Trost'],
 current_date - 2),

('Weltschmerz', '[ˈvɛltʃmɛʁts]', 'Substantiv, m.',
 'Ein tiefes Gefühl von Trauer oder Müdigkeit angesichts des Zustands der Welt.',
 'Die Nachrichten lösten bei ihm einen leichten Weltschmerz aus.',
 array['Melancholie', 'Schwermut'],
 current_date - 1),

('Eigensinn', '[ˈaɪ̯ɡənˌzɪn]', 'Substantiv, m.',
 'Die Eigenschaft, hartnäckig den eigenen Willen zu verfolgen, auch gegen Widerstand.',
 'Mit kindlichem Eigensinn bestand sie darauf, den Weg allein zu finden.',
 array['Hartnäckigkeit', 'Trotz', 'Beharrlichkeit'],
 current_date);


-- ============================================================
-- ERWEITERUNG: Freundschaftsanfragen, Abzeichen-Meilensteine
-- ============================================================

-- Freundschaftsanfragen-Tabelle (Anfragen müssen angenommen werden)
create table if not exists friend_requests (
  from_user_id uuid references profiles(id) on delete cascade,
  to_user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

-- Freundschaftsanfrage senden
create or replace function send_friend_request(p_code text)
returns void language plpgsql security definer as $$
declare v_target_id uuid;
begin
  select id into v_target_id from profiles where friend_code = p_code;
  if not found then raise exception 'Code not found'; end if;
  if v_target_id = auth.uid() then raise exception 'Own code'; end if;
  -- Verhindere Duplikate
  insert into friend_requests (from_user_id, to_user_id)
  values (auth.uid(), v_target_id)
  on conflict do nothing;
end; $$;

-- Ausstehende Anfragen abrufen (an mich gerichtet)
create or replace function get_pending_friend_requests()
returns table(from_user_id uuid, name text, avatar_url text, created_at timestamptz)
language plpgsql security definer as $$
begin
  return query
    select fr.from_user_id, p.name, p.avatar_url, fr.created_at
    from friend_requests fr
    join profiles p on p.id = fr.from_user_id
    where fr.to_user_id = auth.uid();
end; $$;

-- Freundschaftsanfrage annehmen
create or replace function accept_friend_request(p_from_user_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Gegenseitige Freundschaft anlegen
  insert into friendships (user_id, friend_id) values (auth.uid(), p_from_user_id) on conflict do nothing;
  insert into friendships (user_id, friend_id) values (p_from_user_id, auth.uid()) on conflict do nothing;
  -- Anfrage löschen
  delete from friend_requests where from_user_id = p_from_user_id and to_user_id = auth.uid();
end; $$;

-- Freundschaftsanfrage ablehnen
create or replace function decline_friend_request(p_from_user_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from friend_requests where from_user_id = p_from_user_id and to_user_id = auth.uid();
end; $$;

-- Abzeichen für neue Meilensteine ergänzen
insert into badges (id, name, beschreibung, icon) values
  ('streak_3', 'Drei Tage dabei', '3 Tage in Folge geöffnet', '⚡'),
  ('five_favorites', 'Bücherfreund', '5 Wörter gemerkt', '🔖'),
  ('five_usage', 'Fleißig', '5 Wörter im Alltag benutzt', '🗣️'),
  ('ten_usage', 'Wortgewandt', '10 Wörter im Alltag benutzt', '🎯')
on conflict (id) do nothing;

-- register_daily_open: Abzeichen für 3-Tage-Streak ergänzen
create or replace function register_daily_open()
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_last date;
  v_today date := current_date;
  v_new_streak integer;
  v_is_first_open boolean;
begin
  select last_opened_date into v_last from profiles where id = auth.uid();
  v_is_first_open := (v_last is null);

  if v_last = v_today then return;
  elsif v_last = v_today - 1 then
    v_new_streak := (select streak_count from profiles where id = auth.uid()) + 1;
  else
    v_new_streak := 1;
  end if;

  update profiles
  set streak_count = v_new_streak,
      best_streak = greatest(best_streak, v_new_streak),
      last_opened_date = v_today,
      xp = xp + 1
  where id = auth.uid();

  if v_is_first_open then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'anfaenger') on conflict do nothing;
  end if;
  if v_new_streak >= 3 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_3') on conflict do nothing;
  end if;
  if v_new_streak >= 7 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_7') on conflict do nothing;
  end if;
  if v_new_streak >= 30 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'streak_30') on conflict do nothing;
  end if;
end; $$;

-- report_word_usage: Abzeichen für 5/10 Wörter benutzt ergänzen
create or replace function report_word_usage(p_word_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare v_count integer;
begin
  insert into word_usage (user_id, word_id, date)
  values (auth.uid(), p_word_id, current_date)
  on conflict (user_id, word_id) do nothing;

  update profiles set xp = xp + 1 where id = auth.uid();

  select count(*) into v_count from word_usage where user_id = auth.uid();
  if v_count >= 1 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'first_usage') on conflict do nothing; end if;
  if v_count >= 5 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'five_usage') on conflict do nothing; end if;
  if v_count >= 10 then insert into user_badges (user_id, badge_id) values (auth.uid(), 'ten_usage') on conflict do nothing; end if;
end; $$;

-- toggleFavorite: Abzeichen für 1/5/10 Favoriten (via Trigger auf favorites-Tabelle)
create or replace function check_favorite_badges()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare v_count integer;
begin
  select count(*) into v_count from favorites where user_id = NEW.user_id;
  if v_count >= 1 then insert into user_badges (user_id, badge_id) values (NEW.user_id, 'first_favorite') on conflict do nothing; end if;
  if v_count >= 5 then insert into user_badges (user_id, badge_id) values (NEW.user_id, 'five_favorites') on conflict do nothing; end if;
  if v_count >= 10 then insert into user_badges (user_id, badge_id) values (NEW.user_id, 'ten_favorites') on conflict do nothing; end if;
  return NEW;
end; $$;

drop trigger if exists trg_check_favorite_badges on favorites;
create trigger trg_check_favorite_badges
  after insert on favorites
  for each row execute function check_favorite_badges();
-- ============================================================
-- UPDATE: daily_words_personal, 10 Abzeichen, neue Wörter
-- ============================================================

-- Persönliche Wörter des Tages
create table if not exists daily_words_personal (
  user_id uuid references profiles(id) on delete cascade,
  datum date not null,
  wort text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, datum)
);

alter table daily_words_personal enable row level security;
create policy "own_daily_word" on daily_words_personal for all using (auth.uid() = user_id);

-- Genau 10 Abzeichen (alle alten erhalten/ergänzen)
insert into badges (id, name, beschreibung, icon) values
  ('anfaenger',     'Anfänger',        'Die App zum ersten Mal geöffnet',              '🌱'),
  ('streak_3',      'Drei Tage',       '3 Tage in Folge die App geöffnet',             '⚡'),
  ('streak_7',      'Eine Woche',      '7 Tage in Folge die App geöffnet',             '🔥'),
  ('streak_30',     'Ein Monat',       '30 Tage in Folge die App geöffnet',            '🏆'),
  ('first_favorite','Erster Favorit',  'Das erste Wort als Favorit gespeichert',       '♥️'),
  ('ten_favorites', 'Sammler',         '10 Wörter als Favoriten gespeichert',          '📚'),
  ('first_usage',   'Erstanwender',    'Ein Wort zum ersten Mal im Alltag benutzt',    '💬'),
  ('ten_usage',     'Wortgewandt',     '10 Wörter im Alltag benutzt',                  '🎯'),
  ('wortfinder',    'Wortfinder',      'Eigener Vorschlag wurde veröffentlicht',        '🔍'),
  ('mein_wort',     'Tagebuchschreiber','Erstes persönliches Wort des Tages eingetragen','✍️')
on conflict (id) do update set name = excluded.name, beschreibung = excluded.beschreibung, icon = excluded.icon;

-- Abzeichen für erstes persönliches Wort-Eintrag vergeben (via Funktion die der Client aufruft)
create or replace function register_personal_word(p_wort text, p_datum date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into daily_words_personal (user_id, datum, wort)
  values (auth.uid(), p_datum, p_wort)
  on conflict (user_id, datum) do update set wort = excluded.wort;
  
  select count(*) into v_count from daily_words_personal where user_id = auth.uid();
  if v_count = 1 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'mein_wort') on conflict do nothing;
  end if;
end; $$;

-- Persönliche Wörter eines Nutzers abrufen (für Profil-Ansicht)
create or replace function get_personal_words(p_user_id uuid)
returns table(datum date, wort text)
language plpgsql security definer as $$
begin
  return query
    select d.datum, d.wort
    from daily_words_personal d
    where d.user_id = p_user_id
    order by d.datum desc
    limit 30;
end; $$;

-- ============================================================
-- 14 neue Wörter einfügen
-- ============================================================
insert into words (wort, lautschrift, wortart, definition, beispielsatz, synonyme, datum, is_community, suggested_by, created_by) values

('Opportunismus', '[ˌɔpɔʁtuˈnɪsmʊs]', 'Substantiv',
 'Verhaltensweise, bei der man seine Grundsätze den jeweiligen Umständen anpasst, um den eigenen Vorteil zu wahren — oft ohne Rücksicht auf Moral oder Prinzipien.',
 'Sein politischer Opportunismus war offensichtlich: Er wechselte die Partei, sobald die Umfragewerte sanken.',
 ARRAY['Anpassertum', 'Wendehalstum', 'Gesinnungswandel'], '2026-07-01', false, null, null),

('Rosskur', '[ˈʁɔskuːɐ̯]', 'Substantiv',
 'Eine drastische, harte Behandlung oder Maßnahme — ursprünglich eine brutale Heilmethode für Pferde, heute übertragen für rigorose Einschnitte oder Therapien.',
 'Die Regierung verordnete dem Land eine wirtschaftliche Rosskur, die viele Bürger hart traf.',
 ARRAY['Radikalkur', 'Schocktherapie', 'Härtetest'], '2026-07-02', false, null, null),

('Koryphäe', '[kɔʁyˈfɛːə]', 'Substantiv',
 'Eine auf einem bestimmten Gebiet herausragende, hochgeachtete Persönlichkeit; ein anerkannter Experte oder eine Kapazität.',
 'Sie gilt als Koryphäe der modernen Astrophysik und erhielt mehrere internationale Auszeichnungen.',
 ARRAY['Kapazität', 'Experte', 'Autorität', 'Meister'], '2026-07-03', false, null, null),

('Ikonisch', '[iˈkoːnɪʃ]', 'Adjektiv',
 'Von symbolischer Bedeutung, stilprägend und unverwechselbar — etwas, das für eine Epoche, Bewegung oder Idee steht und weithin als Sinnbild anerkannt wird.',
 'Das Lächeln der Mona Lisa ist eines der ikonischsten Motive der Kunstgeschichte.',
 ARRAY['symbolisch', 'stilprägend', 'legendär', 'wegweisend'], '2026-07-04', false, null, null),

('Quatschig', '[ˈkvatʃɪç]', 'Adjektiv',
 'Umgangssprachlich für albern, töricht oder unsinnig; auch für Dinge, die matschig-weich und formlos sind.',
 'Seine quatschigen Witze kamen nicht bei allen an, doch die Kinder lachten herzlich.',
 ARRAY['albern', 'töricht', 'läppisch', 'blödsinnig'], '2026-07-05', false, null, null),

('Behaglichkeit', '[bəˈhaːklɪçkaɪ̯t]', 'Substantiv',
 'Ein angenehmes Gefühl von Wärme, Geborgenheit und Wohlbehagen; eine gemütliche, entspannte Atmosphäre ohne Unruhe.',
 'Die knisternde Behaglichkeit am Kamin an einem Winterabend ist unvergleichlich.',
 ARRAY['Gemütlichkeit', 'Wohlbehagen', 'Behagen', 'Komfort'], '2026-07-06', false, null, null),

('Beharrlichkeit', '[bəˈhaʁlɪçkaɪ̯t]', 'Substantiv',
 'Ausdauerndes Festhalten an einem Ziel oder Vorhaben trotz Widerständen und Rückschlägen; zielstrebige Beständigkeit.',
 'Nur durch ihre Beharrlichkeit gelang es ihr, das Projekt trotz aller Hindernisse abzuschließen.',
 ARRAY['Ausdauer', 'Hartnäckigkeit', 'Zielstrebigkeit', 'Persistenz'], '2026-07-07', false, null, null),

('Imperativ', '[ɪmpeˈʁaːtiːf]', 'Substantiv',
 'Eine unumgängliche Notwendigkeit oder ein zwingendes Gebot; in der Grammatik die Befehlsform des Verbs.',
 'Der kategorische Imperativ Kants fordert, nur nach Grundsätzen zu handeln, die man als allgemeines Gesetz wollen könnte.',
 ARRAY['Gebot', 'Pflicht', 'Befehlsform', 'Notwendigkeit'], '2026-07-08', false, null, null),

('Aufwartung', '[ˈaʊ̯fvaʁtʊŋ]', 'Substantiv',
 'Ein höflicher Besuch oder die Aufmerksamkeit, die man einer Person erweist — oft in der Wendung „seine Aufwartung machen".',
 'Er machte dem neuen Bürgermeister seine Aufwartung und überreichte dabei eine Glückwunschkarte.',
 ARRAY['Besuch', 'Visite', 'Höflichkeitsbesuch'], '2026-07-09', false, null, null),

('Erlaucht', '[ɛɐ̯ˈlaʊ̯xt]', 'Adjektiv',
 'Veraltetes Ehrenattribut für adlige oder hochgestellte Persönlichkeiten; heute ironisch oder altertümlich verwendet für Hochangesehene.',
 'Die erlauchte Gesellschaft im Ballsaal bestand aus Herzögen, Grafen und Botschaftern.',
 ARRAY['hochgeboren', 'hochgestellt', 'vornehm', 'nobel'], '2026-07-10', false, null, null),

('Schludrig', '[ˈʃluːdʁɪç]', 'Adjektiv',
 'Unordentlich, nachlässig und ohne die nötige Sorgfalt ausgeführt; flüchtig und liederlich in der Ausführung.',
 'Das schludrige Handwerk des Malers zeigte sich in den ungleichmäßigen Pinselstrichen.',
 ARRAY['nachlässig', 'liederlich', 'flüchtig', 'unordentlich'], '2026-07-11', false, null, null),

('Einstand', '[ˈaɪ̯nʃtant]', 'Substantiv',
 'Das erste Auftreten in einer neuen Rolle oder Stellung, oft verbunden mit einem geselligen Umtrunk oder einer kleinen Feier; auch ein Ausgleichsstand im Tennisfall.',
 'Zum Einstand in seiner neuen Stelle spendierte er den Kollegen Kuchen und Kaffee.',
 ARRAY['Antrittsfeier', 'Einführung', 'Debüt'], '2026-07-12', false, null, null),

('Debilitiert', '[debiliˈtɪːɐ̯t]', 'Adjektiv',
 'Geschwächt, erschöpft oder in seiner Leistungsfähigkeit dauerhaft beeinträchtigt — medizinisch für körperliche oder geistige Schwächung.',
 'Nach Wochen der Überarbeitung war er so debilitiert, dass er kaum noch konzentriert lesen konnte.',
 ARRAY['geschwächt', 'erschöpft', 'kraftlos', 'beeinträchtigt'], '2026-07-13', false, null, null),

('Selbstbezogenheit', '[zɛlpstbəˈtsoːgənhaɪ̯t]', 'Substantiv',
 'Die übermäßige Beschäftigung mit der eigenen Person, den eigenen Bedürfnissen und Gedanken; egozentrische Haltung, die andere in den Hintergrund drängt.',
 'Seine Selbstbezogenheit machte echte Freundschaften nahezu unmöglich.',
 ARRAY['Egozentrik', 'Ichbezogenheit', 'Narzissmus', 'Selbstvernarrtheit'], '2026-07-14', false, null, null)

on conflict do nothing;


-- ============================================================
-- Freundesprofil: sichere Datenabruf-Funktionen
-- ============================================================

-- Favoriten eines Freundes abrufen (nur wenn befreundet)
create or replace function get_friend_favorites(p_user_id uuid)
returns table(word_id uuid, wort text, wortart text, datum date)
language plpgsql security definer set search_path = public as $$
begin
  -- Zugriff nur wenn befreundet oder eigenes Profil
  if p_user_id <> auth.uid() then
    perform 1 from friendships where user_id = auth.uid() and friend_id = p_user_id;
    if not found then raise exception 'Not friends'; end if;
  end if;
  return query
    select f.word_id, w.wort, w.wortart, w.datum
    from favorites f
    join words w on w.id = f.word_id
    where f.user_id = p_user_id
    order by f.created_at desc
    limit 30;
end; $$;

-- Benutzte Wörter eines Freundes abrufen
create or replace function get_friend_used_words(p_user_id uuid)
returns table(word_id uuid, wort text, wortart text, date date)
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id <> auth.uid() then
    perform 1 from friendships where user_id = auth.uid() and friend_id = p_user_id;
    if not found then raise exception 'Not friends'; end if;
  end if;
  return query
    select wu.word_id, w.wort, w.wortart, wu.date
    from word_usage wu
    join words w on w.id = wu.word_id
    where wu.user_id = p_user_id
    order by wu.date desc
    limit 30;
end; $$;
-- ============================================================
-- Feed: Votes auf persönliche Wörter des Tages
-- ============================================================

-- Votes-Tabelle: upvote (+1) oder downvote (-1) pro User pro Eintrag
create table if not exists daily_word_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid references profiles(id) on delete cascade,
  entry_user_id uuid references profiles(id) on delete cascade,
  entry_datum date not null,
  vote smallint not null check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  unique (voter_id, entry_user_id, entry_datum)
);
alter table daily_word_votes enable row level security;
create policy "vote_own" on daily_word_votes for all using (auth.uid() = voter_id);
create policy "vote_read" on daily_word_votes for select using (true);

-- Sperrwortliste für Inhaltsmoderation
create table if not exists blocked_words (
  word text primary key
);
alter table blocked_words enable row level security;
create policy "blocked_read" on blocked_words for select using (true);
create policy "blocked_admin" on blocked_words for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- Einige Standard-Sperrwörter
insert into blocked_words (word) values
  ('scheiße'), ('scheiß'), ('fick'), ('ficken'), ('hurensohn'), ('hure'),
  ('wichser'), ('wichsen'), ('arschloch'), ('arsch'), ('fotze'), ('schwuchtel'),
  ('nazi'), ('nigger'), ('penis'), ('vagina'), ('porno'), ('sex'), ('bump')
on conflict do nothing;

-- Globaler Feed: alle persönlichen Wörter mit Votes, sortiert nach Score
create or replace function get_global_feed(p_date date default current_date)
returns table(
  entry_user_id uuid, user_name text, user_avatar text,
  datum date, wort text,
  upvotes bigint, downvotes bigint, score bigint,
  my_vote smallint
)
language plpgsql security definer set search_path = public as $$
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
    where d.datum = p_date
      and d.user_id <> auth.uid()
    group by d.user_id, p.name, p.avatar_url, d.datum, d.wort
    order by coalesce(sum(v.vote), 0) desc, d.created_at asc;
end; $$;

-- Freunde-Feed: nur Freunde
create or replace function get_friends_feed(p_date date default current_date)
returns table(
  entry_user_id uuid, user_name text, user_avatar text,
  datum date, wort text,
  upvotes bigint, downvotes bigint, score bigint,
  my_vote smallint
)
language plpgsql security definer set search_path = public as $$
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
    join friendships f on f.user_id = auth.uid() and f.friend_id = d.user_id
    left join daily_word_votes v on v.entry_user_id = d.user_id and v.entry_datum = d.datum
    where d.datum = p_date
    group by d.user_id, p.name, p.avatar_url, d.datum, d.wort
    order by coalesce(sum(v.vote), 0) desc, d.created_at asc;
end; $$;

-- Vote abgeben oder wechseln/entfernen
create or replace function cast_vote(
  p_entry_user_id uuid,
  p_entry_datum date,
  p_vote smallint -- 1 oder -1
)
returns void language plpgsql security definer set search_path = public as $$
declare v_existing smallint;
begin
  select vote into v_existing
  from daily_word_votes
  where voter_id = auth.uid() and entry_user_id = p_entry_user_id and entry_datum = p_entry_datum;

  if found then
    if v_existing = p_vote then
      -- gleicher Vote nochmal → entfernen (toggle)
      delete from daily_word_votes
      where voter_id = auth.uid() and entry_user_id = p_entry_user_id and entry_datum = p_entry_datum;
    else
      -- anderen Vote → aktualisieren
      update daily_word_votes set vote = p_vote
      where voter_id = auth.uid() and entry_user_id = p_entry_user_id and entry_datum = p_entry_datum;
      -- Punkt anpassen: +1 für Upvote, kein Punkt für Downvote
      if p_vote = 1 then
        update profiles set xp = xp + 1 where id = p_entry_user_id;
      else
        update profiles set xp = greatest(0, xp - 1) where id = p_entry_user_id;
      end if;
    end if;
  else
    insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
    values (auth.uid(), p_entry_user_id, p_entry_datum, p_vote);
    if p_vote = 1 then
      update profiles set xp = xp + 1 where id = p_entry_user_id;
    end if;
  end if;
end; $$;

-- Wort auf Sperrwortliste prüfen
create or replace function check_word_allowed(p_wort text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_blocked boolean;
begin
  select exists(
    select 1 from blocked_words where lower(p_wort) like '%' || lower(word) || '%'
  ) into v_blocked;
  return not v_blocked;
end; $$;


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
