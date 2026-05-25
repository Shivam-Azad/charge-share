-- Phase 5: push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Phase 6: trust, verification, and moderation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vehicle_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vehicle_reg_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;

ALTER TABLE chargers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE session_requests ADD COLUMN IF NOT EXISTS dispute_notes TEXT;

CREATE OR REPLACE FUNCTION public.apply_rating_trust_flags()
RETURNS TRIGGER AS $$
DECLARE
  low_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO low_count
  FROM ratings
  WHERE to_user = NEW.to_user
    AND score <= 2;

  IF low_count >= 5 THEN
    UPDATE profiles
    SET flagged = TRUE,
        flag_reason = 'Multiple low ratings',
        updated_at = NOW()
    WHERE id = NEW.to_user;
  ELSIF low_count >= 3 THEN
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.to_user,
      'trust_warning',
      'Trust Score Warning',
      'You have received multiple low ratings. Improve session quality to avoid restrictions.',
      jsonb_build_object('low_rating_count', low_count),
      FALSE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ratings_apply_trust_flags ON ratings;
CREATE TRIGGER ratings_apply_trust_flags
AFTER INSERT ON ratings
FOR EACH ROW
EXECUTE FUNCTION public.apply_rating_trust_flags();

CREATE OR REPLACE FUNCTION public.create_session_ending_soon_notifications()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH due_sessions AS (
    SELECT sr.id, sr.driver_id
    FROM session_requests sr
    WHERE sr.status = 'active'
      AND sr.started_at IS NOT NULL
      AND sr.started_at + (sr.time_limit_mins || ' minutes')::interval <= NOW() + interval '5 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.type = 'session_ending_soon'
          AND n.data->>'session_id' = sr.id::text
      )
  ),
  inserted AS (
    INSERT INTO notifications (user_id, type, title, body, data, read)
    SELECT
      driver_id,
      'session_ending_soon',
      'Session ending in 5 min',
      'Your charging session is close to its time limit.',
      jsonb_build_object('session_id', id),
      FALSE
    FROM due_sessions
    RETURNING id
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional pg_cron setup, if enabled in your Supabase project:
-- SELECT cron.schedule('session-ending-soon', '* * * * *', 'SELECT public.create_session_ending_soon_notifications();');

-- RLS helpers for admin pages. Replace these IDs in production or keep ADMIN_USER_IDS in app middleware too.
-- Policies should be added according to your existing RLS setup.
