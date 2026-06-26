import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { getLevelProgress, LEVELS } from '../../lib/levels';
import { LeaderboardEntry, Badge } from '../../lib/types';
import { getGuestState } from '../../lib/guest';
import { DEFAULT_BADGES } from '../../lib/badges';

type InfoBox = { title: string; text: string } | null;
type StatKey = 'streak' | 'best' | 'words';

const STAT_INFO: Record<StatKey, { title: string; text: string }> = {
  streak: { title: 'Streak', text: 'Deine aktuelle Serie zeigt, an wie vielen Tagen hintereinander du die App geöffnet hast.' },
  best: { title: 'Beste Serie', text: 'Deine beste Serie ist die höchste Anzahl aufeinanderfolgender Tage, an denen du die App geöffnet hast. Wenn deine aktuelle Serie reißt, bleibt dieser Bestwert gespeichert.' },
  words: { title: 'Wörter benutzt', text: 'Hier zählen Wörter, die du im Alltag verwendet und gemeldet hast.' },
};

export default function StatistikScreen() {
  const { theme } = useTheme();
  const { profile, isGuest } = useAuth();
  const router = useRouter();
  const [leaderboardMode, setLeaderboardMode] = useState<'freunde' | 'global'>('freunde');
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({ freunde: [], global: [] });
  const [wordsUsedCount, setWordsUsedCount] = useState(0);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [statInfoKey, setStatInfoKey] = useState<StatKey | null>(null);
  const [badgeInfo, setBadgeInfo] = useState<InfoBox>(null);
  const [showLevelInfo, setShowLevelInfo] = useState(false);

  async function loadLeaderboard(mode: 'freunde' | 'global') {
    if (isGuest) {
      setLeaderboards(prev => ({ ...prev, [mode]: [] }));
      return;
    }
    const rpcName = mode === 'global' ? 'get_global_leaderboard' : 'get_friends_leaderboard';
    const { data } = await supabase.rpc(rpcName);
    setLeaderboards(prev => ({ ...prev, [mode]: data ?? [] }));
  }

  async function loadBadges() {
    if (!profile) return;
    const { data: badges } = await supabase.from('badges').select('*');
    setAllBadges(badges && badges.length > 0 ? badges : DEFAULT_BADGES);
    if (isGuest) {
      setEarnedBadgeIds(new Set(['anfaenger']));
      return;
    }
    try { await supabase.rpc('ensure_initial_badge'); } catch {}
    const { data: earned } = await supabase.from('user_badges').select('badge_id').eq('user_id', profile.id);
    const ids = new Set((earned ?? []).map((b: any) => b.badge_id));
    ids.add('anfaenger');
    setEarnedBadgeIds(ids);
  }

  async function loadStats() {
    if (!profile) return;
    setLoading(true);
    if (isGuest) {
      const guest = await getGuestState();
      setWordsUsedCount(guest.usages.length);
      await loadBadges();
      setLeaderboards({ freunde: [], global: [] });
      setLoading(false);
      return;
    }
    const { count } = await supabase.from('word_usage').select('*', { count: 'exact', head: true }).eq('user_id', profile.id);
    setWordsUsedCount(count ?? 0);
    await Promise.all([loadLeaderboard('freunde'), loadLeaderboard('global'), loadBadges()]);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => {
    loadStats();
    return () => {
      setStatInfoKey(null);
      setBadgeInfo(null);
      setShowLevelInfo(false);
    };
  }, [profile?.id]));

  if (!profile || loading) {
    return <View style={[styles.center, { backgroundColor: theme.paper }]}><ActivityIndicator color={theme.accent} /></View>;
  }

  if (isGuest) {
    return (
      <View style={[styles.container, { backgroundColor: theme.paper }]}>
        <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1}>Statistik</Text>
        </View>
        <View style={[styles.lockCard, { backgroundColor: theme.card, borderColor: theme.rule }]}>
          <Ionicons name="lock-closed-outline" size={28} color={theme.accent} />
          <Text style={[styles.lockTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Statistik nur mit Konto</Text>
          <Text style={[styles.lockText, { color: theme.inkSoft }]}>Als Gast kannst du das Wort des Tages ansehen, Favoriten speichern und Wörter im Alltag markieren. Punkte, Abzeichen, Rangliste und Auswertungen werden erst mit einem Konto aktiviert.</Text>
          <Pressable style={[styles.lockButton, { backgroundColor: theme.accent }]} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.lockButtonText}>Konto erstellen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { current, next, progressFraction, xpToNext } = getLevelProgress(profile.xp);
  const levelIndex = LEVELS.findIndex(l => l.key === current.key);

  function toggleStatInfo(key: StatKey) {
    setStatInfoKey(prev => prev === key ? null : key);
  }

  function toggleBadgeInfo(badge: Badge, earned: boolean) {
    const nextInfo = { title: `${badge.icon} ${badge.name}`, text: `${earned ? 'Freigeschaltet.' : 'Noch nicht freigeschaltet.'}\n${badge.beschreibung}` };
    setBadgeInfo(prev => {
      const isClosing = prev?.title === nextInfo.title;
      return isClosing ? null : nextInfo;
    });
  }

  const activeStatInfo = statInfoKey ? STAT_INFO[statInfoKey] : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Statistik</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 44 }}>
        <Pressable style={[styles.levelCard, { backgroundColor: '#1F1A14' }]} onPress={() => setShowLevelInfo(v => !v)}>
          {showLevelInfo ? (
            <View>
              <Text style={[styles.levelInfoTitle, { color: theme.gold, fontFamily: fonts.serifSemiBold }]}>So bekommst du Punkte</Text>
              <View style={styles.pointList}>
                <Text style={styles.levelInfoText}>• App täglich öffnen: +1 Punkt</Text>
                <Text style={styles.levelInfoText}>• Wort im Alltag verwenden: +1 Punkt</Text>
                <Text style={styles.levelInfoText}>• Eigenes Wort des Tages eintragen: +1 Punkt</Text>
                <Text style={styles.levelInfoText}>• Jeder Upvote für dein eigenes Wort: +1 Punkt</Text>
                <Text style={styles.levelInfoText}>• Wortvorschlag: Punkte nach Wertung</Text>
                <Text style={styles.levelInfoText}>• Abzeichen erhältst du für besondere Fortschritte.</Text>
              </View>
              <Text style={styles.levelInfoHint}>Tippe erneut, um deinen Rang zu sehen.</Text>
            </View>
          ) : (
            <>
              <View style={styles.levelTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: 'rgba(250,247,240,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Rang {levelIndex + 1} von {LEVELS.length}
                  </Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={[styles.levelName, { color: '#FAF7F0', fontFamily: fonts.serifSemiBold }]}>{current.name}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: theme.gold, fontSize: 13 }}>{profile.xp} Punkte</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: 'rgba(250,247,240,0.15)' }]}> 
                <View style={[styles.progressFill, { backgroundColor: theme.gold, width: `${progressFraction * 100}%` }]} />
              </View>
              <Text style={styles.progressText} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.78}>
                {next ? `${xpToNext} Punkte bis Rang ${levelIndex + 2}: „${next.name}“` : 'Höchster Rang erreicht'}
              </Text>
            </>
          )}
        </Pressable>

        <SectionLabel theme={theme} text="Kennzahlen" />
        <View style={styles.statRow}>
          <StatBox theme={theme} num={profile.streak_count} label="Streak" onPress={() => toggleStatInfo('streak')} />
          <StatBox theme={theme} num={profile.best_streak} label="Beste Serie" onPress={() => toggleStatInfo('best')} />
          <StatBox theme={theme} num={wordsUsedCount} label="Wörter benutzt" onPress={() => toggleStatInfo('words')} />
        </View>
        {activeStatInfo && <InfoCard theme={theme} title={activeStatInfo.title} text={activeStatInfo.text} onPress={() => setStatInfoKey(null)} />}

        <SectionLabel theme={theme} text="Abzeichen" />
        {badgeInfo && <InfoCard theme={theme} title={badgeInfo.title} text={badgeInfo.text} onPress={() => setBadgeInfo(null)} />}
        {allBadges.length === 0 ? (
          <Text style={{ color: theme.inkSoft, fontSize: 13 }}>Noch keine Abzeichen definiert.</Text>
        ) : (
          <View style={styles.badgeGrid}>
            {allBadges.map((badge) => {
              const earned = earnedBadgeIds.has(badge.id);
              return (
                <Pressable key={badge.id} onPress={() => toggleBadgeInfo(badge, earned)} style={[styles.badgeItem, { backgroundColor: theme.card, borderColor: earned ? theme.accent : theme.rule, opacity: earned ? 1 : 0.42 }]}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={[styles.badgeName, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>{badge.name}</Text>
                  {earned && <View style={[styles.badgeEarnedDot, { backgroundColor: theme.accent }]} />}
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionLabel theme={theme} text="Meine Wörter" />
        <View style={styles.wordCardsRow}>
          <Pressable style={[styles.usedWordsCard, { backgroundColor: theme.card, borderColor: theme.rule }]} onPress={() => router.push({ pathname: '/(tabs)/benutzte-woerter', params: { returnTo: '/(tabs)/statistik' } })}>
            <Text style={[styles.usedWordsTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Benutzte Wörter</Text>
            <Text style={[styles.usedWordsSub, { color: theme.inkSoft }]} numberOfLines={2}>{wordsUsedCount} im Alltag verwendet</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.inkSoft} />
          </Pressable>
          <Pressable style={[styles.usedWordsCard, { backgroundColor: theme.card, borderColor: theme.rule }]} onPress={() => router.push({ pathname: '/(tabs)/upvotes', params: { returnTo: '/(tabs)/statistik' } })}>
            <Text style={[styles.usedWordsTitle, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Upvotes</Text>
            <Text style={[styles.usedWordsSub, { color: theme.inkSoft }]} numberOfLines={2}>Wörter, denen du zugestimmt hast</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.inkSoft} />
          </Pressable>
        </View>

        <SectionLabel theme={theme} text="Rangliste" />
        <View style={[styles.leaderboardCard, { backgroundColor: theme.card, borderColor: theme.rule }]}> 
          <View style={[styles.toggle, { backgroundColor: theme.paper, borderColor: theme.rule }]}> 
            {(['freunde', 'global'] as const).map((mode) => (
              <Pressable key={mode} style={[styles.toggleBtn, leaderboardMode === mode && { backgroundColor: theme.ink }]} onPress={() => setLeaderboardMode(mode)}>
                <Text style={{ fontSize: 12, color: leaderboardMode === mode ? theme.paper : theme.inkSoft, fontWeight: leaderboardMode === mode ? '600' : '400' }}>
                  {mode === 'freunde' ? 'Freunde' : 'Global'}
                </Text>
              </Pressable>
            ))}
          </View>
          {(leaderboards[leaderboardMode] ?? []).length === 0 ? (
            <Text style={{ color: theme.inkSoft, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
              {isGuest ? 'Ranglisten sind nur mit Konto verfügbar.' : leaderboardMode === 'freunde' ? 'Noch keine Freunde hinzugefügt.' : 'Keine Einträge.'}
            </Text>
          ) : (leaderboards[leaderboardMode] ?? []).map((entry, idx) => (
            <Pressable key={entry.user_id} onPress={() => { if (entry.user_id !== profile.id) router.push({ pathname: '/(tabs)/freund-profil', params: { userId: entry.user_id, returnTo: '/(tabs)/statistik' } }); }}>
              <View style={styles.lbRow}>
                <Text style={[styles.lbRank, { color: theme.inkSoft }]}>{idx + 1}</Text>
                <View style={[styles.lbAvatar, { backgroundColor: '#1F1A14', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 15 }}>{entry.avatar_url || '🦊'}</Text></View>
                <Text style={[styles.lbName, { color: entry.user_id === profile.id ? theme.accent : theme.ink }, entry.user_id === profile.id && { fontWeight: '700' }]} numberOfLines={1}>{entry.user_id === profile.id ? 'Du' : entry.name ?? 'Unbekannt'}</Text>
                <Text style={[styles.lbXp, { color: theme.inkSoft }]}>{entry.xp} Pkt.</Text>
              </View>
              {idx < (leaderboards[leaderboardMode] ?? []).length - 1 && <View style={[styles.lbDivider, { backgroundColor: theme.rule }]} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ theme, text }: { theme: any; text: string }) {
  return <Text style={[styles.sectionLabel, { color: theme.inkSoft }]}>{text}</Text>;
}

function InfoCard({ theme, title, text, onPress }: { theme: any; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.accent }]}> 
      <Text style={[styles.infoTitle, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.infoText, { color: theme.inkSoft }]}>{text}</Text>
    </Pressable>
  );
}

function StatBox({ theme, num, label, onPress }: { theme: any; num: number; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.rule }]} onPress={onPress}>
      <Text style={[styles.statNum, { color: theme.accent, fontFamily: fonts.serifSemiBold }]}>{num}</Text>
      <Text style={[styles.statLabel, { color: theme.inkSoft }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  masthead: { borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 15, minHeight: 96, justifyContent: 'flex-end' },
  title: { fontSize: 22, lineHeight: 31, includeFontPadding: true },
  levelCard: { borderRadius: 20, padding: 18, marginBottom: 18, minHeight: 138 },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 14 },
  levelName: { fontSize: 22, lineHeight: 29, marginTop: 2, includeFontPadding: true },
  levelInfoTitle: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  pointList: { gap: 4 },
  levelInfoText: { color: 'rgba(250,247,240,0.78)', fontSize: 12.5, lineHeight: 17 },
  levelInfoHint: { color: 'rgba(250,247,240,0.48)', fontSize: 10.5, marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 100, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 100 },
  progressText: { color: 'rgba(250,247,240,0.6)', fontSize: 11, lineHeight: 16, includeFontPadding: true },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 12, lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: { flex: 1, borderWidth: 1, borderRadius: 15, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', minWidth: 0, minHeight: 78 },
  statNum: { fontSize: 24 },
  statLabel: { fontSize: 11.2, lineHeight: 15, marginTop: 3, textAlign: 'center', includeFontPadding: true },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 10 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 12 },
  badgeItem: { width: '31.8%', height: 72, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', gap: 3 },
  badgeIcon: { fontSize: 20 },
  badgeName: { fontSize: 8.5, lineHeight: 11, textAlign: 'center', width: '100%' },
  badgeEarnedDot: { width: 6, height: 6, borderRadius: 3, marginTop: 1 },
  wordCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  usedWordsCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 13, minHeight: 98, justifyContent: 'space-between' },
  usedWordsTitle: { fontSize: 16, lineHeight: 22, includeFontPadding: true },
  usedWordsSub: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  leaderboardCard: { borderWidth: 1, borderRadius: 16, padding: 18 },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 100, padding: 3, marginBottom: 14 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 100 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  lbRank: { width: 20, fontSize: 13, fontWeight: '600' },
  lbAvatar: { width: 32, height: 32, borderRadius: 16 },
  lbName: { flex: 1, fontSize: 14 },
  lbXp: { fontSize: 12 },
  lockCard: { margin: 24, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center' },
  lockTitle: { fontSize: 20, lineHeight: 27, marginTop: 12, marginBottom: 8, textAlign: 'center' },
  lockText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  lockButton: { borderRadius: 100, paddingHorizontal: 24, paddingVertical: 13 },
  lockButtonText: { color: 'white', fontSize: 14, fontWeight: '700' },
  lbDivider: { height: 1 },
});
