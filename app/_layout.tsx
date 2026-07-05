import { useEffect, Component, ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, View, ScrollView, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { setupNotificationResponseListener, ensureNotificationHandlerSet } from '../lib/notifications';
import { setupSupabaseAuthDeepLinking } from '../lib/authDeepLink';

// Systemschriftgröße ignorieren – in try-catch für React 19 Kompatibilität
try {
  if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
  (Text as any).defaultProps.allowFontScaling = false;
  if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
  (TextInput as any).defaultProps.allowFontScaling = false;
} catch (_e) {}

// Globaler JS-Fehler-Handler: zeigt Fehler auf dem Bildschirm statt stillem Crash
if (typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    if (isFatal) {
      console.error('FATAL JS ERROR:', error?.message, error?.stack);
    }
  });
}

// Notification-Handler nach React-Initialisierung setzen
ensureNotificationHandlerSet();

export const unstable_settings = {
  initialRouteName: '(auth)/login',
};

// Error Boundary: fängt Render-Fehler und zeigt sie auf dem Bildschirm
interface ErrorBoundaryState { error: Error | null }
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.errorScroll}>
            <Text style={styles.errorTitle}>App-Fehler</Text>
            <Text style={styles.errorMsg}>{this.state.error?.message}</Text>
            <Text style={styles.errorStack}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, backgroundColor: '#1a0000', padding: 20, paddingTop: 60 },
  errorScroll: { flexGrow: 1 },
  errorTitle: { color: '#ff4444', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  errorMsg: { color: '#ffcccc', fontSize: 14, marginBottom: 12 },
  errorStack: { color: '#ff8888', fontSize: 11, fontFamily: 'monospace' },
});

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
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <RootNavigation />
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
