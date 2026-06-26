import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../lib/ThemeContext';
import { fonts } from '../../constants/theme';
import { goBack } from '../../lib/navigation';
import { loadLegalDocument, LegalSlug } from '../../lib/legal';
import { useAuth } from '../../lib/AuthContext';

const SLUG = 'impressum' as LegalSlug;

export default function LegalScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      loadLegalDocument(SLUG).then((doc) => {
        if (!alive) return;
        setTitle(doc.title);
        setContent(doc.content);
        setLoading(false);
      });
      return () => { alive = false; };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.paper }]}> 
      <View style={[styles.masthead, { borderBottomColor: theme.rule }]}>
        <Pressable onPress={() => goBack(router, returnTo || '/(tabs)/profil')} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={theme.inkSoft} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink, fontFamily: fonts.serifSemiBold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{title || 'Rechtliches'}</Text>
        {profile?.is_admin && (
          <Pressable onPress={() => router.push('/(admin)/rechtliches?tab=impressum')} hitSlop={10}>
            <Ionicons name="pencil-outline" size={20} color={theme.inkSoft} />
          </Pressable>
        )}
      </View>
      {loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {content.split('\n').map((line, index) => {
            const clean = line.trim();
            if (!clean) return <View key={index} style={{ height: 10 }} />;
            const isHeading = clean.length < 55 && !clean.endsWith('.') && !clean.includes('Bitte vor Veröffentlichung ergänzen:');
            return <Text key={index} style={[isHeading ? styles.h : styles.p, { color: isHeading ? theme.ink : theme.inkSoft }]}>{clean}</Text>;
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 14 },
  title: { fontSize: 20, lineHeight: 28, flex: 1 },
  content: { padding: 24, paddingBottom: 56 },
  h: { fontSize: 16, lineHeight: 23, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  p: { fontSize: 13.5, lineHeight: 21, marginBottom: 8 },
});
