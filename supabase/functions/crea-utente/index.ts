// =====================================================================
//  Edge Function: crea-utente
//  Scopo: crea un nuovo utente con password temporanea e imposta ruolo +
//  organizzazione. L'Admin comunica la password all'utente, che potrà
//  cambiarla al primo accesso.
//  Sicurezza:
//   - verifica che il chiamante sia autenticato e con ruolo 'admin'
//     (RPC sono_admin, 10_mfa_profilo.sql: con MFA se mfa_obbligatoria è accesa)
//   - usa la service role key (lato server, mai esposta al browser)
//   - non consente di creare altri admin
//
//  Usato da: src/lib/dati.js → creaUtente(), dalla pagina
//  src/pages/GestioneUtenti.jsx (pulsante di creazione utente).
//
//  Dati/servizi coinvolti:
//   - Supabase Auth (auth.admin.createUser);
//   - tabella profilo (01_schema.sql): la riga nasce dal trigger
//     trg_auth_user_created (02_sicurezza.sql) e qui si completa con ruolo,
//     nome e organizzazione; password_temporanea vale true per
//     impostazione predefinita (15_password.sql), quindi l'utente dovrà
//     cambiarla al primo accesso;
//   - RPC sono_admin (10_mfa_profilo.sql);
//   - segreti automatici SUPABASE_URL, SUPABASE_ANON_KEY,
//     SUPABASE_SERVICE_ROLE_KEY (nessun segreto da impostare a mano).
//   - RPC admin_imposta_organizzazioni (10_mfa_profilo.sql), chiamata con
//     il token dell'Admin, per tutte le organizzazioni del cliente.
//  O tutto o niente: se il profilo o le organizzazioni non si salvano,
//  l'account appena creato viene eliminato e si restituisce l'errore
//  (backlog 33, 18/10/2026).
//
//  Pubblicazione: dashboard Supabase → Edge Functions; Verify JWT attivo.
//
//  Registro sviluppo e deploy: capitolo 5 «Edge Functions»; capitolo 8
//  «Procedure di rilascio».
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// Intestazioni CORS per le chiamate dal browser (portale su Vercel).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Punto di ingresso. Corpo atteso:
// { email, password, ruolo: "cliente"|"operatore", organizzazione_id,
//   organizzazioni (facoltativo: elenco completo, la prima è la principale),
//   nome_completo }.
// Restituisce { ok: true, email, id } oppure { error } con stato 400/401/403/500.
Deno.serve(async (req) => {
  // Richiesta preliminare CORS del browser.
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

    // Verifica: amministratore attivo con verifica a due fattori (script 10).
    const { data: admin_ok } = await clientChiamante.rpc("sono_admin");
    if (admin_ok !== true) {
      return json({ error: "Solo un amministratore (con verifica a due fattori) può creare utenti" }, 403);
    }

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const ruolo = body.ruolo; // 'cliente' | 'operatore'
    const nomeCompleto = body.nome_completo || null;
    // Elenco completo delle organizzazioni (senza doppioni); se manca si usa
    // la sola organizzazione_id (compatibilità con le versioni precedenti
    // del portale). La prima è l'organizzazione principale del profilo.
    const organizzazioni: string[] = [...new Set(
      (Array.isArray(body.organizzazioni) && body.organizzazioni.length
        ? body.organizzazioni
        : [body.organizzazione_id]).filter(Boolean),
    )];
    const organizzazioneId = organizzazioni[0] || null;

    // Il ruolo "admin" non è nell'elenco: da qui non si creano amministratori.
    // Password: stessa regola delle password personali (almeno 10
    // caratteri con lettere e numeri, src/lib/password.js); il portale ne
    // genera di 12.
    const passwordValida = password.length >= 10 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
    if (!email || !passwordValida || !["cliente", "operatore"].includes(ruolo)) {
      return json({ error: "Dati non validi (email, password di almeno 10 caratteri con lettere e numeri, ruolo)" }, 400);
    }
    if (ruolo === "cliente" && !organizzazioneId) {
      return json({ error: "Per un utente cliente serve l'organizzazione" }, 400);
    }

    // Client amministrativo (service role).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Crea l'utente già confermato (nessuna email di conferma da Supabase).
    const { data: creato, error: errCrea } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_completo: nomeCompleto },
    });
    if (errCrea) {
      return json({ error: "Creazione non riuscita: " + errCrea.message }, 400);
    }

    // Completa il profilo creato dal trigger e, per i clienti, registra tutte
    // le organizzazioni. Se uno dei due passi fallisce si elimina l'account
    // appena creato (il profilo si cancella a cascata): niente utenti a metà.
    const nuovoId = creato.user?.id;
    if (!nuovoId) return json({ error: "Creazione non riuscita: identificativo mancante" }, 500);
    const annulla = async (motivo: string) => {
      await admin.auth.admin.deleteUser(nuovoId);
      return json({ error: "Creazione annullata: " + motivo }, 400);
    };
    const { error: errProfilo } = await admin
      .from("profilo")
      .update({
        ruolo,
        nome_completo: nomeCompleto,
        organizzazione_id: ruolo === "cliente" ? organizzazioneId : null,
      })
      .eq("id", nuovoId);
    if (errProfilo) return await annulla(errProfilo.message);
    if (ruolo === "cliente") {
      // Con il token dell'Admin: valgono i controlli della funzione del database.
      const { error: errOrg } = await clientChiamante.rpc("admin_imposta_organizzazioni", {
        p_utente: nuovoId,
        p_organizzazioni: organizzazioni,
      });
      if (errOrg) return await annulla(errOrg.message);
    }

    return json({ ok: true, email, id: nuovoId });
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
