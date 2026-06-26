# v31 – Passwort-Reset Deep-Link Fix

## Geändert

- Supabase-Client für React Native stabilisiert:
  - `flowType: 'implicit'` explizit gesetzt
  - `processLock` ergänzt
  - Auto-Refresh über `AppState` ergänzt
- Neuer zentraler Deep-Link-Handler: `lib/authDeepLink.ts`
  - verarbeitet `access_token` + `refresh_token`
  - verarbeitet `code`
  - verarbeitet `token_hash`
  - hört global auf Deep Links, bevor der Reset-Screen arbeitet
  - merkt sich gültige Recovery-Sitzung lokal
- `app/_layout.tsx` verarbeitet Supabase-Auth-Deep-Links jetzt global.
- `app/reset-password.tsx` verlässt sich nicht mehr nur auf `Linking.getInitialURL()` im Screen.
- `token=` aus dem Supabase-Verify-Link wird nicht mehr falsch als `token_hash` verwendet.

## Wichtiger Testhinweis

Nach Installation unbedingt einen neuen Passwort-Link anfordern. Alte Recovery-Links sind Einmal-Links und können bereits verbraucht sein.

## Supabase

URL Configuration sollte mindestens enthalten:

- Site URL: `wortdestages://login`
- Redirect URL: `wortdestages://reset-password`
- optional zusätzlich: `wortdestages://**`
