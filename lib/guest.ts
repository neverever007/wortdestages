import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const GUEST_ID = '00000000-0000-0000-0000-000000000000';
export const GUEST_STORAGE_KEY = 'wortdestages:guest:v1';

export type GuestUsage = { word_id: string; date: string };
export type GuestPersonalWord = { datum: string; wort: string };
export type GuestState = {
  enabled: boolean;
  favorites: string[];
  usages: GuestUsage[];
  personalWords: GuestPersonalWord[];
};

const DEFAULT_GUEST_STATE: GuestState = {
  enabled: false,
  favorites: [],
  usages: [],
  personalWords: [],
};

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getGuestState(): Promise<GuestState> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GUEST_STATE };
    return { ...DEFAULT_GUEST_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GUEST_STATE };
  }
}

export async function setGuestState(next: GuestState) {
  await AsyncStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
}

export async function enableGuestMode() {
  const current = await getGuestState();
  await setGuestState({ ...current, enabled: true });
}

export async function disableGuestMode({ clearData = false } = {}) {
  if (clearData) {
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
    return;
  }
  const current = await getGuestState();
  await setGuestState({ ...current, enabled: false });
}

export async function isGuestFavorite(wordId: string): Promise<boolean> {
  const state = await getGuestState();
  return state.favorites.includes(wordId);
}

export async function setGuestFavorite(wordId: string, favorite: boolean) {
  const state = await getGuestState();
  const favorites = favorite
    ? Array.from(new Set([...state.favorites, wordId]))
    : state.favorites.filter(id => id !== wordId);
  await setGuestState({ ...state, favorites });
}

export async function isGuestUsage(wordId: string, date = todayIso()): Promise<boolean> {
  const state = await getGuestState();
  return state.usages.some(u => u.word_id === wordId && u.date === date);
}

export async function setGuestUsage(wordId: string, used: boolean, date = todayIso()) {
  const state = await getGuestState();
  const usages = used
    ? [...state.usages.filter(u => !(u.word_id === wordId && u.date === date)), { word_id: wordId, date }]
    : state.usages.filter(u => !(u.word_id === wordId && u.date === date));
  await setGuestState({ ...state, usages });
}

export async function getGuestPersonalWords(): Promise<GuestPersonalWord[]> {
  const state = await getGuestState();
  return state.personalWords;
}

export async function setGuestPersonalWord(wort: string, datum = todayIso()) {
  const state = await getGuestState();
  const personalWords = [
    ...state.personalWords.filter(w => w.datum !== datum),
    { datum, wort },
  ].sort((a, b) => b.datum.localeCompare(a.datum));
  await setGuestState({ ...state, personalWords });
}

export async function migrateGuestDataToAccount(userId: string) {
  const state = await getGuestState();
  if (!state.enabled) return;

  for (const wordId of state.favorites) {
    await supabase.from('favorites').upsert({ user_id: userId, word_id: wordId });
  }

  for (const usage of state.usages) {
    await supabase.from('word_usage').upsert({ user_id: userId, word_id: usage.word_id, date: usage.date });
  }

  for (const personal of state.personalWords) {
    await supabase.rpc('register_personal_word', { p_wort: personal.wort, p_datum: personal.datum });
  }

  await disableGuestMode({ clearData: true });
}
