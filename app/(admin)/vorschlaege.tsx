import { useCallback, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Pressable, Modal, Alert, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { WordSuggestion } from '../../lib/types';
import { goBack } from '../../lib/navigation';

type SuggestionWithUser = WordSuggestion & { profiles: { name: string | null } | null };

export default function AdminVorschlaegeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<SuggestionWithUser | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SuggestionWithUser | null>(null);
  const [duplicatesByWord, setDuplicatesByWord] = useState<Record<string, number>>({});

  const [acceptPoints, setAcceptPoints] = useState('20');
  const [acceptNote, setAcceptNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('word_suggestions')
      .select('*, profiles(name)')
      .eq('status', 'offen')
      .order('created_at', { ascending: true });
    const list = (data as any) ?? [];
    setSuggestions(list);

    // Für jeden Vorschlag prüfen, ob das Wort schon einmal in `words` vorkam
    const counts: Record<string, number> = {};
    await Promise.all(
      list.map(async (s: SuggestionWithUser) => {
        const { count } = await supabase
          .from('words')
          .select('*', { count: 'exact', head: true })
          .ilike('wort', s.wort);
        counts[s.id] = count ?? 0;
      })
    );
    setDuplicatesByWord(counts);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  function openReject(suggestion: SuggestionWithUser) {
    setRejectNote('');
    setRejectTarget(suggestion);
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return;
    await supabase.rpc('reject_suggestion', {
      p_suggestion_id: rejectTarget.id,
      p_review_note: rejectNote.trim() || null,
    });
    setSuggestions((prev) => prev.filter((s) => s.id !== rejectTarget.id));
    setRejectTarget(null);
  }

  function openAccept(suggestion: SuggestionWithUser) {
    setAcceptPoints('20');
    setAcceptNote('');
    setConfirmTarget(suggestion);
  }

  function handleConfirmAccept() {
    if (!confirmTarget) return;
    const points = parseInt(acceptPoints, 10);
    router.push({
      pathname: '/(admin)/neues-wort',
      params: {
        suggestionId: confirmTarget.id,
        prefillWort: confirmTarget.wort,
        prefillBegruendung: confirmTarget.begruendung,
        suggestedByName: confirmTarget.profiles?.name ?? 'Nutzer',
        awardPoints: String(Number.isFinite(points) ? points : 20),
        reviewNote: acceptNote.trim(),
      },
    });
    setConfirmTarget(null);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <View style={styles.mastheadLeft}>
          <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
          </Pressable>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1}>
            Vorschläge
          </Text>
        </View>
        <View style={[styles.adminBadge, { borderColor: theme.accent }]}>
          <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>ADMIN</Text>
        </View>
      </View>

      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/neues-wort')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Neues Wort</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/planung')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Planung</Text>
        </Pressable>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>
          Vorschläge
        </Text>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/app-ideen')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>App-Ideen</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/historie')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Historie</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/rechtliches')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Recht</Text></Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : suggestions.length === 0 ? (
        <Text style={[styles.empty, { color: theme.inkSoft }]}>Keine offenen Vorschläge.</Text>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, gap: 14 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}>
              <View style={styles.cardTop}>
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.word, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
                  {item.wort}
                </Text>
                <Text numberOfLines={1} style={[styles.from, { color: theme.inkSoft }]}>
                  von {item.profiles?.name ?? 'Nutzer'}
                </Text>
              </View>

              {duplicatesByWord[item.id] > 0 && (
                <View style={[styles.duplicateWarning, { backgroundColor: `${theme.gold}20`, borderColor: theme.gold }]}>
                  <Ionicons name="alert-circle-outline" size={14} color={theme.gold} />
                  <Text style={{ color: theme.ink, fontSize: 11.5, flex: 1 }}>
                    Dieses Wort gab es schon {duplicatesByWord[item.id]}x
                  </Text>
                </View>
              )}

              <Text numberOfLines={3} style={[styles.reason, { color: theme.inkSoft }]}>{item.begruendung}</Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: `${theme.red}1A` }]}
                  onPress={() => openReject(item)}
                >
                  <Text style={{ color: theme.red, fontSize: 13, fontWeight: '500' }}>Ablehnen</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.green }]}
                  onPress={() => openAccept(item)}
                >
                  <Text style={{ color: 'white', fontSize: 13, fontWeight: '500' }}>Annehmen</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!confirmTarget} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.paper }]}>
            <View style={[styles.handle, { backgroundColor: theme.rule }]} />
            <Text style={[styles.sheetTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
              Vorschlag annehmen?
            </Text>
            <Text style={[styles.sheetText, { color: theme.inkSoft }]}>
              Das Wort wird als Community-Vorschlag gekennzeichnet, sobald es veröffentlicht wird. Im
              nächsten Schritt ergänzt du Lautschrift, Definition, Beispiel und Datum.
            </Text>

            {confirmTarget && (
              <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.rule }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.previewWord, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
                  {confirmTarget.wort}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.accent, fontSize: 11.5, marginBottom: 8 }}>
                  Vorgeschlagen von {confirmTarget.profiles?.name ?? 'Nutzer'}
                </Text>
                <Text style={{ color: theme.inkSoft, fontSize: 13, lineHeight: 18 }}>
                  {confirmTarget.begruendung}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.inkSoft }]}>Punkte für den Einreicher</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]}
              value={acceptPoints}
              onChangeText={setAcceptPoints}
              keyboardType="number-pad"
              placeholder="20"
              placeholderTextColor={theme.inkSoft}
            />

            <Text style={[styles.fieldLabel, { color: theme.inkSoft, marginTop: 14 }]}>
              Begründung (optional, für den Einreicher sichtbar)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink },
              ]}
              value={acceptNote}
              onChangeText={setAcceptNote}
              placeholder="z. B. Tolle Wahl, passt super in den Sommer!"
              placeholderTextColor={theme.inkSoft}
              multiline
            />

            <View style={styles.btnRow}>
              <Pressable
                style={[styles.btn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.rule }]}
                onPress={() => setConfirmTarget(null)}
              >
                <Text style={{ color: theme.inkSoft, fontSize: 14 }}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: theme.green }]} onPress={handleConfirmAccept}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Annehmen & weiter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!rejectTarget} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.paper }]}>
            <View style={[styles.handle, { backgroundColor: theme.rule }]} />
            <Text style={[styles.sheetTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
              Vorschlag ablehnen?
            </Text>
            <Text style={[styles.sheetText, { color: theme.inkSoft }]}>
              „{rejectTarget?.wort}" wird abgelehnt. Du kannst dem Einreicher optional eine kurze
              Begründung mitgeben.
            </Text>

            <Text style={[styles.fieldLabel, { color: theme.inkSoft }]}>
              Begründung (optional, für den Einreicher sichtbar)
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink },
              ]}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="z. B. Gab es leider schon vor kurzem."
              placeholderTextColor={theme.inkSoft}
              multiline
            />

            <View style={styles.btnRow}>
              <Pressable
                style={[styles.btn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.rule }]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={{ color: theme.inkSoft, fontSize: 14 }}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: theme.red }]} onPress={handleConfirmReject}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Ablehnen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 15,
    minHeight: 96,
  },
  mastheadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, lineHeight: 28, includeFontPadding: true },
  adminBadge: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 },
  subtabs: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 0, minHeight: 46, alignItems: 'flex-end', borderBottomWidth: 1 },
  subtabPressable: { flex: 1, minWidth: 0 },
  subtab: { fontSize: 9.2, lineHeight: 13, paddingBottom: 8, paddingTop: 2, flex: 1, textAlign: 'center', minWidth: 0 },
  subtabActive: { fontWeight: '600', borderBottomWidth: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 13.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  word: { fontSize: 20, lineHeight: 25, includeFontPadding: true },
  from: { fontSize: 11 },
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  reason: { fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 26, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 100, alignSelf: 'center', marginBottom: 22 },
  sheetTitle: { fontSize: 21, marginBottom: 8 },
  sheetText: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  previewCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20 },
  previewWord: { fontSize: 20, marginBottom: 4 },
  fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { minHeight: 56, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 100 },
});
