ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS sales_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_total numeric NOT NULL DEFAULT 0;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS line_notify_token text;