import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

export default function IndexScreen() {
  const router = useRouter();
  const { session, isGuest, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (loading) return;
    router.replace(session || isGuest ? '/(tabs)/heute' : '/(auth)/login');
  }, [session, isGuest, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.paper }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}
