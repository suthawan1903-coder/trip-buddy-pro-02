ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS line_group_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS line_user_id text NOT NULL DEFAULT '';