import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function KontoLoeschenScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { profile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!profile?.email) return;
    if (confirmText.trim().toUpperCase() !== 'LÖSCHEN' && confirmText.trim().toUpperCase() !== 'LOESCHEN') {
      Alert.alert('Bestätigung fehlt', 'Bitte gib LÖSCHEN ein, um die Löschung zu bestätigen.');
      return;
    }
    if (!password) {
      Alert.alert('Passwort fehlt', 'Bitte gib dein Passwort ein.');
      return;
    }

    Alert.alert(
      'Profil wirklich löschen?',
      'Dein Konto und deine App-Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Dauerhaft löschen',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const authCheck = await supabase.auth.signInWithPassword({ email: profile.email, password });
            if (authCheck.error) {
              setLoading(false);
              Alert.alert('Passwort falsch', 'Bitte prüfe dein Passwort und versuche es erneut.');
              return;
            }
            const { error } = await supabase.rpc('delete_current_user');
            setLoading(false);
            if (error) {
              Alert.alert('Löschung nicht möglich', 'Die Datenbankfunktion fehlt oder ist nicht korrekt eingerichtet. Führe zuerst die V27-SQL-Datei in Supabase aus.');
              return;
            }
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Profil löschen</Text>
      </View>
      <View style={{ padding: 24 }}>
        <Text style={[styles.warning, { color: theme.ink }]}>Diese Aktion löscht dein Konto dauerhaft.</Text>
        <Text style={[styles.info, { color: theme.inkSoft }]}>Favoriten, Statistik, persönliche Wörter, Freundschaften, Abzeichen und Profilinformationen werden entfernt. Das kann nicht rückgängig gemacht werden.</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]}
          placeholder="Passwort"
          placeholderTextColor={theme.inkSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]}
          placeholder="LÖSCHEN eingeben"
          placeholderTextColor={theme.inkSoft}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />
        <Pressable style={[styles.deleteBtn, { backgroundColor: '#B84A32' }]} onPress={handleDelete} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>Profil dauerhaft löschen</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20, lineHeight: 28 },
  warning: { fontSize: 20, lineHeight: 28, fontWeight: '700', marginBottom: 8 },
  info: { fontSize: 13.5, lineHeight: 20, marginBottom: 22 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  deleteBtn: { borderRadius: 100, alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  deleteText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
