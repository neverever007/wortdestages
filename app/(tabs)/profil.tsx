import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, TextInput, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { getLevelForXp, LEVELS } from '../../lib/levels';
import { checkWordAllowed } from '../../lib/moderation';
import { getGuestPersonalWords } from '../../lib/guest';

type PersonalWord = { datum: string; wort: string };

export default function ProfilScreen() {
  const { theme } = useTheme();
  const { profile, signOut, isGuest, leaveGuestMode } = useAuth();
  const router = useRouter();

  const [personalWords, setPersonalWords] = useState<PersonalWord[]>([]);
  const [todayWord, setTodayWord] = useState<string | null>(null);
  const [newWord, setNewWord] = useState('');
  const [savingWord, setSavingWord] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  async function loadPersonalWords() {
    if (!profile) return;
    let list: PersonalWord[] = [];
    if (isGuest) {
      list = await getGuestPersonalWords();
    } else {
      const { data } = await supabase.rpc('get_personal_words', { p_user_id: profile.id });
      list = data ?? [];
    }
    setPersonalWords(list);
    const today = list.find(w => w.datum === todayIso);
    setTodayWord(today?.wort ?? null);
  }

  useFocusEffect(useCallback(() => { loadPersonalWords(); }, [profile?.id]));

  async function handleSaveWord() {
    if (todayWord) {
      Alert.alert('Bereits eingereicht', 'Du hast heute bereits dein Wort eingereicht. Morgen kannst du wieder ein neues Wort eintragen.');
      return;
    }
    if (!newWord.trim() || !profile) return;
    const check = await checkWordAllowed(newWord.trim());
    if (!check.ok) {
      Alert.alert('Nicht erlaubt', check.reason ?? 'Dieses Wort darf nicht eingetragen werden.');
      return;
    }
    setSavingWord(true);
    const { error } = await supabase.rpc('register_personal_word', { p_wort: newWord.trim() });
    setSavingWord(false);
    if (error) { Alert.alert('Fehler', error.message); return; }
    setTodayWord(newWord.trim());
    setNewWord('');
    loadPersonalWords();
  }

  async function handleLogout() {
    if (isGuest) {
      Alert.alert('Gastzugang beenden', 'Du verlässt den Gastzugang. Deine lokalen Gastdaten bleiben erhalten und können später übernommen werden.', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Beenden', style: 'destructive', onPress: signOut },
      ]);
      return;
    }
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: signOut },
    ]);
  }

  async function goToAuth(path: '/(auth)/login' | '/(auth)/register') {
    await leaveGuestMode();
    router.push(path);
  }


  if (!profile) return null;
  const level = getLevelForXp(profile.xp);
  const levelIndex = LEVELS.findIndex(l => l.key === level.key);

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

        {/* Profilkopf */}
        <Pressable
          style={styles.profileHeader}
          onPress={() => isGuest ? goToAuth('/(auth)/register') : router.push({ pathname: '/(tabs)/freund-profil', params: { userId: profile.id, isSelf: 'true', returnTo: '/(tabs)/profil' } })}
        >
          <View style={[styles.avatar, { backgroundColor: '#1F1A14' }]}>
            <Text style={{ fontSize: 26 }}>{profile.avatar_url || '🦊'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.profileName, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1}>
              {isGuest ? 'Gastzugang' : profile.name ?? profile.email}
            </Text>
            <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.62} style={{ color: theme.accent, fontSize: 12, lineHeight: 18, marginTop: 2, includeFontPadding: true, flexShrink: 1 }}>
              {isGuest ? 'Gastmodus · Konto jederzeit möglich' : `Rang ${levelIndex + 1} · ${level.name} · ${profile.xp} Punkte`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.inkSoft} />
        </Pressable>
        {!isGuest && (
          <Pressable
            style={[styles.editBtn, { borderColor: theme.rule }]}
            onPress={() => router.push({ pathname: '/(tabs)/profil-bearbeiten', params: { returnTo: '/(tabs)/profil' } })}
          >
            <Ionicons name="pencil-outline" size={14} color={theme.inkSoft} />
            <Text style={{ color: theme.inkSoft, fontSize: 12 }}>Profil bearbeiten</Text>
          </Pressable>
        )}

        {!isGuest && (
          <>
        {/* Mein Wort des Tages */}
        <SectionLabel theme={theme} text="Mein Wort des Tages" />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}>
          {todayWord ? (
            <Pressable onPress={() => Alert.alert('Bereits eingereicht', 'Du hast heute bereits dein Wort eingereicht. Morgen kannst du wieder ein neues Wort eintragen.')}>
              <Text style={{ color: theme.inkSoft, fontSize: 11, marginBottom: 4 }}>Heute</Text>
              <Text
                style={[styles.todayWordText, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {todayWord}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.wordInputRow}>
              <TextInput
                style={[styles.wordInput, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.paper }]}
                placeholder="Dein Wort für heute …"
                placeholderTextColor={theme.inkSoft}
                value={newWord}
                onChangeText={setNewWord}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleSaveWord}
              />
              <Pressable
                style={[styles.wordSaveBtn, { backgroundColor: newWord.trim() ? theme.accent : theme.rule }]}
                onPress={handleSaveWord}
                disabled={savingWord || !newWord.trim()}
              >
                {savingWord
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="checkmark" size={18} color="#fff" />}
              </Pressable>
            </View>
          )}

        </View>

          </>
        )}

        {!isGuest && (
          <>
            {/* Wortvorschläge */}
            <SectionLabel theme={theme} text="Wortvorschläge" />
            <NavRow theme={theme} label="Wort vorschlagen" onPress={() => router.push({ pathname: '/(tabs)/vorschlagen', params: { returnTo: '/(tabs)/profil' } })} />
            <NavRow theme={theme} label="Meine Vorschläge" onPress={() => router.push({ pathname: '/(tabs)/meine-vorschlaege', params: { returnTo: '/(tabs)/profil' } })} />

            {/* Freunde */}
            <SectionLabel theme={theme} text="Freunde" />
            <View style={[styles.friendCard, { backgroundColor: '#1F1A14' }]}> 
              <Text style={styles.friendCardLabel}>Dein Freundescode</Text>
              <Text style={[styles.friendCode, { fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>
                {profile.friend_code || '—'}
              </Text>
              <Pressable style={styles.addFriendBtn} onPress={() => router.push({ pathname: '/(tabs)/freunde-hinzufuegen', params: { returnTo: '/(tabs)/profil' } })}>
                <Text style={{ color: '#1F1A14', fontSize: 13, fontWeight: '600' }}>Freund hinzufügen</Text>
              </Pressable>
            </View>

            <NavRow theme={theme} label="Freundschaftsanfragen" onPress={() => router.push({ pathname: '/(tabs)/freundschaftsanfragen', params: { returnTo: '/(tabs)/profil' } })} />
            <NavRow theme={theme} label="Meine Freunde" onPress={() => router.push({ pathname: '/(tabs)/freund-profil', params: { userId: profile.id, isSelf: 'true', startTab: 'freunde', returnTo: '/(tabs)/profil' } })} />

            {/* App-Entwicklung */}
            <SectionLabel theme={theme} text="App-Entwicklung" />
            <NavRow theme={theme} label="Vorschläge zur App-Entwicklung" onPress={() => router.push({ pathname: '/(tabs)/app-idee', params: { returnTo: '/(tabs)/profil' } })} />
            <NavRow theme={theme} label="Meine Ideen" onPress={() => router.push({ pathname: '/(tabs)/meine-ideen', params: { returnTo: '/(tabs)/profil' } })} />
          </>
        )}

        {/* Konto */}
        <SectionLabel theme={theme} text="Konto" />
        {isGuest ? (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
            <Pressable onPress={() => goToAuth('/(auth)/register')}>
              <Text style={[styles.settingLabel, { color: theme.ink, marginBottom: 6 }]}>Gastzugang</Text>
              <Text style={{ color: theme.inkSoft, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
                Als Gast kannst du das Wort des Tages ansehen, Favoriten speichern, Wörter im Alltag markieren und Benachrichtigungen einstellen. Statistik, Feed-Beiträge, Rangliste, Freundescode, Freundschaften und eigene Wörter sind erst mit Konto verfügbar. Deine lokalen Gastdaten werden bei der Registrierung übernommen.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={[styles.accountBtn, { backgroundColor: theme.accent }]} onPress={() => goToAuth('/(auth)/register')}>
                  <Text style={styles.accountBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Konto erstellen</Text>
                </Pressable>
                <Pressable style={[styles.accountBtn, { backgroundColor: theme.ink }]} onPress={() => goToAuth('/(auth)/login')}>
                  <Text style={[styles.accountBtnText, { color: theme.paper }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Anmelden</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
            <Text style={[styles.settingLabel, { color: theme.ink }]}>E-Mail</Text>
            <Text style={{ color: theme.inkSoft, fontSize: 13 }} numberOfLines={1}>{profile.email}</Text>
          </View>
        )}

        <SectionLabel theme={theme} text="Rechtliches" />
        <NavRow theme={theme} label="Datenschutzerklärung" onPress={() => router.push({ pathname: '/(tabs)/datenschutz', params: { returnTo: '/(tabs)/profil' } })} />
        <NavRow theme={theme} label="Impressum" onPress={() => router.push({ pathname: '/(tabs)/impressum', params: { returnTo: '/(tabs)/profil' } })} />
        <NavRow theme={theme} label="Nutzungsbedingungen" onPress={() => router.push({ pathname: '/(tabs)/nutzungsbedingungen', params: { returnTo: '/(tabs)/profil' } })} />
        {!isGuest && (
          <NavRow theme={theme} label="Profil löschen" onPress={() => router.push({ pathname: '/(tabs)/konto-loeschen', params: { returnTo: '/(tabs)/profil' } })} />
        )}

        <SectionLabel theme={theme} text="Benachrichtigungen" />
        <NavRow
          theme={theme}
          label="Benachrichtigungseinstellungen"
          onPress={() => router.push({ pathname: '/(tabs)/notification-zeit', params: { returnTo: '/(tabs)/profil' } })}
        />

        {!isGuest && profile.is_admin && (
          <Pressable
            style={[styles.adminButton, { borderColor: theme.accent }]}
            onPress={() => router.push({ pathname: '/(admin)/neues-wort', params: { returnTo: '/(tabs)/profil' } })}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.accent} />
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Admin-Bereich öffnen</Text>
          </Pressable>
        )}

        <Pressable onPress={handleLogout} style={styles.logout}>
          <Text style={{ color: theme.inkSoft, fontSize: 13, lineHeight: 18 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{isGuest ? 'Gastzugang beenden' : 'Abmelden'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ theme, text }: { theme: any; text: string }) {
  return <Text style={[styles.sectionLabel, { color: theme.inkSoft }]}>{text}</Text>;
}

function NavRow({ theme, label, onPress }: { theme: any; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.rule }]} onPress={onPress}>
      <Text style={[styles.settingLabel, { color: theme.ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 22, lineHeight: 30, includeFontPadding: true },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8, minHeight: 76 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 19, lineHeight: 26, includeFontPadding: true, flexShrink: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 4 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },
  todayWordText: { fontSize: 26, lineHeight: 32, includeFontPadding: true, flexShrink: 1 },
  wordInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  wordInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  wordSaveBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  settingRow: {
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, minHeight: 56,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10,
  },
  settingLabel: { fontSize: 14, lineHeight: 20, flex: 1, includeFontPadding: true },
  accountBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100, paddingVertical: 12, minWidth: 0, paddingHorizontal: 8 },
  accountBtnText: { color: 'white', fontWeight: '700', fontSize: 12, lineHeight: 16, textAlign: 'center', includeFontPadding: false },
  friendCard: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 22, alignItems: 'center', marginBottom: 10 },
  friendCardLabel: { color: 'rgba(250,247,240,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  friendCode: { color: '#FAF7F0', width: '100%', textAlign: 'center', fontSize: 22, lineHeight: 30, letterSpacing: 2.5, marginBottom: 16, textTransform: 'uppercase', includeFontPadding: true },
  addFriendBtn: { borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FAF7F0' },
  adminButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 100, paddingVertical: 13, marginTop: 24,
  },
  logout: { alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 8, minHeight: 48 },
});
