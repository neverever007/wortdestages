-- V29 Release Candidate: Passwort-Reset, Profil-Löschung, Rechtliches/Admin, Benachrichtigungsfelder
-- Dieses Skript ist bewusst mehrfach ausführbar.

-- ------------------------------------------------------------
-- Profile: Benachrichtigungsspalten absichern
-- ------------------------------------------------------------
alter table if exists public.profiles add column if not exists notification_time time default '07:00';
alter table if exists public.profiles add column if not exists notifications_enabled boolean not null default true;
alter table if exists public.profiles add column if not exists expo_push_token text;

update public.profiles
set notification_time = coalesce(notification_time, '07:00'::time),
    notifications_enabled = coalesce(notifications_enabled, true)
where true;

-- ------------------------------------------------------------
-- Rechtstexte: dynamisch aus Supabase laden und im Adminbereich bearbeiten
-- ------------------------------------------------------------
create table if not exists public.legal_documents (
  slug text primary key check (slug in ('datenschutz', 'impressum', 'nutzungsbedingungen')),
  title text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.legal_documents enable row level security;

drop policy if exists "legal documents readable by everyone" on public.legal_documents;
drop policy if exists "legal documents editable by admins" on public.legal_documents;

create policy "legal documents readable by everyone"
  on public.legal_documents
  for select
  using (true);

create policy "legal documents editable by admins"
  on public.legal_documents
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

insert into public.legal_documents (slug, title, content)
values
('datenschutz', 'Datenschutzerklärung', 'Stand: 25.06.2026

Diese Datenschutzerklärung beschreibt, welche Daten in der App „Wort des Tages“ verarbeitet werden.

Verantwortlicher
Bitte vor Veröffentlichung ergänzen: Name, Anschrift und E-Mail-Adresse des Betreibers.

Verarbeitete Daten
Die App verarbeitet Kontodaten wie E-Mail-Adresse, Anzeigename, Profilbild/Avatar, Favoriten, benutzte Wörter, persönliche Wörter, Upvotes, Freundschaften, App-Ideen und Wortvorschläge.

Gastzugang
Im Gastzugang werden Favoriten, benutzte Wörter und Einstellungen lokal auf dem Gerät gespeichert. Bei späterer Registrierung können diese Daten in den Account übernommen werden.

Benachrichtigungen
Benachrichtigungen werden nur nach Erlaubnis durch Android/iOS angezeigt. Die Uhrzeit und einzelne Benachrichtigungen können im Profil geändert werden.

Dienstleister
Für Authentifizierung und Datenbank wird Supabase verwendet. Daten können auf Servern des Anbieters verarbeitet werden.

Löschung
Du kannst dein Profil in der App löschen. Dabei werden dein Account und die zugeordneten App-Daten dauerhaft entfernt.

Hinweis
Diese Vorlage ersetzt keine Rechtsberatung. Vor Veröffentlichung sollte sie rechtlich geprüft und mit echten Betreiberangaben ergänzt werden.'),
('impressum', 'Impressum', 'Angaben gemäß § 5 TMG / DDG

Bitte vor Veröffentlichung ergänzen:

Name des Betreibers
Straße und Hausnummer
PLZ und Ort
Deutschland

Kontakt
E-Mail: bitte ergänzen

Verantwortlich für den Inhalt
Bitte Namen und Anschrift ergänzen.

Hinweis
Diese Vorlage ersetzt keine Rechtsberatung.'),
('nutzungsbedingungen', 'Nutzungsbedingungen', 'Nutzungsbedingungen für „Wort des Tages“

1. Nutzung der App
Die App dient dem Entdecken, Speichern und Verwenden besonderer Wörter.

2. Nutzerinhalte
Nutzer können eigene Wörter, Vorschläge und App-Ideen einreichen. Inhalte dürfen nicht beleidigend, rechtswidrig, diskriminierend oder urheberrechtsverletzend sein.

3. Moderation
Der Betreiber darf Inhalte prüfen, ablehnen, löschen oder Accounts einschränken, wenn gegen diese Regeln verstoßen wird.

4. Gastzugang
Gäste können die App eingeschränkt nutzen. Bestimmte Community-Funktionen sind nur mit Konto verfügbar.

5. Haftung
Für nutzergenerierte Inhalte wird keine Gewähr übernommen.

6. Änderungen
Die Nutzungsbedingungen können angepasst werden. Die aktuelle Version ist in der App einsehbar.')
on conflict (slug) do update
set title = excluded.title,
    content = case
      when public.legal_documents.content is null or length(trim(public.legal_documents.content)) = 0 then excluded.content
      else public.legal_documents.content
    end,
    updated_at = coalesce(public.legal_documents.updated_at, now());

-- ------------------------------------------------------------
-- Account löschen: aktuelle Nutzerin / aktueller Nutzer + Appdaten
-- ------------------------------------------------------------
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.daily_word_votes') is not null then
    delete from public.daily_word_votes where voter_id = v_uid or entry_user_id = v_uid;
  end if;
  if to_regclass('public.daily_words_personal') is not null then
    delete from public.daily_words_personal where user_id = v_uid;
  end if;
  if to_regclass('public.friend_requests') is not null then
    delete from public.friend_requests where from_user_id = v_uid or to_user_id = v_uid;
  end if;
  if to_regclass('public.friendships') is not null then
    delete from public.friendships where user_id = v_uid or friend_id = v_uid;
  end if;
  if to_regclass('public.app_ideas') is not null then
    delete from public.app_ideas where user_id = v_uid;
  end if;
  if to_regclass('public.word_suggestions') is not null then
    delete from public.word_suggestions where user_id = v_uid;
  end if;
  if to_regclass('public.user_badges') is not null then
    delete from public.user_badges where user_id = v_uid;
  end if;
  if to_regclass('public.notification_clicks') is not null then
    delete from public.notification_clicks where user_id = v_uid;
  end if;
  if to_regclass('public.word_usage') is not null then
    delete from public.word_usage where user_id = v_uid;
  end if;
  if to_regclass('public.favorites') is not null then
    delete from public.favorites where user_id = v_uid;
  end if;
  if to_regclass('public.monthly_recaps') is not null then
    delete from public.monthly_recaps where user_id = v_uid;
  end if;
  if to_regclass('public.profiles') is not null then
    delete from public.profiles where id = v_uid;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_current_user() to authenticated;

-- ------------------------------------------------------------
-- Leserechte für Gäste, falls die Funktionen vorhanden sind
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.get_global_feed_all()') is not null then
    grant execute on function public.get_global_feed_all() to anon, authenticated;
  end if;
  if to_regprocedure('public.get_word_usage_count(uuid)') is not null then
    grant execute on function public.get_word_usage_count(uuid) to anon, authenticated;
  end if;
  if to_regprocedure('public.get_word_usage_count_today(uuid)') is not null then
    grant execute on function public.get_word_usage_count_today(uuid) to anon, authenticated;
  end if;
end $$;
