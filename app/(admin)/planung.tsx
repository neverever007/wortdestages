import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

type WordSlim = { id: string; wort: string; datum: string };

function pad(n: number) { return String(n).padStart(2, '0'); }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

// Berechnet Wochentag (Mo=0...So=6) aus ISO-Datum ohne Date-Konstruktor
// Verwendet Tomohiko Sakamoto's Algorithmus - völlig timezone-unabhängig
function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  // Zeller-basierter Algorithmus für Wochentag (0=So, 1=Mo, ..., 6=Sa)
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yr = m < 3 ? y - 1 : y;
  const dow = (yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) + t[m - 1] + d) % 7;
  // dow: 0=So, 1=Mo...6=Sa → umrechnen auf Mo=0...So=6
  return (dow + 6) % 7;
}

export default function PlanungScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();

  const todayLocal = new Date();
  const todayIso = toIso(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());

  const [viewYear, setViewYear] = useState(todayLocal.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayLocal.getMonth());
  const [wordsByDate, setWordsByDate] = useState<Record<string, WordSlim>>({});
  const [loading, setLoading] = useState(true);

  async function loadMonth() {
    setLoading(true);
    const firstIso = toIso(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const lastIso = toIso(viewYear, viewMonth, daysInMonth);
    const { data } = await supabase.from('words').select('id, wort, datum')
      .gte('datum', firstIso).lte('datum', lastIso);
    const map: Record<string, WordSlim> = {};
    (data ?? []).forEach((w: WordSlim) => { map[w.datum] = w; });
    setWordsByDate(map);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { loadMonth(); }, [viewYear, viewMonth]));

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  }

  function openDay(dateIso: string) {
    const existing = wordsByDate[dateIso];
    router.push({
      pathname: '/(admin)/neues-wort',
      params: existing ? { editWordId: existing.id, editDatum: dateIso } : { prefillDatum: dateIso },
    });
  }

  function confirmDelete(dateIso: string) {
    const entry = wordsByDate[dateIso];
    if (!entry) return;
    Alert.alert('Wort löschen?', `„${entry.wort}" wird unwiderruflich gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        await supabase.from('words').delete().eq('id', entry.id);
        setWordsByDate(prev => { const n = { ...prev }; delete n[dateIso]; return n; });
      }},
    ]);
  }

  const firstIso = toIso(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingEmpty = isoWeekday(firstIso); // Mo=0 ... So=6

  const cells: (string | null)[] = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIso(viewYear, viewMonth, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}>
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <View style={styles.mastheadLeft}>
          <Pressable onPress={() => goBack(router, '/(tabs)/profil')} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
          </Pressable>
          <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Planung</Text>
        </View>
        <View style={[styles.adminBadge, { borderColor: theme.accent }]}>
          <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>ADMIN</Text>
        </View>
      </View>

      <View style={[styles.subtabs, { borderBottomColor: theme.rule }]}>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/neues-wort')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Neues Wort</Text>
        </Pressable>
        <Text style={[styles.subtab, styles.subtabActive, { color: theme.ink, borderBottomColor: theme.accent }]}>Planung</Text>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/vorschlaege')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Vorschläge</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/app-ideen')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>App-Ideen</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/historie')}>
          <Text style={[styles.subtab, { color: theme.inkSoft }]}>Historie</Text>
        </Pressable>
        <Pressable style={styles.subtabPressable} onPress={() => router.replace('/(admin)/rechtliches')}><Text style={[styles.subtab, { color: theme.inkSoft }]}>Recht</Text></Pressable>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.ink} />
        </Pressable>
        <Pressable onPress={() => { setViewYear(todayLocal.getFullYear()); setViewMonth(todayLocal.getMonth()); }}>
          <Text style={[styles.monthLabel, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>
            {MONATSNAMEN[viewMonth]} {viewYear}
          </Text>
        </Pressable>
        <Pressable onPress={() => changeMonth(1)} hitSlop={10} style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={theme.ink} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WOCHENTAGE.map((wd) => (
          <Text key={wd} style={[styles.weekdayLabel, { color: theme.inkSoft }]}>{wd}</Text>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {cells.map((iso, idx) => {
            if (!iso) return <View key={`e-${idx}`} style={styles.dayCell} />;
            const dayNum = parseInt(iso.slice(8), 10);
            const wordEntry = wordsByDate[iso];
            const isToday = iso === todayIso;
            const isPast = iso < todayIso;

            return (
              <View key={iso} style={[styles.dayCell, {
                backgroundColor: wordEntry ? `${theme.accent}18` : theme.card,
                borderColor: isToday ? theme.accent : theme.rule,
                borderWidth: isToday ? 2 : 1,
                opacity: isPast && !wordEntry ? 0.4 : 1,
              }]}>
                <Text style={[styles.dayNum, { color: isToday ? theme.accent : theme.ink }]}>{dayNum}</Text>
                {wordEntry ? (
                  <>
                    <Text
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                      style={[styles.dayWord, { color: theme.accent }]}
                    >
                      {wordEntry.wort}
                    </Text>
                    <View style={styles.dayCellActions}>
                      <Pressable hitSlop={8} onPress={() => openDay(iso)}>
                        <Ionicons name="pencil-outline" size={11} color={theme.inkSoft} />
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => confirmDelete(iso)}>
                        <Ionicons name="trash-outline" size={11} color={theme.red} />
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable onPress={() => openDay(iso)} hitSlop={6}>
                    <Ionicons name="add" size={14} color={theme.inkSoft} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 15, minHeight: 96 },
  mastheadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, lineHeight: 28, includeFontPadding: true },
  adminBadge: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3 },
  subtabs: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 8, paddingBottom: 0, minHeight: 46, alignItems: 'flex-end', borderBottomWidth: 1 },
  subtabPressable: { flex: 1, minWidth: 0 },
  subtab: { fontSize: 9.2, lineHeight: 13, paddingBottom: 8, paddingTop: 2, flex: 1, textAlign: 'center', minWidth: 0 },
  subtabActive: { fontWeight: '600', borderBottomWidth: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 16, minHeight: 58 },
  monthNavBtn: { padding: 6 },
  monthLabel: { fontSize: 18, lineHeight: 26, includeFontPadding: true, minWidth: 150, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 10, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingTop: 4, paddingBottom: 20 },
  dayCell: { width: `${100 / 7}%`, minHeight: 76, padding: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'flex-start' },
  dayNum: { fontSize: 11, marginBottom: 2 },
  dayWord: { fontSize: 8.5, textAlign: 'center', lineHeight: 10.5, width: '100%', flexShrink: 1, includeFontPadding: false },
  dayCellActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
