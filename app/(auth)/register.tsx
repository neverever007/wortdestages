import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { migrateGuestDataToAccount } from '../../lib/guest';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) {
      Alert.alert('Fehlende Angaben', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Passwort zu kurz', 'Mindestens 6 Zeichen verwenden.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setLoading(false);
      Alert.alert('Registrierung fehlgeschlagen', error.message);
      return;
    }

    if (data.user && name) {
      await supabase.from('profiles').update({ name }).eq('id', data.user.id);
    }

    if (data.session?.user?.id) {
      await migrateGuestDataToAccount(data.session.user.id);
      setLoading(false);
      router.replace('/(tabs)/heute');
      return;
    }

    setLoading(false);
    Alert.alert(
      'Konto erstellt',
      'Dein Konto wurde erstellt. Du kannst dich jetzt anmelden und direkt loslegen.'
    );
    router.replace('/(auth)/login');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        Konto erstellen
      </Text>
      <Text style={[styles.info, { color: theme.inkSoft }]}>Nach der Registrierung kannst du sofort loslegen. Eine Bestätigung per E-Mail ist nicht erforderlich.</Text>

      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="Name"
        placeholderTextColor={theme.inkSoft}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="E-Mail"
        placeholderTextColor={theme.inkSoft}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="Passwort (min. 6 Zeichen)"
        placeholderTextColor={theme.inkSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, { backgroundColor: theme.ink }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.paper} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.paper }]}>Registrieren</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: theme.inkSoft, fontSize: 13 }}>
            Schon ein Konto? <Text style={{ color: theme.accent, fontWeight: '600' }}>Anmelden</Text>
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 28, lineHeight: 36, marginBottom: 10, textAlign: 'center', includeFontPadding: true },
  info: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  linkRow: { marginTop: 22, alignItems: 'center' },
});
