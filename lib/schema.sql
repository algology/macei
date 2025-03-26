-- Create a notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  idea_id BIGINT REFERENCES ideas(id) ON DELETE CASCADE,
  briefing_id BIGINT REFERENCES briefings(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  notification_type TEXT NOT NULL DEFAULT 'briefing', -- 'briefing', 'signal', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

-- Create index on is_read for filtering unread notifications
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read); 