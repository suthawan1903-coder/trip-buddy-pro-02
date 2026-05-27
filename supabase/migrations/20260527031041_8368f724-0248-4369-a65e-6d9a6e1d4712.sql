CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_name TEXT NOT NULL,
  place TEXT NOT NULL,
  province TEXT,
  district TEXT,
  time_in TEXT,
  time_out TEXT,
  distance NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  vehicle TEXT NOT NULL DEFAULT 'car',
  mode TEXT NOT NULL DEFAULT 'gps',
  job TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'รออนุมัติ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view trips" ON public.trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert trips" ON public.trips FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update trips" ON public.trips FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete trips" ON public.trips FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX trips_trip_date_idx ON public.trips(trip_date DESC);
CREATE INDEX trips_employee_idx ON public.trips(employee_name);