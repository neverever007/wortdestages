import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { Word } from '../../lib/types';
import { isGuestFavorite, setGuestFavorite, isGuestUsage, setGuestUsage } from '../../lib/guest';
import { didLevelUp } from '../../lib/levels';
import LevelUpOverlay from '../../components/LevelUpOverlay';
import ShareWordCard from '../../components/ShareWordCard';

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function isoDayNumber(iso: string) {
  return Number(iso.slice(8, 10));
}
function isoWeekdayShortDe(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const dow = (adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) + t[month - 1] + day) % 7;
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][dow];
}
function addDaysLocal(base: Date, offset: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + offset);
  return toLocalIso(d);
}
function wordFontSize(wort: string) {
  if (wort.length >= 24) return 24;
  if (wort.length >= 20) return 27;
  if (wort.length >= 16) return 31;
  if (wort.length >= 12) return 37;
  return 46;
}

export default function HeuteScreen() {
  const { theme } = useTheme();
  const { profile, refreshProfile, isGuest } = useAuth();

  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [alreadyUsedToday, setAlreadyUsedToday] = useState(false);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [suggesterName, setSuggesterName] = useState<string | null>(null);

  const todayIso = toLocalIso(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const isToday = selectedDate === todayIso;

  // Die letzten 7 Tage (heute + 6 davor) für die Tage-Leiste
  const last7Days = Array.from({ length: 7 }).map((_, i) => addDaysLocal(new Date(), -(6 - i)));

  async function loadWordForDate(dateIso: string) {
    setLoading(true);

    let loadedWord: Word | null = null;

    if (dateIso === todayIso) {
      // Heute: Wort des heutigen Datums; falls keins existiert, das letzte verfügbare als Fallback
      const { data: todayWord } = await supabase
        .from('words')
        .select('*')
        .eq('datum', dateIso)
        .maybeSingle();

      if (todayWord) {
        loadedWord = todayWord;
      } else {
        const { data: fallback } = await supabase
          .from('words')
          .select('*')
          .lte('datum', dateIso)
          .order('datum', { ascending: false })
          .limit(1)
          .maybeSingle();
        loadedWord = fallback ?? null;
      }
    } else {
      // Vergangener Tag: nur das exakte Wort dieses Datums, kein Fallback
      const { data: pastWord } = await supabase
        .from('words')
        .select('*')
        .eq('datum', dateIso)
        .maybeSingle();
      loadedWord = pastWord ?? null;
    }

    setWord(loadedWord);

    // Einreicher-Name für Community-Vorschläge laden
    if (loadedWord?.is_community && loadedWord.suggested_by) {
      const { data: suggester } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', loadedWord.suggested_by)
        .maybeSingle();
      setSuggesterName(suggester?.name ?? null);
    } else {
      setSuggesterName(null);
    }

    if (loadedWord && profile) {
      if (isGuest) {
        setIsFavorite(await isGuestFavorite(loadedWord.id));
        setAlreadyUsedToday(await isGuestUsage(loadedWord.id, todayIso));
        const { data: todayCount } = await supabase.rpc('get_word_usage_count_today', { p_word_id: loadedWord.id });
        setUsageCount(todayCount ?? 0);
      } else {
        const { data: fav } = await supabase
          .from('favorites')
          .select('*')
          .eq('user_id', profile.id)
          .eq('word_id', loadedWord.id)
          .maybeSingle();
        setIsFavorite(!!fav);

        const { data: usage } = await supabase
          .from('word_usage')
          .select('*')
          .eq('user_id', profile.id)
          .eq('word_id', loadedWord.id)
          .maybeSingle();
        setAlreadyUsedToday(!!usage);

        const { data: todayCount, error: todayCountError } = await supabase.rpc('get_word_usage_count_today', { p_word_id: loadedWord.id });
        if (todayCountError) {
          const { data: count } = await supabase.rpc('get_word_usage_count', { p_word_id: loadedWord.id });
          setUsageCount(count ?? 0);
        } else {
          setUsageCount(todayCount ?? 0);
        }
      }
    }

    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadWordForDate(selectedDate);
      if (selectedDate === todayIso) {
        registerOpen();
      }
    }, [profile?.id, selectedDate])
  );

  async function registerOpen() {
    if (!profile || isGuest) return;
    const xpBefore = profile.xp;
    await supabase.rpc('register_daily_open');
    const { data: updated } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', profile.id)
      .single();
    if (updated && didLevelUp(xpBefore, updated.xp)) {
      setShowLevelUp(true);
    }
    await refreshProfile();
  }

  async function toggleFavorite() {
    if (!profile || !word) return;
    Haptics.selectionAsync();

    if (isGuest) {
      await setGuestFavorite(word.id, !isFavorite);
      setIsFavorite(!isFavorite);
      return;
    }

    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', profile.id).eq('word_id', word.id);
      setIsFavorite(false);
    } else {
      await supabase.from('favorites').insert({ user_id: profile.id, word_id: word.id });
      setIsFavorite(true);
    }
  }

  async function reportUsage() {
    if (!profile || !word) return;

    if (isGuest) {
      await setGuestUsage(word.id, !alreadyUsedToday, todayIso);
      Haptics.selectionAsync();
      setAlreadyUsedToday(!alreadyUsedToday);
      return;
    }

    if (alreadyUsedToday) {
      const { error } = await supabase.rpc('undo_word_usage', { p_word_id: word.id });
      if (error) {
        await supabase
          .from('word_usage')
          .delete()
          .eq('user_id', profile.id)
          .eq('word_id', word.id)
          .eq('date', todayIso);
      }
      Haptics.selectionAsync();
      setAlreadyUsedToday(false);
      setUsageCount((c) => Math.max(0, c - 1));
      return;
    }

    const xpBefore = profile.xp;
    const { error } = await supabase.rpc('report_word_usage', { p_word_id: word.id });

    if (error) {
      Alert.alert('Fehler', 'Konnte nicht gespeichert werden. Versuch es erneut.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlreadyUsedToday(true);
    setUsageCount((c) => c + 1);

    const { data: updated } = await supabase.from('profiles').select('xp').eq('id', profile.id).single();
    if (updated && didLevelUp(xpBefore, updated.xp)) {
      setShowLevelUp(true);
    }
    await refreshProfile();
  }

  function speakWord() {
    if (!word) return;
    Speech.speak(word.wort, { language: 'de-DE', rate: 0.9 });
  }

  function DayPicker() {
    return (
      <View style={[styles.dayPicker, { borderBottomColor: theme.rule }]}>
        {last7Days.map((dateIso) => {
          const isSelected = dateIso === selectedDate;
          const dayLabel = isoWeekdayShortDe(dateIso);
          const dayNum = isoDayNumber(dateIso);
          return (
            <Pressable
              key={dateIso}
              onPress={() => setSelectedDate(dateIso)}
              style={[styles.dayPickerItem, isSelected && { backgroundColor: theme.ink }]}
            >
              <Text style={[styles.dayPickerWeekday, { color: isSelected ? theme.paper : theme.inkSoft }]}>
                {dayLabel}
              </Text>
              <Text
                style={[
                  styles.dayPickerNum,
                  { color: isSelected ? theme.paper : theme.ink, fontFamily: fonts.serifSemiBold },
                ]}
              >
                {dayNum}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.paper }]}>
        <DayPicker />
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </View>
    );
  }

  if (!word) {
    return (
      <View style={[styles.container, { backgroundColor: theme.paper }]}>
        <DayPicker />
        <View style={styles.center}>
          <Text style={{ color: theme.inkSoft, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
            {isToday
              ? 'Noch kein Wort des Tages verfügbar. Schau später wieder vorbei.'
              : 'Für diesen Tag gibt es kein Wort.'}
          </Text>
        </View>
      </View>
    );
  }

  const dateLabel = new Date(word.datum).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <DayPicker />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
          <Text style={[styles.mastheadLabel, { color: theme.inkSoft }]}>
            {isToday ? 'Wort des Tages' : 'Wort vom'}
          </Text>
          <Text numberOfLines={1} style={[styles.mastheadDate, { color: theme.inkSoft }]}>{dateLabel}</Text>
        </View>

        {word.is_community && (
          <View style={[styles.communityBadge, { borderColor: theme.accent }]}>
            <Ionicons name="people" size={12} color={theme.accent} />
            <Text numberOfLines={1} style={[styles.communityBadgeText, { color: theme.accent }]}>
              Community-Vorschlag{suggesterName ? ` von ${suggesterName}` : ''}
            </Text>
          </View>
        )}

        <View style={styles.wordRow}>
          <Text
            style={[styles.word, {
              color: theme.ink,
              fontFamily: fonts.serifSemiBold,
              fontSize: wordFontSize(word.wort),
              lineHeight: wordFontSize(word.wort) * 1.2,
            }]}
            numberOfLines={2}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {word.wort}
          </Text>
          <Pressable onPress={speakWord} style={styles.speakButton} hitSlop={10}>
            <Ionicons name="volume-medium-outline" size={22} color={theme.inkSoft} />
          </Pressable>
        </View>

        <Text style={[styles.phonetic, { color: theme.inkSoft, fontFamily: fonts.serifItalic }]}>
          {word.lautschrift ? `${word.lautschrift} · ` : ''}
          {word.wortart}
        </Text>

        <Text style={[styles.definition, { color: theme.ink }]}>{word.definition}</Text>

        {word.synonyme && word.synonyme.length > 0 && (
          <Text style={[styles.synonyms, { color: theme.inkSoft }]}>
            Verwandt: {word.synonyme.join(', ')}
          </Text>
        )}

        {word.beispielsatz && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.rule }]} />
            <Text style={[styles.exampleLabel, { color: theme.inkSoft }]}>Beispiel</Text>
            <Text style={[styles.example, { color: theme.inkSoft, fontFamily: fonts.serifItalic }]}>
              {word.beispielsatz}
            </Text>
          </>
        )}


      </ScrollView>

      <View style={[styles.footerRow, { borderTopColor: theme.rule, backgroundColor: theme.paper }]}>
        {/* Herz links */}
        <Pressable onPress={toggleFavorite} hitSlop={10} style={styles.footerIconButton}>
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={isFavorite ? theme.accent : theme.inkSoft}
          />
        </Pressable>

        {/* Heute benutzt Mitte — nur wenn isToday */}
        {isToday && (
          <Pressable
            onPress={reportUsage}
            style={[
              styles.usageFooterBtn,
              { backgroundColor: alreadyUsedToday ? theme.rule : theme.accent },
            ]}
          >
            <Ionicons
              name={alreadyUsedToday ? 'checkmark-circle' : 'megaphone-outline'}
              size={19}
              color={alreadyUsedToday ? theme.inkSoft : 'white'}
            />
            <View>
              <Text style={[styles.usageFooterBtnText, { color: alreadyUsedToday ? theme.inkSoft : 'white' }]}>
                {alreadyUsedToday ? 'Gemeldet' : 'Im Alltag verwendet'}
              </Text>

            </View>
          </Pressable>
        )}

        {/* Teilen rechts */}
        <Pressable onPress={() => setShowShareCard(true)} hitSlop={10} style={styles.footerIconButton}>
          <Ionicons name="share-outline" size={20} color={theme.inkSoft} />
        </Pressable>
      </View>

      {showLevelUp && <LevelUpOverlay onDone={() => setShowLevelUp(false)} />}
      {showShareCard && <ShareWordCard word={word} onClose={() => setShowShareCard(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 26, paddingTop: 34, paddingBottom: 28 },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 24,
  },
  mastheadLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  mastheadDate: { fontSize: 11 },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  communityBadgeText: { fontSize: 11, fontWeight: '600' },
  wordRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, overflow: 'visible' },
  word: { flex: 1, minWidth: 0, includeFontPadding: true, flexShrink: 1, paddingLeft: 1, paddingRight: 2 },
  speakButton: { padding: 6 },
  phonetic: { fontSize: 16, marginTop: 8, marginBottom: 22, lineHeight: 22 },
  definition: { fontSize: 18, lineHeight: 27 },
  synonyms: { fontSize: 13, marginTop: 12, fontStyle: 'italic' },
  divider: { height: 1, marginVertical: 22 },
  exampleLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  example: { fontSize: 16, lineHeight: 24 },
  usageHint: {
    marginTop: 26,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  usageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 100,
    paddingVertical: 14,
    marginTop: 12,
  },
  usageButtonText: { fontSize: 14, fontWeight: '600' },
  usageFooterBtn: {
    flex: 1.25,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  usageFooterBtnText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  footerIconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  dayPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dayPickerItem: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 38,
  },
  dayPickerWeekday: { fontSize: 10, textTransform: 'uppercase' },
  dayPickerNum: { fontSize: 15 },
});
