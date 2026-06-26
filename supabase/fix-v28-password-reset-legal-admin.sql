-- v28: Rechtstexte dynamisch durch Admin bearbeitbar
-- Im Supabase SQL Editor ausführen.

create table if not exists public.legal_documents (
  slug text primary key check (slug in ('datenschutz', 'impressum', 'nutzungsbedingungen')),
  title text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.legal_documents enable row level security;

create policy if not exists "legal documents readable by everyone"
  on public.legal_documents
  for select
  using (true);

create policy if not exists "legal documents editable by admins"
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
Die App verarbeitet Kontodaten wie E-Mail-Adresse, Anzeigename, Favoriten, benutzte Wörter, persönliche Wörter, Upvotes, Freundschaften, App-Ideen und Wortvorschläge.

Gastzugang
Im Gastzugang werden Daten lokal auf dem Gerät gespeichert. Bei späterer Registrierung können diese Daten übernommen werden.

Benachrichtigungen
Benachrichtigungen werden nur nach Erlaubnis angezeigt und können in der App eingestellt werden.

Hinweis
Diese Vorlage ersetzt keine Rechtsberatung.'),
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
Der Betreiber darf Inhalte prüfen, ablehnen, löschen oder Accounts einschränken.

4. Gastzugang
Gäste können die App eingeschränkt nutzen.

5. Haftung
Für nutzergenerierte Inhalte wird keine Gewähr übernommen.')
on conflict (slug) do nothing;
