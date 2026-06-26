import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, SectionList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';

type FeedEntry = {
  entry_user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  datum: string;
  wort: string;
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: number | null;
};

type Section = { title: string; data: FeedEntry[] };
type Mode = 'freunde' | 'global';
type Period = 'heute' | 'woche' | 'monat' | 'jahr';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDate(value: string): string {
  return String(value ?? '').slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodStart(period: Period): string {
  if (period === 'heute') return todayIso();
  if (period === 'woche') return daysAgoIso(6);
  if (period === 'monat') return daysAgoIso(30);
  return daysAgoIso(365);
}

function formatDate(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'Heute';
  if (iso === daysAgoIso(1)) return 'Gestern';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function applyPeriod(entries: FeedEntry[], period: Period): FeedEntry[] {
  const start = periodStart(period);
  return entries.filter(e => normalizeDate(e.datum) >= start);
}

function buildSections(entries: FeedEntry[], period: Period): Section[] {
  if (period !== 'heute') {
    const sorted = [...entries].sort((a, b) => b.score - a.score || b.upvotes - a.upvotes || normalizeDate(b.datum).localeCompare(normalizeDate(a.datum)));
    return sorted.length ? [{ title: 'gesamt', data: sorted }] : [];
  }
  const byDate: Record<string, FeedEntry[]> = {};
  entries.forEach((entry) => {
    const datum = normalizeDate(entry.datum);
    if (!datum) return;
    if (!byDate[datum]) byDate[datum] = [];
    byDate[datum].push({ ...entry, datum });
  });

  return Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      title: formatDate(date),
      data: byDate[date].sort((a, b) => b.score - a.score || (a.user_name ?? '').localeCompare(b.user_name ?? '') || 0),
    }));
}

