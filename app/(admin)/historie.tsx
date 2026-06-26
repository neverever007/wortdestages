import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

type WordSug = { id: string; wort: string; status: string; review_note: string | null; reviewed_at: string | null; profiles?: { name: string | null } | null };
type Idea = { id: string; title: string; status: string; admin_response: string | null; reviewed_at: string | null; profiles?: { name: string | null } | null };

export default function AdminHistorieScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [words, setWords] = useState<WordSug[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: wordData }, { data: ideaData }] = await Promise.all([
      supabase.from('word_suggestions').select('id, wort, status, review_note, reviewed_at, profiles(name)').neq('status', 'offen').order('reviewed_at', { ascending: false }),
      supabase.from('app_ideas').select('id, title, status, admin_response, reviewed_at, profiles(name)').eq('status', 'abgeschlossen').order('reviewed_at', { ascending: false }),
    ]);
    setWords((wordData ?? []) as unknown as WordSug[]);
    setIdeas((ideaData ?? []) as unknown as Idea[]);
    setLoading(false);
  }
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>Historie</Text>
      </View>
      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/neues-wort')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Neues Wort</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/planung')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Planung</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/vorschlaege')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Vorschläge</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/app-ideen')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>App-Ideen</Text></Pressable>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>Historie</Text>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/rechtliches')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Recht</Text></Pressable>
      </View>

      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Section theme={theme} text="Abgeschlossene Wortvorschläge" />
          {words.length === 0 ? <Text style={[styles.empty, { color: theme.inkSoft }]}>Keine abgeschlossenen Wortvorschläge.</Text> : words.map(w => <View key={w.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}><Text style={[styles.itemTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>{w.wort}</Text><Text style={{ color: theme.inkSoft, fontSize: 12 }}>Status: {w.status} · von {w.profiles?.name ?? 'Nutzer'}</Text>{w.review_note && <Text style={[styles.note, { color: theme.inkSoft }]}>{w.review_note}</Text>}</View>)}
          <Section theme={theme} text="Abgeschlossene App-Ideen" />
          {ideas.length === 0 ? <Text style={[styles.empty, { color: theme.inkSoft }]}>Keine abgeschlossenen App-Ideen.</Text> : ideas.map(i => <View key={i.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}><Text style={[styles.itemTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>{i.title}</Text><Text style={{ color: theme.inkSoft, fontSize: 12 }}>von {i.profiles?.name ?? 'Nutzer'}</Text>{i.admin_response && <Text style={[styles.note, { color: theme.inkSoft }]}>{i.admin_response}</Text>}</View>)}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ theme, text }: { theme: any; text: string }) { return <Text style={[styles.section, { color: theme.inkSoft }]}>{text}</Text>; }
const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 21, lineHeight: 29, includeFontPadding: true, flex: 1 },
  subtabs: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 0, minHeight: 46, alignItems: 'flex-end', borderBottomWidth: 1 },
  subtabPressable: { flex: 1, minWidth: 0 },
  subtab: { fontSize: 9.2, lineHeight: 13, paddingBottom: 8, paddingTop: 2, flex: 1, textAlign: 'center', minWidth: 0 },
  subtabActive: { fontWeight: '600', borderBottomWidth: 2 },
  section: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 },
  empty: { fontSize: 13, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 10 },
  itemTitle: { fontSize: 17, lineHeight: 23, includeFontPadding: true },
  note: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
});
