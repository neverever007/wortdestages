# V29 Release Candidate

Diese Version basiert auf dem hochgeladenen echten Projektstand v27 und enthält die Release-Korrekturen:

- Passwort-Reset stabilisiert:
  - `app/reset-password.tsx` vorhanden
  - Deep-Link `wortdestages://reset-password` wird im Root-Layout nicht mehr zum Login umgeleitet
  - Route `reset-password` ist im Root-Stack registriert
  - veraltete Datei `app/reset-passwort` entfernt
- Start-Route `app/index.tsx` ergänzt, damit die App auch beim normalen Start sauber weiterleitet.
- Rechtliches bleibt dynamisch aus Supabase ladbar und im Adminbereich bearbeitbar.
- Neues SQL-Skript `supabase/fix-v29-release-candidate.sql` ersetzt die fehlerhafte Policy-Syntax aus v28.
- SQL ist mehrfach ausführbar und nutzt `DROP POLICY IF EXISTS` statt ungültigem `CREATE POLICY IF NOT EXISTS`.
- Android-Projektdateien sind enthalten, aber Build-/Cache-Ordner und `node_modules` sollten lokal neu erzeugt werden.

## Supabase

Im SQL-Editor ausführen:

```sql
supabase/fix-v29-release-candidate.sql
```

## Passwort vergessen

In Supabase unter Authentication -> URL Configuration müssen erlaubt sein:

```text
wortdestages://login
wortdestages://reset-password
```

In der App ist das Scheme in `app.json` gesetzt:

```json
"scheme": "wortdestages"
```

## Lokal installieren

```bash
cd /c/wdt/wortdestages-v29-release-candidate
npm install
npx expo run:android
```

## Release-Test ohne Metro/USB

```bash
npx expo run:android --variant release
```

Danach Kabel abziehen und App neu starten.
