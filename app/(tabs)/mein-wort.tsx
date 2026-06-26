import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function MeinWortScreen() {
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
  const [todayEntry, setTodayEntry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_words_personal')
      .select('wort')
      .eq('user_id', profile.id)
      .eq('datum', todayIso)
      .maybeSingle();
    setTodayEntry(data?.wort ?? null);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  async function handleSave() {
    if (todayEntry) {
      Alert.alert('Bereits eingereicht', 'Du hast heute bereits dein Wort eingereicht. Morgen kannst du wieder ein neues Wort eintragen.');
      return;
    }
    if (!wort.trim() || !profile) return;
    if (wort.trim().length > 40) {
      Alert.alert('Zu lang', 'Bitte maximal 40 Zeichen.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('register_personal_word', { p_wort: wort.trim() });
    setSaving(false);
    if (error) { Alert.alert('Fehler', error.message); return; }
    setTodayEntry(wort.trim());
    setWort('');
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.paper }]}><ActivityIndicator color={theme.accent} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Mein Wort des Tages</Text>
      </View>

      <View style={{ padding: 24 }}>
        <Text style={[styles.intro, { color: theme.inkSoft }]}>
          Welches Wort begleitet dich heute? Trage einmal täglich dein persönliches Wort ein — es ist auf deinem Profil sichtbar.
        </Text>

        {todayEntry ? (
          <Pressable onPress={() => Alert.alert('Bereits eingereicht', 'Du hast heute bereits dein Wort eingereicht. Morgen kannst du wieder ein neues Wort eintragen.')} style={[styles.todayCard, { backgroundColor: theme.card, borderColor: theme.rule }]}>
            <Text style={{ color: theme.inkSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
              Dein heutiges Wort
            </Text>
            <Text style={[styles.todayWord, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
              {todayEntry}
            </Text>
            <Text style={{ color: theme.inkSoft, fontSize: 12, marginTop: 8 }}>
              Du hast heute bereits ein Wort eingetragen.
            </Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]}
              placeholder="Dein Wort für heute …"
              placeholderTextColor={theme.inkSoft}
              value={wort}
              onChangeText={setWort}
              maxLength={40}
            />
            <Pressable
              style={[styles.btn, { backgroundColor: wort.trim() ? theme.accent : theme.rule }]}
              onPress={handleSave}
              disabled={saving || !wort.trim()}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Eintragen</Text>}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 18 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 24 },
  todayCard: { borderWidth: 1, borderRadius: 16, padding: 20 },
  todayWord: { fontSize: 32 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, marginBottom: 16 },
  btn: { borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
