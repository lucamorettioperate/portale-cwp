// =========================================================================
//  marketing — funzione del server dello strumento di marketing
//  (richiesta di Luca Moretti del 23/10/2026; tabelle dello script 44).
//
//  Azioni riservate agli AMMINISTRATORI (token dell'utente, app_is_admin):
//   - importa_comuni  { fase: "base" | "ipa" | "uo", da? }
//       base: tutti i Comuni ISTAT (public/marketing/dati/comuni_istat.json)
//             con regione, provincia, popolazione;
//       ipa:  da IndicePA (open data, CC-BY 4.0) PEC, email generica, sito,
//             codice fiscale, indirizzo e sindaco di ogni Comune;
//       uo:   unità organizzative dei Comuni (a blocchi, parametro «da»):
//             responsabili di tributi, ambiente, finanziario, tecnico con
//             le loro email; email generica (protocollo, segreteria) se
//             manca. Restituisce { fatti, prossimo } per il blocco seguente.
//   - importa_albo { sezione, indice }: imprese di una provincia (indice
//       nella sezione regionale; risponde con «prossimo») dell'Albo
//       Nazionale Gestori Ambientali con categoria 1 ordinaria («1o»),
//       dall'elenco pubblico degli iscritti; poi PEC, email e sito dei
//       gestori pubblici registrati in IndicePA (stesso codice fiscale).
//   - leggi_siti { quanti? }: legge i siti dei prossimi enti in coda
//       (script 46, al massimo 4); la stessa azione arriva ogni 30 secondi
//       dal lavoro pianificato con il codice segreto { segreto } quando la
//       lettura è accesa. Recapiti e referenti si riconoscono con regole
//       fisse (estraiDati), senza servizi a pagamento;
//   - prova_campagna { campagna }: spedisce la campagna solo all'indirizzo
//       dell'Amministratore che la prova.
//   - invia_campagna { campagna, quanti? }: spedisce un blocco di invii
//       «da_inviare» (al massimo 50 per chiamata, uno al secondo verso
//       Resend) e restituisce quanti ne restano.
//  Azioni PUBBLICHE (landing page, nessun accesso richiesto; si conosce
//  solo il codice casuale dell'invio):
//   - visita { token }: nome dell'ente e popolazione per la pagina; segna
//       la prima visita;
//   - simulata { token }: segna che il Comune ha fatto la simulazione;
//   - richiesta { token?, ente, referente, ruolo, email, telefono,
//       messaggio, simulazione, sito_web (campo trappola) }: salva la
//       richiesta di registrazione e la manda a tutti gli Amministratori
//       (notifica nel portale con email, cwp_notifica dello script 09);
//       limiti: 3 richieste all'ora per email, 30 all'ora in tutto;
//   - disiscrivi { token }: l'indirizzo non riceve più campagne.
//
//  Verify JWT DISATTIVATO di proposito (la landing page è pubblica): le
//  azioni riservate controllano da sole il token e il ruolo.
//  Segreti: RESEND_API_KEY, EMAIL_MITTENTE (facoltativo), PORTALE_URL
//  (facoltativo); automatici SUPABASE_URL, SUPABASE_ANON_KEY,
//  SUPABASE_SERVICE_ROLE_KEY.
//  Le funzioni tra INIZIO-… e FINE-… sono copie IDENTICHE di
//  src/lib/marketing.js (prova test/marketing.test.mjs).
//  Registro sviluppo e deploy: capitolo «Marketing».
// =========================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Fondazione Operate - Programma CWP <onboarding@resend.dev>";
const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");

