import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PERMISSION_ASKED_KEY = 'wortdestages:notifications:permission_asked:v1';
const DAILY_NOTIFICATION_ID_KEY = 'wortdestages:notifications:daily_id:v2';
const NOTIFICATION_SETTINGS_KEY = 'wortdestages:notifications:settings:v2';
const DAILY_SCHEDULED_TIME_KEY = 'wortdestages:notifications:scheduled_time:v1';

const DAILY_CHANNEL_ID = 'wortdestages-daily';
const SOCIAL_CHANNEL_ID = 'wortdestages-social';
const TEST_CHANNEL_ID = 'wortdestages-test';

// Notification-Handler erst beim ersten Aufruf setzen, nicht beim Modulimport
// (verhindert Native-Crash in Release-Builds bevor React Native vollständig bereit ist)
let handlerSet = false;
export function ensureNotificationHandlerSet() {
  if (handlerSet) return;
  handlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (_e) {}
}

export type NotificationSettings = {
  dailyWordEnabled: boolean;
  friendRequestsEnabled: boolean;
  ownWordUpvotesEnabled: boolean;
  time: string;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyWordEnabled: true,
  friendRequestsEnabled: true,
  ownWordUpvotesEnabled: true,
  time: '07:00',
};

export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
    name: 'Wort des Tages',
    description: 'Tägliche Erinnerung mit dem Wort des Tages.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E88354',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync(SOCIAL_CHANNEL_ID, {
    name: 'Community',
    description: 'Freundschaftsanfragen und Upvotes.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E88354',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync(TEST_CHANNEL_ID, {
    name: 'Test',
    description: 'Test-Benachrichtigungen.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E88354',
    sound: 'default',
  });
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_SETTINGS };
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

export async function saveNotificationSettings(next: Partial<NotificationSettings>) {
  const current = await getNotificationSettings();
  const merged = { ...current, ...next };
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(merged));
  await syncDailyWordNotification(merged.dailyWordEnabled, merged.time);
  return merged;
}

export function parseNotificationTime(value?: string | null) {
  const fallback = { hour: 7, minute: 0 };
  if (!value) return fallback;
  const clean = String(value).slice(0, 5);
  const match = clean.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export async function ensureNotificationPermissionOnFirstOpen() {
  await ensureNotificationChannels();
  const alreadyAsked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
  if (alreadyAsked) return;
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

export async function requestNotificationPermissionNow() {
  await ensureNotificationChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') return Notifications.requestPermissionsAsync();
  return current;
}

export async function hasNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  return current.status === 'granted';
}

export async function cancelDailyWordNotification() {
  const existingId = await AsyncStorage.getItem(DAILY_NOTIFICATION_ID_KEY);
  if (existingId) {
    try { await Notifications.cancelScheduledNotificationAsync(existingId); } catch {}
    await AsyncStorage.removeItem(DAILY_NOTIFICATION_ID_KEY);
  }
}

export async function scheduleDailyWordNotification(time = '07:00') {
  await cancelDailyWordNotification();
  await ensureNotificationChannels();
  const granted = await hasNotificationPermission();
  if (!granted) return null;

  const { hour, minute } = parseNotificationTime(time);
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wort des Tages',
      body: 'Dein neues Wort wartet auf dich.',
      data: { route: '/(tabs)/heute' },
      sound: 'default',
    },
    trigger: {
      hour,
      minute,
      repeats: true,
      channelId: DAILY_CHANNEL_ID,
    } as Notifications.NotificationTriggerInput,
  });
  await AsyncStorage.setItem(DAILY_NOTIFICATION_ID_KEY, id);
  return id;
}

export async function syncDailyWordNotification(enabled: boolean, time?: string | null) {
  const targetTime = time || '07:00';
  if (!enabled) {
    await cancelDailyWordNotification();
    await AsyncStorage.removeItem(DAILY_SCHEDULED_TIME_KEY);
    return;
  }
  // Nur neu planen wenn noch keine Benachrichtigung existiert oder die Uhrzeit sich geändert hat
  const existingId = await AsyncStorage.getItem(DAILY_NOTIFICATION_ID_KEY);
  const scheduledTime = await AsyncStorage.getItem(DAILY_SCHEDULED_TIME_KEY);
  if (existingId && scheduledTime === targetTime) return;

  await ensureNotificationPermissionOnFirstOpen();
  await scheduleDailyWordNotification(targetTime);
  await AsyncStorage.setItem(DAILY_SCHEDULED_TIME_KEY, targetTime);
}

export async function sendTestNotification() {
  await requestNotificationPermissionNow();
  const granted = await hasNotificationPermission();
  if (!granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test: Wort des Tages',
      body: 'Benachrichtigungen funktionieren.',
      sound: 'default',
    },
    trigger: {
      seconds: 10,
      channelId: TEST_CHANNEL_ID,
    } as Notifications.NotificationTriggerInput,
  });
}

export async function showFriendRequestNotification(fromName?: string | null) {
  const settings = await getNotificationSettings();
  if (!settings.friendRequestsEnabled) return;
  await ensureNotificationChannels();
  const granted = await hasNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Neue Freundschaftsanfrage',
      body: fromName ? `${fromName} möchte dich hinzufügen.` : 'Du hast eine neue Freundschaftsanfrage.',
      data: { route: '/(tabs)/freundschaftsanfragen' },
      sound: 'default',
    },
    trigger: { channelId: SOCIAL_CHANNEL_ID } as Notifications.NotificationTriggerInput,
  });
}

export async function showOwnWordUpvoteNotification(word?: string | null) {
  const settings = await getNotificationSettings();
  if (!settings.ownWordUpvotesEnabled) return;
  await ensureNotificationChannels();
  const granted = await hasNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Neuer Upvote',
      body: word ? `Dein Wort „${word}“ hat einen Upvote bekommen.` : 'Dein Wort hat einen neuen Upvote bekommen.',
      data: { route: '/(tabs)/feed' },
      sound: 'default',
    },
    trigger: { channelId: SOCIAL_CHANNEL_ID } as Notifications.NotificationTriggerInput,
  });
}

export function setupNotificationResponseListener(onRoute: (route: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const route = response.notification.request.content.data?.route;
    if (typeof route === 'string') onRoute(route);
  });
}
