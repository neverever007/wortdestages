import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';

export default function RechtlichesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const back = returnTo || '/(tabs)/profil';
  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}> 
        <Pressable onPress={() => goBack(router, back)} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]}>Rechtliches</Text>
      </View>
      <View style={{ padding: 24 }}>
        <Row label="Datenschutzerklärung" onPress={() => router.push({ pathname: '/(tabs)/datenschutz', params: { returnTo: '/(tabs)/rechtliches' } })} />
        <Row label="Impressum" onPress={() => router.push({ pathname: '/(tabs)/impressum', params: { returnTo: '/(tabs)/rechtliches' } })} />
        <Row label="Nutzungsbedingungen" onPress={() => router.push({ pathname: '/(tabs)/nutzungsbedingungen', params: { returnTo: '/(tabs)/rechtliches' } })} />
      </View>
    </View>
  );

  function Row({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable style={[styles.row, { backgroundColor: theme.card, borderColor: theme.rule }]} onPress={onPress}>
        <Text style={[styles.rowLabel, { color: theme.ink }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.inkSoft} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20, lineHeight: 28 },
  row: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rowLabel: { fontSize: 14.5, fontWeight: '600' },
});
