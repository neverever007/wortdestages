import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { setupNotificationResponseListener } from '../lib/notifications';
import { setupSupabaseAuthDeepLinking } from '../lib/authDeepLink';

export const unstable_settings = {
  initialRouteName: '(auth)/login',
};

function ThemedStatusBar() {
  const { theme, isDark } = useTheme();

  return (
    <StatusBar
      style={isDark ? 'light' : 'dark'}
      backgroundColor={theme.paper}
      translucent={false}
    />
  );
}

function RootNavigation() {
  const { session, loading, isGuest } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const subscription = setupNotificationResponseListener((route) => {
      router.push(route as any);
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const subscription = setupSupabaseAuthDeepLinking(() => {
      router.replace('/reset-password');
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!segments.length) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isResetPassword = segments[0] === 'reset-password';

    if (!session && !isGuest && !inAuthGroup && !isResetPassword) {
      router.replace('/(auth)/login');
    } else if ((session || isGuest) && inAuthGroup) {
      router.replace('/(tabs)/heute');
    }
  }, [session, isGuest, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <RootNavigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
