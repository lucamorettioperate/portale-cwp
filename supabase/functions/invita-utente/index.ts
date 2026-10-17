// =====================================================================
//  Edge Function: invita-utente
//  Invita un nuovo utente via email e imposta ruolo + organizzazione.
//  Sicurezza:
//   - verifica che il chiamante sia autenticato e con ruolo 'admin'
//   - usa la service role key (lato server, mai esposta al browser)
//   - non consente di creare altri admin
//  L'utente riceve un'email e imposta da sé la password.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client con il token del chiamante: serve per sapere CHI sta chiamando.
    const authHeader = req.headers.get("Authorization") || "";
    const clientChiamante = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await clientChiamante.auth.getUser();
    const chiamante = userData?.user;
    if (!chiamante) {
      return json({ error: "Non autenticato" }, 401);
    }

    // Verifica ruolo admin del chiamante.
    const { data: profilo } = await clientChiamante
      .from("profilo")
      .select("ruolo")
      .eq("id", chiamante.id)
      .single();
    if (profilo?.ruolo !== "admin") {
      return json({ error: "Solo un amministratore può invitare utenti" }, 403);
    }

    // Dati dell'invito.
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const ruolo = body.ruolo; // 'cliente' | 'operatore'
    const organizzazioneId = body.organizzazione_id || null;
    const nomeCompleto = body.nome_completo || null;

    if (!email || !["cliente", "operatore"].includes(ruolo)) {
      return json({ error: "Dati non validi (email o ruolo)" }, 400);
    }
    if (ruolo === "cliente" && !organizzazioneId) {
      return json({ error: "Per un utente cliente serve l'organizzazione" }, 400);
    }

    // Client amministrativo (service role) per creare l'invito.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Invia l'invito via email: l'utente imposterà la password.
    const { data: invito, error: errInvito } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome_completo: nomeCompleto },
    });
    if (errInvito) {
      return json({ error: "Invito non riuscito: " + errInvito.message }, 400);
    }

    const nuovoId = invito.user?.id;
    if (nuovoId) {
      // Imposta ruolo e organizzazione sul profilo (creato dal trigger).
      await admin
        .from("profilo")
        .update({
          ruolo,
          nome_completo: nomeCompleto,
          organizzazione_id: ruolo === "cliente" ? organizzazioneId : null,
        })
        .eq("id", nuovoId);
    }

    return json({ ok: true, email });
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
