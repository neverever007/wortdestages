export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  xp: number;
  level_key: string;
  streak_count: number;
  best_streak: number;
  last_opened_date: string | null;
  notification_time: string;
  notifications_enabled: boolean;
  friend_code: string;
  created_at: string;
};

export type Word = {
  id: string;
  wort: string;
  lautschrift: string | null;
  wortart: string | null;
  definition: string;
  beispielsatz: string | null;
  synonyme: string[] | null;
  datum: string; // YYYY-MM-DD
  is_community: boolean;
  suggested_by: string | null;
  created_by: string | null;
  created_at: string;
};

export type WordSuggestion = {
  id: string;
  user_id: string;
  wort: string;
  begruendung: string;
  status: 'offen' | 'angenommen' | 'abgelehnt';
  resulting_word_id: string | null;
  review_note: string | null;
  awarded_points: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export type Badge = {
  id: string;
  name: string;
  beschreibung: string;
  icon: string;
};

export type UserBadge = {
  user_id: string;
  badge_id: string;
  erreicht_am: string;
};

export type LeaderboardEntry = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  xp: number;
};

export type MonthlyRecap = {
  id: string;
  user_id: string;
  monat: string;
  pdf_url: string | null;
  created_at: string;
};

export type AppIdea = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  status: 'offen' | 'abgeschlossen';
  admin_response: string | null;
  created_at: string;
  reviewed_at: string | null;
};