const IPA = "https://indicepa.gov.it/ipa-dati/api/3/action/datastore_search_sql";
const IPA_ENTI = "d09adf99-dc10-4349-8c53-27b1e5aa97b6";
const IPA_UO = "b0aa1f6c-f135-4c8a-b416-396fed4e1a5d";
const ALBO = "https://www.albonazionalegestoriambientali.it/Public/Api/ElenchiIscritti/GetImpresePerSezioneProvincia";
// Sezioni regionali dell'Albo: id, nome della regione, province.
const SEZIONI_ALBO: Record<string, [string, string[]]> = {
  "13": ["Abruzzo", ["AQ", "CH", "PE", "TE"]], "21": ["Trentino-Alto Adige/Südtirol", ["BZ"]], "17": ["Basilicata", ["MT", "PZ"]],
  "18": ["Calabria", ["CS", "CZ", "KR", "RC", "VV"]], "15": ["Campania", ["AV", "BN", "CE", "NA", "SA"]],
  "8": ["Emilia-Romagna", ["BO", "FC", "FE", "MO", "PC", "PR", "RA", "RE", "RN"]], "6": ["Friuli-Venezia Giulia", ["GO", "PN", "TS", "UD"]],
  "12": ["Lazio", ["FR", "LT", "RI", "RM", "VT"]], "7": ["Liguria", ["GE", "IM", "SP", "SV"]],
  "3": ["Lombardia", ["BG", "BS", "CO", "CR", "LC", "LO", "MB", "MI", "MN", "PV", "SO", "VA"]],
  "11": ["Marche", ["AN", "AP", "FM", "MC", "PU"]], "14": ["Molise", ["CB", "IS"]],
  "1": ["Piemonte", ["AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC"]], "16": ["Puglia", ["BA", "BR", "BT", "FG", "LE", "TA"]],
  "20": ["Sardegna", ["CA", "CI", "NU", "OG", "OR", "OT", "SS", "SU", "VS"]], "19": ["Sicilia", ["AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP"]],
  "9": ["Toscana", ["AR", "FI", "GR", "LI", "LU", "MS", "PI", "PO", "PT", "SI"]], "4": ["Trentino-Alto Adige/Südtirol", ["TN"]],
  "10": ["Umbria", ["PG", "TR"]], "2": ["Valle d'Aosta/Vallée d'Aoste", ["AO"]], "5": ["Veneto", ["BL", "PD", "RO", "TV", "VE", "VI", "VR"]],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// INIZIO-EMAIL-CAMPAGNA
// Grafiche disponibili per l'intestazione (immagini in public/marketing/).
export const GRAFICHE_CAMPAGNA = {
  risorse: { nome: "Risorse per il Comune", file: "banner-risorse.png" },
  territorio: { nome: "Territorio e ambiente", file: "banner-territorio.png" },
};

// Sostituisce i caratteri speciali HTML.
function escCampagna(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Parametri: { portale (indirizzo del portale, senza / finale), grafica,
// oggetto, testo (paragrafi separati da una riga vuota), ente (nome del
// destinatario), token (codice dell'invio) }. Restituisce l'HTML completo.
export function htmlCampagna({ portale, grafica, oggetto, testo, ente, token }) {
  const g = GRAFICHE_CAMPAGNA[grafica] || GRAFICHE_CAMPAGNA.risorse;
  const link = `${portale}/scopri?c=${encodeURIComponent(token)}`;
  const esci = `${portale}/scopri/disiscrizione?c=${encodeURIComponent(token)}`;
  const paragrafi = String(testo || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1b2118">${escCampagna(p).replace(/\n/g, "<br>")}</p>`).join("");
  const anni = [7, 10, 21].map((a) => `<td align="center" style="padding:10px 6px;background:#ffffff;border:1px solid #d9d4c5;border-radius:10px"><div style="font-size:26px;font-weight:bold;color:#2f5d3a">${a}</div><div style="font-size:12px;color:#5a5e54">anni</div></td>`).join('<td style="width:8px"></td>');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"><title>${escCampagna(oggetto)}</title></head>
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #d9d4c5;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td><img src="${portale}/marketing/${g.file}" width="600" alt="Programma Carbon WastePrint: i rifiuti evitati diventano risorse per il Comune" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:22px 26px 4px">
<div style="font-size:13px;color:#5a5e54;margin-bottom:10px">All'attenzione di ${escCampagna(ente)}</div>
${paragrafi}
</td></tr>
<tr><td style="padding:4px 26px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e4ede1;border-radius:12px"><tr><td style="padding:16px 16px 8px;font-size:15px;font-weight:bold;color:#2f5d3a">Risorse economiche per il Comune, per tutta la durata del progetto</td></tr>
<tr><td style="padding:0 16px 10px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>${anni}</tr></table></td></tr>
<tr><td style="padding:0 16px 16px;font-size:13px;line-height:1.5;color:#1b2118">I rifiuti che il territorio evita diventano crediti di carbonio certificati (Metodologia Carbon WastePrint&reg;, UNI EN ISO 14064-2), venduti sul mercato volontario: ricavi ogni anno, tariffa più equa per i cittadini, dati misurati e un percorso seguito dalla Fondazione.</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:14px 26px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border-radius:10px">
<a href="${link}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none"><span style="color:#ffffff">Approfondisci e simula il tuo Comune &rarr;</span></a>
</td></tr></table>
<div style="font-size:12px;color:#8a8d82;padding-top:8px">In due minuti: abitanti, secco e rifiuti totali, durata. Ricevi costi e ricavi anno per anno.</div>
</td></tr>
<tr><td style="padding:16px 26px 22px;border-top:1px solid #d9d4c5;font-size:11px;line-height:1.5;color:#8a8d82">
Fondazione Operate &middot; Programma Carbon WastePrint&reg; &middot; info@carbonwasteprint.com<br>
Ricevete questo messaggio all'indirizzo pubblicato dall'ente (IndicePA o sito istituzionale/aziendale). Titolare del trattamento: Fondazione Operate; dati usati solo per presentare il Programma.
<a href="${esci}" style="color:#5a5e54">Non desidero ricevere altre comunicazioni</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

// Versione in testo semplice della stessa email.
export function testoCampagna({ portale, testo, ente, token }) {
  return [
    `All'attenzione di ${ente}`,
    "",
    String(testo || "").trim(),
    "",
    "Risorse economiche per il Comune per 7, 10 o 21 anni: i rifiuti evitati diventano crediti di carbonio certificati.",
    "",
    `Approfondisci e simula il tuo Comune: ${portale}/scopri?c=${token}`,
    "",
    "Fondazione Operate · Programma Carbon WastePrint® · info@carbonwasteprint.com",
    `Non desidero ricevere altre comunicazioni: ${portale}/scopri/disiscrizione?c=${token}`,
  ].join("\n");
}
// FINE-EMAIL-CAMPAGNA

// INIZIO-REGOLE-IPA
// Ruolo del referente dalla descrizione dell'unità organizzativa
// (ufficio) di un Comune; null se l'ufficio non interessa.
export function ruoloUfficio(descrizione) {
  const d = String(descrizione || "").toLowerCase();
  if (/tribut|entrate|\btari\b|fiscal/.test(d)) return "tributi";
  if (/ambient|ecolog|rifiut|igiene urbana|nettezza/.test(d)) return "ambiente";
  if (/finanz|ragioneri|bilancio|contabil/.test(d)) return "finanziario";
  if (/tecnic|lavori pubblici|urbanistic|manutenzion/.test(d)) return "tecnico";
  return null;
}
// Ufficio da cui prendere l'email generica dell'ente, se manca.
export function ufficioGenerico(descrizione) {
  return /protocollo|segreteria|affari generali|\burp\b|relazioni con il pubblico/.test(String(descrizione || "").toLowerCase());
}
// Vero se l'indirizzo sembra una PEC dal dominio (stessa regola del
// database, mkt_sembra_pec dello script 44).
export function sembraPec(email) {
  return /@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura))/.test(String(email || "").toLowerCase());
}
// FINE-REGOLE-IPA

// Pulizia di un testo (null se vuoto) e di un indirizzo email.
const t = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
const mail = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
};

// Query SQL sugli open data di IndicePA. Restituisce le righe.
async function ipa(sql: string) {
  const r = await fetch(`${IPA}?sql=${encodeURIComponent(sql)}`);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(`IndicePA non risponde (${r.status}): ${JSON.stringify(j?.error || "").slice(0, 200)}`);
  return j.result.records as Record<string, string | null>[];
}

// Tutte le righe di una lettura (le API restituiscono al massimo 1.000
// righe per volta): crea(da, a) costruisce la lettura di un intervallo.
// deno-lint-ignore no-explicit-any
async function tutte(crea: (da: number, a: number) => any) {
  const out: Record<string, unknown>[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await crea(da, da + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

// Upsert a blocchi (chiave unica onConflict).
async function upsert(admin: ReturnType<typeof createClient>, tabella: string, righe: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < righe.length; i += 500) {
    const { error } = await admin.from(tabella).upsert(righe.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${tabella}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// Lettore dei siti (script 46): regole condivise con il portale.
// Le funzioni tra INIZIO-LETTURA-SITI e FINE-LETTURA-SITI sono copie
// IDENTICHE di src/lib/marketingLettura.js (controllo in npm test).
// ---------------------------------------------------------------------
// INIZIO-LETTURA-SITI
// Entità HTML più comuni nelle pagine italiane.
const ENTITA_HTML = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù", Agrave: "À", Egrave: "È", Eacute: "É", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", euro: "€", deg: "°", laquo: "«", raquo: "»", middot: "·", copy: "©", reg: "®" };

// Testo leggibile da una pagina HTML: niente script e stili, una riga per
// blocco (paragrafi, righe di tabella, voci di elenco, titoli).
export function htmlInTesto(html) {
  let s = String(html || "");
  s = s.replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Indirizzi delle email nei collegamenti mailto (a volte il testo è «scrivici»).
  s = s.replace(/<a[^>]+href\s*=\s*["']mailto:([^"'?]+)[^>]*>/gi, " $1 ");
  s = s.replace(/<(br|\/p|\/li|\/tr|\/div|\/h[1-6]|\/td|\/th|\/dd|\/dt|\/section|\/article|\/header|\/footer)[^>]*>/gi, "\n");
  s = s.replace(/<td[^>]*>/gi, " | ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    }
    return ENTITA_HTML[e] ?? m;
  });
  return s.split("\n").map((r) => r.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

// Collegamenti di una pagina: [{ url assoluto, testo }], senza duplicati,
// senza file (pdf, immagini) e senza mailto/tel/javascript.
export function collegamenti(html, base) {
  const out = [];
  const visti = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)(#[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ""))) && out.length < 600) {
    const href = m[1].trim();
    if (/^(mailto|tel|javascript|data):/i.test(href)) continue;
    let url;
    try { url = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    if (/\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|odt|p7m|mp4|mp3)$/i.test(url.pathname)) continue;
    url.hash = "";
    const chiave = url.href;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    const testo = htmlInTesto(m[3]).replace(/\n/g, " ").slice(0, 120);
    out.push({ url: chiave, testo });
  }
  return out;
}

// Dominio «di base» (ultimi due livelli; tre per i domini come comune.x.it
// non servono: basta che l'host finisca con il dominio di base del sito).
export function dominioBase(host) {
  const p = String(host || "").toLowerCase().replace(/^www\./, "").split(".");
  return p.length <= 2 ? p.join(".") : p.slice(-2).join(".");
}

// Punteggio di un collegamento per il tipo di ente: più alto = più utile.
// Collegamenti esterni al sito: solo l'amministrazione trasparente (spesso
// su una piattaforma esterna).
export function punteggioLink(link, tipo, hostBase) {
  let percorso = link.url;
  try { percorso = decodeURIComponent(link.url); } catch { /* indirizzo con caratteri non validi */ }
  const t = (link.testo + " " + percorso.replace(/[-_/.]/g, " ")).toLowerCase();
  let host = "";
  try { host = new URL(link.url).hostname.toLowerCase(); } catch { return 0; }
  const interno = host === hostBase || host.endsWith("." + dominioBase(hostBase)) || dominioBase(host) === dominioBase(hostBase);
  const trasparenza = /trasparen/.test(t);
  if (!interno && !trasparenza) return 0;
  let p = 0;
  if (/contatt|recapit|contact|dove siamo/.test(t)) p = Math.max(p, 10);
  if (/telefono e posta|posta elettronica|articolazione|organizzazione degli uffici|uffici e orari|elenco uffici|\buffici\b/.test(t)) p = Math.max(p, 9);
  if (/organigramma|organi di|consiglio di amministrazione|\bcda\b|governance|management|direzione|dirigent/.test(t)) p = Math.max(p, tipo === "gestore" ? 9 : 7);
  if (tipo === "comune" && /tribut|entrate|\btari\b|ambient|ecolog|rifiut|igiene urbana/.test(t)) p = Math.max(p, 9);
  if (tipo === "gestore" && /chi siamo|azienda|societ[aà]|about|comuni serviti|dove operiamo|territorio|servizi/.test(t)) p = Math.max(p, 7);
  if (tipo === "gestore" && /tariff|\btari\b|tarip|bollett|sportell/.test(t)) p = Math.max(p, 7);
  if (trasparenza) p = Math.max(p, 8);
  if (/news|notizi|eventi|blog|cookie|privacy|login|accedi|area riservata|newsletter|bandi di gara|albo pretorio/.test(t)) p = Math.min(p, 2);
  return p;
}

// Robots.txt: vero se il percorso è consentito ai programmi automatici
// (regole per «*» e per il nostro nome; vince la regola più lunga).
export function robotsConsente(robots, percorso, agente = "cwpportalebot") {
  const righe = String(robots || "").split(/\r?\n/).map((r) => r.replace(/#.*/, "").trim());
  const gruppi = [];
  let g = null;
  for (const r of righe) {
    const m = r.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") {
      if (!g || g.regole.length) { g = { agenti: [], regole: [] }; gruppi.push(g); }
      g.agenti.push(v.toLowerCase());
    } else if ((k === "allow" || k === "disallow") && g) {
      g.regole.push({ consenti: k === "allow", percorso: v });
    }
  }
  const nostro = gruppi.filter((x) => x.agenti.some((a) => a !== "*" && agente.includes(a)));
  const validi = nostro.length ? nostro : gruppi.filter((x) => x.agenti.includes("*"));
  let migliore = null;
  for (const x of validi) {
    for (const r of x.regole) {
      if (!r.percorso) continue; // «Disallow:» vuoto = tutto consentito
      const re = new RegExp("^" + r.percorso.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
      if (re.test(percorso) && (!migliore || r.percorso.length > migliore.percorso.length)) migliore = r;
    }
  }
  return !migliore || migliore.consenti;
}

const RE_PEC = /@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura|certimprese|certifymail|cgn\.legalmail|pec\.it))/i;

// Nomi propri dopo un'etichetta («Responsabile: dott.ssa Maria Rossi»,
// «Presidente ROSSI Mario»): due o tre parole con l'iniziale maiuscola o
// tutte maiuscole. Parole che non sono nomi (Ufficio, Area…) escluse.
const NON_NOMI = new Set(["area", "settore", "servizio", "servizi", "ufficio", "uffici", "comune", "tributi", "tributo", "entrate", "ambiente", "ecologia", "responsabile", "dirigente", "del", "della", "dello", "dei", "delle", "di", "e", "posta", "telefono", "tel", "email", "mail", "pec", "orari", "orario", "sede", "via", "piazza", "dott", "dott.ssa", "dr", "ing", "arch", "geom", "rag", "avv", "sig", "sig.ra", "segretario", "generale", "tecnico", "direttore", "presidente", "consiglio", "amministrazione", "amministratore", "delegato", "unico", "società", "spa", "srl", "s.p.a.", "s.r.l.", "lavori", "pubblici", "polizia", "locale", "finanziario", "economico", "gestione", "rifiuti", "tari", "igiene", "urbana", "nessuno", "vacante", "contatti", "home", "chi", "siamo"]);
const TITOLI = /^(?:(?:dott\.?ssa|dott|dr|dr\.ssa|ing|arch|geom|rag|avv|sig\.?ra|sig|p\.?\s?i|prof)\.?\s+)+/i;
function nomeDopo(testo) {
  const t = String(testo || "").replace(/^[\s:–—\-|,.]+/, "").replace(TITOLI, "");
  const m = t.match(/^([A-ZÀ-Ý][A-Za-zÀ-ÿ'’]+(?:[ \t]+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’]+){1,2})/);
  if (!m) return null;
  // Nomi composti da una sola riga: «Paolo Neri» e non «Paolo Neri Svolgiamo».
  const parole = m[1].split(/[ \t]+/).filter((w) => !NON_NOMI.has(w.toLowerCase()));
  if (parole.length < 2 || parole.length !== m[1].split(/[ \t]+/).length) return null;
  // «ROSSI Maria» → cognome in maiuscolo per primo; altrimenti «Maria Rossi».
  const maiuscole = parole.filter((w) => w.length > 1 && w === w.toUpperCase());
  if (maiuscole.length && maiuscole.length < parole.length && parole[0] === parole[0].toUpperCase()) {
    return { nome: parole.filter((w) => !maiuscole.includes(w)).join(" "), cognome: maiuscole.join(" ") };
  }
  return { nome: parole[0], cognome: parole.slice(1).join(" ") };
}

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_TEL = /(?:tel(?:efono)?|centralino|t\.|ph(?:one)?|numero verde)\s*[.:]?\s*((?:\+39[\s.]?)?(?:0\d{1,3}|800|3\d{2})[\s./-]?\d{2,4}[\s./-]?\d{2,4}(?:[\s./-]?\d{1,4})?)/i;
const ESCLUSE = /^(webmaster|privacy|dpo|rpd|noreply|no-reply|newsletter|gdpr|whistleblowing|curriculum|cv|lavoraconnoi|jobs|recruiting)@/i;
const ETICHETTA_COMUNE = /(responsabile|dirigente|referente|funzionari[oa]|capo\s+(?:settore|area|servizio|ufficio)|titolare\s+(?:di\s+)?(?:p\.?\s?o\.?|posizione organizzativa|incarico di elevata qualificazione))(?:\s+(?:del|dell['’]|della|dei|di)\s+(?:servizio|settore|area|ufficio)?[^:\n]{0,50}?)?\s*[:\-–]/i;
const ETICHETTE_GESTORE = [
  [/presidente(?:\s+del\s+(?:c\.?d\.?a\.?|consiglio\s+di\s+amministrazione))?/i, "amministratore"],
  [/amministratore\s+(?:delegato|unico)/i, "amministratore"],
  [/direttore\s+generale/i, "direttore_generale"],
  [/direttore\s+tecnico/i, "direttore_tecnico"],
];

// Riconosce i dati nelle pagine lette, con regole fisse (nessun servizio
// a pagamento). pagine: [{ url, testo }]. Restituisce lo stesso formato che
// controlloEsito si aspetta, con la pagina di provenienza di ogni dato.
export function estraiDati(pagine, tipo, hostBase = "") {
  const dominio = dominioBase(hostBase);
  const tutte = [];
  for (const p of pagine) {
    for (const e of String(p.testo || "").match(RE_EMAIL) || []) {
      const x = e.toLowerCase().replace(/\.$/, "");
      if (!tutte.some((t) => t.email === x)) tutte.push({ email: x, fonte: p.url });
    }
  }
  const pec = tutte.filter((t) => RE_PEC.test(t.email));
  const ordinarie = tutte.filter((t) => !RE_PEC.test(t.email) && !ESCLUSE.test(t.email));
  const sulDominio = (t) => !dominio || t.email.endsWith("@" + dominio) || t.email.endsWith("." + dominio);
  const preferite = tipo === "comune" ? /^(protocollo|info|urp|segreteria|comune|municipio|ufficio\.?protocollo)[@.]/ : /^(info|segreteria|amministrazione|commerciale|contatti|ufficio|clienti|direzione)[@.]/;
  const generica = ordinarie.find((t) => preferite.test(t.email) && sulDominio(t)) || ordinarie.find((t) => preferite.test(t.email)) || null;
  const pecScelta = pec.find((t) => /^(protocollo|comune|segreteria|info|amministrazione)/.test(t.email)) || pec[0] || null;
  let telefono = null;
  for (const p of pagine) {
    const m = String(p.testo || "").match(RE_TEL);
    if (m) { telefono = m[1].trim(); break; }
  }
  const out = { email: generica?.email || null, pec: pecScelta?.email || null, telefono, uffici: [], referenti: [], attivita_raccolta: null, attivita_tariffa: null, comuni_serviti: [], note: "" };

  if (tipo === "comune") {
    const RUOLI = [["tributi", /tribut|entrate|\btari\b/i], ["ambiente", /ambient|ecolog|rifiut|igiene urbana/i]];
    for (const [ruolo, re] of RUOLI) {
      let migliore = null;
      for (const p of pagine) {
        const righe = String(p.testo || "").split("\n");
        const altri = RUOLI.filter(([x]) => x !== ruolo).map(([, y]) => y);
        righe.forEach((r, i) => {
          if (!re.test(r) || r.length > 220) return;
          // La finestra va dalla riga dell'ufficio alle 4 seguenti, e si
          // ferma dove comincia l'altro ufficio.
          const parte = [r];
          for (let k = i + 1; k < Math.min(righe.length, i + 5); k++) {
            if (altri.some((y) => y.test(righe[k]))) break;
            parte.push(righe[k]);
          }
          const finestra = parte.join("\n");
          const emails = (finestra.match(RE_EMAIL) || []).map((e) => e.toLowerCase()).filter((e) => !RE_PEC.test(e) && !ESCLUSE.test(e));
          const email = emails.find((e) => re.test(e.split("@")[0])) || emails[0] || null;
          const tel = (finestra.match(RE_TEL) || [])[1] || null;
          let persona = null;
          const et = finestra.match(ETICHETTA_COMUNE);
          if (et) persona = nomeDopo(finestra.slice(et.index + et[0].length, et.index + et[0].length + 80));
          const punti = (email ? 2 : 0) + (persona ? 2 : 0) + (tel ? 1 : 0) + (email && re.test(email.split("@")[0]) ? 2 : 0) + (r.includes("@") ? 0 : 1);
          if (punti > 0 && (!migliore || punti > migliore.punti)) {
            migliore = { punti, ruolo, ufficio: r.slice(0, 150), nome: persona?.nome || null, cognome: persona?.cognome || null, email, telefono: tel ? tel.trim() : null, fonte: p.url };
          }
        });
      }
      // Email dell'ufficio riconoscibile dal nome (es. tributi@comune.x.it).
      if (!migliore || !migliore.email) {
        const t = ordinarie.find((x) => re.test(x.email.split("@")[0]));
        if (t) migliore = { ...(migliore || { ruolo, ufficio: null, nome: null, cognome: null, telefono: null }), email: t.email, fonte: migliore?.fonte || t.fonte, punti: 2 };
      }
      if (migliore) { delete migliore.punti; out.uffici.push(migliore); }
    }
  } else {
    const visti = new Set();
    for (const p of pagine) {
      const testo = String(p.testo || "");
      for (const [re, ruolo] of ETICHETTE_GESTORE) {
        const g = new RegExp(re.source, "gi");
        let m;
        while ((m = g.exec(testo)) && out.referenti.length < 6) {
          const persona = nomeDopo(testo.slice(m.index + m[0].length, m.index + m[0].length + 80));
          if (!persona) continue;
          const k = ruolo + "|" + persona.cognome.toLowerCase();
          if (visti.has(k)) continue;
          visti.add(k);
          out.referenti.push({ ruolo, nome: persona.nome, cognome: persona.cognome, fonte: p.url });
        }
      }
    }
    const tutto = pagine.map((p) => p.testo).join("\n");
    if (/raccolta\s+(?:porta\s+a\s+porta|differenziata|dei\s+rifiuti\s+urbani|rifiuti\s+urbani)|igiene\s+urbana|spazzamento/i.test(tutto) && /\bcomun[ei]\b/i.test(tutto)) out.attivita_raccolta = true;
    if (/tariffa\s+puntuale|\btarip\b|\btari\b|bollettazione|sportello\s+(?:utenti|tari|tariffa)/i.test(tutto)) out.attivita_tariffa = true;
    const comuni = new Set();
    for (const m of tutto.matchAll(/Comune\s+di\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’]+(?:[\s-][A-ZÀ-Ý][A-Za-zÀ-ÿ'’]+){0,3})/g)) {
      if (comuni.size >= 40) break;
      comuni.add(m[1].trim());
    }
    out.comuni_serviti = [...comuni];
  }
  return out;
}

// Tutte le email presenti nel testo (minuscole, senza doppioni).
export function emailNelTesto(testo) {
  const m = String(testo || "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  return [...new Set(m.map((e) => e.replace(/\.$/, "")))];
}

// Controlla i dati riconosciuti contro il testo letto: tiene solo email,
// telefoni e nomi che compaiono davvero nel testo e solo fonti tra le
// pagine lette; separa PEC ed email generiche. Restituisce l'esito pulito.
export function controlloEsito(grezzo, testo, pagineLette, tipo) {
  const T = String(testo || "").toLowerCase();
  const cifre = T.replace(/[^0-9]/g, "");
  const urls = new Set(pagineLette);
  const fonte = (u) => (u && urls.has(u) ? u : pagineLette[0] || null);
  const email = (e) => {
    const x = String(e || "").trim().toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x) && T.includes(x) ? x : null;
  };
  const tel = (v) => {
    const d = String(v || "").replace(/[^0-9]/g, "");
    return d.length >= 6 && cifre.includes(d) ? String(v).trim().slice(0, 40) : null;
  };
  const nome = (v) => {
    const x = String(v || "").trim();
    return x.length >= 2 && T.includes(x.toLowerCase()) ? x.slice(0, 80) : null;
  };
  const g = grezzo || {};
  const out = { email: null, pec: null, telefono: tel(g.telefono), uffici: [], referenti: [], attivita_raccolta: null, attivita_tariffa: null, comuni_serviti: [], note: "" };
  const e = email(g.email), p = email(g.pec);
  if (e && !RE_PEC.test(e)) out.email = e;
  if (p && RE_PEC.test(p)) out.pec = p;
  if (!out.pec && e && RE_PEC.test(e)) out.pec = e;
  const ruoliComune = ["tributi", "ambiente"];
  const ruoliGestore = ["direttore_generale", "direttore_tecnico", "amministratore"];
  for (const u of Array.isArray(g.uffici) ? g.uffici : []) {
    if (tipo !== "comune" || !ruoliComune.includes(u?.ruolo)) continue;
    const em = email(u.email);
    const r = {
      ruolo: u.ruolo, ufficio: String(u.ufficio || "").slice(0, 150) || null, nome: nome(u.nome), cognome: nome(u.cognome),
      email: em && !RE_PEC.test(em) ? em : null, telefono: tel(u.telefono), fonte: fonte(u.fonte),
    };
    if (r.cognome || r.email || r.telefono) out.uffici.push(r);
  }
  for (const r0 of Array.isArray(g.referenti) ? g.referenti : []) {
    if (tipo !== "gestore" || !ruoliGestore.includes(r0?.ruolo)) continue;
    const r = { ruolo: r0.ruolo, nome: nome(r0.nome), cognome: nome(r0.cognome), fonte: fonte(r0.fonte) };
    if (r.cognome) out.referenti.push(r);
  }
  if (tipo === "gestore") {
    if (typeof g.attivita_raccolta === "boolean") out.attivita_raccolta = g.attivita_raccolta;
    if (typeof g.attivita_tariffa === "boolean") out.attivita_tariffa = g.attivita_tariffa;
    out.comuni_serviti = (Array.isArray(g.comuni_serviti) ? g.comuni_serviti : []).map((c) => String(c).trim()).filter((c) => c && T.includes(c.toLowerCase())).slice(0, 40);
  }
  out.note = String(g.note || "").slice(0, 400);
  return out;
}
// FINE-LETTURA-SITI

const UA_LETTORE = "Mozilla/5.0 (compatible; CWPPortaleBot/1.0; +https://portale-cwp.vercel.app/programma)";
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Scarica una pagina HTML (al massimo 700.000 caratteri, 12 secondi).
async function scarica(url: string, ms = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA_LETTORE, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "it-IT,it;q=0.9" }, redirect: "follow", signal: ctl.signal });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok) return { ok: false, url: r.url || url, html: "", errore: `HTTP ${r.status}` };
    if (tipo && !/html|xml|text\/plain/i.test(tipo)) return { ok: false, url: r.url || url, html: "", errore: `tipo ${tipo}` };
    const html = (await r.text()).slice(0, 700000);
    return { ok: true, url: r.url || url, html, errore: "" };
  } catch (e) {
    return { ok: false, url, html: "", errore: (e as Error)?.name === "AbortError" ? "tempo scaduto" : String((e as Error)?.message || e).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

// robots.txt di un host (in memoria per la durata della chiamata).
const robotsCache = new Map<string, string>();
async function robotsDi(origine: string) {
  if (robotsCache.has(origine)) return robotsCache.get(origine)!;
  const r = await scarica(origine + "/robots.txt", 6000);
  const testo = r.ok ? r.html : "";
  robotsCache.set(origine, testo);
  return testo;
}
async function consentito(url: string) {
  try {
    const u = new URL(url);
    return robotsConsente(await robotsDi(u.origin), u.pathname + u.search);
  } catch {
    return false;
  }
}

// Legge il sito di un ente: home page, poi fino a 5 pagine utili e 2 di
// secondo livello (amministrazione trasparente → uffici), una alla volta.
async function leggiSito(ente: { tipo: string; denominazione: string; sito: string; comune_sede: string | null }) {
  let base = String(ente.sito || "").trim();
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;
  if (!(await consentito(base))) throw new Error("Il sito chiede di non essere letto dai programmi automatici (robots.txt)");
  let home = await scarica(base);
  if (!home.ok && base.startsWith("https://")) home = await scarica(base.replace("https://", "http://"));
  if (!home.ok) throw new Error(`Sito non raggiungibile (${home.errore})`);
  const hostBase = new URL(home.url).hostname.toLowerCase();
  const pagine = [{ url: home.url, html: home.html }];
  const visitate = new Set([home.url]);
  const scegli = (html: string, url: string, minimo: number, quanti: number) =>
    collegamenti(html, url).map((l) => ({ ...l, p: punteggioLink(l, ente.tipo, hostBase) }))
      .filter((l) => l.p >= minimo && !visitate.has(l.url)).sort((a, b) => b.p - a.p).slice(0, quanti);
  for (const l of scegli(home.html, home.url, 6, 5)) {
    if (visitate.has(l.url) || !(await consentito(l.url))) continue;
    await pausa(700);
    const r = await scarica(l.url);
    visitate.add(l.url);
    if (r.ok) { pagine.push({ url: r.url, html: r.html }); visitate.add(r.url); }
  }
  let extra = 0;
  for (const p of pagine.slice(1)) {
    if (extra >= 2) break;
    if (!/trasparen|organizzazion|uffici|chi-siamo|azienda|societ/i.test(p.url)) continue;
    for (const l of scegli(p.html, p.url, 8, 2)) {
      if (extra >= 2 || visitate.has(l.url) || !(await consentito(l.url))) continue;
      await pausa(700);
      const r = await scarica(l.url);
      visitate.add(l.url);
      extra++;
      if (r.ok) pagine.push({ url: r.url, html: r.html });
    }
  }
  return { host: hostBase, pagine: pagine.map((p) => ({ url: p.url, testo: htmlInTesto(p.html) })) };
}

// Legge un ente e salva i dati trovati (solo nei campi vuoti) e i referenti.
async function leggiESalva(admin: ReturnType<typeof createClient>, ente: { ente_id: number; tipo: string; denominazione: string; sito: string; comune_sede: string | null }) {
  const { host, pagine } = await leggiSito(ente);
  const urls = pagine.map((p) => p.url);
  const tuttoIlTesto = pagine.map((p) => p.testo).join("\n");
  // Regole fisse, nessun servizio a pagamento (scelta di Luca del 25/10/2026).
  const dati = estraiDati(pagine, ente.tipo, host);
  const esito = controlloEsito(dati, tuttoIlTesto, urls, ente.tipo);
  const token_in = 0, token_out = 0;
  const { data: attuale } = await admin.from("mkt_ente").select("email, pec, telefono, attivita_raccolta, attivita_tariffa, fonti, note").eq("id", ente.ente_id).single();
  const patch: Record<string, unknown> = { verificato_il: new Date().toISOString().slice(0, 10) };
  if (!attuale?.email && esito.email) patch.email = esito.email;
  if (!attuale?.pec && esito.pec) patch.pec = esito.pec;
  if (!attuale?.telefono && esito.telefono) patch.telefono = esito.telefono;
  if (ente.tipo === "gestore") {
    if (attuale?.attivita_raccolta == null && esito.attivita_raccolta != null) patch.attivita_raccolta = esito.attivita_raccolta;
    if (attuale?.attivita_tariffa == null && esito.attivita_tariffa != null) patch.attivita_tariffa = esito.attivita_tariffa;
    if (esito.comuni_serviti.length && !String(attuale?.note || "").includes("Comuni serviti (dal sito)")) {
      patch.note = [attuale?.note, `Comuni serviti (dal sito): ${esito.comuni_serviti.join(", ")}`].filter(Boolean).join(" · ").slice(0, 2000);
    }
  }
  const fonti = new Set([...(attuale?.fonti || []), "sito web (lettura automatica)"]);
  patch.fonti = [...fonti];
  const { error: e1 } = await admin.from("mkt_ente").update(patch).eq("id", ente.ente_id);
  if (e1) throw new Error(`Salvataggio: ${e1.message}`);
  const chiave = (ruolo: string, cognome: string | null) => "sito:" + ruolo + ":" + (cognome ? cognome.toLowerCase().replace(/[^a-zà-ù]/g, "") : "ufficio");
  const referenti = ente.tipo === "comune"
    ? esito.uffici.map((u) => ({ ente_id: ente.ente_id, ruolo: u.ruolo, chiave: chiave(u.ruolo, u.cognome), nome: u.nome, cognome: u.cognome, ufficio: u.ufficio, email: u.email, telefono: u.telefono, fonte: u.fonte }))
    : esito.referenti.map((r) => ({ ente_id: ente.ente_id, ruolo: r.ruolo, chiave: chiave(r.ruolo, r.cognome), nome: r.nome, cognome: r.cognome, fonte: r.fonte }));
  const unici = [...new Map(referenti.map((r) => [r.ruolo + "|" + r.chiave, r])).values()];
  if (unici.length) {
    const { error: e2 } = await admin.from("mkt_referente").upsert(unici, { onConflict: "ente_id,ruolo,chiave" });
    if (e2) throw new Error(`Referenti: ${e2.message}`);
  }
  await admin.from("mkt_lettura").update({ stato: "fatto", pagine: urls, esito, errore: null, token_in, token_out, letto_il: new Date().toISOString() }).eq("ente_id", ente.ente_id);
  return { ente: ente.denominazione, pagine: urls.length, email: esito.email, pec: esito.pec, telefono: esito.telefono, referenti: unici.length, token_in, token_out, esito };
}

// Un blocco della coda: fino a 4 enti in parallelo.
async function leggiSiti(admin: ReturnType<typeof createClient>, n: number) {
  const { data: enti, error } = await admin.rpc("mkt_lettura_prendi", { p_n: Math.max(1, Math.min(n, 4)) });
  if (error) throw new Error(error.message);
  const risultati = await Promise.all((enti || []).map(async (e: { ente_id: number; tipo: string; denominazione: string; sito: string; comune_sede: string | null }) => {
    try {
      return { ok: true, ...(await leggiESalva(admin, e)) };
    } catch (err) {
      const msg = String((err as Error)?.message || err).slice(0, 300);
      await admin.from("mkt_lettura").update({ stato: "errore", errore: msg, letto_il: new Date().toISOString() }).eq("ente_id", e.ente_id);
      return { ok: false, ente: e.denominazione, errore: msg };
    }
  }));
  return { letti: risultati.length, risultati };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const azione = String(body.azione || "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---------------- Azioni pubbliche (landing page) ----------------
    if (["visita", "simulata", "richiesta", "disiscrivi"].includes(azione)) {
      return await pubblica(admin, azione, body);
    }

    // ---------------- Lettura dei siti dal lavoro pianificato ----------------
    // Il lavoro pianificato (richiedi_lettura_siti, script 46) manda il codice
    // segreto dell'impostazione mkt_lettura_segreto, non leggibile dal portale.
    if (azione === "leggi_siti" && body.segreto) {
      const { data: imp } = await admin.from("impostazione").select("chiave, valore").in("chiave", ["mkt_lettura_segreto", "mkt_lettura_attiva"]);
      const val = (k: string) => (imp || []).find((x: { chiave: string }) => x.chiave === k)?.valore;
      if (!val("mkt_lettura_segreto") || body.segreto !== val("mkt_lettura_segreto")) return json({ errore: "Non autorizzato" }, 403);
      if (val("mkt_lettura_attiva") !== "si") return json({ letti: 0, nota: "lettura spenta" });
      return json(await leggiSiti(admin, 4));
    }

    // ---------------- Azioni degli Amministratori ----------------
    const autorizzazione = req.headers.get("Authorization") || "";
    const chiamante = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: autorizzazione } } });
    const { data: u } = await chiamante.auth.getUser();
    const { data: eAdmin } = u?.user ? await chiamante.rpc("app_is_admin") : { data: false };
    if (!u?.user || eAdmin !== true) return json({ errore: "Operazione riservata agli amministratori" }, 403);

    if (azione === "importa_comuni") return json(await importaComuni(admin, String(body.fase || "base"), Number(body.da || 0)));
    if (azione === "importa_albo") return json(await importaAlbo(admin, String(body.sezione || ""), Number(body.indice || 0)));
    if (azione === "prova_campagna") return json(await provaCampagna(admin, String(body.campagna || ""), u.user.email || ""));
    if (azione === "leggi_siti") return json(await leggiSiti(admin, Number(body.quanti || 1)));
    if (azione === "invia_campagna") return json(await inviaCampagna(admin, String(body.campagna || ""), Number(body.quanti || 50)));
    return json({ errore: "Azione sconosciuta" }, 400);
  } catch (e) {
    return json({ errore: String((e as Error)?.message || e) }, 500);
  }
});

// ---------------------------------------------------------------------
// Importazione dei Comuni
// ---------------------------------------------------------------------
async function importaComuni(admin: ReturnType<typeof createClient>, fase: string, da: number) {
  if (fase === "base") {
    const r = await fetch(`${PORTALE}/marketing/dati/comuni_istat.json`);
    if (!r.ok) throw new Error(`Elenco ISTAT non raggiungibile (${r.status})`);
    const dati = await r.json();
    const righe = (dati.comuni as [string, string, string, string, string, string, number | null][]).map(([codice, nome, regione, provincia, sigla, cap, pop]) => ({
      tipo: "comune", chiave: `istat:${codice}`, denominazione: `Comune di ${nome}`, codice_istat: codice,
      regione, provincia, sigla, comune_sede: nome, cap: cap || null, popolazione: pop ?? null, fonti: ["ISTAT"],
    }));
    await upsert(admin, "mkt_ente", righe, "chiave");
    return { fatti: righe.length, prossimo: null };
  }

  if (fase === "ipa") {
    const righe = await ipa(`SELECT "Codice_IPA","Denominazione_ente","Codice_fiscale_ente","Nome_responsabile","Cognome_responsabile","Titolo_responsabile","Codice_comune_ISTAT","Indirizzo","Mail1","Tipo_Mail1","Mail2","Tipo_Mail2","Mail3","Tipo_Mail3","Mail4","Tipo_Mail4","Mail5","Tipo_Mail5","Sito_istituzionale" FROM "${IPA_ENTI}" WHERE "Codice_Categoria" = 'L6' LIMIT 20000`);
    const esistenti = await tutte((da, a) => admin.from("mkt_ente").select("id, chiave").eq("tipo", "comune").order("id").range(da, a));
    const perChiave = new Map(esistenti.map((e) => [e.chiave as string, e.id as number]));
    const enti: Record<string, unknown>[] = [];
    const sindaci: Record<string, unknown>[] = [];
    // Nella categoria L6 ci sono anche Unioni, Consorzi e Comunità con il
    // codice ISTAT del Comune sede: per ogni Comune si tiene una sola riga,
    // solo quella dell'ente «Comune …» (o «Città …», «Roma Capitale»): il
    // 23/10/2026 sono 7.891 codici su 8.046 righe L6.
    const eComune = (r: Record<string, unknown>) => /^(comune|citta|città|roma capitale)\b/i.test(String(r.Denominazione_ente || "").trim());
    const perCodice = new Map<string, Record<string, unknown>[]>();
    for (const r of righe) {
      const c = String(r.Codice_comune_ISTAT || "");
      if (!c) continue;
      if (!perCodice.has(c)) perCodice.set(c, []);
      perCodice.get(c)!.push(r);
    }
    const scelte: Record<string, unknown>[] = [];
    for (const gruppo of perCodice.values()) {
      const r = gruppo.find(eComune);
      if (r) scelte.push(r);
    }
    for (const r of scelte) {
      const chiave = `istat:${r.Codice_comune_ISTAT}`;
      const id = perChiave.get(chiave);
      if (!id) continue; // Comune non più esistente nell'elenco ISTAT
      const indirizzi = [1, 2, 3, 4, 5].map((i) => ({ m: mail(r[`Mail${i}`]), tipo: String(r[`Tipo_Mail${i}`] || "") }));
      const pec = indirizzi.find((x) => x.m && /pec/i.test(x.tipo))?.m || null;
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const sito = t(r.Sito_istituzionale);
      enti.push({
        chiave, tipo: "comune", denominazione: t(r.Denominazione_ente) || "Comune", codice_ipa: t(r.Codice_IPA),
        codice_fiscale: t(r.Codice_fiscale_ente), indirizzo: t(r.Indirizzo), pec, email: generica,
        sito: sito ? (sito.startsWith("http") ? sito : `https://${sito}`) : null, fonti: ["ISTAT", "IndicePA"],
      });
      if (t(r.Cognome_responsabile)) {
        sindaci.push({ ente_id: id, ruolo: "sindaco", chiave: "ipa", nome: t(r.Nome_responsabile), cognome: t(r.Cognome_responsabile), ufficio: t(r.Titolo_responsabile), fonte: "IndicePA" });
      }
    }
    // Upsert parziale: solo i campi di IndicePA (la riga ISTAT esiste già).
    for (let i = 0; i < enti.length; i += 500) {
      const blocco = enti.slice(i, i + 500);
      const { error } = await admin.from("mkt_ente").upsert(blocco, { onConflict: "chiave" });
      if (error) throw new Error(`mkt_ente: ${error.message}`);
    }
    await upsert(admin, "mkt_referente", sindaci, "ente_id,ruolo,chiave");
    return { fatti: enti.length, prossimo: null };
  }

  if (fase === "uo") {
    // A blocchi di 400 Comuni (codici IPA già importati), una lettura leggera
    // per blocco: la lettura unica di tutti gli uffici mandava IndicePA in
    // errore. «da» = posizione nell'elenco dei Comuni con codice IPA.
    const BLOCCO = 400;
    const enti = await tutte((da, a) => admin.from("mkt_ente").select("id, codice_ipa, email").eq("tipo", "comune").not("codice_ipa", "is", null).order("id").range(da, a));
    const blocco = enti.slice(da, da + BLOCCO);
    if (!blocco.length) return { fatti: 0, referenti: 0, prossimo: null };
    const codici = blocco.map((e) => `'${String(e.codice_ipa).replace(/'/g, "")}'`).join(",");
    const righe = await ipa(`SELECT u."Codice_IPA",u."Codice_uni_uo",u."Descrizione_uo",u."Nome_responsabile",u."Cognome_responsabile",u."Mail_responsabile",u."Telefono_responsabile",u."Telefono",u."Mail1",u."Tipo_Mail1",u."Mail2",u."Tipo_Mail2",u."Mail3",u."Tipo_Mail3" FROM "${IPA_UO}" u WHERE u."Codice_IPA" IN (${codici}) LIMIT 32000`);
    // deno-lint-ignore no-explicit-any
    const perIpa = new Map(blocco.map((e: any) => [e.codice_ipa as string, e as { id: number; email: string | null }]));
    const referenti: Record<string, unknown>[] = [];
    const emailGeneriche = new Map<number, string>();
    for (const r of righe) {
      const ente = perIpa.get(r.Codice_IPA as string);
      if (!ente) continue;
      const indirizzi = [1, 2, 3].map((i) => ({ m: mail(r[`Mail${i}`]), tipo: String(r[`Tipo_Mail${i}`] || "") }));
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const ruolo = ruoloUfficio(r.Descrizione_uo);
      if (ruolo) {
        const mr = mail(r.Mail_responsabile);
        referenti.push({
          ente_id: ente.id, ruolo, chiave: String(r.Codice_uni_uo || ""), nome: t(r.Nome_responsabile), cognome: t(r.Cognome_responsabile),
          ufficio: t(r.Descrizione_uo), email: mr && !sembraPec(mr) ? mr : generica, telefono: t(r.Telefono_responsabile) || t(r.Telefono), fonte: "IndicePA",
        });
      }
      if (!ente.email && generica && ufficioGenerico(r.Descrizione_uo) && !emailGeneriche.has(ente.id)) emailGeneriche.set(ente.id, generica);
    }
    await upsert(admin, "mkt_referente", referenti, "ente_id,ruolo,chiave");
    for (const [id, email] of emailGeneriche) {
      await admin.from("mkt_ente").update({ email }).eq("id", id).is("email", null);
    }
    return { fatti: righe.length, referenti: referenti.length, prossimo: da + BLOCCO < enti.length ? da + BLOCCO : null };
  }
  throw new Error("Fase sconosciuta");
}

// ---------------------------------------------------------------------
// Importazione dei gestori dall'Albo (categoria 1 ordinaria)
// ---------------------------------------------------------------------
// Una provincia per chiamata (indice nella sezione), per restare nei tempi
// della funzione: la pagina Importazioni ripete finché «prossimo» è null.
async function importaAlbo(admin: ReturnType<typeof createClient>, sezione: string, indice: number) {
  const s = SEZIONI_ALBO[sezione];
  if (!s) throw new Error("Sezione dell'Albo sconosciuta");
  const [regione, tutteLeProvince] = s;
  if (!(indice >= 0 && indice < tutteLeProvince.length)) throw new Error("Provincia fuori elenco");
  const province = [tutteLeProvince[indice]];
  const imprese: Record<string, unknown>[] = [];
  let lette = 0;
  for (const provincia of province) {
    for (let pagina = 1; pagina < 200; pagina++) {
      const r = await fetch(ALBO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: "it", siglaProvincia: provincia, idRegione: Number(sezione), includiCP: false, paginaCorrente: pagina, risultatiPerPagina: 100 }),
      });
      if (!r.ok) throw new Error(`Albo non raggiungibile (${r.status}) per ${provincia}`);
      const j = await r.json();
      const lista = (j.ListaImprese || []) as Record<string, string>[];
      lette += lista.length;
      for (const i of lista) {
        const categorie = String(i.Categorie || "");
        if (!categorie.split(",").some((c) => /^1o(\s|$)/i.test(c.trim()))) continue;
        imprese.push({
          tipo: "gestore", chiave: `albo:${i.Sezione}/${i.NumeroIscrizione}`, denominazione: t(i.Denominazione) || "Impresa",
          codice_fiscale: t(i.CodiceFiscale), comune_sede: t(i.Comune), indirizzo: t(i.Via), cap: t(i.Cap), sigla: t(i.SiglaProvincia),
          regione, provincia: provincia, albo_numero: `${i.Sezione}/${i.NumeroIscrizione}`, albo_categorie: categorie, fonti: ["Albo Gestori Ambientali"],
        });
      }
      if (lista.length < 100) break;
    }
  }
  await upsert(admin, "mkt_ente", imprese, "chiave");
  // Gestori pubblici in IndicePA (stesso codice fiscale): PEC, email, sito.
  const cf = [...new Set(imprese.map((i) => i.codice_fiscale).filter(Boolean))] as string[];
  let daIpa = 0;
  let ipaAssente = false;
  for (let i = 0; i < cf.length && !ipaAssente; i += 300) {
    const elenco = cf.slice(i, i + 300).map((c) => `'${c.replace(/'/g, "")}'`).join(",");
    // IndicePA a volte risponde «App offline»: le imprese restano salvate e
    // i dati pubblici si aggiungono ripetendo l'importazione più tardi.
    let righe: Record<string, string | null>[] = [];
    try {
      righe = await ipa(`SELECT "Codice_fiscale_ente","Mail1","Tipo_Mail1","Mail2","Tipo_Mail2","Mail3","Tipo_Mail3","Sito_istituzionale" FROM "${IPA_ENTI}" WHERE "Codice_fiscale_ente" IN (${elenco})`);
    } catch {
      ipaAssente = true;
    }
    for (const r of righe) {
      const indirizzi = [1, 2, 3].map((k) => ({ m: mail(r[`Mail${k}`]), tipo: String(r[`Tipo_Mail${k}`] || "") }));
      const pec = indirizzi.find((x) => x.m && /pec/i.test(x.tipo))?.m || null;
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const sito = t(r.Sito_istituzionale);
      const { error } = await admin.from("mkt_ente").update({
        pec, ...(generica ? { email: generica } : {}), ...(sito ? { sito: sito.startsWith("http") ? sito : `https://${sito}` } : {}),
        natura: "pubblico", fonti: ["Albo Gestori Ambientali", "IndicePA"],
      }).eq("tipo", "gestore").eq("codice_fiscale", r.Codice_fiscale_ente as string);
      if (!error) daIpa++;
    }
  }
  return {
    regione, provincia: province[0], lette, categoria_1o: imprese.length, con_dati_ipa: daIpa, ipa_non_disponibile: ipaAssente,
    prossimo: indice + 1 < tutteLeProvince.length ? indice + 1 : null, province: tutteLeProvince.length,
  };
}

// ---------------------------------------------------------------------
// Campagne
// ---------------------------------------------------------------------
async function spedisci(a: { to: string; oggetto: string; html: string; testo: string; token: string }) {
  if (!RESEND_API_KEY) return { ok: false, errore: "RESEND_API_KEY non impostata" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MITTENTE, to: [a.to], subject: a.oggetto, html: a.html, text: a.testo,
      headers: { "List-Unsubscribe": `<${PORTALE}/scopri/disiscrizione?c=${a.token}>` },
    }),
  });
  const esito = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, errore: esito?.message || `errore ${r.status}` };
}

async function provaCampagna(admin: ReturnType<typeof createClient>, id: string, email: string) {
  const { data: c } = await admin.from("mkt_campagna").select("*").eq("id", id).single();
  if (!c) throw new Error("Campagna non trovata");
  const dati = { portale: PORTALE, grafica: c.grafica, oggetto: c.oggetto, testo: c.testo, ente: "Comune di Prova (email di prova)", token: "prova" };
  const esito = await spedisci({ to: email, oggetto: `[PROVA] ${c.oggetto}`, html: htmlCampagna(dati), testo: testoCampagna(dati), token: "prova" });
  return { ...esito, a: email };
}

async function inviaCampagna(admin: ReturnType<typeof createClient>, id: string, quanti: number) {
  const { data: c } = await admin.from("mkt_campagna").select("*").eq("id", id).single();
  if (!c) throw new Error("Campagna non trovata");
  if (c.stato === "inviata") return { inviati: 0, errori: 0, restano: 0 };
  if (c.stato === "bozza") await admin.from("mkt_campagna").update({ stato: "in_invio" }).eq("id", id);
  const { data: invii } = await admin.from("mkt_invio").select("id, email, token, ente:ente_id (denominazione)")
    .eq("campagna_id", id).eq("stato", "da_inviare").limit(Math.min(Math.max(quanti, 1), 50));
  const { data: disiscritti } = await admin.from("mkt_disiscrizione").select("email").in("email", (invii || []).map((i) => i.email));
  const esclusi = new Set((disiscritti || []).map((d) => d.email));
  let inviati = 0, errori = 0;
  for (const i of invii || []) {
    if (esclusi.has(i.email) || sembraPec(i.email)) {
      await admin.from("mkt_invio").update({ stato: "escluso", errore: sembraPec(i.email) ? "indirizzo PEC" : "disiscritto" }).eq("id", i.id);
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const ente = (i as any).ente?.denominazione || "Ente";
    const dati = { portale: PORTALE, grafica: c.grafica, oggetto: c.oggetto, testo: c.testo, ente, token: i.token };
    const esito = await spedisci({ to: i.email, oggetto: c.oggetto, html: htmlCampagna(dati), testo: testoCampagna(dati), token: i.token });
    if (esito.ok) inviati++; else errori++;
    await admin.from("mkt_invio").update(esito.ok ? { stato: "inviato", inviato_il: new Date().toISOString(), errore: null } : { stato: "errore", errore: esito.errore }).eq("id", i.id);
    await new Promise((r) => setTimeout(r, 600)); // limite di Resend: 2 richieste al secondo
  }
  const { count } = await admin.from("mkt_invio").select("id", { count: "exact", head: true }).eq("campagna_id", id).eq("stato", "da_inviare");
  if (!count) await admin.from("mkt_campagna").update({ stato: "inviata", inviata_il: new Date().toISOString() }).eq("id", id);
  return { inviati, errori, restano: count || 0 };
}

// ---------------------------------------------------------------------
// Azioni pubbliche della landing page
// ---------------------------------------------------------------------
async function pubblica(admin: ReturnType<typeof createClient>, azione: string, body: Record<string, unknown>) {
  const token = String(body.token || "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? token : null;
  const invio = uuid
    ? (await admin.from("mkt_invio").select("id, email, ente_id, visitato_il, simulato_il, ente:ente_id (denominazione, tipo, popolazione)").eq("token", uuid).maybeSingle()).data
    : null;

  if (azione === "visita") {
    if (invio && !invio.visitato_il) await admin.from("mkt_invio").update({ visitato_il: new Date().toISOString() }).eq("id", invio.id);
    // deno-lint-ignore no-explicit-any
    const e = (invio as any)?.ente;
    return json({ ente: e?.denominazione || null, tipo: e?.tipo || null, popolazione: e?.popolazione ?? null });
  }
  if (azione === "simulata") {
    if (invio && !invio.simulato_il) await admin.from("mkt_invio").update({ simulato_il: new Date().toISOString() }).eq("id", invio.id);
    return json({ ok: true });
  }
  if (azione === "disiscrivi") {
    if (!invio) return json({ ok: false, errore: "Collegamento non valido." }, 404);
    await admin.from("mkt_disiscrizione").upsert({ email: invio.email, ente_id: invio.ente_id }, { onConflict: "email" });
    return json({ ok: true });
  }
  if (azione === "richiesta") {
    // Campo trappola: i robot lo compilano, le persone non lo vedono.
    if (t(body.sito_web)) return json({ ok: true });
    const ente = t(body.ente), referente = t(body.referente), email = mail(body.email);
    if (!ente || ente.length < 2 || !referente || referente.length < 2 || !email) {
      return json({ ok: false, errore: "Indica ente, nome e cognome ed email validi." }, 400);
    }
    const ora = new Date(Date.now() - 3600_000).toISOString();
    const { count: perEmail } = await admin.from("mkt_richiesta").select("id", { count: "exact", head: true }).eq("email", email).gte("creato_il", ora);
    const { count: tutte } = await admin.from("mkt_richiesta").select("id", { count: "exact", head: true }).gte("creato_il", ora);
    if ((perEmail || 0) >= 3 || (tutte || 0) >= 30) return json({ ok: false, errore: "Troppe richieste: riprova più tardi o scrivi a info@carbonwasteprint.com." }, 429);
    const simulazione = body.simulazione && typeof body.simulazione === "object" ? body.simulazione : null;
    const { error } = await admin.from("mkt_richiesta").insert({
      invio_id: invio?.id || null, ente_id: invio?.ente_id || null, ente: ente.slice(0, 200), referente: referente.slice(0, 200),
      ruolo: t(body.ruolo)?.slice(0, 200) || null, email, telefono: t(body.telefono)?.slice(0, 60) || null,
      messaggio: t(body.messaggio)?.slice(0, 4000) || null, simulazione,
    });
    if (error) return json({ ok: false, errore: "Richiesta non salvata: riprova." }, 500);
    if (invio) await admin.from("mkt_invio").update({ richiesta_il: new Date().toISOString() }).eq("id", invio.id);
    // A tutti gli Amministratori attivi: notifica nel portale ed email.
    const { data: ammin } = await admin.from("profilo").select("id").eq("ruolo", "admin").eq("attivo", true);
    // deno-lint-ignore no-explicit-any
    const s = simulazione as any;
    const riepilogo = s?.totali ? ` Simulazione: ${s.anni_durata || ""} anni, margine stimato ${Math.round(s.totali.margine).toLocaleString("it-IT")} €.` : "";
    await admin.rpc("cwp_notifica", {
      p_destinatari: (ammin || []).map((a) => a.id), p_pratica: null, p_evento: "richiesta_registrazione",
      p_titolo: `Richiesta di registrazione: ${ente}`,
      p_testo: `${referente}${t(body.ruolo) ? ` (${t(body.ruolo)})` : ""} · ${email}${t(body.telefono) ? ` · ${t(body.telefono)}` : ""}.${riepilogo} Dettagli in Marketing → Richieste.`,
    });
    return json({ ok: true });
  }
  return json({ errore: "Azione sconosciuta" }, 400);
}
