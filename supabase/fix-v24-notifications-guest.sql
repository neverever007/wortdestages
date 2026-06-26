-- V24 Gastzugang + Benachrichtigungen
-- Gäste bleiben reine lokale Nutzer. Feed/Rangliste/Freunde bleiben nur für registrierte Profile.

alter table profiles add column if not exists notification_time time default '07:00';
alter table profiles add column if not exists notifications_enabled boolean not null default true;
alter table profiles add column if not exists expo_push_token text;

update profiles
set notification_time = coalesce(notification_time, '07:00'::time),
    notifications_enabled = coalesce(notifications_enabled, true);

-- Bestehende Funktionen bleiben unverändert; diese Datei stellt nur sicher,
-- dass die Felder für lokale Benachrichtigungseinstellungen vorhanden sind.
