# Fix: Passwort zurücksetzen

Diese Version ersetzt `app/reset-password.tsx` durch einen robusteren Supabase-v2-Recovery-Flow.

Der Screen verarbeitet jetzt mehrere Link-Varianten:

- `code` über `exchangeCodeForSession(code)`
- `access_token` + `refresh_token` über `setSession(...)`
- `token_hash`/`token` mit `type=recovery` über `verifyOtp(...)`
- Query-Parameter von Expo Router über `useLocalSearchParams(...)`
- Initial-URL und laufende Deep-Link-Events über `expo-linking`

Wichtig: Nach Installation immer einen neuen Passwort-Link anfordern. Alte Links sind oft verbraucht.
