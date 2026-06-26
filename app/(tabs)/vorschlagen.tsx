import { useEffect, useState, useCallback } from 'react';
import { BackHandler, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function VorschlagenScreen() {
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


  const [wort, setWort] = useState('');
  const [begruendung, setBegruendung] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!wort.trim() || !begruendung.trim()) {
      Alert.alert('Fehlende Angaben', 'Bitte Wort und Begründung ausfüllen.');
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    const { error } = await supabase.from('word_suggestions').insert({
      user_id: profile.id,
      wort: wort.trim(),
      begruendung: begruendung.trim(),
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Fehler', 'Vorschlag konnte nicht gesendet werden.');
      return;
    }

    Alert.alert('Danke!', 'Dein Vorschlag wurde eingereicht.');
    goBack(router, returnTo || '/(tabs)/profil');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
          Wort vorschlagen
        </Text>
      </View>

      <View style={{ padding: 24 }}>
        <Text style={[styles.intro, { color: theme.inkSoft }]}>
          Du hast ein schönes, seltenes oder besonderes Wort entdeckt? Schlag es vor — gefällt es uns,
          wird es als Wort des Tages veröffentlicht.
        </Text>

        <Text style={[styles.label, { color: theme.inkSoft }]}>Dein Wort</Text>
        <TextInput
          style={[
            styles.input,
            styles.wordInput,
            { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink, fontFamily: fonts.serifSemiBold },
          ]}
          placeholder="z. B. Sonnenklar"
          placeholderTextColor={theme.inkSoft}
          value={wort}
          onChangeText={setWort}
        />

        <Text style={[styles.label, { color: theme.inkSoft }]}>Warum sollte es Wort des Tages werden?</Text>
        <TextInput
          style={[
            styles.input,
            styles.textarea,
            { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink },
          ]}
          placeholder="Kurze Begründung oder Bedeutung …"
          placeholderTextColor={theme.inkSoft}
          multiline
          maxLength={280}
          value={begruendung}
          onChangeText={setBegruendung}
        />
        <Text style={[styles.charCount, { color: theme.inkSoft }]}>{begruendung.length} / 280</Text>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: theme.accent }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Wird gesendet …' : 'Vorschlag einsenden'}
          </Text>
        </Pressable>
        <Text style={[styles.note, { color: theme.inkSoft }]}>
          Du erfährst unter „Meine Vorschläge", wie es weitergeht.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 14,
  },
  title: { fontSize: 20 },
  intro: { fontSize: 13.5, lineHeight: 20, marginBottom: 26 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 18 },
  wordInput: { fontSize: 20 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: -12, marginBottom: 18 },
  submitBtn: { borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  note: { textAlign: 'center', fontSize: 11.5, marginTop: 12 },
});
