// =====================================================================
//  Edge Function: consultazione-pubblica
//  Scopo: servizio della pagina pubblica delle consultazioni (requisiti §6,
//  decisioni B e D del 18/10/2026). Chiunque, senza account, può:
//   - "elenco":    vedere le consultazioni aperte;
//   - "dettaglio": leggere documento, errata corrige e osservazioni ammesse;
//   - "invia":     inviare un'osservazione (nome, email, testo, allegato
//                  facoltativo). L'osservazione resta IN ATTESA finché
//                  l'autore non conferma l'email con il collegamento ricevuto;
//   - "conferma":  confermare l'email: l'osservazione arriva allo staff come
//                  RICEVUTA e va moderata.
//  Sicurezza: nessun dato personale restituito (l'email non esce mai; il
//  nome solo se l'autore ha acconsentito alla pubblicazione), limiti di
//  invio per indirizzo e per consultazione, campo trappola anti-robot,
//  allegati max 10 MB con controllo del contenuto, token monouso valido 48
//  ore conservato solo come impronta SHA-256.
//  Secrets: RESEND_API_KEY, EMAIL_MITTENTE (facoltativo), PORTALE_URL (facoltativo).
//  Pubblicazione: dashboard Supabase → Edge Functions; Verify JWT DISATTIVATO
//  (la usano visitatori senza account).
//
//  Usato da: src/lib/dati.js → consultazionePubblica(), chiamata dalle
//  pagine pubbliche di src/pages/ConsultazioniPubbliche.jsx
//  (/consultazioni, /consultazioni/:id, /consultazioni/conferma).
//
//  Dati/servizi coinvolti:
//   - tabelle consultazione, pratica, organizzazione, documento, commento
//     (01_schema.sql, colonne dell'autore in 17_pratiche.sql),
//     consultazione_errata e commento_in_attesa (17_pratiche.sql);
//   - archivi Storage "documenti" (lettura con URL firmati) e
//     "allegati-consultazione" (scrittura, 10 MB, 17_pratiche.sql);
//   - Resend per l'email di conferma;
//   - segreti automatici SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
//
//  Sicurezza (importante per chi modifica):
//   - il client usa la chiave service_role, che SCAVALCA le regole RLS:
//     tutti i controlli (consultazione aperta, Progetti e Rapporti, formati,
//     limiti) devono quindi stare qui dentro;
//   - le risposte non devono mai contenere email, id utenti o nomi non
//     autorizzati: si restituiscono solo i campi scelti in pubblica() e
//     dettaglio();
//   - l'osservazione diventa un vero commento solo dopo la conferma
//     dell'email; prima resta in commento_in_attesa.
//
//  Uso / prova: dopo la pubblicazione aprire /consultazioni sul portale,
//  inviare un'osservazione di prova e confermarla dall'email.
//
//  Registro sviluppo e deploy: capitolo 5 «Edge Functions»; capitolo 4
//  «Database» (17_pratiche.sql); capitolo 8 «Procedure di rilascio»
//  (pubblicazione delle Edge Function).
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

// Intestazioni CORS: la funzione è chiamata dal browser da un altro dominio
// (portale su Vercel). "*" è accettabile perché non usa cookie né sessioni.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ALLEGATO = 10 * 1024 * 1024; // 10 MB
// Formati ammessi per l'allegato di un'osservazione: estensione → tipo MIME
// e firma dei primi byte (vedi contenutoValido). Devono restare ammessi anche
// dall'archivio "allegati-consultazione" (17_pratiche.sql).
const ALLEGATI: Record<string, { mime: string; firma: "pdf" | "jpg" | "png" | "zip" }> = {
  pdf: { mime: "application/pdf", firma: "pdf" },
  jpg: { mime: "image/jpeg", firma: "jpg" },
  jpeg: { mime: "image/jpeg", firma: "jpg" },
  png: { mime: "image/png", firma: "png" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", firma: "zip" },
  odt: { mime: "application/vnd.oasis.opendocument.text", firma: "zip" },
};

// Punto di ingresso: una sola richiesta POST con { azione, ... } nel corpo.
// Ogni errore imprevisto diventa un messaggio generico (il dettaglio va solo
// nei log della funzione, dashboard Supabase → Edge Functions → Logs).
Deno.serve(async (req) => {
  // Richiesta preliminare CORS del browser.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Client con chiave service_role: nessuna regola RLS si applica.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    switch (body.azione) {
      case "elenco": return json(await elenco(admin));
      case "dettaglio": return json(await dettaglio(admin, String(body.id || "")));
      case "invia": return json(await invia(admin, body));
      case "conferma": return json(await conferma(admin, String(body.token || "")));
      default: return json({ errore: "Richiesta non valida" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ errore: "Servizio momentaneamente non disponibile. Riprova più tardi." }, 500);
  }
});

