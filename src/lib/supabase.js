/* =========================================================================
   Client Supabase — punto unico di collegamento al backend.
   Legge URL e chiave dalle variabili d'ambiente (file .env, mai pubblicato).
   Finché Supabase non è configurato, `supabase` resta null e il portale
   funziona con i dati di esempio.
   ========================================================================= */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurato = Boolean(url && anonKey);

export const supabase = supabaseConfigurato
  ? createClient(url, anonKey)
  : null;
