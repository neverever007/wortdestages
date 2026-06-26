import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

type AppIdea = { id: string; title: string; body: string; status: string; admin_response: string | null; created_at: string; reviewed_at: string | null };

export default function MeineIdeenScreen() {
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

  const [ideas, setIdeas] = useState<AppIdea[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase.from('app_ideas').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setIdeas((data ?? []) as AppIdea[]);
    setLoading(false);
  }
  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>Meine Ideen</Text>
      </View>
      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {ideas.length === 0 ? <Text style={{ color: theme.inkSoft, textAlign: 'center', marginTop: 40 }}>Noch keine App-Ideen eingereicht.</Text> : ideas.map(idea => (
            <View key={idea.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
              <View style={styles.cardTop}>
                <Text style={[styles.ideaTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={2}>{idea.title}</Text>
                <Text style={[styles.status, { color: idea.status === 'abgeschlossen' ? theme.green : theme.accent }]}>{idea.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</Text>
              </View>
              <Text style={[styles.body, { color: theme.inkSoft }]}>{idea.body}</Text>
              {idea.admin_response && <View style={[styles.response, { borderColor: theme.accent }]}><Text style={{ color: theme.ink, fontSize: 12.5, lineHeight: 18 }}>{idea.admin_response}</Text></View>}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 21, lineHeight: 29, includeFontPadding: true, flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  ideaTitle: { flex: 1, fontSize: 17, lineHeight: 23, includeFontPadding: true },
  status: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  body: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  response: { marginTop: 12, borderLeftWidth: 3, paddingLeft: 10 },
});