// Data di oggi aaaa-mm-gg in ora italiana (Europe/Rome), come il database
// (20_rinforzi_integrita.sql) e il portale (oggiItalia in src/lib/date.js).
// Il server della funzione lavora in UTC: senza fuso, tra mezzanotte e le
// 2 di notte la consultazione risulterebbe ancora al giorno prima.
// Il formato svedese (sv-SE) produce già aaaa-mm-gg.
const oggi = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// Formato di un id uuid: si controlla prima di interrogare il database.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// true se la consultazione è attiva e oggi è tra apertura e chiusura
// (estremi compresi; date mancanti = nessun limite). Confronto tra stringhe
// ISO, valido perché hanno tutte lo stesso formato aaaa-mm-gg.
function aperta(c: { attiva: boolean; data_apertura: string | null; data_chiusura: string | null }) {
  const d = oggi();
  return c.attiva && (!c.data_apertura || c.data_apertura <= d) && (!c.data_chiusura || d <= c.data_chiusura);
}

// Colonne lette per una consultazione, con pratica, ente e documento.
const SELECT_CONS =
  "id, attiva, data_apertura, data_chiusura, " +
  "pratica:pratica_id (codice, titolo, tipo, anno_monitoraggio, organizzazione:organizzazione_id (denominazione)), " +
  "documento:documento_id (nome, versione, storage_path)";

// Riduce una consultazione ai soli campi pubblicabili (niente id interni
// di pratica o documento, niente percorsi dell'archivio).
function pubblica(c: any) {
  return {
    id: c.id,
    aperta: aperta(c),
    data_apertura: c.data_apertura,
    data_chiusura: c.data_chiusura,
    codice: c.pratica?.codice,
    titolo: c.pratica?.titolo,
    // Progetto o Rapporto di Monitoraggio (dal 18/10/2026 anche i Rapporti
    // hanno il feedback pubblico, Guida 6.3.1, script 23).
    tipo: c.pratica?.tipo,
    anno: c.pratica?.anno_monitoraggio ?? null,
    ente: c.pratica?.organizzazione?.denominazione,
    documento: c.documento ? `${c.documento.nome} (v${c.documento.versione})` : null,
  };
}

// Azione "elenco": consultazioni (periodi di feedback pubblico) attive e
// aperte oggi, di Progetti e Rapporti di Monitoraggio, per chiusura più vicina.
async function elenco(admin: any) {
  const { data, error } = await admin.from("consultazione").select(SELECT_CONS)
    .eq("attiva", true).order("data_chiusura", { ascending: true });
  if (error) throw error;
  return { consultazioni: (data || []).filter((c: any) => c.pratica && aperta(c)).map(pubblica) };
}

