-- V27: Account-Löschung + Release-Vorbereitung
-- Im Supabase SQL Editor ausführen.

create or replace function delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if to_regclass('public.daily_word_votes') is not null then
    delete from daily_word_votes where voter_id = v_uid or entry_user_id = v_uid;
  end if;
  if to_regclass('public.daily_words_personal') is not null then
    delete from daily_words_personal where user_id = v_uid;
  end if;
  if to_regclass('public.friend_requests') is not null then
    delete from friend_requests where from_user_id = v_uid or to_user_id = v_uid;
  end if;
  if to_regclass('public.friendships') is not null then
    delete from friendships where user_id = v_uid or friend_id = v_uid;
  end if;
  if to_regclass('public.app_ideas') is not null then
    delete from app_ideas where user_id = v_uid;
  end if;
  if to_regclass('public.word_suggestions') is not null then
    delete from word_suggestions where user_id = v_uid;
  end if;
  if to_regclass('public.user_badges') is not null then
    delete from user_badges where user_id = v_uid;
  end if;
  if to_regclass('public.notification_clicks') is not null then
    delete from notification_clicks where user_id = v_uid;
  end if;
  if to_regclass('public.word_usage') is not null then
    delete from word_usage where user_id = v_uid;
  end if;
  if to_regclass('public.favorites') is not null then
    delete from favorites where user_id = v_uid;
  end if;
  if to_regclass('public.monthly_recaps') is not null then
    delete from monthly_recaps where user_id = v_uid;
  end if;
  if to_regclass('public.profiles') is not null then
    delete from profiles where id = v_uid;
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function delete_current_user() to authenticated;
