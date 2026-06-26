import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { useAuth } from '../../lib/AuthContext';

export default function LoginScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGuest() {
    await continueAsGuest();
    router.replace('/(tabs)/heute');
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Fehlende Angaben', 'Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login fehlgeschlagen', error.message);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.outer, { backgroundColor: theme.paper }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
        Wort des Tages
      </Text>
      <Text style={[styles.subtitle, { color: theme.inkSoft }]}>
        Melde dich an, um dein Wort zu erhalten.
      </Text>

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
        placeholder="Passwort"
        placeholderTextColor={theme.inkSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, { backgroundColor: theme.ink }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.paper} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.paper }]}>Anmelden</Text>
        )}
      </Pressable>



      <Link href="/(auth)/passwort-vergessen" asChild>
        <Pressable style={styles.forgotRow}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Passwort vergessen?</Text>
        </Pressable>
      </Link>

      <Pressable
        style={[styles.guestButton, { borderColor: theme.rule }]}
        onPress={handleGuest}
        disabled={loading}
      >
        <Text style={[styles.guestButtonText, { color: theme.ink }]}>Als Gast fortfahren</Text>
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable style={styles.linkRow}>
          <Text style={{ color: theme.inkSoft, fontSize: 13 }}>
            Noch kein Konto? <Text style={{ color: theme.accent, fontWeight: '600' }}>Registrieren</Text>
          </Text>
        </Pressable>
      </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 32, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },
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
  forgotRow: { marginTop: 14, alignItems: 'center' },
  guestButton: { borderWidth: 1, borderRadius: 100, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  guestButtonText: { fontSize: 14, fontWeight: '600' },
  linkRow: { marginTop: 22, alignItems: 'center' },
});
