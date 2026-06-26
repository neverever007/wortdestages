import { useEffect, useState, useCallback } from 'react';
import { BackHandler, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function FreundeHinzufuegenScreen() {
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

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSend() {
    if (!code.trim() || !profile) return;
    if (code.trim().toUpperCase() === profile.friend_code) {
      Alert.alert('Hinweis', 'Das ist dein eigener Freundescode.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('send_friend_request', { p_code: code.trim().toUpperCase() });
    setSubmitting(false);

    if (error) {
      Alert.alert('Fehler', error.message === 'Code not found' ? 'Kein Nutzer mit diesem Code gefunden.' : error.message);
      return;
    }
    Alert.alert('Anfrage gesendet', 'Die Freundschaftsanfrage wurde gesendet. Sie muss noch angenommen werden.');
    goBack(router, returnTo || '/(tabs)/profil');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Freund hinzufügen</Text>
      </View>

      <View style={{ padding: 24 }}>
        <Text style={[styles.intro, { color: theme.inkSoft }]}>
          Gib den Freundescode deines Freundes ein. Er erhält dann eine Anfrage, die er annehmen muss.
        </Text>
        <TextInput
          style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink, fontFamily: fonts.serifSemiBold }]}
          placeholder="z. B. WORT-7K2M"
          placeholderTextColor={theme.inkSoft}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleSend} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Wird gesendet …' : 'Anfrage senden'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20 },
  intro: { fontSize: 13.5, lineHeight: 20, marginBottom: 22 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, marginBottom: 18, textAlign: 'center' },
  button: { borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
