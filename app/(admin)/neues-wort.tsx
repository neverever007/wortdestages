import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function NeuesWortScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  // Wird per Navigation übergeben, wenn ein Community-Vorschlag angenommen wurde,
  // oder wenn aus der Planungsoberfläche ein Tag (mit oder ohne bestehendes Wort) angeklickt wurde
  const params = useLocalSearchParams<{
    suggestionId?: string;
    prefillWort?: string;
    prefillBegruendung?: string;
    suggestedByName?: string;
    editWordId?: string;
    editDatum?: string;
    prefillDatum?: string;
    awardPoints?: string;
    reviewNote?: string;
  }>();

  const [wort, setWort] = useState(params.prefillWort ?? '');
  const [lautschrift, setLautschrift] = useState('');
  const [wortart, setWortart] = useState('');
  const [definition, setDefinition] = useState('');
  const [beispielsatz, setBeispielsatz] = useState('');
  const [synonyme, setSynonyme] = useState('');
  const [datum, setDatum] = useState(() => {
    if (params.editDatum) return params.editDatum;
    if (params.prefillDatum) return params.prefillDatum;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!params.editWordId);

  // Duplikat-Prüfung: zeigt frühere Vorkommen des eingegebenen Wortes
  const [duplicates, setDuplicates] = useState<{ id: string; datum: string }[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const isFromSuggestion = !!params.suggestionId;
  const isEditing = !!params.editWordId;

  // Bestehendes Wort laden, falls aus der Planung ein belegter Tag angeklickt wurde
  useEffect(() => {
    if (!params.editWordId) return;
    (async () => {
      const { data } = await supabase
        .from('words')
        .select('*')
        .eq('id', params.editWordId)
        .single();
      if (data) {
        setWort(data.wort ?? '');
        setLautschrift(data.lautschrift ?? '');
        setWortart(data.wortart ?? '');
        setDefinition(data.definition ?? '');
        setBeispielsatz(data.beispielsatz ?? '');
        setSynonyme((data.synonyme ?? []).join(', '));
      }
      setLoadingExisting(false);
    })();
  }, [params.editWordId]);

  // Live-Prüfung, ob das eingegebene Wort schon einmal vorkam (außer am gerade bearbeiteten Tag selbst)
  useEffect(() => {
    const trimmed = wort.trim();
    if (trimmed.length < 2) {
      setDuplicates([]);
      return;
    }
    setCheckingDuplicates(true);
    const timeout = setTimeout(async () => {
      let query = supabase.from('words').select('id, datum').ilike('wort', trimmed);
      if (params.editWordId) {
        query = query.neq('id', params.editWordId);
      }
      const { data } = await query;
      setDuplicates(data ?? []);
      setCheckingDuplicates(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [wort]);

  async function handleSubmit() {
    if (!wort.trim() || !definition.trim() || !datum) {
      Alert.alert('Fehlende Angaben', 'Wort, Definition und Datum sind erforderlich.');
      return;
    }

    setSubmitting(true);
    const synonymeArray = synonyme
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (isFromSuggestion && params.suggestionId) {
      const pointsToAward = params.awardPoints ? parseInt(params.awardPoints, 10) : 20;
      const { error } = await supabase.rpc('accept_suggestion', {
        p_suggestion_id: params.suggestionId,
        p_lautschrift: lautschrift || null,
        p_wortart: wortart || null,
        p_definition: definition,
        p_beispielsatz: beispielsatz || null,
        p_synonyme: synonymeArray,
        p_datum: datum,
        p_points: Number.isFinite(pointsToAward) ? pointsToAward : 20,
        p_review_note: params.reviewNote || null,
      });
      setSubmitting(false);

      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }
    } else if (isEditing && params.editWordId) {
      const { error } = await supabase
        .from('words')
        .update({
          wort: wort.trim(),
          lautschrift: lautschrift || null,
          wortart: wortart || null,
          definition,
          beispielsatz: beispielsatz || null,
          synonyme: synonymeArray,
          datum,
        })
        .eq('id', params.editWordId);
      setSubmitting(false);

      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('words').insert({
        wort: wort.trim(),
        lautschrift: lautschrift || null,
        wortart: wortart || null,
        definition,
        beispielsatz: beispielsatz || null,
        synonyme: synonymeArray,
        datum,
      });
      setSubmitting(false);

      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }
    }

    Alert.alert('Gespeichert', 'Das Wort wurde eingeplant.');
    goBack(router, '/(tabs)/profil');
  }

  if (loadingExisting) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.paper }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <View style={styles.mastheadLeft}>
          <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
          </Pressable>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
            {isEditing ? 'Wort bearbeiten' : 'Neues Wort'}
          </Text>
        </View>
        <View style={[styles.adminBadge, { borderColor: theme.accent }]}>
          <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>ADMIN</Text>
        </View>
      </View>

      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>
          {isEditing ? 'Bearbeiten' : 'Neues Wort'}
        </Text>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/planung')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Planung</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/vorschlaege')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Vorschläge</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/app-ideen')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>App-Ideen</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/historie')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Historie</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/rechtliches')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Recht</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        {isFromSuggestion && (
          <View
            style={[
              styles.sourceBanner,
              { backgroundColor: `${theme.accent}14`, borderColor: `${theme.accent}40` },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontSize: 12.5, fontWeight: '600' }}>
                Community-Vorschlag von {params.suggestedByName ?? 'Nutzer'}
              </Text>
              {params.prefillBegruendung && (
                <Text
                  style={{
                    color: theme.inkSoft,
                    fontSize: 12.5,
                    fontStyle: 'italic',
                    marginTop: 4,
                    fontFamily: fonts.serifItalic,
                  }}
                >
                  „{params.prefillBegruendung}"
                </Text>
              )}
            </View>
          </View>
        )}

        <Field label="Wort" theme={theme}>
          <TextInput
            style={[styles.input, styles.wordInput, inputStyle(theme)]}
            value={wort}
            onChangeText={setWort}
            placeholder="z. B. Fernweh"
            placeholderTextColor={theme.inkSoft}
          />
        </Field>

        {checkingDuplicates && (
          <Text style={{ color: theme.inkSoft, fontSize: 12, marginTop: -10, marginBottom: 14 }}>
            Prüfe, ob das Wort schon vorkam …
          </Text>
        )}
        {!checkingDuplicates && duplicates.length > 0 && (
          <View style={[styles.duplicateWarning, { backgroundColor: `${theme.gold}20`, borderColor: theme.gold }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.gold} />
            <Text style={{ color: theme.ink, fontSize: 12.5, flex: 1 }}>
              Dieses Wort gab es schon{' '}
              {duplicates.length === 1
                ? `am ${formatDate(duplicates[0].datum)}`
                : `${duplicates.length}x, zuletzt am ${formatDate(
                    duplicates.map((d) => d.datum).sort().reverse()[0]
                  )}`}
              .
            </Text>
          </View>
        )}

        <View style={styles.row2}>
          <Field label="Lautschrift" theme={theme} flex>
            <TextInput
              style={[styles.input, inputStyle(theme)]}
              value={lautschrift}
              onChangeText={setLautschrift}
              placeholder="[ˈfɛʁnveː]"
              placeholderTextColor={theme.inkSoft}
            />
          </Field>
          <Field label="Wortart" theme={theme} flex>
            <TextInput
              style={[styles.input, inputStyle(theme)]}
              value={wortart}
              onChangeText={setWortart}
              placeholder="Substantiv"
              placeholderTextColor={theme.inkSoft}
            />
          </Field>
        </View>

        <Field label="Definition" theme={theme}>
          <TextInput
            style={[styles.input, styles.textarea, inputStyle(theme)]}
            value={definition}
            onChangeText={setDefinition}
            placeholder="Bedeutung des Wortes …"
            placeholderTextColor={theme.inkSoft}
            multiline
          />
        </Field>

        <Field label="Beispielsatz" theme={theme}>
          <TextInput
            style={[styles.input, styles.textarea, inputStyle(theme)]}
            value={beispielsatz}
            onChangeText={setBeispielsatz}
            placeholder="„…"
            placeholderTextColor={theme.inkSoft}
            multiline
          />
        </Field>

        <Field label="Synonyme (kommagetrennt)" theme={theme}>
          <TextInput
            style={[styles.input, inputStyle(theme)]}
            value={synonyme}
            onChangeText={setSynonyme}
            placeholder="Wanderlust, Sehnsucht"
            placeholderTextColor={theme.inkSoft}
          />
        </Field>

        <Field label="Veröffentlichungsdatum (JJJJ-MM-TT)" theme={theme}>
          <TextInput
            style={[styles.input, inputStyle(theme)]}
            value={datum}
            onChangeText={setDatum}
            placeholder="2026-06-17"
            placeholderTextColor={theme.inkSoft}
          />
        </Field>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: theme.accent }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Wird gespeichert …' : isEditing ? 'Änderungen speichern' : 'Wort einplanen'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Field({
  label,
  theme,
  children,
  flex,
}: {
  label: string;
  theme: any;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={[styles.fieldLabel, { color: theme.inkSoft }]}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(theme: any) {
  return { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
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
  sourceBanner: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  duplicateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: -10,
    marginBottom: 16,
  },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  row2: { flexDirection: 'row', gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  wordInput: { fontSize: 22, fontWeight: '600' },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
