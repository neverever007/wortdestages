import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

type UpvotedWord = { entry_user_id: string; datum: string; wort: string; user_name: string | null; user_avatar: string | null; upvote_count: number };

function normalizeDate(value: string) { return String(value ?? '').slice(0, 10); }
function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' });
}

async function withUpvoteCounts(rows: UpvotedWord[]) {
  return Promise.all(rows.map(async (row) => {
    const { count } = await supabase
      .from('daily_word_votes')
      .select('*', { count: 'exact', head: true })
      .eq('entry_user_id', row.entry_user_id)
      .eq('entry_datum', row.datum)
      .eq('vote', 1);
    return { ...row, upvote_count: count ?? row.upvote_count ?? 0 };
  }));
}

export default function UpvotesScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack(router, returnTo || '/(tabs)/statistik');
      return true;
      });
      return () => subscription.remove();
    }, [router])
  );

  const [items, setItems] = useState<UpvotedWord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile?.id) return;
    setLoading(true);

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_upvoted_words');
    if (!rpcError && rpcData) {
      const mapped = (rpcData ?? []).map((r: any) => ({
        entry_user_id: r.entry_user_id,
        datum: normalizeDate(r.datum),
        wort: r.wort,
        user_name: r.user_name ?? null,
        user_avatar: r.user_avatar ?? null,
        upvote_count: r.upvote_count ?? r.upvotes ?? 0,
      }));
      setItems(await withUpvoteCounts(mapped));
      setLoading(false);
      return;
    }

    const { data: votes } = await supabase
      .from('daily_word_votes')
      .select('entry_user_id, entry_datum')
      .eq('voter_id', profile.id)
      .eq('vote', 1)
      .order('entry_datum', { ascending: false })
      .limit(100);

    const rows: UpvotedWord[] = [];
    for (const vote of votes ?? []) {
      const datum = normalizeDate((vote as any).entry_datum);
      const entryUserId = (vote as any).entry_user_id;
      const [{ data: word }, { data: user }] = await Promise.all([
        supabase.from('daily_words_personal').select('wort').eq('user_id', entryUserId).eq('datum', datum).maybeSingle(),
        supabase.from('profiles').select('name, avatar_url').eq('id', entryUserId).maybeSingle(),
      ]);
      if (word) rows.push({ entry_user_id: entryUserId, datum, wort: (word as any).wort, user_name: (user as any)?.name ?? null, user_avatar: (user as any)?.avatar_url ?? null, upvote_count: 0 });
    }
    setItems(await withUpvoteCounts(rows));
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [profile?.id]));

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/statistik')} hitSlop={10}><Ionicons name="arrow-back" size={20} color={theme.inkSoft} /></Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit>Upvotes</Text>
      </View>

      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.entry_user_id}-${item.datum}`}
          contentContainerStyle={{ padding: 22, paddingBottom: 44 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.inkSoft }]}>Noch keine Wörter mit Upvote.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/freund-profil', params: { userId: item.entry_user_id, isSelf: item.entry_user_id === profile?.id ? 'true' : undefined, returnTo: returnTo || '/(tabs)/statistik' } })}>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
                <View style={[styles.avatar, { backgroundColor: '#1F1A14' }]}><Text style={{ fontSize: 16 }}>{item.user_avatar || '🦊'}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.word, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>{item.wort}</Text>
                  <Text style={[styles.meta, { color: theme.inkSoft }]} numberOfLines={1}>von {item.entry_user_id === profile?.id ? 'dir' : item.user_name ?? 'Nutzer'} · {formatDate(item.datum)}</Text>
                </View>
                <View style={styles.upvotePill}>
                  <Ionicons name="arrow-up-circle" size={20} color={theme.green} />
                  <Text style={[styles.upvoteCount, { color: theme.green }]}>{item.upvote_count}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 15, minHeight: 96 },
  title: { fontSize: 21, lineHeight: 30, includeFontPadding: true, flex: 1 },
  empty: { textAlign: 'center', fontSize: 13, marginTop: 42 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  word: { fontSize: 18, lineHeight: 24, includeFontPadding: true },
  meta: { fontSize: 12, marginTop: 2 },
  upvotePill: { alignItems: 'center', justifyContent: 'center', minWidth: 34 },
  upvoteCount: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
