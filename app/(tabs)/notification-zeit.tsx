import { useEffect, useState, useCallback } from 'react';
import { BackHandler, View, Text, Pressable, StyleSheet, TextInput, Alert, Switch, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';
import { getNotificationSettings, requestNotificationPermissionNow, saveNotificationSettings, sendTestNotification, syncDailyWordNotification } from '../../lib/notifications';

export default function NotificationZeitScreen() {
  const { theme } = useTheme();
  const { profile, refreshProfile, isGuest } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [loading, setLoading] = useState(true);
  const [dailyWordEnabled, setDailyWordEnabled] = useState(true);
  const [friendRequestsEnabled, setFriendRequestsEnabled] = useState(true);
  const [ownWordUpvotesEnabled, setOwnWordUpvotesEnabled] = useState(true);
  const [timeString, setTimeString] = useState('07:00');

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack(router, returnTo || '/(tabs)/profil');
        return true;
      });
      return () => subscription.remove();
    }, [router, returnTo])
  );

  useEffect(() => {
    let mounted = true;
    getNotificationSettings().then(settings => {
      if (!mounted) return;
      setDailyWordEnabled(isGuest ? settings.dailyWordEnabled : (!!profile?.notifications_enabled && settings.dailyWordEnabled));
      setFriendRequestsEnabled(settings.friendRequestsEnabled);
      setOwnWordUpvotesEnabled(settings.ownWordUpvotesEnabled);
      setTimeString(isGuest ? settings.time : (profile?.notification_time ? profile.notification_time.slice(0, 5) : settings.time || '07:00'));
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [profile?.id, profile?.notification_time, profile?.notifications_enabled, isGuest]);

  async function handleSave() {
    if (!profile) return;
    const normalized = timeString.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      Alert.alert('Ungültige Uhrzeit', 'Bitte gib die Uhrzeit im Format HH:MM ein, zum Beispiel 07:00.');
      return;
    }

    await requestNotificationPermissionNow();
    await saveNotificationSettings({
      dailyWordEnabled,
      friendRequestsEnabled,
      ownWordUpvotesEnabled,
      time: normalized,
    });

    if (!isGuest) {
      await supabase
        .from('profiles')
        .update({ notifications_enabled: dailyWordEnabled || friendRequestsEnabled || ownWordUpvotesEnabled, notification_time: normalized })
        .eq('id', profile.id);
      await syncDailyWordNotification(dailyWordEnabled, normalized);
      await refreshProfile();
    }

    Alert.alert('Gespeichert', 'Deine Benachrichtigungseinstellungen wurden gespeichert.');
    goBack(router, returnTo || '/(tabs)/profil');
  }

  async function handleTestNotification() {
    const id = await sendTestNotification();
    if (!id) {
      Alert.alert('Keine Berechtigung', 'Bitte erlaube Benachrichtigungen in den Android-Einstellungen der App.');
      return;
    }
    Alert.alert('Test geplant', 'In ca. 10 Sekunden sollte eine Test-Benachrichtigung erscheinen.');
  }

  if (loading) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Benachrichtigungen</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 42 }}>
        <Text style={[styles.intro, { color: theme.inkSoft }]}>Lege fest, welche Benachrichtigungen du erhalten möchtest.</Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.ink }]}>Wort des Tages</Text>
              <Text style={[styles.sub, { color: theme.inkSoft }]}>Tägliche Erinnerung mit dem neuen Wort.</Text>
            </View>
            <Switch value={dailyWordEnabled} onValueChange={setDailyWordEnabled} />
          </View>
          <Text style={[styles.timeLabel, { color: theme.inkSoft }]}>Uhrzeit</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.rule, color: theme.ink, backgroundColor: theme.paper }]}
            value={timeString}
            onChangeText={setTimeString}
            placeholder="07:00"
            placeholderTextColor={theme.inkSoft}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule, opacity: isGuest ? 0.55 : 1 }]}> 
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.ink }]}>Freundschaftsanfragen</Text>
              <Text style={[styles.sub, { color: theme.inkSoft }]}>{isGuest ? 'Erst mit Konto verfügbar.' : 'Wenn dir jemand eine Anfrage sendet.'}</Text>
            </View>
            <Switch value={!isGuest && friendRequestsEnabled} onValueChange={setFriendRequestsEnabled} disabled={isGuest} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule, opacity: isGuest ? 0.55 : 1 }]}> 
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.ink }]}>Upvotes auf eigene Wörter</Text>
              <Text style={[styles.sub, { color: theme.inkSoft }]}>{isGuest ? 'Erst mit Konto verfügbar.' : 'Wenn dein eigenes Wort einen Upvote bekommt.'}</Text>
            </View>
            <Switch value={!isGuest && ownWordUpvotesEnabled} onValueChange={setOwnWordUpvotesEnabled} disabled={isGuest} />
          </View>
        </View>

        <Pressable style={[styles.secondaryButton, { borderColor: theme.rule }]} onPress={handleTestNotification}>
          <Ionicons name="notifications-outline" size={16} color={theme.ink} />
          <Text style={[styles.secondaryButtonText, { color: theme.ink }]}>Benachrichtigung testen</Text>
        </Pressable>

        <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleSave}>
          <Text style={styles.buttonText}>Speichern</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20, lineHeight: 27, includeFontPadding: true },
  intro: { fontSize: 13.5, lineHeight: 20, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  sub: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  timeLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 22, textAlign: 'center', maxWidth: 150 },
  secondaryButton: { borderWidth: 1, borderRadius: 100, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  button: { borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 0 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
