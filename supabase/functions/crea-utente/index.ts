// =====================================================================
//  Edge Function: crea-utente
//  Crea un nuovo utente con password temporanea e imposta ruolo +
//  organizzazione. L'Admin comunica la password all'utente, che potrà
//  cambiarla al primo accesso.
//  Sicurezza:
//   - verifica che il chiamante sia autenticato e con ruolo 'admin'
//   - usa la service role key (lato server, mai esposta al browser)
//   - non consente di creare altri admin
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

    // Client con il token del chiamante: per sapere CHI chiama.
    const authHeader = req.headers.get("Authorization") || "";
    const clientChiamante = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await clientChiamante.auth.getUser();
    const chiamante = userData?.user;
    if (!chiamante) return json({ error: "Non autenticato" }, 401);

    // Verifica ruolo admin.
    const { data: profilo } = await clientChiamante
      .from("profilo")
      .select("ruolo")
      .eq("id", chiamante.id)
      .single();
    if (profilo?.ruolo !== "admin") {
      return json({ error: "Solo un amministratore può creare utenti" }, 403);
    }

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const ruolo = body.ruolo; // 'cliente' | 'operatore'
    const organizzazioneId = body.organizzazione_id || null;
    const nomeCompleto = body.nome_completo || null;

    if (!email || password.length < 8 || !["cliente", "operatore"].includes(ruolo)) {
      return json({ error: "Dati non validi (email, password min 8 caratteri, ruolo)" }, 400);
    }
    if (ruolo === "cliente" && !organizzazioneId) {
      return json({ error: "Per un utente cliente serve l'organizzazione" }, 400);
    }

    // Client amministrativo (service role).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Crea l'utente già confermato.
    const { data: creato, error: errCrea } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_completo: nomeCompleto },
    });
    if (errCrea) {
      return json({ error: "Creazione non riuscita: " + errCrea.message }, 400);
    }

    const nuovoId = creato.user?.id;
    if (nuovoId) {
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
