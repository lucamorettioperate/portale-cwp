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
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profilo } = await admin.from("profilo").select("ruolo, attivo").eq("id", utenteId).single();
    if (!profilo) return json({ error: "Utente non trovato" }, 404);
    if (profilo.ruolo === "admin") {
      return json({ error: "La password di un amministratore non si reimposta da qui" }, 403);
    }

    const { error: errPwd } = await admin.auth.admin.updateUserById(utenteId, { password });
    if (errPwd) return json({ error: "Reimpostazione non riuscita: " + errPwd.message }, 400);

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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
