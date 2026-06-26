import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';
import { getGuestState } from '../../lib/guest';

type UsedWord = { word_id: string; date: string; wort: string; wortart: string | null };

export default function BenutzteWoerterScreen() {
  const { theme } = useTheme();
  const { profile, isGuest } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack(router, returnTo || '/(tabs)/statistik');
      return true;
      });
      return () => subscription.remove();
    }, [router])
  );

  const [usedWords, setUsedWords] = useState<UsedWord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    setLoading(true);
    if (isGuest) {
      const guest = await getGuestState();
      if (guest.usages.length === 0) {
        setUsedWords([]);
        setLoading(false);
        return;
      }
      const ids = Array.from(new Set(guest.usages.map(u => u.word_id)));
      const { data: words } = await supabase.from('words').select('id, wort, wortart').in('id', ids);
      const byId = new Map((words ?? []).map((w: any) => [w.id, w]));
      setUsedWords(guest.usages.map(u => ({
        word_id: u.word_id,
        date: u.date,
        wort: byId.get(u.word_id)?.wort ?? '—',
        wortart: byId.get(u.word_id)?.wortart ?? null,
      })).sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('word_usage')
      .select('word_id, date, words(wort, wortart)')
      .eq('user_id', profile.id)
      .order('date', { ascending: false });
    setUsedWords((data ?? []).map((row: any) => ({
      word_id: row.word_id,
      date: row.date,
      wort: row.words?.wort ?? '—',
      wortart: row.words?.wortart ?? null,
    })));
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/statistik')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Benutzte Wörter</Text>
      </View>
      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {usedWords.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
              <Text style={{ fontSize: 28, marginBottom: 10 }}>💬</Text>
              <Text style={{ color: theme.inkSoft, fontSize: 14, textAlign: 'center' }}>Du hast noch kein Wort im Alltag verwendet gemeldet.</Text>
            </View>
          ) : usedWords.map((item, idx) => (
            <View key={`${item.word_id}-${idx}`} style={[styles.row, { borderBottomColor: theme.rule }]}> 
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.word, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{item.wort}</Text>
                {item.wortart && <Text style={{ color: theme.inkSoft, fontSize: 11 }}>{item.wortart}</Text>}
              </View>
              <Text style={{ color: theme.inkSoft, fontSize: 12 }}>{new Date(item.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Text>
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
  title: { fontSize: 21, lineHeight: 29, includeFontPadding: true },
  emptyBox: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  word: { fontSize: 17, lineHeight: 23, includeFontPadding: true },
});
