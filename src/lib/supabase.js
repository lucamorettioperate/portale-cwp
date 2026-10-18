/* =========================================================================
   supabase.js — client Supabase, punto unico di collegamento al backend.

   Scopo: crea l'unico client @supabase/supabase-js usato dal portale
   (database, Auth, Storage, Edge Functions). Legge URL e chiave dalle
   variabili d'ambiente (file .env in locale, mai pubblicato; in produzione
   le variabili del progetto Vercel). Finché Supabase non è configurato,
   `supabase` resta null e il portale funziona con i dati di esempio.

   Usato da: src/lib/AuthContext.jsx, src/lib/dati.js, src/lib/fascicolo.js,
   src/lib/crediti/archivio.js, src/pages/VerificaMfa.jsx,
   src/components/crediti/RegistroCrediti.jsx.

   Dati/servizi coinvolti: progetto Supabase "portale-cwp".
   Variabili richieste: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.

   Sicurezza: la chiave "anon" è pubblica per natura (finisce nel codice
   del browser). Non inserire MAI qui la chiave service_role: quella vive
   solo nei Secrets delle Edge Functions.

   Registro sviluppo e deploy: capitolo 3 «Servizi e configurazione» e
   capitolo 2 «Architettura».
   ========================================================================= */
import { createClient } from "@supabase/supabase-js";

// Vite sostituisce import.meta.env.* al momento della build: dopo aver
// cambiato le variabili su Vercel serve un nuovo deploy.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// true se entrambe le variabili sono presenti.
export const supabaseConfigurato = Boolean(url && anonKey);

// Client condiviso, oppure null se il backend non è configurato.
export const supabase = supabaseConfigurato
  ? createClient(url, anonKey)
  : null;
