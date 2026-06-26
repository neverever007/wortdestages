import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';
import { getDefaultLegalDocument, loadLegalDocument, saveLegalDocument, LegalSlug } from '../../lib/legal';

type Tab = LegalSlug;
const TABS: { slug: Tab; label: string }[] = [
  { slug: 'datenschutz', label: 'Datenschutz' },
  { slug: 'impressum', label: 'Impressum' },
  { slug: 'nutzungsbedingungen', label: 'Nutzung' },
];

export default function AdminRechtlichesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab = TABS.find(t => t.slug === tab)?.slug ?? 'datenschutz';
  const [active, setActive] = useState<Tab>(initialTab);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (slug: Tab) => {
    setLoading(true);
    const doc = await loadLegalDocument(slug);
    setTitle(doc.title);
    setContent(doc.content);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(active); }, [active, load]));

  async function save() {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Fehlt noch etwas', 'Titel und Inhalt dürfen nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      await saveLegalDocument(active, title, content);
      Alert.alert('Gespeichert', 'Der Rechtstext wurde aktualisiert.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message ?? 'Der Text konnte nicht gespeichert werden. Bitte SQL für v28 ausführen.');
    } finally {
      setSaving(false);
    }
  }

  function resetToTemplate() {
    const doc = getDefaultLegalDocument(active);
    setTitle(doc.title);
    setContent(doc.content);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <View style={styles.mastheadLeft}>
          <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
          </Pressable>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>Rechtliches bearbeiten</Text>
        </View>
      </View>

      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}> 
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/neues-wort')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Neues Wort</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/planung')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Planung</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/vorschlaege')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Vorschläge</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/app-ideen')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>App-Ideen</Text></Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/historie')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Historie</Text></Pressable>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>Recht</Text>
      </View>

      <View style={[styles.legalTabs, { borderBottomColor: theme.rule }]}> 
        {TABS.map((tab) => (
          <Pressable key={tab.slug} onPress={() => setActive(tab.slug)} style={[styles.legalTab, active === tab.slug && { backgroundColor: `${theme.accent}20`, borderColor: theme.accent }]}> 
            <Text style={{ color: active === tab.slug ? theme.ink : theme.inkSoft, fontSize: 12, fontWeight: '700' }}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: theme.inkSoft }]}>Titel</Text>
          <TextInput style={[styles.input, { color: theme.ink, backgroundColor: theme.card, borderColor: theme.rule }]} value={title} onChangeText={setTitle} />

          <Text style={[styles.label, { color: theme.inkSoft, marginTop: 16 }]}>Inhalt</Text>
          <TextInput
            style={[styles.input, styles.textarea, { color: theme.ink, backgroundColor: theme.card, borderColor: theme.rule }]}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="Rechtstext eingeben …"
            placeholderTextColor={theme.inkSoft}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.secondary, { borderColor: theme.rule }]} onPress={resetToTemplate}>
              <Text style={{ color: theme.inkSoft, fontWeight: '700' }}>Vorlage laden</Text>
            </Pressable>
            <Pressable style={[styles.primary, { backgroundColor: theme.ink }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.paper} /> : <Text style={{ color: theme.paper, fontWeight: '800' }}>Speichern</Text>}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 15, minHeight: 96 },
  mastheadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  title: { fontSize: 20, lineHeight: 28, includeFontPadding: true, flex: 1 },
  subtabs: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 8, minHeight: 46, alignItems: 'flex-end', borderBottomWidth: 1 },
  subtabPressable: { flex: 1, minWidth: 0 },
  subtab: { fontSize: 9.2, lineHeight: 13, paddingBottom: 8, paddingTop: 2, flex: 1, textAlign: 'center', minWidth: 0 },
  subtabActive: { fontWeight: '700', borderBottomWidth: 2 },
  legalTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  legalTab: { flex: 1, borderWidth: 1, borderColor: 'transparent', borderRadius: 999, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 20 },
  textarea: { minHeight: 360 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondary: { flex: 1, borderWidth: 1, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  primary: { flex: 1, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
});
