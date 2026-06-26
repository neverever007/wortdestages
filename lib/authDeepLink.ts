import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

const PASSWORD_RECOVERY_READY_KEY = 'wortdestages:auth:password_recovery_ready:v1';

type AuthLinkParams = {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

function pick(value: string | null): string | undefined {
  return value && value.length > 0 ? decodeURIComponent(value.replace(/\+/g, ' ')) : undefined;
}

export function readAuthParamsFromUrl(url?: string | null): AuthLinkParams {
  const result: AuthLinkParams = {};
  if (!url) return result;

  const readPart = (part?: string) => {
    if (!part) return;
    const clean = part.replace(/^[?#]/, '');
    if (!clean) return;
    const params = new URLSearchParams(clean);
    result.access_token = result.access_token ?? pick(params.get('access_token'));
    result.refresh_token = result.refresh_token ?? pick(params.get('refresh_token'));
    result.code = result.code ?? pick(params.get('code'));
    result.token_hash = result.token_hash ?? pick(params.get('token_hash'));
    result.type = result.type ?? pick(params.get('type'));
    result.error = result.error ?? pick(params.get('error'));
    result.error_code = result.error_code ?? pick(params.get('error_code'));
    result.error_description = result.error_description ?? pick(params.get('error_description'));
  };

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined;
    readPart(url.slice(queryIndex + 1, queryEnd));
  }
  if (hashIndex >= 0) readPart(url.slice(hashIndex + 1));

  return result;
}

export async function markPasswordRecoveryReady() {
  await AsyncStorage.setItem(PASSWORD_RECOVERY_READY_KEY, '1');
}

export async function clearPasswordRecoveryReady() {
  await AsyncStorage.removeItem(PASSWORD_RECOVERY_READY_KEY);
}

export async function isPasswordRecoveryReady() {
  const value = await AsyncStorage.getItem(PASSWORD_RECOVERY_READY_KEY);
  if (value === '1') {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  }
  return false;
}

export async function handleSupabaseAuthUrl(url?: string | null) {
  if (!url) return { handled: false, recovery: false, error: null as string | null };

  const params = readAuthParamsFromUrl(url);
  const isRecovery = params.type === 'recovery' || url.includes('reset-password');

  if (params.error || params.error_description) {
    return { handled: false, recovery: isRecovery, error: params.error_description || params.error || 'Der Auth-Link ist ungültig.' };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { handled: false, recovery: isRecovery, error: error.message };
    if (isRecovery) await markPasswordRecoveryReady();
    return { handled: true, recovery: isRecovery, error: null };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { handled: false, recovery: isRecovery, error: error.message };
    if (isRecovery) await markPasswordRecoveryReady();
    return { handled: true, recovery: isRecovery, error: null };
  }

  // token_hash ist nur vorhanden, wenn ein angepasstes Mail-Template verwendet wird.
  // Der Standard-Supabase-Link enthält dagegen serverseitig ?token=... und leitet danach
  // normalerweise mit access_token/refresh_token oder code in die App weiter.
  if (params.token_hash && isRecovery) {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: params.token_hash,
    });
    if (error) return { handled: false, recovery: true, error: error.message };
    await markPasswordRecoveryReady();
    return { handled: true, recovery: true, error: null };
  }

  const { data } = await supabase.auth.getSession();
  if (isRecovery && data.session) {
    await markPasswordRecoveryReady();
    return { handled: true, recovery: true, error: null };
  }

  return { handled: false, recovery: isRecovery, error: null };
}

export function setupSupabaseAuthDeepLinking(onRecovery?: () => void) {
  let active = true;

  const handle = async (url?: string | null) => {
    const result = await handleSupabaseAuthUrl(url);
    if (active && result.recovery && result.handled) onRecovery?.();
  };

  Linking.getInitialURL().then(handle).catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => {
    handle(url).catch(() => {});
  });

  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      await markPasswordRecoveryReady();
      if (active) onRecovery?.();
    }
  });

  return {
    remove() {
      active = false;
      sub.remove();
      authListener.subscription.unsubscribe();
    },
  };
}
