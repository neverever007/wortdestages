import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { getLevelForXp } from '../lib/levels';
import { fonts } from '../constants/theme';

export default function LevelUpOverlay({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const level = profile ? getLevelForXp(profile.xp) : null;

  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: theme.ink }]}> 
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[styles.title, { color: theme.gold, fontFamily: fonts.serifSemiBold }]}>Level aufgestiegen!</Text>
        <Text style={[styles.levelName, { color: theme.paper, fontFamily: fonts.serifSemiBold }]}> {level?.name ?? 'Neues Level'} </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  card: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 20,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 14, marginBottom: 6 },
  levelName: { fontSize: 24 },
});