export default function FeedScreen() {
  const { theme } = useTheme();
  const { profile, isGuest } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(isGuest ? 'global' : 'freunde');
  const [period, setPeriod] = useState<Period>('woche');
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => { if (isGuest) setMode('global'); }, [isGuest]);

  async function loadOwnEntries(): Promise<FeedEntry[]> {
    if (!profile?.id || isGuest) return [];
    const { data } = await supabase
      .from('daily_words_personal')
      .select('user_id, datum, wort')
      .eq('user_id', profile.id)
      .gte('datum', periodStart(period))
      .order('datum', { ascending: false })
      .limit(80);

    return (data ?? []).map((row: any) => ({
      entry_user_id: row.user_id,
      user_name: profile.name ?? 'Du',
      user_avatar: profile.avatar_url ?? null,
      datum: normalizeDate(row.datum),
      wort: row.wort,
      upvotes: 1,
      downvotes: 0,
      score: 1,
      my_vote: 1,
    }));
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setFeedError(null);
    const effectiveMode = isGuest ? 'global' : mode;
    const rpcName = effectiveMode === 'freunde' ? 'get_friends_feed_all' : 'get_global_feed_all';
    let entries: FeedEntry[] = [];
    const { data, error } = await supabase.rpc(rpcName);

    if (error) {
      setFeedError('Feed-SQL-Funktion fehlt noch. Bitte das neue SQL-Skript ausführen. Dein eigenes Wort wird trotzdem angezeigt.');
    } else {
      entries = (data ?? []).map((row: any) => {
        const isOwn = row.entry_user_id === profile?.id;
        const upvotes = Number(row.upvotes ?? 0);
        const downvotes = Number(row.downvotes ?? 0);
        const myVote = row.my_vote ?? null;
        return {
          entry_user_id: row.entry_user_id,
          user_name: row.user_name,
          user_avatar: row.user_avatar,
          datum: normalizeDate(row.datum),
          wort: row.wort,
          upvotes: isOwn && myVote == null ? Math.max(1, upvotes) : upvotes,
          downvotes,
          score: isOwn && myVote == null ? Math.max(1, Number(row.score ?? 0)) : Number(row.score ?? 0),
          my_vote: isOwn && myVote == null ? 1 : myVote,
        };
      });
    }

    const ownEntries = await loadOwnEntries();
    const merged = new Map<string, FeedEntry>();
    entries.forEach(entry => merged.set(`${entry.entry_user_id}-${entry.datum}`, entry));
    ownEntries.forEach(entry => {
      const key = `${entry.entry_user_id}-${entry.datum}`;
      if (!merged.has(key)) merged.set(key, entry);
    });

    setSections(buildSections(applyPeriod(Array.from(merged.values()), period), period));
    if (!silent) setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [mode, period, profile?.id]));

  async function handleVote(entry: FeedEntry, vote: 1 | -1) {
    if (!profile?.id) return;
    if (isGuest) {
      Alert.alert('Konto erforderlich', 'Als Gast kannst du den Feed lesen, aber nicht abstimmen. Melde dich im Profil an oder registriere dich.');
      return;
    }
    const prevSections = sections;
    setSections(prev => prev.map(sec => ({
      ...sec,
      data: sec.data.map(e => {
        if (e.entry_user_id !== entry.entry_user_id || e.datum !== entry.datum) return e;
        const removing = e.my_vote === vote;
        const wasOpposite = e.my_vote !== null && e.my_vote !== vote;
        return {
          ...e,
          my_vote: removing ? null : vote,
          upvotes: vote === 1 ? (removing ? Math.max(0, e.upvotes - 1) : e.upvotes + 1) : (wasOpposite ? Math.max(0, e.upvotes - 1) : e.upvotes),
          downvotes: vote === -1 ? (removing ? Math.max(0, e.downvotes - 1) : e.downvotes + 1) : (wasOpposite ? Math.max(0, e.downvotes - 1) : e.downvotes),
          score: removing ? e.score - vote : wasOpposite ? e.score + vote * 2 : e.score + vote,
        };
      }).sort((a, b) => b.score - a.score),
    })));

    const { error } = await supabase.rpc('cast_vote', {
      p_entry_user_id: entry.entry_user_id,
      p_entry_datum: entry.datum,
      p_vote: vote,
    });
    if (error) setSections(prevSections);
  }

  async function handleAdminDelete(entry: FeedEntry) {
    Alert.alert('Eintrag löschen?', `„${entry.wort}" von ${entry.user_name ?? 'Nutzer'} aus dem Feed entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('delete_feed_entry', {
          p_entry_user_id: entry.entry_user_id,
          p_entry_datum: entry.datum,
        });
        if (error) {
          await supabase.from('daily_words_personal')
            .delete()
            .eq('user_id', entry.entry_user_id)
            .eq('datum', entry.datum);
        }
        setSections(prev => prev
          .map(sec => ({ ...sec, data: sec.data.filter(e => !(e.entry_user_id === entry.entry_user_id && e.datum === entry.datum)) }))
          .filter(sec => sec.data.length > 0)
        );
      }},
    ]);
  }

  const isAdmin = profile?.is_admin ?? false;
  const periodLabels: Record<Period, string> = { heute: 'Heute', woche: 'Woche', monat: 'Monat', jahr: 'Jahr' };

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Feed</Text>
      </View>

      <View style={styles.controls}>
        <View style={[styles.toggle, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
          {(['freunde', 'global'] as Mode[]).map(m => (
            <Pressable key={m} disabled={isGuest && m === 'freunde'} style={[styles.toggleBtn, mode === m && { backgroundColor: theme.ink }, isGuest && m === 'freunde' && { opacity: 0.35 }]} onPress={() => setMode(m)}>
              <Text style={{ fontSize: 13, fontWeight: mode === m ? '600' : '400', color: mode === m ? theme.paper : theme.inkSoft }}>
                {m === 'freunde' ? 'Freunde' : 'Global'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.periodRow, { borderColor: theme.rule }]}> 
          {(['heute', 'woche', 'monat', 'jahr'] as Period[]).map(p => (
            <Pressable key={p} style={[styles.periodBtn, period === p && { backgroundColor: theme.accent }]} onPress={() => setPeriod(p)}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: period === p ? '#fff' : theme.inkSoft }}>{periodLabels[p]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {feedError && !loading && (
        <Text style={[styles.feedHint, { color: theme.inkSoft, backgroundColor: theme.card, borderColor: theme.rule }]}>{feedError}</Text>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32, marginBottom: 14 }}>📭</Text>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>Noch keine Einträge</Text>
          <Text style={[styles.emptyText, { color: theme.inkSoft }]}> 
            {isGuest ? 'Als Gast kannst du den globalen Feed ansehen. Eigene Gastwörter erscheinen hier erst nach Registrierung.' : mode === 'freunde' ? 'Trage dein eigenes Wort ein oder füge Freunde hinzu.' : 'Noch niemand hat in diesem Zeitraum ein persönliches Wort eingetragen.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => `${item.entry_user_id}-${item.datum}`}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.accent} />}
          renderSectionHeader={({ section }) => section.title && period === 'heute' ? (
            <View style={[styles.sectionHeader, { backgroundColor: theme.paper }]}> 
              <View style={[styles.sectionLine, { backgroundColor: theme.rule }]} />
              <Text numberOfLines={1} style={[styles.sectionTitle, { color: theme.inkSoft }]}>{section.title}</Text>
              <View style={[styles.sectionLine, { backgroundColor: theme.rule }]} />
            </View>
          ) : null}
          renderItem={({ item }) => {
            const isOwnEntry = item.entry_user_id === profile?.id;
            return (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
                <Pressable style={styles.cardMain} onPress={() => router.push({ pathname: '/(tabs)/freund-profil', params: { userId: item.entry_user_id, isSelf: isOwnEntry ? 'true' : undefined, returnTo: '/(tabs)/feed' } })}>
                  <View style={[styles.avatar, { backgroundColor: theme.paper, borderColor: theme.rule }]}> 
                    <Text style={styles.avatarText}>{item.user_avatar || '🦊'}</Text>
                  </View>
                  <View style={styles.cardTextWrap}>
                    <View style={styles.metaRow}>
                      <Text style={[styles.userName, { color: theme.inkSoft }]} numberOfLines={1}>{isOwnEntry ? 'Du' : item.user_name ?? 'Unbekannt'}</Text>
                      {period === 'heute' && <Text style={[styles.dot, { color: theme.inkSoft }]}>•</Text>}
                      {period === 'heute' && <Text style={[styles.metaText, { color: theme.inkSoft }]} numberOfLines={1}>{formatDate(item.datum)}</Text>}
                    </View>
                    <Text style={[styles.wort, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{item.wort}</Text>
                  </View>
                  <View style={styles.rightColumn}>
                    <View style={[styles.scorePill, { backgroundColor: item.score > 0 ? `${theme.green}20` : item.score < 0 ? `${theme.red}20` : theme.rule }]}> 
                      <Text style={[styles.scoreText, { color: item.score > 0 ? theme.green : item.score < 0 ? theme.red : theme.inkSoft }]}>{item.score > 0 ? `+${item.score}` : item.score}</Text>
                    </View>
                    {isAdmin && (
                      <Pressable hitSlop={10} onPress={() => handleAdminDelete(item)} style={styles.trashBtn}>
                        <Ionicons name="trash-outline" size={15} color={theme.red} />
                      </Pressable>
                    )}
                  </View>
                </Pressable>

                <View style={[styles.voteRow, { borderTopColor: theme.rule }]}> 
                  <Pressable style={[styles.voteBtn, item.my_vote === 1 && { backgroundColor: `${theme.green}22` }]} onPress={() => handleVote(item, 1)}>
                    <Ionicons name={item.my_vote === 1 ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={18} color={item.my_vote === 1 ? theme.green : theme.inkSoft} />
                    <Text style={[styles.voteCount, { color: item.my_vote === 1 ? theme.green : theme.inkSoft }]}>{item.upvotes}</Text>
                  </Pressable>
                  <Pressable style={[styles.voteBtn, item.my_vote === -1 && { backgroundColor: `${theme.red}22` }]} onPress={() => handleVote(item, -1)}>
                    <Ionicons name={item.my_vote === -1 ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={18} color={item.my_vote === -1 ? theme.red : theme.inkSoft} />
                    <Text style={[styles.voteCount, { color: item.my_vote === -1 ? theme.red : theme.inkSoft }]}>{item.downvotes}</Text>
                  </Pressable>
                  <Text style={[styles.compactHint, { color: theme.inkSoft }]} numberOfLines={1}>{item.score === 1 ? '1 Punkt' : `${item.score} Punkte`}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  masthead: { borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, minHeight: 88, justifyContent: 'flex-end' },
  title: { fontSize: 24, lineHeight: 32, includeFontPadding: true },
  controls: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 7 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, padding: 2 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 15 },
  periodRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 2 },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 13 },
  feedHint: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: 12, padding: 9, fontSize: 11, lineHeight: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 6 },
  sectionLine: { flex: 1, height: 1, opacity: 0.65 },
  sectionTitle: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 7, marginBottom: 8 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardTextWrap: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, marginBottom: 1 },
  dot: { fontSize: 10, marginHorizontal: 5, opacity: 0.7 },
  metaText: { fontSize: 10.5, fontWeight: '500', flexShrink: 1 },
  rightColumn: { alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginLeft: 4 },
  trashBtn: { padding: 2 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, lineHeight: 19 },
  userName: { fontSize: 10.5, fontWeight: '700', maxWidth: 145 },
  wort: { fontSize: 18.5, lineHeight: 24, includeFontPadding: true, flexShrink: 1 },
  voteRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, marginTop: 7, paddingTop: 6, gap: 8 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 },
  voteCount: { fontSize: 12.5, fontWeight: '700', minWidth: 14, textAlign: 'center' },
  scorePill: { minWidth: 36, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  scoreText: { fontSize: 11.5, fontWeight: '800' },
  compactHint: { marginLeft: 'auto', fontSize: 11, fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
