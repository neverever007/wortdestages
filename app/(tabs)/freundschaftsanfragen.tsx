import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

type Request = { id: string; from_user_id: string; name: string | null; avatar_url: string | null; created_at: string };

export default function FreundschaftsanfragenScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack(router, returnTo || '/(tabs)/profil');
      return true;
      });
      return () => subscription.remove();
    }, [router])
  );

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase.rpc('get_pending_friend_requests');
    setRequests(data ?? []);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  async function accept(fromUserId: string) {
    const { error } = await supabase.rpc('accept_friend_request', { p_from_user_id: fromUserId });
    if (error) { Alert.alert('Fehler', error.message); return; }
    setRequests(prev => prev.filter(r => r.from_user_id !== fromUserId));
    Alert.alert('Freund hinzugefügt', 'Ihr seid jetzt befreundet!');
  }

  async function decline(fromUserId: string) {
    await supabase.rpc('decline_friend_request', { p_from_user_id: fromUserId });
    setRequests(prev => prev.filter(r => r.from_user_id !== fromUserId));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Freundschaftsanfragen</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: theme.inkSoft, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
            Keine ausstehenden Anfragen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.from_user_id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}>
              <View style={[styles.avatar, { backgroundColor: '#1F1A14' }]}>
                <Text style={{ fontSize: 22 }}>{item.avatar_url || '🦊'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1}>
                  {item.name ?? 'Unbekannt'}
                </Text>
                <Text style={{ color: theme.inkSoft, fontSize: 11 }}>
                  {new Date(item.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <Pressable style={[styles.actionBtn, { backgroundColor: theme.green }]} onPress={() => accept(item.from_user_id)}>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Annehmen</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.rule }]} onPress={() => decline(item.from_user_id)}>
                <Text style={{ color: theme.inkSoft, fontSize: 13 }}>Ablehnen</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
});
