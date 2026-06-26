import { useEffect, useState, useCallback } from 'react';
import { BackHandler, View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function AppIdeeScreen() {
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

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!profile || !title.trim() || !body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('app_ideas').insert({ user_id: profile.id, title: title.trim(), body: body.trim() });
    setSaving(false);
    if (error) { Alert.alert('Fehler', error.message); return; }
    Alert.alert('Danke', 'Deine Idee wurde gespeichert. Den Status findest du unter „Meine Ideen“.');
    goBack(router, returnTo || '/(tabs)/profil');
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>App-Idee</Text>
      </View>
      <View style={{ padding: 24 }}>
        <Text style={[styles.label, { color: theme.inkSoft }]}>Titel</Text>
        <TextInput style={[styles.input, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]} value={title} onChangeText={setTitle} placeholder="z. B. Neues Abzeichen" placeholderTextColor={theme.inkSoft} maxLength={80} />
        <Text style={[styles.label, { color: theme.inkSoft, marginTop: 16 }]}>Beschreibung</Text>
        <TextInput style={[styles.input, styles.area, { borderColor: theme.rule, backgroundColor: theme.card, color: theme.ink }]} value={body} onChangeText={setBody} placeholder="Beschreibe deine Idee kurz …" placeholderTextColor={theme.inkSoft} multiline maxLength={800} />
        <Pressable style={[styles.button, { backgroundColor: title.trim() && body.trim() ? theme.accent : theme.rule }]} disabled={saving || !title.trim() || !body.trim()} onPress={submit}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Idee senden</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 21, lineHeight: 29, includeFontPadding: true, flex: 1 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  area: { minHeight: 130, textAlignVertical: 'top', lineHeight: 21 },
  button: { marginTop: 22, borderRadius: 100, alignItems: 'center', paddingVertical: 14 },
});
