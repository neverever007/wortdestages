import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, Modal, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { Word } from '../../lib/types';
import { getGuestState, setGuestFavorite } from '../../lib/guest';

type RemovedFavorite = { word: Word; index: number } | null;

export default function FavoritenScreen() {
  const { theme } = useTheme();
  const { profile, isGuest } = useAuth();
  const [favorites, setFavorites] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [removedFavorite, setRemovedFavorite] = useState<RemovedFavorite>(null);

  async function loadFavorites() {
    if (!profile) return;
    setLoading(true);
    if (isGuest) {
      const guest = await getGuestState();
      if (guest.favorites.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from('words').select('*').in('id', guest.favorites);
      const byId = new Map((data ?? []).map((w: any) => [w.id, w]));
      setFavorites(guest.favorites.map(id => byId.get(id)).filter(Boolean) as Word[]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('favorites')
      .select('word_id, words(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    const words = (data ?? []).map((row: any) => row.words).filter(Boolean);
    setFavorites(words);
    setLoading(false);
  }

  async function removeFavorite(word: Word) {
    if (!profile) return;
    const index = Math.max(0, favorites.findIndex((w) => w.id === word.id));
    if (isGuest) {
      await setGuestFavorite(word.id, false);
    } else {
      await supabase.from('favorites').delete().eq('user_id', profile.id).eq('word_id', word.id);
    }
    setRemovedFavorite({ word, index });
    setFavorites((prev) => prev.filter((w) => w.id !== word.id));
    if (selectedWord?.id === word.id) setSelectedWord(null);
  }

  async function undoRemoveFavorite() {
    if (!profile || !removedFavorite) return;
    const { word, index } = removedFavorite;
    if (isGuest) {
      await setGuestFavorite(word.id, true);
    } else {
      await supabase.from('favorites').upsert({ user_id: profile.id, word_id: word.id });
    }
    setFavorites((prev) => {
      if (prev.some((w) => w.id === word.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, word);
      return next;
    });
    setRemovedFavorite(null);
  }

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      return () => setRemovedFavorite(null);
    }, [profile?.id])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Favoriten</Text>
        <Text style={[styles.count, { color: theme.inkSoft }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{favorites.length} gemerkt</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : favorites.length === 0 ? (
        <Text style={[styles.empty, { color: theme.inkSoft }]}> 
          Noch keine Wörter gemerkt. Tippe auf das Herz beim Wort des Tages.
        </Text>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingBottom: removedFavorite ? 92 : 32, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.rule }]}
              onPress={() => setSelectedWord(item)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.date, { color: theme.inkSoft }]}> 
                  {new Date(`${item.datum}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
                </Text>
                <Text
                  style={[styles.word, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.74}
                >
                  {item.wort}
                </Text>
                <Text style={[styles.definition, { color: theme.inkSoft }]} numberOfLines={2}>
                  {item.definition}
                </Text>
              </View>
              <Pressable onPress={() => removeFavorite(item)} hitSlop={12}>
                <Ionicons name="heart" size={20} color={theme.accent} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {removedFavorite && (
        <View style={[styles.undoBar, { backgroundColor: '#1F1A14', borderColor: theme.rule }]}> 
          <Text style={styles.undoText} numberOfLines={1}>Favorit entfernt</Text>
          <Pressable onPress={undoRemoveFavorite} style={[styles.undoButton, { backgroundColor: theme.accent }]}> 
            <Text style={styles.undoButtonText}>Rückgängig</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={!!selectedWord} transparent animationType="slide" onRequestClose={() => setSelectedWord(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedWord(null)} />
        <View style={[styles.sheet, { backgroundColor: '#1F1A14', borderColor: theme.accent }]}> 
          <View style={[styles.sheetHandle, { backgroundColor: theme.accent }]} />

          {selectedWord && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetDate}> 
                  {new Date(`${selectedWord.datum}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Pressable onPress={() => removeFavorite(selectedWord)} hitSlop={12}>
                  <Ionicons name="heart" size={22} color={theme.accent} />
                </Pressable>
              </View>

              <Text numberOfLines={3} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.sheetWord, { fontFamily: fonts.serifSemiBold }]}> 
                {selectedWord.wort}
              </Text>

              {(selectedWord.lautschrift || selectedWord.wortart) && (
                <Text numberOfLines={2} style={styles.sheetMeta}> 
                  {selectedWord.lautschrift ? `${selectedWord.lautschrift}  ·  ` : ''}{selectedWord.wortart}
                </Text>
              )}

              <Text style={styles.sheetDefinition}>
                {selectedWord.definition}
              </Text>

              {selectedWord.synonyme && selectedWord.synonyme.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sheetSectionLabel}>Verwandt</Text>
                  <Text style={[styles.sheetSynonyms, { fontFamily: fonts.serifItalic }]}> 
                    {selectedWord.synonyme.join(', ')}
                  </Text>
                </View>
              )}

              {selectedWord.beispielsatz && (
                <View style={[styles.sheetExample, { backgroundColor: theme.paper, borderColor: theme.accent }]}> 
                  <Text style={[styles.sheetExampleLabel, { color: theme.inkSoft }]}>Beispiel</Text>
                  <Text style={[styles.sheetExampleText, { color: theme.ink }]}> 
                    {selectedWord.beispielsatz}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 58, paddingBottom: 18, minHeight: 104 },
  title: { fontSize: 22, lineHeight: 32, includeFontPadding: true, flexShrink: 1, paddingRight: 10 },
  count: { fontSize: 12, lineHeight: 18, includeFontPadding: true, flexShrink: 0, maxWidth: 96, textAlign: 'right' },
  empty: { textAlign: 'center', marginTop: 60, paddingHorizontal: 40, fontSize: 13.5, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  date: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  word: { fontSize: 21, lineHeight: 27, marginBottom: 4, includeFontPadding: true, flexShrink: 1 },
  definition: { fontSize: 13, lineHeight: 18 },
  undoBar: {
    position: 'absolute', left: 18, right: 18, bottom: 18,
    borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  undoText: { color: '#FAF7F0', flex: 1, fontSize: 13 },
  undoButton: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  undoButtonText: { color: 'white', fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '82%', borderWidth: 1, borderBottomWidth: 0 },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetDate: { color: 'rgba(250,247,240,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetWord: { color: '#FAF7F0', fontSize: 34, lineHeight: 43, marginBottom: 6, includeFontPadding: true, flexShrink: 1 },
  sheetMeta: { color: 'rgba(250,247,240,0.62)', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  sheetDefinition: { color: '#FAF7F0', fontSize: 15, lineHeight: 23 },
  sheetSectionLabel: { color: 'rgba(250,247,240,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  sheetSynonyms: { color: 'rgba(250,247,240,0.72)', fontSize: 13, lineHeight: 19 },
  sheetExample: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 16 },
  sheetExampleLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  sheetExampleText: { fontSize: 14, lineHeight: 21 },
});
