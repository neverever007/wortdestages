import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../lib/ThemeContext';

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.62}
      allowFontScaling={false}
      style={{ color, fontSize: 10, lineHeight: 13, includeFontPadding: false, textAlign: 'center', width: 74 }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.inkSoft,
        tabBarBackground: () => null,
        tabBarLabelStyle: { fontSize: 9.5, lineHeight: 12, includeFontPadding: false, paddingBottom: 0 },
        tabBarItemStyle: { paddingHorizontal: 0, minWidth: 0, flex: 1 },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarStyle: {
          backgroundColor: theme.paper,
          borderTopColor: theme.rule,
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 0,
          minHeight: 70,
          paddingBottom: 8,
          paddingTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="heute"
        options={{
          title: 'Heute',
          tabBarLabel: ({ color }) => <TabLabel label="Heute" color={color} />,
          tabBarIcon: ({ color }) => <Ionicons name="sunny-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favoriten"
        options={{
          title: 'Favoriten',
          tabBarLabel: ({ color }) => <TabLabel label="Favoriten" color={color} />,
          tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarLabel: ({ color }) => <TabLabel label="Feed" color={color} />,
          tabBarIcon: ({ color }) => <Ionicons name="flame-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="statistik"
        options={{
          title: 'Statistik',
          tabBarLabel: ({ color }) => <TabLabel label="Statistik" color={color} />,
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarLabel: ({ color }) => <TabLabel label="Profil" color={color} />,
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={23} color={color} />,
        }}
      />
      <Tabs.Screen name="vorschlagen" options={{ href: null }} />
      <Tabs.Screen name="meine-vorschlaege" options={{ href: null }} />
      <Tabs.Screen name="freunde-hinzufuegen" options={{ href: null }} />
      <Tabs.Screen name="profil-bearbeiten" options={{ href: null }} />
      <Tabs.Screen name="freundschaftsanfragen" options={{ href: null }} />
      <Tabs.Screen name="notification-zeit" options={{ href: null }} />
      <Tabs.Screen name="mein-wort" options={{ href: null }} />
      <Tabs.Screen name="freund-profil" options={{ href: null }} />
      <Tabs.Screen name="benutzte-woerter" options={{ href: null }} />
      <Tabs.Screen name="app-idee" options={{ href: null }} />
      <Tabs.Screen name="meine-ideen" options={{ href: null }} />
      <Tabs.Screen name="upvotes" options={{ href: null }} />
      <Tabs.Screen name="rechtliches" options={{ href: null }} />
      <Tabs.Screen name="datenschutz" options={{ href: null }} />
      <Tabs.Screen name="impressum" options={{ href: null }} />
      <Tabs.Screen name="nutzungsbedingungen" options={{ href: null }} />
      <Tabs.Screen name="konto-loeschen" options={{ href: null }} />
    </Tabs>
  );
}
