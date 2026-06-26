import { supabase } from './supabase';

// Clientseitige Grundprüfung: nur sinnvolle Zeichen, keine Sonderzeichen-Spam
function isBasicValid(wort: string): { ok: boolean; reason?: string } {
  const trimmed = wort.trim();
  if (trimmed.length < 2) return { ok: false, reason: 'Das Wort ist zu kurz.' };
  if (trimmed.length > 40) return { ok: false, reason: 'Das Wort ist zu lang (max. 40 Zeichen).' };
  if (/[<>{}[\]\\|^`~]/.test(trimmed)) return { ok: false, reason: 'Ungültige Zeichen.' };
  if (/(.)\1{4,}/.test(trimmed)) return { ok: false, reason: 'Ungültiges Wort.' };
  return { ok: true };
}

// DB-seitige Sperrwortprüfung
export async function checkWordAllowed(wort: string): Promise<{ ok: boolean; reason?: string }> {
  const basic = isBasicValid(wort);
  if (!basic.ok) return basic;

  const { data, error } = await supabase.rpc('check_word_allowed', { p_wort: wort.trim() });
  if (error) return { ok: true }; // Im Zweifel durchlassen
  if (data === false) return { ok: false, reason: 'Dieses Wort ist nicht erlaubt.' };
  return { ok: true };
}
