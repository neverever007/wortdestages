import { supabase } from './supabase';

export type LegalSlug = 'datenschutz' | 'impressum' | 'nutzungsbedingungen';

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  content: string;
  updated_at?: string | null;
};

const DEFAULTS: Record<LegalSlug, LegalDocument> = {
  datenschutz: {
    slug: 'datenschutz',
    title: 'Datenschutzerklärung',
    content: `Stand: 25.06.2026\n\nDiese Datenschutzerklärung beschreibt, welche Daten in der App „Wort des Tages” verarbeitet werden.\n\nVerantwortlicher\nFabio Klug\nE-Mail: info@wortdestages.eu\n\nVerarbeitete Daten\nDie App verarbeitet Kontodaten wie E-Mail-Adresse, Anzeigename, Profilbild/Avatar, Favoriten, benutzte Wörter, persönliche Wörter, Upvotes, Freundschaften, App-Ideen und Wortvorschläge.\n\nGastzugang\nIm Gastzugang werden Favoriten, benutzte Wörter und Einstellungen lokal auf dem Gerät gespeichert. Bei späterer Registrierung können diese Daten in den Account übernommen werden.\n\nBenachrichtigungen\nBenachrichtigungen werden nur nach Erlaubnis durch Android/iOS angezeigt. Die Uhrzeit und einzelne Benachrichtigungen können im Profil geändert werden.\n\nDienstleister\nFür Authentifizierung und Datenbank wird Supabase (Supabase Inc.) verwendet. Die Daten werden auf Servern in Irland (EU West) verarbeitet und gespeichert.\n\nLöschung\nDu kannst dein Profil in der App löschen. Dabei werden dein Account und die zugeordneten App-Daten dauerhaft entfernt.`,
  },
  impressum: {
    slug: 'impressum',
    title: 'Impressum',
    content: `Angaben gemäß § 5 TMG / DDG\n\nFabio Klug\n\nKontakt\nE-Mail: info@wortdestages.eu\n\nVerantwortlich für den Inhalt\nFabio Klug`,
  },
  nutzungsbedingungen: {
    slug: 'nutzungsbedingungen',
    title: 'Nutzungsbedingungen',
    content: `Nutzungsbedingungen für „Wort des Tages”\n\n1. Nutzung der App\nDie App dient dem Entdecken, Speichern und Verwenden besonderer Wörter.\n\n2. Nutzerinhalte\nNutzer können eigene Wörter, Vorschläge und App-Ideen einreichen. Inhalte dürfen nicht beleidigend, rechtswidrig, diskriminierend oder urheberrechtsverletzend sein.\n\n3. Moderation\nDer Betreiber darf Inhalte prüfen, ablehnen, löschen oder Accounts einschränken, wenn gegen diese Regeln verstoßen wird.\n\n4. Gastzugang\nGäste können die App eingeschränkt nutzen. Bestimmte Community-Funktionen sind nur mit Konto verfügbar.\n\n5. Haftung\nFür nutzergenerierte Inhalte wird keine Gewähr übernommen.\n\n6. Änderungen\nDie Nutzungsbedingungen können angepasst werden. Die aktuelle Version ist in der App einsehbar.`,
  },
};

export function getDefaultLegalDocument(slug: LegalSlug): LegalDocument {
  return DEFAULTS[slug];
}

export async function loadLegalDocument(slug: LegalSlug): Promise<LegalDocument> {
  const fallback = getDefaultLegalDocument(slug);
  try {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('slug,title,content,updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return fallback;
    return {
      slug,
      title: data.title || fallback.title,
      content: data.content || fallback.content,
      updated_at: data.updated_at,
    };
  } catch {
    return fallback;
  }
}

export async function saveLegalDocument(slug: LegalSlug, title: string, content: string) {
  const { error } = await supabase.from('legal_documents').upsert({
    slug,
    title: title.trim(),
    content: content.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
