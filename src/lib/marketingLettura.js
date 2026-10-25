/* =========================================================================
   marketingLettura.js — regole del «lettore dei siti» della sezione
   Marketing (richiesta di Luca Moretti del 25/10/2026: «devi cercare nei
   singoli siti internet di ogni gestore e comune»).
   Il lettore gira nella funzione del server «marketing» (azioni
   leggi_siti e prova_lettura, script 46): per ogni ente con sito legge la
   home page e le pagine di contatti, uffici, amministrazione trasparente e
   organigramma (rispettando robots.txt, una pagina alla volta), prepara un
   estratto del testo e chiede a Claude di trovare email generica, PEC,
   telefono, uffici tributi e ambiente con i responsabili (Comuni) oppure
   Comuni serviti, tariffa, direttori e amministratori (gestori). Ogni dato
   è accettato solo se compare davvero nel testo letto (controlloEsito).
   Le funzioni tra INIZIO-LETTURA-SITI e FINE-LETTURA-SITI sono copie
   IDENTICHE nella funzione del server (controllo in test/marketing.test.mjs).
   Registro sviluppo e deploy: capitolo 16 «Marketing».
   ========================================================================= */

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

const PAROLE_UTILI = /tribut|entrate|\btari\b|ambient|ecolog|rifiut|igiene|responsabil|dirigent|direttor|amministrator|presidente|consiglier|\bpec\b|e-?mail|posta|tel\.?|telefon|centralino|@|sede|uffici|settore|area |servizi|raccolta|tariff|comuni (soci|serviti)|bacino|igiene urbana|capitale sociale|partita iva|p\.? ?iva/i;

// Estratto del testo da mandare a Claude: righe con parole utili (più una
// riga prima e una dopo), per ogni pagina al massimo maxPagina caratteri,
// in tutto al massimo maxTotale.
export function estratto(pagine, maxPagina = 3500, maxTotale = 14000) {
  let out = "";
  for (const p of pagine) {
    const righe = String(p.testo || "").split("\n");
    const tieni = new Set();
    righe.forEach((r, i) => { if (PAROLE_UTILI.test(r)) { tieni.add(i - 1); tieni.add(i); tieni.add(i + 1); } });
    let parte = [...tieni].filter((i) => i >= 0 && i < righe.length).sort((a, b) => a - b).map((i) => righe[i].slice(0, 300)).join("\n");
    if (!parte) parte = righe.slice(0, 15).join("\n");
    parte = parte.slice(0, maxPagina);
    const blocco = `\n=== PAGINA: ${p.url} ===\n${parte}\n`;
    if (out.length + blocco.length > maxTotale) { out += blocco.slice(0, Math.max(0, maxTotale - out.length)); break; }
    out += blocco;
  }
  return out.trim();
}

// Tutte le email presenti nel testo (minuscole, senza doppioni).
export function emailNelTesto(testo) {
  const m = String(testo || "").toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  return [...new Set(m.map((e) => e.replace(/\.$/, "")))];
}

const RE_PEC = /@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura|certimprese|certifymail|cgn\.legalmail|pec\.it))/i;

// Controlla la risposta di Claude contro il testo letto: tiene solo email,
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
