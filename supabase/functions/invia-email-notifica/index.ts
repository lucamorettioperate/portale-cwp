// =====================================================================
//  Edge Function: invia-email-notifica
//  Invia per email ogni nuova notifica del portale (requisiti §9:
//  "email + notifica interna").
//
//  Viene chiamata da un Database Webhook di Supabase su INSERT nella
//  tabella "notifica" (il webhook aggiunge da sé l'autorizzazione).
//  Servizio di invio: Resend (https://resend.com).
//
//  Secrets da impostare in Supabase → Edge Functions → Secrets:
//   - RESEND_API_KEY   chiave API di Resend
//   - EMAIL_MITTENTE   es. "Portale CWP <notifiche@tuodominio.it>"
//                      (il dominio va verificato su Resend; per le prove
//                      si può usare "onboarding@resend.dev", che però
//                      consegna solo all'indirizzo del titolare Resend)
//   - PORTALE_URL      es. "https://portale-cwp.vercel.app" (facoltativo)
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Portale CWP <onboarding@resend.dev>";
    const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const payload = await req.json();
    const idNotifica = payload?.record?.id;
    if (payload?.type !== "INSERT" || payload?.table !== "notifica" || !idNotifica) {
      return json({ ignorata: true });
    }
    if (!RESEND_API_KEY) {
      // Servizio non ancora configurato: la notifica interna resta comunque.
      return json({ inviata: false, motivo: "RESEND_API_KEY non impostata" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Sicurezza: dal messaggio ricevuto si usa solo l'id. Contenuto e
    // destinatario si rileggono dal database, e ogni notifica si spedisce
    // una sola volta: una chiamata inventata non può inviare testi propri.
    const { data: n } = await admin
      .from("notifica")
      .select("id, utente_id, pratica_id, titolo, testo, email_inviata")
      .eq("id", idNotifica)
      .single();
    if (!n || n.email_inviata) {
      return json({ inviata: false, motivo: "notifica inesistente o già inviata" });
    }

    // Destinatario: email e ruolo; niente invio a profili disattivati.
    const { data: utente } = await admin.auth.admin.getUserById(n.utente_id);
    const email = utente?.user?.email;
    const { data: profilo } = await admin
      .from("profilo")
      .select("ruolo, attivo, nome_completo")
      .eq("id", n.utente_id)
      .single();
    if (!email || !profilo?.attivo) {
      return json({ inviata: false, motivo: "destinatario non attivo o senza email" });
    }

    const staff = profilo.ruolo === "operatore" || profilo.ruolo === "admin";
    const link = n.pratica_id ? `${PORTALE}${staff ? "/pratiche" : "/"}?id=${n.pratica_id}` : PORTALE;
    const saluto = profilo.nome_completo && !profilo.nome_completo.includes("@") ? `Gentile ${profilo.nome_completo},` : "Buongiorno,";

    const testo = [
      saluto,
      "",
      n.titolo,
      n.testo || "",
      "",
      `Apri il portale: ${link}`,
      "",
      "— Portale Carbon WastePrint · Fondazione Operate",
      "Messaggio automatico: non rispondere a questa email.",
    ].join("\n");

    const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9d4c5;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 24px 6px;font-size:13px;color:#5a5e54">Programma Carbon WastePrint&reg; &middot; Fondazione Operate</td></tr>
<tr><td style="padding:6px 24px 0;font-size:14px">${esc(saluto)}</td></tr>
<tr><td style="padding:12px 24px 0;font-size:18px;font-weight:bold">${esc(n.titolo)}</td></tr>
${n.testo ? `<tr><td style="padding:6px 24px 0;font-size:14px;color:#5a5e54">${esc(n.testo)}</td></tr>` : ""}
<tr><td style="padding:20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border:2px solid #2f5d3a;border-radius:8px">
<a href="${link}" style="display:inline-block;background-color:#2f5d3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;line-height:18px;padding:11px 18px;border-radius:8px"><span style="color:#ffffff">Apri nel portale &rarr;</span></a>
</td></tr></table>
<div style="padding-top:10px;font-size:12px;color:#8a8d82">Oppure copia questo indirizzo nel browser: <a href="${link}" style="color:#2f5d3a">${esc(link)}</a></div>
</td></tr>
<tr><td style="padding:0 24px 20px;font-size:12px;color:#8a8d82">Messaggio automatico: non rispondere a questa email.</td></tr>
</table></td></tr></table></body></html>`;

    const risposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MITTENTE, to: [email], subject: `Portale CWP — ${n.titolo}`, text: testo, html }),
    });
    const esito = await risposta.json().catch(() => ({}));
    if (!risposta.ok) {
      return json({ inviata: false, motivo: esito?.message || `errore ${risposta.status}` }, 502);
    }

    await admin.from("notifica").update({ email_inviata: true }).eq("id", n.id);
    return json({ inviata: true, id: esito?.id });
  } catch (e) {
    return json({ errore: String(e) }, 500);
  }
});

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
