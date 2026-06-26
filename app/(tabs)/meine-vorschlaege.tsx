import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { WordSuggestion } from '../../lib/types';
import { goBack } from '../../lib/navigation';

const STATUS_LABEL: Record<WordSuggestion['status'], string> = {
  offen: 'Offen',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
};

export default function MeineVorschlaegeScreen() {
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

  const [suggestions, setSuggestions] = useState<WordSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('word_suggestions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setSuggestions(data ?? []);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [profile?.id])
  );

  function statusColor(status: WordSuggestion['status']) {
    if (status === 'angenommen') return theme.green;
    if (status === 'abgelehnt') return theme.red;
    return theme.inkSoft;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
          Meine Vorschläge
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : suggestions.length === 0 ? (
        <Text style={[styles.empty, { color: theme.inkSoft }]}>
          Du hast noch keine Wörter vorgeschlagen.
        </Text>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}>
              <View style={styles.cardTop}>
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.word, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
                  {item.wort}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: `${statusColor(item.status)}1A` },
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.badgeText, { color: statusColor(item.status) }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={3} style={[styles.reason, { color: theme.inkSoft }]}>{item.begruendung}</Text>
              {item.review_note && (
                <View style={[styles.reviewNoteBox, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
                  <Text style={{ color: theme.inkSoft, fontSize: 11, marginBottom: 2 }}>
                    Rückmeldung vom Admin
                  </Text>
                  <Text style={{ color: theme.ink, fontSize: 13, lineHeight: 18 }}>{item.review_note}</Text>
                </View>
              )}
              <Text style={[styles.date, { color: theme.inkSoft }]}>
                Eingereicht am{' '}
                {new Date(item.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 14,
  },
  title: { fontSize: 20 },
  empty: { textAlign: 'center', marginTop: 60, paddingHorizontal: 40, fontSize: 13.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  word: { fontSize: 20, lineHeight: 25, includeFontPadding: true },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
  reason: { fontSize: 13.5, lineHeight: 19, marginBottom: 8 },
  reviewNoteBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  date: { fontSize: 11, opacity: 0.7 },
});
