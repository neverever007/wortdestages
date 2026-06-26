import { useCallback, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

type Idea = { id: string; user_id: string; title: string; body: string; status: string; admin_response: string | null; created_at: string; profiles?: { name: string | null } | null };

export default function AdminAppIdeenScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [response, setResponse] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('app_ideas').select('*, profiles(name)').eq('status', 'offen').order('created_at', { ascending: true });
    setIdeas((data ?? []) as Idea[]);
    setLoading(false);
  }
  useFocusEffect(useCallback(() => { load(); }, []));

  function open(idea: Idea) { setSelected(idea); setResponse(''); }

  async function answer() {
    if (!selected) return;
    await supabase.rpc('complete_app_idea', { p_idea_id: selected.id, p_admin_response: response.trim() || 'Danke für deine Idee. Sie wurde geprüft.' });
    setSelected(null); setResponse(''); load();
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <View style={styles.mastheadLeft}>
          <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>App-Ideen</Text>
        </View>
      </View>
      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/neues-wort')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Neues Wort</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/planung')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Planung</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/vorschlaege')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Vorschläge</Text></Pressable>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>App-Ideen</Text>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/historie')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Historie</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/rechtliches')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Recht</Text></Pressable>
      </View>
      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : ideas.length === 0 ? (
        <Text style={[styles.empty, { color: theme.inkSoft }]}>Keine offenen App-Ideen.</Text>
      ) : (
        <FlatList data={ideas} keyExtractor={i => i.id} contentContainerStyle={{ padding: 24, gap: 14 }} renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
            <Text style={[styles.ideaTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.from, { color: theme.inkSoft }]}>von {item.profiles?.name ?? 'Nutzer'}</Text>
            <Text style={[styles.body, { color: theme.inkSoft }]} numberOfLines={4}>{item.body}</Text>
            <Pressable style={[styles.action, { backgroundColor: theme.green }]} onPress={() => open(item)}><Text style={{ color: '#fff', fontWeight: '700' }}>Antworten & abschließen</Text></Pressable>
          </View>
        )} />
      )}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: theme.paper }]}> 
          <Text style={[styles.sheetTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Antwort senden</Text>
          <Text style={[styles.body, { color: theme.inkSoft }]}>{selected?.title}</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.rule, color: theme.ink }]} value={response} onChangeText={setResponse} multiline placeholder="Antwort an den Ideengeber …" placeholderTextColor={theme.inkSoft} />
          <View style={styles.btnRow}><Pressable style={[styles.btn, { borderColor: theme.rule, borderWidth: 1 }]} onPress={() => setSelected(null)}><Text style={{ color: theme.inkSoft }}>Abbrechen</Text></Pressable><Pressable style={[styles.btn, { backgroundColor: theme.green }]} onPress={answer}><Text style={{ color: '#fff', fontWeight: '700' }}>Abschließen</Text></Pressable></View>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 15, minHeight: 96 },
  mastheadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  title: { fontSize: 20, lineHeight: 28, includeFontPadding: true, flex: 1 },
  subtabs: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 0, minHeight: 46, alignItems: 'flex-end', borderBottomWidth: 1 },
  subtabPressable: { flex: 1, minWidth: 0 },
  subtab: { fontSize: 9.2, lineHeight: 13, paddingBottom: 8, paddingTop: 2, flex: 1, textAlign: 'center', minWidth: 0 },
  subtabActive: { fontWeight: '600', borderBottomWidth: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 13.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  ideaTitle: { fontSize: 18, lineHeight: 24, includeFontPadding: true },
  from: { fontSize: 11, marginTop: 2, marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 19 },
  action: { marginTop: 14, borderRadius: 100, paddingVertical: 11, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  sheetTitle: { fontSize: 21, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 120, marginTop: 14, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, alignItems: 'center', borderRadius: 100, paddingVertical: 13 },
});
