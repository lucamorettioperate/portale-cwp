// =====================================================================
//  Edge Function: recupera-password
//  «Password dimenticata?»: genera il collegamento di recupero di Supabase
//  Auth e spedisce l'email in italiano con Resend (stessa grafica delle
//  notifiche), invece del modello email di Supabase.
//  Sicurezza:
//   - risponde sempre { ok: true }, che l'indirizzo esista o no (non si
//     rivela chi è registrato);
//   - utenti disattivati: nessuna email;
//   - massimo una richiesta ogni 2 minuti per indirizzo (tabella
//     recupero_password_richiesta, script 16);
//   - il collegamento porta solo all'indirizzo del portale.
//  Secrets: RESEND_API_KEY, EMAIL_MITTENTE (facoltativo), PORTALE_URL (facoltativo).
//  Pubblicazione: dashboard Supabase → Edge Functions; Verify JWT DISATTIVATO
//  (la chiama chi non ha ancora effettuato l'accesso).
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ok = () => json({ ok: true });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Portale CWP <onboarding@resend.dev>";
    const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");
    if (!RESEND_API_KEY) return json({ ok: false, error: "Servizio email non configurato" }, 503);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok();

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Limite: una richiesta ogni 2 minuti per indirizzo.
    const { data: ultima } = await admin
      .from("recupero_password_richiesta")
      .select("richiesta_il")
      .eq("email", email)
      .maybeSingle();
    if (ultima && Date.now() - Date.parse(ultima.richiesta_il) < 120_000) return ok();
    await admin.from("recupero_password_richiesta").upsert({ email, richiesta_il: new Date().toISOString() });

    // Collegamento di recupero (fallisce in silenzio se l'utente non esiste).
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${PORTALE}/reimposta-password` },
    });
    if (error || !link?.properties?.action_link || !link.user) return ok();

    // Nessuna email agli utenti disattivati.
    const { data: profilo } = await admin.from("profilo").select("attivo, nome_completo").eq("id", link.user.id).single();
    if (!profilo?.attivo) return ok();

    const url = link.properties.action_link;
    const saluto = profilo.nome_completo && !profilo.nome_completo.includes("@") ? `Gentile ${profilo.nome_completo},` : "Buongiorno,";
    const testo = [
      saluto,
      "",
      `hai ricevuto questa email perché dal Portale Carbon WastePrint (CWP) di Fondazione Operate è stata richiesta la reimpostazione della password dell'account ${email}.`,
      "",
      `Per scegliere una nuova password apri questo collegamento: ${url}`,
      "",
      "Il collegamento vale una sola volta e per un tempo limitato. Se non hai chiesto tu di reimpostare la password, ignora questa email: la password attuale resta valida e nessuna modifica viene fatta al tuo account.",
      "",
      "— Portale Carbon WastePrint · Fondazione Operate",
      "Messaggio automatico: non rispondere a questa email.",
    ].join("\n");

    const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9d4c5;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 24px 6px;font-size:13px;color:#5a5e54">Programma Carbon WastePrint&reg; &middot; Fondazione Operate</td></tr>
<tr><td style="padding:6px 24px 0;font-size:14px">${esc(saluto)}</td></tr>
<tr><td style="padding:12px 24px 0;font-size:18px;font-weight:bold">Richiesta di reimpostazione della password</td></tr>
<tr><td style="padding:8px 24px 0;font-size:14px;line-height:1.5;color:#3a4036">hai ricevuto questa email perché dal <b>Portale Carbon WastePrint (CWP)</b> di Fondazione Operate è stata richiesta la reimpostazione della password dell'account <b>${esc(email)}</b>. Per scegliere una nuova password premi il pulsante qui sotto: si aprirà il portale.</td></tr>
<tr><td style="padding:20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border:2px solid #2f5d3a;border-radius:8px">
<a href="${url}" style="display:inline-block;background-color:#2f5d3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;line-height:18px;padding:11px 18px;border-radius:8px"><span style="color:#ffffff">Scegli una nuova password &rarr;</span></a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 24px 8px;font-size:12.5px;line-height:1.5;color:#5a5e54">Il collegamento vale una sola volta e per un tempo limitato. Se non hai chiesto tu di reimpostare la password, ignora questa email: la password attuale resta valida e nessuna modifica viene fatta al tuo account.</td></tr>
<tr><td style="padding:0 24px 20px;font-size:12px;color:#8a8d82">Portale CWP &middot; ${esc(PORTALE.replace(/^https?:\/\//, ""))} &middot; Messaggio automatico: non rispondere a questa email.</td></tr>
</table></td></tr></table></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MITTENTE,
        to: [email],
        subject: "Portale Carbon WastePrint (CWP) — Richiesta di reimpostazione della password",
        text: testo,
        html,
      }),
    });
    return ok();
  } catch (_e) {
    return ok();
  }
});

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
