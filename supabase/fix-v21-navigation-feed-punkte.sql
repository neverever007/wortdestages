-- ============================================================
-- FIX V21: Punkte für eigene Wörter + Upvote-Punkte
-- Bitte nach den bisherigen Fix-Skripten im Supabase SQL Editor ausführen.
-- ============================================================

-- Ein persönliches Wort des Tages gibt genau beim ersten Eintrag des Tages +1 Punkt.
-- Zusätzlich wird der eigene Standard-Upvote gesetzt, ohne dafür einen zweiten Punkt zu vergeben.
create or replace function register_personal_word(p_wort text, p_datum date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into daily_words_personal (user_id, datum, wort)
  values (auth.uid(), p_datum, trim(p_wort))
  on conflict (user_id, datum) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    raise exception 'Du hast heute bereits dein Wort eingereicht.';
  end if;

  update profiles
  set xp = xp + 1
  where id = auth.uid();

  insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
  values (auth.uid(), auth.uid(), p_datum, 1)
  on conflict (voter_id, entry_user_id, entry_datum) do nothing;

  select count(*) into v_count from daily_words_personal where user_id = auth.uid();
  if v_count >= 1 then
    insert into user_badges (user_id, badge_id) values (auth.uid(), 'mein_wort') on conflict do nothing;
  end if;
end;
$$;
grant execute on function register_personal_word(text, date) to authenticated;

-- Jeder Upvote von anderen Nutzern gibt dem Besitzer des Wortes +1 Punkt.
-- Wird der Upvote zurückgenommen oder in Downvote geändert, wird der Punkt wieder entfernt.
create or replace function cast_vote(
  p_entry_user_id uuid,
  p_entry_datum date,
  p_vote smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing smallint;
  v_is_owner boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_vote not in (1, -1) then
    raise exception 'Invalid vote';
  end if;

  v_is_owner := p_entry_user_id = auth.uid();

  select vote into v_existing
  from daily_word_votes
  where voter_id = auth.uid()
    and entry_user_id = p_entry_user_id
    and entry_datum = p_entry_datum;

  if found then
    if v_existing = p_vote then
      delete from daily_word_votes
      where voter_id = auth.uid()
        and entry_user_id = p_entry_user_id
        and entry_datum = p_entry_datum;

      if p_vote = 1 and not v_is_owner then
        update profiles set xp = greatest(0, xp - 1) where id = p_entry_user_id;
      end if;
    else
      update daily_word_votes
      set vote = p_vote
      where voter_id = auth.uid()
        and entry_user_id = p_entry_user_id
        and entry_datum = p_entry_datum;

      if not v_is_owner then
        if v_existing = -1 and p_vote = 1 then
          update profiles set xp = xp + 1 where id = p_entry_user_id;
        elsif v_existing = 1 and p_vote = -1 then
          update profiles set xp = greatest(0, xp - 1) where id = p_entry_user_id;
        end if;
      end if;
    end if;
  else
    insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
    values (auth.uid(), p_entry_user_id, p_entry_datum, p_vote);

    if p_vote = 1 and not v_is_owner then
      update profiles set xp = xp + 1 where id = p_entry_user_id;
    end if;
  end if;
end;
$$;
grant execute on function cast_vote(uuid, date, smallint) to authenticated;

-- Bestehende persönliche Wörter bekommen den Standard-Upvote nachträglich.
insert into daily_word_votes (voter_id, entry_user_id, entry_datum, vote)
select d.user_id, d.user_id, d.datum, 1
from daily_words_personal d
on conflict (voter_id, entry_user_id, entry_datum) do nothing;
