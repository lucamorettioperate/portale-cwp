// =====================================================================
//  Edge Function: reimposta-password
//  Scopo: l'Amministratore assegna una nuova password temporanea a un utente
//  (Cliente od Operatore) che l'ha dimenticata. Al primo accesso il
//  portale obbliga l'utente a sceglierne una personale (script 15).
//  Sicurezza:
//   - il chiamante deve essere un amministratore con verifica a due
//     fattori (funzione sono_admin)
//   - non si reimpostano le password degli amministratori né la propria
//   - usa la service role key (lato server, mai esposta al browser)
//   - l'operazione è registrata nell'audit (senza la password)
//   - all'utente parte un'email con la nuova password temporanea
//     (inviaEmailAccesso in fondo al file, Resend); l'esito torna al
//     portale, che in caso di errore chiede di comunicarla a mano
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
// Restituisce { ok: true, email_inviata, motivo_email } oppure { error } con stato 400/401/403/404/500
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
    const { data: profilo } = await admin.from("profilo").select("ruolo, attivo, nome_completo").eq("id", utenteId).single();
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

    // Email con la nuova password temporanea all'indirizzo dell'account.
    const { data: account } = await admin.auth.admin.getUserById(utenteId);
    const destinatario = account?.user?.email;
    const esito = destinatario
      ? await inviaEmailAccesso(destinatario, profilo.nome_completo, password, "reimpostazione")
      : { inviata: false, motivo: "email dell'account non trovata" };
    return json({ ok: true, email_inviata: esito.inviata, motivo_email: esito.motivo || null });
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
