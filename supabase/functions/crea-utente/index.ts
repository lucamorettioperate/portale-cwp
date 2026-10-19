// =====================================================================
//  Edge Function: crea-utente
//  Scopo: crea un nuovo utente con password temporanea e imposta ruolo +
//  organizzazione. All'utente parte un'email con indirizzo del portale,
//  email di accesso e password temporanea (Resend, funzione
//  inviaEmailAccesso in fondo al file); se l'email non parte la creazione
//  resta valida e il portale avvisa l'Admin di comunicare la password a
//  mano. Al primo accesso l'utente deve scegliere una password personale.
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
//     SUPABASE_SERVICE_ROLE_KEY; per l'email RESEND_API_KEY (già
//     impostato) e, facoltativi, EMAIL_MITTENTE e PORTALE_URL.
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
// Restituisce { ok: true, email, id, email_inviata, motivo_email } oppure
// { error } con stato 400/401/403/500.
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

    // Email con le credenziali: l'esito si restituisce al portale.
    const esito = await inviaEmailAccesso(email, nomeCompleto, password, "creazione");
    return json({ ok: true, email, id: nuovoId, email_inviata: esito.inviata, motivo_email: esito.motivo || null });
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

// ---------------------------------------------------------------------
// Email con le credenziali di accesso (aggiunta il 19/10/2026).
// Spedisce con Resend all'utente l'indirizzo del portale, la sua email e
// la password temporanea, ricordando che al primo accesso dovrà sceglierne
// una personale. Parametri: email e nome del destinatario, password
// temporanea, tipo «creazione» (nuovo account) o «reimpostazione».
// Restituisce { inviata: true } oppure { inviata: false, motivo } con il
// motivo da mostrare all'Amministratore (in quel caso la password va
// comunicata a mano). L'errore di invio non annulla l'operazione.
// Segreti: RESEND_API_KEY; facoltativi EMAIL_MITTENTE e PORTALE_URL.
// Finché il dominio non è verificato su Resend il mittente è
// onboarding@resend.dev e Resend consegna solo al titolare dell'account.
// ---------------------------------------------------------------------
async function inviaEmailAccesso(
  email: string,
  nome: string | null,
  password: string,
  tipo: "creazione" | "reimpostazione",
): Promise<{ inviata: boolean; motivo?: string }> {
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY) return { inviata: false, motivo: "servizio email non configurato (manca RESEND_API_KEY)" };
  const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Portale CWP <onboarding@resend.dev>";
  const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");
  const accesso = `${PORTALE}/login`;
  // Saluto generico se il nome manca o è in realtà un'email.
  const saluto = nome && !nome.includes("@") ? `Gentile ${nome},` : "Buongiorno,";
  const titolo = tipo === "creazione" ? "Il tuo accesso al Portale CWP" : "Nuova password temporanea per il Portale CWP";
  const apertura = tipo === "creazione"
    ? "Fondazione Operate ha creato il tuo account sul Portale Carbon WastePrint (CWP)."
    : "Fondazione Operate ha assegnato una nuova password temporanea al tuo account sul Portale Carbon WastePrint (CWP). La password precedente non è più valida.";

  // Versione in testo semplice.
  const testo = [
    saluto,
    "",
    apertura,
    "",
    `Indirizzo del portale: ${accesso}`,
    `Email di accesso: ${email}`,
    `Password temporanea: ${password}`,
    "",
    "Al primo accesso il portale ti chiederà di scegliere una password personale (almeno 10 caratteri, con lettere e numeri). Fino ad allora non potrai vedere né modificare i dati.",
    "",
    "Per sicurezza non inoltrare questa email e cancellala dopo aver scelto la nuova password. Se non ti aspettavi questo messaggio, scrivi a Fondazione Operate.",
    "",
    "— Portale Carbon WastePrint · Fondazione Operate",
    "Messaggio automatico: non rispondere a questa email.",
  ].join("\n");

  // Versione HTML (stesso stile dell'email di recupero password).
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9d4c5;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 24px 6px;font-size:13px;color:#5a5e54">Programma Carbon WastePrint&reg; &middot; Fondazione Operate</td></tr>
<tr><td style="padding:6px 24px 0;font-size:14px">${escEmail(saluto)}</td></tr>
<tr><td style="padding:12px 24px 0;font-size:18px;font-weight:bold">${escEmail(titolo)}</td></tr>
<tr><td style="padding:8px 24px 0;font-size:14px;line-height:1.5;color:#3a4036">${escEmail(apertura)}</td></tr>
<tr><td style="padding:16px 24px 0">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f4ee;border-radius:8px;font-size:14px">
<tr><td style="padding:10px 14px 4px;color:#5a5e54;width:160px">Email di accesso</td><td style="padding:10px 14px 4px;font-weight:bold">${escEmail(email)}</td></tr>
<tr><td style="padding:4px 14px 10px;color:#5a5e54">Password temporanea</td><td style="padding:4px 14px 10px;font-weight:bold;font-family:Consolas,Menlo,monospace;font-size:16px;letter-spacing:1px">${escEmail(password)}</td></tr>
</table></td></tr>
<tr><td style="padding:20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border:2px solid #2f5d3a;border-radius:8px">
<a href="${accesso}" style="display:inline-block;background-color:#2f5d3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;line-height:18px;padding:11px 18px;border-radius:8px"><span style="color:#ffffff">Accedi al portale &rarr;</span></a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 24px 8px;font-size:13px;line-height:1.5;color:#3a4036">Al primo accesso il portale ti chiederà di scegliere una <b>password personale</b> (almeno 10 caratteri, con lettere e numeri). Fino ad allora non potrai vedere né modificare i dati.</td></tr>
<tr><td style="padding:0 24px 8px;font-size:12.5px;line-height:1.5;color:#5a5e54">Per sicurezza non inoltrare questa email e cancellala dopo aver scelto la nuova password. Se non ti aspettavi questo messaggio, scrivi a Fondazione Operate.</td></tr>
<tr><td style="padding:0 24px 20px;font-size:12px;color:#8a8d82">Portale CWP &middot; ${escEmail(PORTALE.replace(/^https?:\/\//, ""))} &middot; Messaggio automatico: non rispondere a questa email.</td></tr>
</table></td></tr></table></body></html>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MITTENTE,
        to: [email],
        subject: `Portale Carbon WastePrint (CWP) — ${titolo}`,
        text: testo,
        html,
      }),
    });
    if (r.ok) return { inviata: true };
    // Motivo restituito da Resend (es. dominio non verificato).
    const corpo = await r.json().catch(() => ({}));
    console.error("Resend", r.status, JSON.stringify(corpo));
    return { inviata: false, motivo: `Resend ${r.status}: ${corpo?.message || "invio rifiutato"}` };
  } catch (e) {
    return { inviata: false, motivo: "invio non riuscito: " + String(e) };
  }
}

// Sostituisce i caratteri speciali HTML (& < > " ') con le entità.
function escEmail(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
