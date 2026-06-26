# Wort des Tages

Expo/React-Native-App mit Supabase-Backend.

## Installation

```bash
npm install
```

## Entwicklung starten

```bash
npx expo start -c
```

Hinweis: Eine veraltete Expo-Go-App kann bei SDK 53 weiter scheitern. Für dein Ziel ist der APK-Build über EAS der wichtigere Weg.

## Android-APK bauen

```bash
npx eas login
npx eas build --platform android --profile preview
```

Alternativ:

```bash
npm run build:apk
```

## Supabase

Die Supabase-Daten stehen in `app.json` unter `expo.extra.supabaseUrl` und `expo.extra.supabaseAnonKey`. Das SQL-Schema liegt unter `supabase/schema.sql`.
