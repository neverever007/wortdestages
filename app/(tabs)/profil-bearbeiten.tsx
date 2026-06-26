import { useState, useEffect, useCallback } from 'react';
import { BackHandler, View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

const AVATAR_OPTIONS = ['🦊', '🦉', '🐝', '🐢', '🦋', '🐦', '🌿', '🌙', '☀️', '🍂', '🌊', '⛰️'];

export default function ProfilBearbeitenScreen() {
  const { theme } = useTheme();
  const { profile, refreshProfile } = useAuth();
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


  const [name, setName] = useState(profile?.name ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url ?? AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  // Live-Prüfung ob Name schon vergeben
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile?.name) {
      setNameTaken(false);
      return;
    }
    setCheckingName(true);
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('name', trimmed)
        .neq('id', profile?.id ?? '')
        .maybeSingle();
      setNameTaken(!!data);
      setCheckingName(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [name]);

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) { Alert.alert('Name fehlt', 'Bitte gib einen Namen ein.'); return; }
    if (nameTaken) { Alert.alert('Name vergeben', 'Dieser Name ist bereits vergeben. Bitte wähle einen anderen.'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), avatar_url: selectedAvatar })
      .eq('id', profile.id);
    setSaving(false);

    if (error) { Alert.alert('Fehler', 'Änderungen konnten nicht gespeichert werden.'); return; }
    await refreshProfile();
    goBack(router, returnTo || '/(tabs)/profil');
  }

  if (!profile) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Profil bearbeiten</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <View style={[styles.avatarPreviewWrap, { backgroundColor: '#1F1A14' }]}>
          <Text style={styles.avatarPreviewEmoji}>{selectedAvatar}</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.inkSoft }]}>Profilbild wählen</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_OPTIONS.map((emoji) => {
            const isSelected = selectedAvatar === emoji;
            return (
              <Pressable key={emoji} onPress={() => setSelectedAvatar(emoji)}
                style={[styles.avatarOption, { backgroundColor: theme.card, borderColor: isSelected ? theme.accent : theme.rule, borderWidth: isSelected ? 2 : 1 }]}>
                <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.inkSoft, marginTop: 26 }]}>Name</Text>
        <TextInput
          style={[styles.input, { borderColor: nameTaken ? theme.red : theme.rule, color: theme.ink, backgroundColor: theme.card }]}
          placeholder="Dein Name"
          placeholderTextColor={theme.inkSoft}
          value={name}
          onChangeText={setName}
        />
        {checkingName && <Text style={{ color: theme.inkSoft, fontSize: 12, marginTop: 4 }}>Prüfe Name …</Text>}
        {!checkingName && nameTaken && (
          <Text style={{ color: theme.red, fontSize: 12, marginTop: 4 }}>
            Dieser Name ist bereits vergeben.
          </Text>
        )}
        {!checkingName && !nameTaken && name.trim() && name.trim() !== profile.name && (
          <Text style={{ color: theme.green, fontSize: 12, marginTop: 4 }}>Name ist verfügbar ✓</Text>
        )}

        <Pressable style={[styles.saveBtn, { backgroundColor: nameTaken ? theme.rule : theme.accent }]}
          onPress={handleSave} disabled={saving || nameTaken}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Speichern</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  backBtn: { padding: 4 },
  title: { fontSize: 20 },
  avatarPreviewWrap: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  avatarPreviewEmoji: { fontSize: 44 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarOptionEmoji: { fontSize: 26 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  saveBtn: { borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
