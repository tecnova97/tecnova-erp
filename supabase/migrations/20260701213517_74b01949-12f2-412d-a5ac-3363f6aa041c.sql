ALTER TABLE public.status_definitionen
  ADD COLUMN IF NOT EXISTS ausschluss_kontakte_ohne_termin boolean NOT NULL DEFAULT false;

ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS kunde_festnetz text;