/* =========================================================================
   marketingLettura.js — regole del «lettore dei siti» della sezione
   Marketing (richiesta di Luca Moretti del 25/10/2026: «devi cercare nei
   singoli siti internet di ogni gestore e comune»).
   Il lettore gira nella funzione del server «marketing» (azione
   leggi_siti, script 46): per ogni ente con sito legge la home page e le
   pagine di contatti, uffici, amministrazione trasparente e organigramma
   (rispettando robots.txt, una pagina alla volta) e riconosce con REGOLE
   FISSE (estraiDati, nessun servizio a pagamento: scelta di Luca del
   25/10/2026) email generica, PEC, telefono, uffici tributi e ambiente con
   i responsabili (Comuni) oppure Comuni serviti, tariffa, direttori e
   amministratori (gestori). Ogni dato è accettato solo se compare davvero
   nel testo letto (controlloEsito).
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

// Dominio «di base» del sito: ultimi due livelli (cemambiente.it), tre
// quando il penultimo è una sigla di provincia o «gov» (desio.mb.it).
export function dominioBase(host) {
  const p = String(host || "").toLowerCase().replace(/^www\./, "").split(".");
  if (p.length <= 2) return p.join(".");
  // Domini come comune.desio.mb.it o comune.x.gov.it: la sigla di provincia
  // (due lettere) o «gov» non bastano come dominio dell'ente.
  const secondo = p[p.length - 2];
  return (secondo.length === 2 || ["gov", "edu", "comune"].includes(secondo)) && p.length >= 3 ? p.slice(-3).join(".") : p.slice(-2).join(".");
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
const NON_NOMI = new Set(["area", "settore", "servizio", "servizi", "ufficio", "uffici", "comune", "tributi", "tributo", "entrate", "ambiente", "ecologia", "responsabile", "dirigente", "del", "della", "dello", "dei", "delle", "di", "e", "posta", "telefono", "tel", "email", "mail", "pec", "orari", "orario", "sede", "via", "piazza", "dott", "dott.ssa", "dr", "ing", "arch", "geom", "rag", "avv", "sig", "sig.ra", "segretario", "generale", "tecnico", "direttore", "presidente", "consiglio", "amministrazione", "amministratore", "delegato", "unico", "società", "spa", "srl", "s.p.a.", "s.r.l.", "lavori", "pubblici", "polizia", "locale", "finanziario", "economico", "gestione", "rifiuti", "tari", "igiene", "urbana", "nessuno", "vacante", "contatti", "home", "chi", "siamo", "capitale", "sociale", "versato", "partita", "iva", "codice", "fiscale", "registro", "imprese", "numero", "verde", "euro", "legale", "operativa", "collegio", "sindacale", "revisore", "revisori", "organismo", "vigilanza", "trasparenza", "anticorruzione", "bilancio", "nomina", "curriculum", "compensi", "comunicato", "stampa"]);
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
  // Solo email sul dominio dell'ente (es. non info@gestore.it sul sito del Comune).
  const generica = ordinarie.find((t) => preferite.test(t.email) && sulDominio(t)) || null;
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
          if (!re.test(r) || r.length > 120) return;
          // La finestra va dalla riga dell'ufficio alle 4 seguenti, e si
          // ferma dove comincia l'altro ufficio.
          const parte = [r];
          for (let k = i + 1; k < Math.min(righe.length, i + 5); k++) {
            if (altri.some((y) => y.test(righe[k]))) break;
            parte.push(righe[k]);
          }
          const finestra = parte.join("\n");
          const emails = (finestra.match(RE_EMAIL) || []).map((e) => e.toLowerCase()).filter((e) => !RE_PEC.test(e) && !ESCLUSE.test(e));
          const proprie = emails.filter((e) => !dominio || e.endsWith("@" + dominio) || e.endsWith("." + dominio));
          const email = proprie.find((e) => re.test(e.split("@")[0])) || proprie[0] || null;
          const tel = (finestra.match(RE_TEL) || [])[1] || null;
          let persona = null;
          const et = finestra.match(ETICHETTA_COMUNE);
          if (et) persona = nomeDopo(finestra.slice(et.index + et[0].length, et.index + et[0].length + 80));
          const punti = (email ? 2 : 0) + (persona ? 2 : 0) + (tel ? 1 : 0) + (email && re.test(email.split("@")[0]) ? 2 : 0) + (r.includes("@") ? 0 : 1);
          if (punti > 0 && (!migliore || punti > migliore.punti)) {
            // Nome dell'ufficio solo se la riga è un titolo (corta, senza recapiti).
            const titolo = r.length <= 80 && !/@|tel|e-?mail|\bpec\b|\d{5,}/i.test(r) ? r : null;
            migliore = { punti, ruolo, ufficio: titolo, nome: persona?.nome || null, cognome: persona?.cognome || null, email, telefono: tel ? tel.trim() : null, fonte: p.url };
          }
        });
      }
      // Email dell'ufficio riconoscibile dal nome (es. tributi@comune.x.it).
      if (!migliore || !migliore.email) {
        const t = ordinarie.find((x) => re.test(x.email.split("@")[0]) && sulDominio(x));
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
