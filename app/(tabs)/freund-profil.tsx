import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { getLevelForXp, getLevelProgress, LEVELS } from '../../lib/levels';
import { Badge } from '../../lib/types';
import { DEFAULT_BADGES } from '../../lib/badges';
import { goBack } from '../../lib/navigation';
import { useAuth } from '../../lib/AuthContext';

type FriendProfile = {
  id: string; name: string | null; avatar_url: string | null; friend_code?: string | null;
  xp: number; streak_count: number; best_streak: number;
};
type FavoriteWord = { word_id: string; wort: string; wortart: string | null; datum: string };
type UsedWord = { word_id: string; wort: string; wortart: string | null; date: string };
type PersonalWord = { datum: string; wort: string };
type FriendRow = { id: string; name: string | null; avatar_url: string | null; xp: number };

export default function FreundProfilScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { profile: currentProfile, isGuest } = useAuth();
  const { userId, isSelf, startTab, returnTo } = useLocalSearchParams<{ userId: string; isSelf?: string; startTab?: string; returnTo?: string }>();
  const isSelfProfile = isSelf === 'true';

  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<FavoriteWord[]>([]);
  const [usedWords, setUsedWords] = useState<UsedWord[]>([]);
  const [personalWords, setPersonalWords] = useState<PersonalWord[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'abzeichen' | 'favoriten' | 'benutzt' | 'meinwort' | 'freunde'>((startTab as any) || 'abzeichen');
  const [friendshipStatus, setFriendshipStatus] = useState<'self' | 'friend' | 'pending' | 'none'>('none');
  const [requestSending, setRequestSending] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);

    if (isSelfProfile) {
      try {
        await supabase.rpc('ensure_initial_badge');
      } catch {
        // Ältere Datenbankstände haben die Funktion evtl. noch nicht.
      }
    }

    const [
      { data: profileData },
      { data: badges },
      { data: earned },
      { data: favData },
      { data: usedData },
      { data: personalData },
      friendsResponse,
    ] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url, friend_code, xp, streak_count, best_streak').eq('id', userId).single(),
      supabase.from('badges').select('*'),
      supabase.from('user_badges').select('badge_id').eq('user_id', userId),
      supabase.rpc('get_friend_favorites', { p_user_id: userId }),
      supabase.rpc('get_friend_used_words', { p_user_id: userId }),
      supabase.rpc('get_personal_words', { p_user_id: userId }),
      supabase.rpc('get_profile_friends', { p_user_id: userId }),
    ]);

    setFriend(profileData as FriendProfile);
    const visibleBadges = badges && badges.length > 0 ? badges : DEFAULT_BADGES;
    setAllBadges(visibleBadges);

    const earnedBadgeIds = new Set((earned ?? []).map((b: any) => b.badge_id));
    if (isSelfProfile) earnedBadgeIds.add('anfaenger');
    setEarnedIds(earnedBadgeIds);
    setFavorites((favData ?? []).map((r: any) => ({
      word_id: r.word_id, wort: r.wort ?? '—', wortart: r.wortart ?? null, datum: r.datum ?? '',
    })));
    setUsedWords((usedData ?? []).map((r: any) => ({
      word_id: r.word_id, wort: r.wort ?? '—', wortart: r.wortart ?? null, date: r.date,
    })));
    setPersonalWords(personalData ?? []);
        let visibleFriends = (friendsResponse.data ?? []) as FriendRow[];
    if ((!visibleFriends || visibleFriends.length === 0) && isSelfProfile) {
      const { data: directLinks } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);
      const friendIds = (directLinks ?? []).map((row: any) => row.friend_id).filter(Boolean);
      if (friendIds.length > 0) {
        const { data: directProfiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, xp')
          .in('id', friendIds);
        visibleFriends = (directProfiles ?? []) as FriendRow[];
      }
    }
    setFriends(visibleFriends);

    if (currentProfile?.id && userId) {
      if (currentProfile.id === userId || isSelfProfile) {
        setFriendshipStatus('self');
      } else {
        const [{ data: friendship }, { data: request }] = await Promise.all([
          supabase.from('friendships').select('friend_id').eq('user_id', currentProfile.id).eq('friend_id', userId).maybeSingle(),
          supabase.from('friend_requests').select('to_user_id').eq('from_user_id', currentProfile.id).eq('to_user_id', userId).maybeSingle(),
        ]);
        setFriendshipStatus(friendship ? 'friend' : request ? 'pending' : 'none');
      }
    }

    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [userId, currentProfile?.id]));

  async function handleSendFriendRequest() {
    if (isGuest) {
      Alert.alert('Konto erforderlich', 'Als Gast kannst du keine Freundschaftsanfragen senden. Melde dich im Profil an oder registriere dich.');
      return;
    }
    if (!friend?.friend_code || friendshipStatus !== 'none') return;
    setRequestSending(true);
    const { error } = await supabase.rpc('send_friend_request', { p_code: friend.friend_code });
    setRequestSending(false);
    if (error) {
      Alert.alert('Fehler', error.message);
      return;
    }
    setFriendshipStatus('pending');
    Alert.alert('Gesendet', 'Die Freundschaftsanfrage wurde gesendet.');
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.paper }]}><ActivityIndicator color={theme.accent} /></View>;
  }
  if (!friend) {
    return <View style={[styles.center, { backgroundColor: theme.paper }]}><Text style={{ color: theme.inkSoft }}>Profil nicht gefunden.</Text></View>;
  }

  const level = getLevelForXp(friend.xp);
  const { progressFraction, xpToNext, next } = getLevelProgress(friend.xp);
  const levelIndex = LEVELS.findIndex(l => l.key === level.key);

  const TABS: Array<{ key: 'abzeichen'|'favoriten'|'benutzt'|'meinwort'|'freunde'; label: string }> = [
    { key: 'abzeichen', label: 'Abzeichen' },
    { key: 'favoriten', label: 'Favoriten' },
    { key: 'benutzt', label: 'Benutzt' },
    { key: 'meinwort', label: 'Mein Wort' },
    { key: 'freunde', label: 'Freunde' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1}>
          {isSelfProfile ? 'Mein Profil' : (friend.name ?? 'Profil')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header-Karte */}
        <View style={[styles.headerCard, { backgroundColor: '#1F1A14' }]}>
          <View style={styles.avatarWrap}>
            <Text style={{ fontSize: 36 }}>{friend.avatar_url || '🦊'}</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.friendName, { fontFamily: fonts.serifSemiBold }]}>
            {friend.name ?? 'Unbekannt'}
          </Text>
          <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.62} style={{ color: 'rgba(250,247,240,0.6)', fontSize: 12, lineHeight: 18, marginBottom: 16, includeFontPadding: true, textAlign: 'center', paddingHorizontal: 12 }}>
            Rang {levelIndex + 1} · {level.name} · {friend.xp} Punkte
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: 'rgba(250,247,240,0.15)' }]}>
            <View style={[styles.progressFill, { backgroundColor: '#C99A3C', width: `${progressFraction * 100}%` }]} />
          </View>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: 'rgba(250,247,240,0.45)', fontSize: 10.5, lineHeight: 15, marginTop: 5, textAlign: 'center', includeFontPadding: true }}>
            {next ? `${xpToNext} Punkte bis Rang ${levelIndex + 2}` : 'Höchster Rang'}
          </Text>
          {!isGuest && !isSelfProfile && friendshipStatus !== 'friend' && (
            <Pressable
              disabled={friendshipStatus === 'pending' || requestSending}
              onPress={handleSendFriendRequest}
              style={[styles.friendRequestButton, friendshipStatus === 'pending' && styles.friendRequestButtonDisabled]}
            >
              <Ionicons name={friendshipStatus === 'pending' ? 'checkmark-circle-outline' : 'person-add-outline'} size={15} color="#FAF7F0" />
              <Text style={styles.friendRequestText}>{friendshipStatus === 'pending' ? 'Anfrage gesendet' : 'Freundschaftsanfrage senden'}</Text>
            </Pressable>
          )}
          {!isGuest && !isSelfProfile && friendshipStatus === 'friend' && (
            <View style={[styles.friendRequestButton, styles.friendRequestButtonDisabled]}>
              <Ionicons name="people-outline" size={15} color="#FAF7F0" />
              <Text style={styles.friendRequestText}>Ihr seid Freunde</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <MiniStat label="Streak" value={friend.streak_count} />
            <MiniStat label="Beststreak" value={friend.best_streak} />
            <MiniStat label="Abzeichen" value={earnedIds.size} />
          </View>
        </View>

        {/* Tab-Leiste */}
        <View style={[styles.tabBar, { borderBottomColor: theme.rule, flexDirection: 'row' }]}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabItem}>
              <Text style={[styles.tabLabel, { color: tab === t.key ? theme.ink : theme.inkSoft }]} numberOfLines={1}>{t.label}</Text>
              {tab === t.key && <View style={[styles.tabUnderline, { backgroundColor: theme.accent }]} />}
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 20 }}>

          {tab === 'abzeichen' && (
            allBadges.length === 0
              ? <EmptyState text="Keine Abzeichen definiert." />
              : <View style={styles.badgeGrid}>
                  {allBadges.map(badge => {
                    const earned = earnedIds.has(badge.id);
                    return (
                      <View key={badge.id} style={[styles.badgeItem, { backgroundColor: theme.card, borderColor: earned ? theme.accent : theme.rule, opacity: earned ? 1 : 0.35 }]}>
                        <Text style={{ fontSize: 28 }}>{badge.icon}</Text>
                        <Text style={[styles.badgeName, { color: theme.ink }]} numberOfLines={3}>{badge.name}</Text>
                        {earned && <View style={[styles.earnedDot, { backgroundColor: theme.accent }]} />}
                      </View>
                    );
                  })}
                </View>
          )}

          {tab === 'favoriten' && (
            favorites.length === 0
              ? <EmptyState text="Noch keine Favoriten gespeichert." />
              : favorites.map((item, idx) => (
                  <WordRow key={`${item.word_id}-${idx}`} theme={theme} wort={item.wort} sub={item.wortart} right={
                    new Date(item.datum).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' })
                  } />
                ))
          )}

          {tab === 'benutzt' && (
            usedWords.length === 0
              ? <EmptyState text="Noch kein Wort als benutzt gemeldet." />
              : usedWords.map((item, idx) => (
                  <WordRow key={`${item.word_id}-${idx}`} theme={theme} wort={item.wort} sub={item.wortart} right={
                    new Date(item.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
                  } />
                ))
          )}

          {tab === 'meinwort' && (
            personalWords.length === 0
              ? <EmptyState text="Noch kein persönliches Wort eingetragen." />
              : personalWords.map((item, idx) => (
                  <WordRow key={`${item.datum}-${idx}`} theme={theme} wort={item.wort} sub={null} right={
                    new Date(item.datum).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
                  } />
                ))
          )}

          {tab === 'freunde' && (
            friends.length === 0
              ? <EmptyState text="Noch keine Freunde hinzugefügt." />
              : friends.map((item) => (
                  <Pressable key={item.id} onPress={() => router.push({ pathname: '/(tabs)/freund-profil', params: { userId: item.id, returnTo: returnTo || '/(tabs)/profil' } })}>
                    <View style={[styles.friendRow, { borderBottomColor: theme.rule }]}> 
                      <View style={[styles.friendAvatar, { backgroundColor: '#1F1A14' }]}><Text style={{ fontSize: 16 }}>{item.avatar_url || '🦊'}</Text></View>
                      <Text style={[styles.friendRowName, { color: theme.ink }]} numberOfLines={1}>{item.name ?? 'Unbekannt'}</Text>
                      <Text style={{ color: theme.inkSoft, fontSize: 12 }}>{item.xp} Pkt.</Text>
                    </View>
                  </Pressable>
                ))
          )}

        </View>
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: '#FAF7F0', fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: 'rgba(250,247,240,0.5)', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function WordRow({ theme, wort, sub, right }: { theme: any; wort: string; sub: string | null; right: string }) {
  return (
    <View style={[styles.wordRow, { borderBottomColor: theme.rule }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.wordRowText, { color: theme.ink }]}
        >
          {wort}
        </Text>
        {sub && <Text style={{ color: theme.inkSoft, fontSize: 11 }}>{sub}</Text>}
      </View>
      <Text style={{ color: theme.inkSoft, fontSize: 12 }}>{right}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20, lineHeight: 28, includeFontPadding: true, flex: 1 },
  headerCard: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, alignItems: 'center' },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  friendName: { color: '#FAF7F0', fontSize: 24, lineHeight: 33, marginBottom: 4, includeFontPadding: true, width: '100%', textAlign: 'center' },
  progressTrack: { width: '70%', height: 6, borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },
  friendRequestButton: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(201,154,60,0.9)' },
  friendRequestButtonDisabled: { backgroundColor: 'rgba(250,247,240,0.16)' },
  friendRequestText: { color: '#FAF7F0', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 36, marginTop: 20 },
  tabBar: { borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 0 },
  tabLabel: { fontSize: 13, paddingVertical: 12 },
  tabUnderline: { height: 2, borderRadius: 1 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: { width: '31%', minHeight: 104, borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 6 },
  badgeName: { fontSize: 9, lineHeight: 12, textAlign: 'center' },
  earnedDot: { width: 6, height: 6, borderRadius: 3 },
  wordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  wordRowText: { fontSize: 17, lineHeight: 23, includeFontPadding: true, flexShrink: 1 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  friendAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  friendRowName: { flex: 1, fontSize: 14 },
});
