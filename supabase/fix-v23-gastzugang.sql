-- V23 Gastzugang
-- Erlaubt Gästen, den globalen Feed und Wort-Nutzungszähler zu lesen.
-- Gäste schreiben weiterhin NICHT in Feed, Rangliste, Freunde oder Profile.

grant execute on function get_global_feed_all() to anon;
grant execute on function get_word_usage_count_today(uuid) to anon;
grant execute on function get_word_usage_count(uuid) to anon;

-- Wichtige Klarstellung:
-- Gastdaten bleiben lokal auf dem Gerät. Erst nach Anmeldung/Registrierung werden
-- Favoriten, benutzte Wörter und persönliche Wörter in echte Account-Tabellen übertragen.
