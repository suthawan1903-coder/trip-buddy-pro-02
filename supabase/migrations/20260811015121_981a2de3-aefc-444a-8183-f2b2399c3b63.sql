ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS employee_position text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS duration_min numeric,
  ADD COLUMN IF NOT EXISTS route_min numeric,
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS fuel_efficiency numeric,
  ADD COLUMN IF NOT EXISTS fuel_price numeric,
  ADD COLUMN IF NOT EXISTS rate_per_km numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  fuel_price numeric NOT NULL DEFAULT 38,
  fuel_efficiency numeric NOT NULL DEFAULT 12,
  rate_per_km numeric NOT NULL DEFAULT 0,
  checkin_radius_km numeric NOT NULL DEFAULT 5,
  line_token text,
  line_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id)
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;