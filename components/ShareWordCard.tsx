import { View, Text, StyleSheet, Pressable, Modal, Share } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../lib/ThemeContext';
import { fonts } from '../constants/theme';
import { Word } from '../lib/types';

function shareWordSize(wort: string) {
  if (wort.length >= 24) return 28;
  if (wort.length >= 19) return 32;
  if (wort.length >= 14) return 36;
  return 42;
}

export default function ShareWordCard({ word, onClose }: { word: Word; onClose: () => void }) {
  const { theme } = useTheme();
  const size = shareWordSize(word.wort);

  async function handleShare() {
    const message = `Wort des Tages: ${word.wort}\n\n${word.definition}${word.beispielsatz ? `\n\nBeispiel: ${word.beispielsatz}` : ''}`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('Teilen fehlgeschlagen', e);
    }
  }

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.paper }]}> 
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.inkSoft} />
          </Pressable>

          <View style={styles.card}> 
            <Text style={styles.cardLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>Wort des Tages</Text>
            <Text
              style={[styles.cardWord, { fontFamily: fonts.serifSemiBold, fontSize: size, lineHeight: size * 1.14 }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.58}
            >
              {word.wort}
            </Text>
            {!!word.lautschrift && (
              <Text
                style={[styles.cardPhonetic, { fontFamily: fonts.serifItalic }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {word.lautschrift}{word.wortart ? ` · ${word.wortart}` : ''}
              </Text>
            )}
            <Text style={styles.cardDefinition} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.82}>
              {word.definition}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardBrand} numberOfLines={1}>Wort des Tages App</Text>
            </View>
          </View>

          <Pressable style={[styles.shareBtn, { backgroundColor: theme.accent }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="white" />
            <Text style={styles.shareBtnText}>Teilen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  closeButton: { alignSelf: 'flex-end', marginBottom: 6 },
  card: {
    backgroundColor: '#1F1A14',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: 'center',
    minHeight: 380,
  },
  cardLabel: {
    color: '#C99A3C',
    fontSize: 9.5,
    lineHeight: 22,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    includeFontPadding: true,
    width: '100%',
    minHeight: 26,
  },
  cardWord: { color: '#FAF7F0', marginBottom: 8, includeFontPadding: true },
  cardPhonetic: { color: 'rgba(250,247,240,0.62)', fontSize: 14, lineHeight: 20, marginBottom: 18, includeFontPadding: true },
  cardDefinition: { color: 'rgba(250,247,240,0.9)', fontSize: 15, lineHeight: 22, flexShrink: 1 },
  cardFooter: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(250,247,240,0.12)' },
  cardBrand: { color: 'rgba(250,247,240,0.55)', fontSize: 10, lineHeight: 18, letterSpacing: 0.5, includeFontPadding: true, minHeight: 20 },
  shareBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 100,
    paddingVertical: 15,
    marginTop: 20,
  },
  shareBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
