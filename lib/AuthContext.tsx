import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile } from './types';
import { enableGuestMode, disableGuestMode, getGuestState, GUEST_ID, migrateGuestDataToAccount } from './guest';
import { ensureNotificationPermissionOnFirstOpen, getNotificationSettings, showFriendRequestNotification, showOwnWordUpvoteNotification, syncDailyWordNotification } from './notifications';

const guestProfile: Profile = {
  id: GUEST_ID,
  email: 'Gastzugang',
  name: 'Gast',
  avatar_url: '👤',
  is_admin: false,
  xp: 0,
  level_key: 'wortneuling',
  streak_count: 0,
  best_streak: 0,
  last_opened_date: null,
  notification_time: '07:00',
  notifications_enabled: true,
  friend_code: '',
  created_at: new Date(0).toISOString(),
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isGuest: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  leaveGuestMode: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  isGuest: false,
  refreshProfile: async () => {},
  signOut: async () => {},
  continueAsGuest: async () => {},
  leaveGuestMode: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
      setIsGuest(false);

      try { await supabase.rpc('ensure_initial_badge'); } catch {}
      try { await migrateGuestDataToAccount(userId); } catch {}
    }
  }

  async function refreshProfile() {
    if (isGuest) {
      setProfile(guestProfile);
      return;
    }
    if (session?.user?.id) await loadProfile(session.user.id);
  }

  async function continueAsGuest() {
    await enableGuestMode();
    setSession(null);
    setIsGuest(true);
    setProfile(guestProfile);
  }

  async function leaveGuestMode() {
    // Nur die Gast-Ansicht verlassen, damit Anmeldung/Registrierung möglich ist.
    // Die lokalen Gastdaten bleiben markiert und werden nach Login/Registrierung übernommen.
    setIsGuest(false);
    setProfile(null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id);
        setLoading(false);
      } else {
        const guest = await getGuestState();
        if (guest.enabled) {
          setIsGuest(true);
          setProfile(guestProfile);
        }
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        setIsGuest(false);
        await loadProfile(newSession.user.id);
      } else {
        const guest = await getGuestState();
        if (guest.enabled) {
          setIsGuest(true);
          setProfile(guestProfile);
        } else {
          setIsGuest(false);
          setProfile(null);
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (!profile) return;

    ensureNotificationPermissionOnFirstOpen()
      .then(async () => {
        const localSettings = await getNotificationSettings();
        const dailyEnabled = localSettings.dailyWordEnabled;
        const time = isGuest ? localSettings.time : (profile.notification_time || localSettings.time || '07:00');
        await syncDailyWordNotification(dailyEnabled, time);
      })
      .catch(() => {});
  }, [profile?.id, profile?.notifications_enabled, profile?.notification_time, isGuest]);

  useEffect(() => {
    if (!profile || isGuest) return;

    const channel = supabase
      .channel(`user-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_user_id=eq.${profile.id}` },
        async (payload) => {
          const fromUserId = (payload.new as any)?.from_user_id;
          let fromName: string | null = null;
          if (fromUserId) {
            const { data } = await supabase.from('profiles').select('name').eq('id', fromUserId).maybeSingle();
            fromName = data?.name ?? null;
          }
          await showFriendRequestNotification(fromName);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daily_word_votes', filter: `entry_user_id=eq.${profile.id}` },
        async (payload) => {
          const vote = (payload.new as any)?.vote;
          const voterId = (payload.new as any)?.voter_id;
          if (vote !== 1 || voterId === profile.id) return;
          const datum = (payload.new as any)?.entry_datum;
          let word: string | null = null;
          if (datum) {
            const { data } = await supabase.from('daily_words_personal').select('wort').eq('user_id', profile.id).eq('datum', datum).maybeSingle();
            word = data?.wort ?? null;
          }
          await showOwnWordUpvoteNotification(word);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, isGuest]);


  async function signOut() {
    if (isGuest) {
      await disableGuestMode({ clearData: false });
      setIsGuest(false);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, isGuest, refreshProfile, signOut, continueAsGuest, leaveGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
