import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Credentials direkt hardcoden — Constants.expoConfig kann im Release-Build null sein
const SUPABASE_URL = 'https://chlhzrpifkocgjfgdyvo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNobGh6cnBpZmtvY2dqZmdkeXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzQ2MTQsImV4cCI6MjA5NzIxMDYxNH0.5xwJsRzkZ9IE9ovpjuSo-v6tWAZkeYRc5UR3aC1Gkik';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
