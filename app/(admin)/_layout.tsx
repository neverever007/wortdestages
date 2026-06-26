import { useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { goBack } from '../../lib/navigation';

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && !profile.is_admin) {
      router.replace('/(tabs)/heute');
    }
  }, [profile, loading]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack(router, '/(tabs)/profil');
        return true;
      });
      return () => subscription.remove();
    }, [router])
  );

  return <Stack screenOptions={{ headerShown: false }} />;
}