// URL firmato (valido 1 ora) per scaricare un documento pubblicato
// dall'archivio privato "documenti"; null se manca il percorso.
async function firma(admin: any, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await admin.storage.from("documenti").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

// Azione "dettaglio": dati pubblici di una consultazione (anche già chiusa:
// qui non si controlla aperta(), il campo "aperta" lo dice alla pagina),
// errata corrige con i documenti e
// osservazioni ammesse (stato "pubblicato" o "risposto"). Per le osservazioni
// si leggono solo testo, firma pubblica, risposta e data: mai nome reale o email.
async function dettaglio(admin: any, id: string) {
  if (!UUID.test(id)) return { errore: "Consultazione non trovata" };
  const { data: c } = await admin.from("consultazione").select(SELECT_CONS).eq("id", id).maybeSingle();
  if (!c || !c.pratica) return { errore: "Consultazione non trovata" };

  const { data: errata } = await admin.from("consultazione_errata")
    .select("testo, riparte, nuova_chiusura, creato_il, documento:documento_id (nome, versione, storage_path)")
    .eq("consultazione_id", id).order("creato_il", { ascending: true });
  const { data: commenti } = await admin.from("commento")
    .select("numero, testo, firma_pubblica, risposta_testo, creato_il")
    .eq("consultazione_id", id).in("stato", ["pubblicato", "risposto"]).order("numero", { ascending: true });

  return {
    consultazione: {
      ...pubblica(c),
      documento_url: await firma(admin, c.documento?.storage_path),
      errata: await Promise.all((errata || []).map(async (e: any) => ({
        testo: e.testo,
        riparte: e.riparte,
        nuova_chiusura: e.nuova_chiusura,
        creato_il: e.creato_il,
        documento: e.documento ? `${e.documento.nome} (v${e.documento.versione})` : null,
        documento_url: await firma(admin, e.documento?.storage_path),
      }))),
      // numero: progressivo dell'osservazione nella consultazione (script 21).
      osservazioni: (commenti || []).map((o: any) => ({
        numero: o.numero,
        testo: o.testo,
        autore: o.firma_pubblica || "Partecipante",
        risposta: o.risposta_testo,
        creato_il: o.creato_il,
      })),
    },
  };
}

// Controlla i primi byte dell'allegato ("numeri magici"): %PDF entro 1 KB,
// JPEG FF D8 FF, PNG 89 50 4E 47, ZIP "PK\3\4" (docx e odt sono archivi ZIP).
// Stessa logica di src/lib/file.js nel portale.
function contenutoValido(b: Uint8Array, firma: string) {
  const ini = (s: number[], da = 0) => s.every((v, i) => b[da + i] === v);
  if (firma === "pdf") { for (let i = 0; i < Math.min(b.length - 4, 1024); i++) if (ini([0x25, 0x50, 0x44, 0x46], i)) return true; return false; }
  if (firma === "jpg") return ini([0xff, 0xd8, 0xff]);
  if (firma === "png") return ini([0x89, 0x50, 0x4e, 0x47]);
  if (firma === "zip") return ini([0x50, 0x4b, 0x03, 0x04]);
  return false;
}

// Impronta SHA-256 esadecimale di un testo. Si usa per il token di conferma:
// nel database va solo l'impronta, così chi legge la tabella non può
// confermare osservazioni altrui.
async function sha256(testo: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Azione "invia": riceve un'osservazione dal modulo pubblico.
// Corpo atteso: { id, nome, email, testo, privacy, nome_pubblico, sito,
//   allegato?: { nome, dati (base64) } }.
// Effetti: pulizia delle richieste scadute, eventuale allegato
// nell'archivio, riga in commento_in_attesa, email di conferma con Resend.
// Restituisce { ok: true } oppure { errore }.
async function invia(admin: any, b: any) {
  // Campo trappola: un visitatore non lo vede, un robot lo compila.
  // Al robot si risponde "ok" senza salvare nulla, così non capisce il filtro.
  if (b.sito) return { ok: true };

  const id = String(b.id || "");
  const nome = String(b.nome || "").trim().replace(/\s+/g, " ");
  const email = String(b.email || "").trim().toLowerCase();
  const testo = String(b.testo || "").trim();
  if (!UUID.test(id)) return { errore: "Consultazione non trovata" };
  if (nome.length < 2 || nome.length > 120) return { errore: "Indica nome e cognome (o la denominazione dell'ente)." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return { errore: "Indirizzo email non valido." };
  if (testo.length < 10) return { errore: "L'osservazione è troppo breve (almeno 10 caratteri)." };
  if (testo.length > 5000) return { errore: "L'osservazione è troppo lunga (al massimo 5000 caratteri)." };
  if (!b.privacy) return { errore: "Per inviare l'osservazione serve il consenso al trattamento dei dati." };

  const { data: c } = await admin.from("consultazione")
    .select("id, pratica_id, attiva, data_apertura, data_chiusura, pratica:pratica_id (codice, titolo, tipo)")
    .eq("id", id).maybeSingle();
  if (!c || !c.pratica) return { errore: "Consultazione non trovata" };
  if (!aperta(c)) return { errore: "La consultazione è chiusa: non si possono più inviare osservazioni." };

  // Pulizia delle richieste scadute (e dei loro allegati).
  const { data: scadute } = await admin.from("commento_in_attesa").select("id, allegato_path").lt("scade_il", new Date().toISOString());
  if (scadute?.length) {
    const file = scadute.map((s: any) => s.allegato_path).filter(Boolean);
    if (file.length) await admin.storage.from("allegati-consultazione").remove(file);
    await admin.from("commento_in_attesa").delete().in("id", scadute.map((s: any) => s.id));
  }

  // Limiti: 3 invii all'ora per indirizzo, 100 all'ora per consultazione.
  const unOraFa = new Date(Date.now() - 3600_000).toISOString();
  const { count: perEmail } = await admin.from("commento_in_attesa").select("id", { count: "exact", head: true })
    .eq("email", email).gt("creato_il", unOraFa);
  const { count: perCons } = await admin.from("commento_in_attesa").select("id", { count: "exact", head: true })
    .eq("consultazione_id", id).gt("creato_il", unOraFa);
  if ((perEmail || 0) >= 3 || (perCons || 0) >= 100) {
    return { errore: "Troppe osservazioni inviate in poco tempo. Riprova tra un'ora." };
  }

  // Allegato facoltativo (arriva in base64 nel corpo JSON).
  // Ordine dei controlli: estensione ammessa → dimensione → contenuto reale.
  // Il percorso è <id consultazione>/<uuid casuale>-<nome ripulito>.
  let allegato_path: string | null = null;
  let allegato_nome: string | null = null;
  if (b.allegato?.dati) {
    const nomeFile = String(b.allegato.nome || "allegato").slice(0, 120);
    const ext = (/\.([a-z0-9]+)$/i.exec(nomeFile)?.[1] || "").toLowerCase();
    const formato = ALLEGATI[ext];
    if (!formato) return { errore: "Allegato non ammesso: usa PDF, JPG, PNG, DOCX o ODT." };
    const byte = Uint8Array.from(atob(String(b.allegato.dati)), (ch) => ch.charCodeAt(0));
    if (byte.length > MAX_ALLEGATO) return { errore: "Allegato troppo grande (al massimo 10 MB)." };
    if (!contenutoValido(byte, formato.firma)) return { errore: "Il contenuto dell'allegato non corrisponde al tipo di file." };
    const sicuro = nomeFile.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_");
    allegato_path = `${id}/${crypto.randomUUID()}-${sicuro}`;
    allegato_nome = nomeFile;
    const { error: e } = await admin.storage.from("allegati-consultazione")
      .upload(allegato_path, byte, { contentType: formato.mime, upsert: false });
    if (e) return { errore: "Allegato non caricato. Riprova." };
  }

  // Token monouso: 32 byte casuali (64 caratteri esadecimali). Va solo
  // nell'email; nel database si salva l'impronta. La scadenza di 48 ore
  // (scade_il) la imposta il valore predefinito della tabella (17_pratiche.sql).
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((x) => x.toString(16).padStart(2, "0")).join("");
  const token_hash = await sha256(token);
  const { error } = await admin.from("commento_in_attesa").insert({
    consultazione_id: id, pratica_id: c.pratica_id, nome, email, testo,
    nome_pubblico: !!b.nome_pubblico, allegato_path, allegato_nome, token_hash,
  });
  if (error) throw error;

  if (!(await emailConferma(email, nome, token, c.pratica?.codice, c.pratica?.titolo))) {
    // Email non partita: l'osservazione non resta in sospeso.
    await admin.from("commento_in_attesa").delete().eq("token_hash", token_hash);
    if (allegato_path) await admin.storage.from("allegati-consultazione").remove([allegato_path]);
    return { errore: "Non è stato possibile inviare l'email di conferma a questo indirizzo. Controlla l'indirizzo o riprova più tardi." };
  }
  return { ok: true };
}

// Azione "conferma": l'autore apre il collegamento dell'email.
// Cerca la richiesta per impronta del token, controlla scadenza e che la
// consultazione sia ancora aperta, poi crea il commento in stato "ricevuto"
// (da moderare) e cancella la richiesta: il collegamento vale una volta sola.
// L'inserimento nel commento fa partire la notifica allo staff (trigger, 09/17).
async function conferma(admin: any, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return { errore: "Collegamento non valido." };
  const { data: p } = await admin.from("commento_in_attesa").select("*").eq("token_hash", await sha256(token)).maybeSingle();
  if (!p) return { errore: "Collegamento non valido o già utilizzato." };
  if (Date.parse(p.scade_il) < Date.now()) {
    await admin.from("commento_in_attesa").delete().eq("id", p.id);
    return { errore: "Il collegamento è scaduto (vale 48 ore). Invia di nuovo l'osservazione." };
  }
  const { data: c } = await admin.from("consultazione").select("attiva, data_apertura, data_chiusura").eq("id", p.consultazione_id).maybeSingle();
  if (!c || !aperta(c)) return { errore: "La consultazione si è chiusa prima della conferma: l'osservazione non può essere ricevuta." };

  const { error } = await admin.from("commento").insert({
    consultazione_id: p.consultazione_id,
    pratica_id: p.pratica_id,
    testo: p.testo,
    stato: "ricevuto",
    autore_nome: p.nome,
    autore_email: p.email,
    firma_pubblica: p.nome_pubblico ? p.nome : null,
    allegato_path: p.allegato_path,
    allegato_nome: p.allegato_nome,
    email_verificata_il: new Date().toISOString(),
  });
  if (error) throw error;
  await admin.from("commento_in_attesa").delete().eq("id", p.id);
  return { ok: true, consultazione_id: p.consultazione_id };
}

// Spedisce con Resend l'email di conferma (testo semplice + HTML).
// Restituisce true se Resend ha accettato l'invio, false altrimenti (anche
// se manca RESEND_API_KEY). Senza dominio verificato su Resend, il mittente
// onboarding@resend.dev consegna solo all'indirizzo del titolare dell'account.
// Nell'HTML ogni dato inserito dall'utente passa da esc() (niente HTML iniettato).
async function emailConferma(email: string, nome: string, token: string, codice?: string, titolo?: string): Promise<boolean> {
  const KEY = Deno.env.get("RESEND_API_KEY");
  if (!KEY) return false;
  const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Portale CWP <onboarding@resend.dev>";
  const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");
  const url = `${PORTALE}/consultazioni/conferma?t=${token}`;
  const progetto = [codice, titolo].filter(Boolean).join(" · ");
  const testo = [
    `Gentile ${nome},`,
    "",
    `hai inviato un'osservazione al periodo di feedback pubblico del Programma Carbon WastePrint® su ${progetto}.`,
    "",
    `Per confermare il tuo indirizzo email e inviarla apri questo collegamento: ${url}`,
    "",
    "Il collegamento vale 48 ore e una sola volta. Senza conferma l'osservazione non viene ricevuta. Se non hai inviato tu l'osservazione, ignora questa email.",
    "",
    "— Portale Carbon WastePrint · Fondazione Operate",
    "Messaggio automatico: non rispondere a questa email.",
  ].join("\n");
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9d4c5;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 24px 6px;font-size:13px;color:#5a5e54">Programma Carbon WastePrint&reg; &middot; Fondazione Operate</td></tr>
<tr><td style="padding:6px 24px 0;font-size:14px">Gentile ${esc(nome)},</td></tr>
<tr><td style="padding:12px 24px 0;font-size:18px;font-weight:bold">Conferma la tua osservazione</td></tr>
<tr><td style="padding:8px 24px 0;font-size:14px;line-height:1.5;color:#3a4036">Hai inviato un'osservazione al <b>periodo di feedback pubblico</b> del Programma Carbon WastePrint&reg; su <b>${esc(progetto)}</b>. Per confermare il tuo indirizzo email e inviarla premi il pulsante qui sotto.</td></tr>
<tr><td style="padding:20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border:2px solid #2f5d3a;border-radius:8px">
<a href="${url}" style="display:inline-block;background-color:#2f5d3a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;line-height:18px;padding:11px 18px;border-radius:8px"><span style="color:#ffffff">Conferma e invia l'osservazione &rarr;</span></a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 24px 8px;font-size:12.5px;line-height:1.5;color:#5a5e54">Il collegamento vale 48 ore e una sola volta. Senza conferma l'osservazione non viene ricevuta. Dopo la conferma l'osservazione è esaminata da Fondazione Operate prima della pubblicazione. Se non hai inviato tu l'osservazione, ignora questa email.</td></tr>
<tr><td style="padding:0 24px 20px;font-size:12px;color:#8a8d82">Portale CWP &middot; ${esc(PORTALE.replace(/^https?:\/\//, ""))} &middot; Messaggio automatico: non rispondere a questa email.</td></tr>
</table></td></tr></table></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MITTENTE,
      to: [email],
      subject: "Portale Carbon WastePrint (CWP) — Conferma la tua osservazione in consultazione pubblica",
      text: testo,
      html,
    }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}

// Sostituisce i caratteri speciali HTML (& < > " ') con le entità.
function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Risposta JSON con le intestazioni CORS. Gli errori "previsti" (dati non
// validi) tornano con stato 200 e campo "errore", letti da dati.js.
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
