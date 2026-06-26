import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';

export default function PasswortVergessenScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('E-Mail fehlt', 'Bitte gib die E-Mail-Adresse deines Kontos ein.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: 'wortdestages://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }
    Alert.alert('E-Mail gesendet', 'Wenn ein Konto zu dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen deines Passworts.');
    router.replace('/(auth)/login');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
        <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
      </Pressable>
      <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Passwort vergessen</Text>
      <Text style={[styles.info, { color: theme.inkSoft }]}>Gib deine E-Mail ein. Wir senden dir einen Link, mit dem du ein neues Passwort setzen kannst.</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="E-Mail"
        placeholderTextColor={theme.inkSoft}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Pressable style={[styles.button, { backgroundColor: theme.ink }]} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color={theme.paper} /> : <Text style={[styles.buttonText, { color: theme.paper }]}>Link senden</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  back: { position: 'absolute', top: 58, left: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 36, textAlign: 'center', marginBottom: 10 },
  info: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  button: { borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
