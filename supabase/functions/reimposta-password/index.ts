// =====================================================================
//  Edge Function: reimposta-password
//  L'Amministratore assegna una nuova password temporanea a un utente
//  (Cliente od Operatore) che l'ha dimenticata. Al primo accesso il
//  portale obbliga l'utente a sceglierne una personale (script 15).
//  Sicurezza:
//   - il chiamante deve essere un amministratore con verifica a due
//     fattori (funzione sono_admin)
//   - non si reimpostano le password degli amministratori né la propria
//   - usa la service role key (lato server, mai esposta al browser)
//   - l'operazione è registrata nell'audit (senza la password)
//  Pubblicazione: dashboard Supabase → Edge Functions; Verify JWT attivo.
//
//  Usato da: src/lib/dati.js → reimpostaPassword(), dalla pagina
//  src/pages/GestioneUtenti.jsx (password generata da
//  generaPasswordTemporanea in src/lib/password.js).
//
//  Dati/servizi coinvolti: Supabase Auth (auth.admin.updateUserById),
//  tabella profilo (colonna password_temporanea, 15_password.sql),
//  tabella audit_event (01_schema.sql: qui si scrive con la service role
//  perché l'audit non è scrivibile dal portale), RPC sono_admin
//  (10_mfa_profilo.sql); segreti automatici SUPABASE_URL,
//  SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
//  Registro sviluppo e deploy: capitolo 5 «Edge Functions»; capitolo 4
//  «Database» (15_password.sql); capitolo 8 «Procedure di rilascio».
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// Intestazioni CORS per le chiamate dal browser (portale su Vercel).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Punto di ingresso. Corpo atteso: { utente_id, password }.
// Restituisce { ok: true } oppure { error } con stato 400/401/403/404/500
// (dati.js legge il motivo dal corpo della risposta).
Deno.serve(async (req) => {
  // Richiesta preliminare CORS del browser.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client con il token del chiamante: per sapere CHI chiama e verificarne
    // il ruolo con le regole del database (non si usa la service role qui).
    const clientChiamante = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: userData } = await clientChiamante.auth.getUser();
    const chiamante = userData?.user;
    if (!chiamante) return json({ error: "Non autenticato" }, 401);

    const { data: adminOk } = await clientChiamante.rpc("sono_admin");
    if (adminOk !== true) {
      return json({ error: "Solo un amministratore (con verifica a due fattori) può reimpostare le password" }, 403);
    }

    const body = await req.json();
    const utenteId = body.utente_id || "";
    const password = body.password || "";
    if (!utenteId || password.length < 10) {
      return json({ error: "Dati non validi (utente, password temporanea di almeno 10 caratteri)" }, 400);
    }
    if (utenteId === chiamante.id) {
      return json({ error: "Per la tua password usa «Cambia password»" }, 400);
    }

    // Da qui in poi client con service role (scavalca RLS): i controlli sopra
    // devono restare prima di questa riga.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profilo } = await admin.from("profilo").select("ruolo, attivo").eq("id", utenteId).single();
    if (!profilo) return json({ error: "Utente non trovato" }, 404);
    if (profilo.ruolo === "admin") {
      return json({ error: "La password di un amministratore non si reimposta da qui" }, 403);
    }

    const { error: errPwd } = await admin.auth.admin.updateUserById(utenteId, { password });
    if (errPwd) return json({ error: "Reimpostazione non riuscita: " + errPwd.message }, 400);

    // Obbligo di cambio al prossimo accesso (App.jsx → CambiaPassword "obbligatorio")
    // e voce di audit scritta a mano: la password non compare mai.
    await admin.from("profilo").update({ password_temporanea: true }).eq("id", utenteId);
    await admin.from("audit_event").insert({
      utente_id: chiamante.id,
      ruolo: "admin",
      operazione: "reimpostazione password",
      oggetto_tipo: "profilo",
      oggetto_id: utenteId,
      stato_successivo: "password temporanea",
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// Risposta JSON con le intestazioni CORS.
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
