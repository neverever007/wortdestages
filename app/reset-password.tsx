import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { fonts } from '../constants/theme';

type ResetParams = {
  accessToken?: string | null;
  refreshToken?: string | null;
  code?: string | null;
  token?: string | null;
  tokenHash?: string | null;
  type?: string | null;
  error?: string | null;
  errorDescription?: string | null;
};

function first(value: unknown): string | null {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

function readParamsFromUrl(url?: string | null): ResetParams {
  if (!url) return {};

  const all = new URLSearchParams();

  function append(part?: string) {
    if (!part) return;
    const clean = part.startsWith('?') || part.startsWith('#') ? part.slice(1) : part;
    if (!clean) return;
    const params = new URLSearchParams(clean);
    params.forEach((value, key) => all.set(key, value));
  }

  append(url.split('?')[1]?.split('#')[0]);
  append(url.split('#')[1]);

  return {
    accessToken: all.get('access_token'),
    refreshToken: all.get('refresh_token'),
    code: all.get('code'),
    token: all.get('token'),
    tokenHash: all.get('token_hash'),
    type: all.get('type'),
    error: all.get('error'),
    errorDescription: all.get('error_description'),
  };
}

function readParamsFromRoute(params: Record<string, unknown>): ResetParams {
  return {
    accessToken: first(params.access_token),
    refreshToken: first(params.refresh_token),
    code: first(params.code),
    token: first(params.token),
    tokenHash: first(params.token_hash),
    type: first(params.type),
    error: first(params.error),
    errorDescription: first(params.error_description),
  };
}

function mergeParams(...items: ResetParams[]): ResetParams {
  return items.reduce<ResetParams>((acc, item) => ({
    accessToken: acc.accessToken || item.accessToken || null,
    refreshToken: acc.refreshToken || item.refreshToken || null,
    code: acc.code || item.code || null,
    token: acc.token || item.token || null,
    tokenHash: acc.tokenHash || item.tokenHash || null,
    type: acc.type || item.type || null,
    error: acc.error || item.error || null,
    errorDescription: acc.errorDescription || item.errorDescription || null,
  }), {});
}

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const routeResetParams = useMemo(() => readParamsFromRoute(routeParams), [routeParams]);

  useEffect(() => {
    let mounted = true;

    const authSub = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
        setSessionMessage(null);
        setReady(true);
      }
    });

    async function prepare(url?: string | null) {
      try {
        const params = mergeParams(routeResetParams, readParamsFromUrl(url));

        if (params.error) {
          throw new Error(params.errorDescription || params.error);
        }

        if (params.accessToken && params.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (error) throw error;
        } else if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) throw error;
        } else if ((params.tokenHash || params.token) && (params.type === 'recovery' || !params.type)) {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: (params.tokenHash || params.token) as string,
          });
          if (error) throw error;
        }

        const { data } = await supabase.auth.getSession();
        const ok = Boolean(data.session);

        if (mounted) {
          setHasRecoverySession(ok);
          setSessionMessage(ok ? null : 'Der Passwort-Link wurde geöffnet, aber es wurde keine gültige Wiederherstellungs-Sitzung gefunden. Bitte fordere einen neuen Link an und öffne ihn auf diesem Gerät.');
        }
      } catch (error: any) {
        if (mounted) {
          setHasRecoverySession(false);
          setSessionMessage(error?.message ?? 'Der Passwort-Link konnte nicht gelesen werden. Bitte fordere einen neuen Link an.');
        }
      } finally {
        if (mounted) setReady(true);
      }
    }

    Linking.getInitialURL().then(prepare).catch(() => prepare(null));
    const linkSub = Linking.addEventListener('url', ({ url }) => prepare(url));

    return () => {
      mounted = false;
      linkSub.remove();
      authSub.data.subscription.unsubscribe();
    };
  }, [routeResetParams]);

  function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Zeitüberschreitung. Bitte versuche es erneut.')), ms)
      ),
    ]);
  }

  async function savePassword() {
    if (password.length < 6) {
      Alert.alert('Passwort zu kurz', 'Bitte gib mindestens 6 Zeichen ein.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Passwörter stimmen nicht überein', 'Bitte gib zweimal dasselbe Passwort ein.');
      return;
    }

    setSaving(true);

    try {
      const { data } = await withTimeout(supabase.auth.getSession());
      if (!data.session) {
        Alert.alert('Link abgelaufen', 'Es fehlt eine gültige Passwort-Sitzung. Bitte fordere einen neuen Passwort-Link an.');
        return;
      }

      const { error } = await withTimeout(supabase.auth.updateUser({ password }));

      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }

      Alert.alert('Passwort geändert', 'Du kannst dich jetzt mit deinem neuen Passwort anmelden.');
      await withTimeout(supabase.auth.signOut());
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Unbekannter Fehler. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <View style={[styles.container, { backgroundColor: theme.paper }]}> 
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.back} hitSlop={12}>
        <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
      </Pressable>
      <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Neues Passwort</Text>
      <Text style={[styles.info, { color: theme.inkSoft }]}>Lege jetzt ein neues Passwort für dein Konto fest.</Text>

      {!hasRecoverySession && sessionMessage ? (
        <View style={[styles.warning, { borderColor: theme.rule, backgroundColor: theme.card }]}> 
          <Text style={[styles.warningText, { color: theme.inkSoft }]}>{sessionMessage}</Text>
        </View>
      ) : null}

      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="Neues Passwort"
        placeholderTextColor={theme.inkSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.card }]}
        placeholder="Passwort wiederholen"
        placeholderTextColor={theme.inkSoft}
        secureTextEntry
        value={password2}
        onChangeText={setPassword2}
      />

      <Pressable style={[styles.button, { backgroundColor: theme.ink, opacity: saving ? 0.7 : 1 }]} onPress={savePassword} disabled={saving}>
        {saving ? <ActivityIndicator color={theme.paper} /> : <Text style={[styles.buttonText, { color: theme.paper }]}>Passwort speichern</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  back: { position: 'absolute', top: 58, left: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, lineHeight: 38, textAlign: 'center', marginBottom: 10 },
  info: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  warning: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  warningText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  button: { borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
