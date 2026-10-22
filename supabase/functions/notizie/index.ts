// =====================================================================
//  Edge Function: notizie
//  Scopo: osservatorio News per gli Amministratori (richiesta di Luca
//  Moretti del 21/10/2026). Ogni 2 ore cerca notizie sul mondo dei crediti
//  di carbonio volontari (mercato volontario, marketplace e borse, prezzi
//  dei crediti scambiati o venduti, standard e registri, regole, progetti,
//  in particolare rifiuti ed economia circolare), le fa valutare a Claude
//  e salva nella tabella notizia (script 36) solo il giudizio: attinente o
//  no, categoria, rilevanza, titolo e sintesi in italiano, prezzi citati.
//
//  Chi la chiama:
//   - il lavoro pg_cron «cwp_notizie» ogni 2 ore (funzione SQL
//     richiedi_aggiornamento_notizie, con pg_net, SENZA autorizzazione):
//     la ricerca parte in sottofondo e la risposta è immediata;
//   - un Amministratore dalla pagina /news («Aggiorna ora», con il suo
//     token): la risposta arriva a ricerca finita.
//  Verify JWT è DISATTIVATO (la chiamata pianificata non ha token). Per
//  questo la funzione non si fida di chi chiama: il database
//  (notizie_puo_partire, script 36) ammette al massimo una ricerca ogni
//  100 minuti senza token di Amministratore, ogni 10 minuti con il token:
//  una chiamata esterna non può far spendere crediti di Claude. La
//  funzione non riceve dati da salvare: legge solo i canali pubblici
//  (elenco CANALI) e scrive con la chiave di servizio.
//
//  Passi: 1) legge i canali RSS (Bing News, siti specializzati e siti di
//  notizie ambientali; Google News non si usa: rifiuta i server di
//  Supabase con 503 e il tramite in Google Apps Script è bloccato
//  dall'account Google, ISS-036);
//  2) toglie le notizie già viste (stesso indirizzo o stesso titolo) e
//  quelle più vecchie di 10 giorni; 3) pre-filtro sulle parole chiave;
//  4) Claude valuta a gruppi di 25 (massimo 100 notizie per ricerca, le
//  più recenti); 5) salva tutte le notizie valutate (anche le scartate,
//  per non rivalutarle) e chiude il registro notizie_esecuzione.
//
//  Costi: modello predefinito Claude Haiku 5.5 (NOTIZIE_MODELLO per
//  cambiarlo); solo titoli ed estratti brevi, poche migliaia di token per
//  ricerca. Stessa chiave dell'assistente (ANTHROPIC_API_KEY).
//
//  Segreti: ANTHROPIC_API_KEY (già presente per l'assistente); facoltativo
//  NOTIZIE_MODELLO; automatici SUPABASE_URL, SUPABASE_ANON_KEY,
//  SUPABASE_SERVICE_ROLE_KEY.
//  Usato da: script 36 (lavoro pianificato); src/lib/dati.js →
//  aggiornaNotizie(), pagina src/pages/News.jsx.
//  Pubblicazione: dashboard Supabase → Edge Functions → «notizie»;
//  Verify JWT DISATTIVATO.
//  Le funzioni pure (canali, lettura RSS, filtro, lettura della risposta)
//  sono COPIATE identiche da src/lib/notizie.js (prova in
//  test/notizie.test.mjs).
//  Registro sviluppo e deploy: capitolo 5 «Edge Functions»; script 36.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GRUPPO = 25; // notizie per chiamata a Claude
const MASSIMO = 100; // notizie valutate per ricerca
const GIORNI = 10; // notizie più vecchie: ignorate

// INIZIO funzioni notizie
// Ricerca su Bing News (feed RSS pubblico), ultima settimana. Google News
// non si usa: blocca ogni richiesta dai server di Supabase (503, pagina
// «Sorry…») e il tramite in Google Apps Script è stato bloccato dalla
// protezione dell'account Google (ISS-036, 21/10/2026).
const bingNews = (q, lingua) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&qft=${encodeURIComponent('interval="7"')}&format=rss` +
  (lingua === "it" ? "&setlang=it-IT&cc=IT" : "&setlang=en-US&cc=US");

// Canali dell'osservatorio: { nome, url, lingua, generale? }. «generale» =
// sito di notizie ambientali in genere: passa al filtro di Claude solo ciò
// che parla espressamente di crediti o mercati del carbonio (PAROLE_STRETTE).
// Le ricerche coprono i
// temi chiesti da Luca: mercato volontario, marketplace e borse, prezzi dei
// crediti scambiati o venduti, standard e registri, regole, progetti
// (anche rifiuti ed economia circolare, il settore del Programma CWP).
const CANALI = [
  { nome: "Bing News · crediti di carbonio", lingua: "it", url: bingNews('"crediti di carbonio"', "it") },
  { nome: "Bing News · mercato volontario del carbonio", lingua: "it", url: bingNews('"mercato volontario" carbonio', "it") },
  { nome: "Bing News · prezzo dei crediti di carbonio", lingua: "it", url: bingNews('"crediti di carbonio" prezzo', "it") },
  { nome: "Bing News · crediti di carbonio e rifiuti", lingua: "it", url: bingNews('"crediti di carbonio" rifiuti', "it") },
  { nome: "Bing News · registro dei crediti di carbonio", lingua: "it", url: bingNews('registro "crediti di carbonio"', "it") },
  { nome: "Bing News · voluntary carbon market", lingua: "en", url: bingNews('"voluntary carbon market"', "en") },
  { nome: "Bing News · carbon credit prices", lingua: "en", url: bingNews('"carbon credits" price', "en") },
  { nome: "Bing News · carbon credit marketplaces", lingua: "en", url: bingNews('"carbon credit" marketplace OR exchange', "en") },
  { nome: "Bing News · standards and registries", lingua: "en", url: bingNews('Verra OR "Gold Standard" OR ICVCM "carbon credits"', "en") },
  { nome: "Bing News · carbon removal credits", lingua: "en", url: bingNews('"carbon removal credits"', "en") },
  { nome: "Bing News · Article 6 and CORSIA", lingua: "en", url: bingNews('"Article 6" OR CORSIA "carbon credits"', "en") },
  { nome: "Bing News · waste carbon credits", lingua: "en", url: bingNews('"carbon credits" waste OR recycling OR landfill', "en") },
  { nome: "Carbon Herald", lingua: "en", url: "https://carbonherald.com/feed/" },
  { nome: "CarbonCredits.com", lingua: "en", url: "https://carboncredits.com/feed/" },
  { nome: "Ecosystem Marketplace", lingua: "en", url: "https://www.ecosystemmarketplace.com/feed/" },
  { nome: "Verra", lingua: "en", url: "https://verra.org/feed/" },
  // Siti di notizie ambientali (dal 21/10/2026, al posto di Google News).
  // Rinnovabili.it rifiuta i server (403) e il feed di GreenReport non
  // esiste più (404): i due siti si leggono attraverso Bing News, che dai
  // server di Supabase risponde (22/10/2026).
  { nome: "Rinnovabili.it (via Bing)", lingua: "it", generale: true, url: bingNews("site:rinnovabili.it carbonio OR emissioni OR CO2", "it") },
  { nome: "QualEnergia", lingua: "it", generale: true, url: "https://www.qualenergia.it/feed/" },
  { nome: "GreenReport (via Bing)", lingua: "it", generale: true, url: bingNews("site:greenreport.it carbonio OR emissioni OR CO2", "it") },
  { nome: "ESGnews", lingua: "it", generale: true, url: "https://www.esgnews.it/feed/" },
  { nome: "LifeGate", lingua: "it", generale: true, url: "https://www.lifegate.it/feed" },
  { nome: "Climate Home News", lingua: "en", generale: true, url: "https://www.climatechangenews.com/feed/" },
  { nome: "edie", lingua: "en", generale: true, url: "https://www.edie.net/feed/" },
  { nome: "BusinessGreen", lingua: "en", generale: true, url: "https://www.businessgreen.com/feeds/rss" },
];

// Categorie (stessi valori del vincolo della tabella notizia, script 36).
const CATEGORIE = {
  prezzi: "Prezzi e scambi",
  marketplace: "Marketplace e borse",
  standard_registri: "Standard e registri",
  regole: "Regole e politiche",
  progetti: "Progetti",
  mercato: "Mercato e domanda",
  altro: "Altro",
};

// Entità XML/HTML più comuni (&amp; per ultima: «&amp;lt;» → «&lt;»).
function entita(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

// Testo semplice da un frammento XML/HTML: CDATA, entità e tag. Nei feed
// l'HTML dell'estratto arriva spesso «escapato» (&lt;a&gt;…): prima si
// decodificano le entità, poi si tolgono i tag, poi le entità rimaste.
function testoPulito(s) {
  const t = entita(String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
  return entita(t.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// Contenuto del primo tag <nome> di un blocco (testo grezzo).
function tag(blocco, nome) {
  const m = blocco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i"));
  return m ? m[1] : "";
}

// I link di Bing News passano da un rimando (bing.com/news/apiclick.aspx
// ?…&url=<indirizzo>): si tiene l'indirizzo dell'articolo.
function indirizzoVero(link) {
  try {
    const u = new URL(link);
    const vero = u.hostname.endsWith("bing.com") ? u.searchParams.get("url") : null;
    return vero && /^https?:\/\//i.test(vero) ? vero : link;
  } catch {
    return link;
  }
}

/* Legge un feed RSS 2.0. Parametri: xml (testo), canale ({ nome, lingua }).
   Restituisce [{ titolo, url, fonte, pubblicata_il (ISO o null), estratto,
   lingua, ricerca }]. Nei feed di Google News il titolo finisce con
   « - Testata»: la testata si toglie dal titolo e va in «fonte». */
function leggiRss(xml, canale = {}) {
  const out = [];
  const blocchi = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocchi) {
    let titolo = testoPulito(tag(b, "title"));
    const url = indirizzoVero(testoPulito(tag(b, "link")) || testoPulito(tag(b, "guid")));
    if (!titolo || !/^https?:\/\//i.test(url)) continue;
    // Testata: dal tag <source> (Google News) o <News:Source> (Bing News),
    // altrimenti il nome del sito.
    const sorgente = testoPulito(tag(b, "source")) || testoPulito(tag(b, "News:Source"));
    const fonte = sorgente || canale.nome || "";
    if (sorgente) {
      const suffisso = ` - ${fonte}`;
      if (titolo.endsWith(suffisso)) titolo = titolo.slice(0, -suffisso.length).trim();
    }
    const data = Date.parse(testoPulito(tag(b, "pubDate")));
    out.push({
      titolo,
      url,
      fonte,
      pubblicata_il: Number.isFinite(data) ? new Date(data).toISOString() : null,
      estratto: testoPulito(tag(b, "description")).slice(0, 400),
      lingua: canale.lingua || null,
      ricerca: canale.nome || null,
      generale: !!canale.generale,
    });
  }
  return out;
}

// Titolo normalizzato: minuscole, senza accenti né punteggiatura, al
// massimo 140 caratteri. Due ricerche che trovano lo stesso articolo
// danno la stessa chiave (colonna unica notizia.chiave).
function chiaveTitolo(titolo) {
  return String(titolo || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 140);
}

// Parole che una notizia attinente contiene quasi sempre (titolo o
// estratto). Chi non ne ha nessuna non arriva a Claude.
const PAROLE_CHIAVE = [
  "carbon", "carbonio", "co2", "credit", "crediti", "offset", "compensazion", "verra", "gold standard", "icvcm", "vcmi",
  "corsia", "article 6", "articolo 6", "removal", "assorbiment", "net zero", "net-zero", "emission", "emissioni", "puro.earth", "isometric",
];
// Per i siti di notizie ambientali in genere (canali «generale») servono
// parole più strette: crediti, compensazioni, mercati del carbonio.
const PAROLE_STRETTE = [
  "carbon credit", "crediti di carbonio", "credito di carbonio", "carbon market", "mercato del carbonio", "mercati del carbonio",
  "offset", "compensazion", "verra", "gold standard", "icvcm", "vcmi", "corsia", "article 6", "articolo 6", "removal credit",
  "crediti volontari", "voluntary carbon", "carbon removal", "assorbimenti di carbonio", "crcf",
];
function preFiltro(n) {
  const t = `${n.titolo || ""} ${n.estratto || ""}`.toLowerCase();
  return (n.generale ? PAROLE_STRETTE : PAROLE_CHIAVE).some((p) => t.includes(p));
}

/* Legge la risposta di Claude: un oggetto JSON { valutazioni: [...] }
   anche se il testo ha parole prima o dopo. Ogni valutazione: { i,
   attinente, categoria, rilevanza, titolo_it, sintesi, prezzi, motivo }.
   Valori fuori elenco corretti (categoria → "altro", rilevanza 1-5).
   Restituisce un array (vuoto se il testo non si legge). */
function leggiValutazioni(testo) {
  const s = String(testo || "");
  const a = s.indexOf("{");
  const z = s.lastIndexOf("}");
  if (a < 0 || z <= a) return [];
  let dati;
  try {
    dati = JSON.parse(s.slice(a, z + 1));
  } catch {
    return [];
  }
  const elenco = Array.isArray(dati?.valutazioni) ? dati.valutazioni : [];
  return elenco
    .filter((v) => Number.isInteger(v?.i))
    .map((v) => ({
      i: v.i,
      attinente: v.attinente === true,
      categoria: Object.prototype.hasOwnProperty.call(CATEGORIE, v.categoria) ? v.categoria : "altro",
      rilevanza: Math.min(5, Math.max(1, Math.round(Number(v.rilevanza) || 1))),
      titolo_it: String(v.titolo_it || "").slice(0, 300) || null,
      sintesi: String(v.sintesi || "").slice(0, 1200) || null,
      prezzi: String(v.prezzi || "").slice(0, 400) || null,
      motivo: String(v.motivo || "").slice(0, 300) || null,
    }));
}
// FINE funzioni notizie

// Istruzioni per Claude: cosa è attinente all'osservatorio.
const ISTRUZIONI = `Sei l'analista dell'osservatorio News del Portale Carbon WastePrint (CWP) di Fondazione Operate.
Il Programma CWP genera crediti di carbonio VOLONTARI dalla riduzione dei rifiuti urbani prodotti dai Comuni (prevenzione, riuso, raccolta differenziata, tariffa puntuale).
Gli Amministratori vogliono restare aggiornati sul mondo dei crediti di carbonio volontari.

Per ogni notizia decidi se è ATTINENTE. È attinente solo se parla in modo specifico di:
- mercato volontario dei crediti di carbonio (domanda, offerta, volumi, report di mercato, acquisti di crediti da parte di aziende o enti);
- prezzi o valori unitari di crediti scambiati o venduti, indici di prezzo, aste;
- marketplace, borse e piattaforme di scambio dei crediti (es. Xpansiv CBL, AirCarbon Exchange, Climate Impact X, Carbonplace, piattaforme di acquisto);
- standard, metodologie e registri dei crediti (es. Verra, Gold Standard, ICVCM, VCMI, Puro.earth, Isometric, registri nazionali come il registro italiano dei crediti di carbonio);
- regole e politiche che toccano i crediti volontari (Articolo 6 dell'Accordo di Parigi, CORSIA, regolamento UE CRCF sugli assorbimenti, norme sulle dichiarazioni di neutralità climatica legate ai crediti);
- progetti che generano crediti di carbonio, soprattutto nel settore dei rifiuti e dell'economia circolare;
- integrità, qualità, controversie o frodi sui crediti di carbonio.
NON è attinente: il solo mercato regolato EU ETS o altri sistemi obbligatori senza legame con i crediti volontari; certificati verdi o bianchi del GSE, garanzie d'origine e altri certificati dell'energia (strumenti diversi dai crediti di carbonio); notizie generiche su clima, energia, ESG o emissioni senza crediti di carbonio; pubblicità, offerte di lavoro, quotazioni di azioni non legate ai crediti.

Per ogni notizia restituisci:
- i: il numero ricevuto;
- attinente: true o false;
- categoria: una tra "prezzi", "marketplace", "standard_registri", "regole", "progetti", "mercato", "altro";
- rilevanza: da 1 a 5 (5 = impatto diretto sul Programma CWP: crediti dal settore dei rifiuti, mercato italiano, prezzi di crediti simili; 1 = marginale);
- titolo_it: il titolo in italiano (tradotto se serve, senza il nome della testata);
- sintesi: 2 o 3 frasi in italiano semplice su cosa dice la notizia, solo dai dati ricevuti, senza inventare;
- prezzi: i valori unitari citati nel titolo o nell'estratto (es. "0,45 $/t CO2 per N-GEO su CBL"), altrimenti "";
- motivo: una frase breve sul perché è o non è attinente.
Rispondi SOLO con un oggetto JSON: {"valutazioni":[...]} senza testo prima o dopo.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Diagnosi dei canali (21/10/2026, ISS-036): con { "diagnosi": true }
    // la funzione prova a leggere alcuni indirizzi con intestazioni diverse
    // e restituisce esito HTTP e inizio della risposta. Non usa Claude e non
    // scrive nulla nel database.
    const corpo = await req.clone().json().catch(() => ({}));
    if (corpo?.diagnosi === true) return json(await diagnosiCanali());

    // Chi chiama: con un token valido di Amministratore (verifica a due
    // fattori compresa, app_is_admin) è una richiesta manuale.
    let utenteId: string | null = null;
    const autorizzazione = req.headers.get("Authorization") || "";
    if (autorizzazione.startsWith("Bearer ") && autorizzazione.slice(7) !== ANON_KEY) {
      const chiamante = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: autorizzazione } } });
      const { data: u } = await chiamante.auth.getUser();
      if (u?.user) {
        const { data: eAdmin } = await chiamante.rpc("app_is_admin");
        if (eAdmin !== true) return json({ error: "La sezione News è riservata agli Amministratori." }, 403);
        utenteId = u.user.id;
      }
    }
    const manuale = !!utenteId;

    const { data: esecuzione, error: errPartenza } = await admin.rpc("notizie_puo_partire", { p_manuale: manuale, p_utente: utenteId });
    if (errPartenza) {
      console.error("notizie_puo_partire", errPartenza.message);
      return json({ error: "Il database non è pronto per le News (script 36)." }, 503);
    }
    if (!esecuzione) {
      return json({ saltata: true, motivo: manuale ? "Ultima ricerca meno di 10 minuti fa: riprova tra poco." : "Ultima ricerca troppo recente." });
    }

    const lavoro = cerca(admin, esecuzione as number);
    if (!manuale) {
      // Chiamata pianificata: si risponde subito, la ricerca continua.
      // @ts-ignore EdgeRuntime esiste nell'ambiente di Supabase
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(lavoro);
      else await lavoro;
      return json({ avviata: true, esecuzione });
    }
    return json(await lavoro);
  } catch (e) {
    console.error(e);
    return json({ error: "Ricerca delle notizie non riuscita." }, 500);
  }
});

// La ricerca vera e propria. Restituisce il riepilogo e lo scrive in
// notizie_esecuzione (anche in caso di errore).
async function cerca(admin: ReturnType<typeof createClient>, esecuzione: number) {
  const riepilogo = { esito: "ok", lette: 0, nuove: 0, attinenti: 0, token_ingresso: 0, token_uscita: 0, errore: null as string | null };
  try {
    const CHIAVE = Deno.env.get("ANTHROPIC_API_KEY");
    const MODELLO = Deno.env.get("NOTIZIE_MODELLO") || "claude-haiku-5-5";
    if (!CHIAVE) throw new Error("Manca la chiave ANTHROPIC_API_KEY nei segreti del server.");

    // 1) Canali, 4 alla volta (un canale che non risponde si salta; molte
    // richieste insieme allo stesso sito vengono rifiutate).
    const leggi = async (c: any) => {
      try {
        const r = await fetch(c.url, { headers: { "User-Agent": "Mozilla/5.0 (Portale CWP osservatorio News)", Accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) {
          console.warn("canale", c.nome, r.status);
          return [];
        }
        const testo = await r.text();
        const voci = leggiRss(testo, c);
        if (!voci.length && !/<rss|<feed/i.test(testo)) console.warn("canale", c.nome, "risposta non RSS:", testo.slice(0, 120));
        return voci;
      } catch (e) {
        console.warn("canale", c.nome, String(e));
        return [];
      }
    };
    const letture: any[][] = [];
    for (let i = 0; i < CANALI.length; i += 4) letture.push(...(await Promise.all(CANALI.slice(i, i + 4).map(leggi))));
    const tutte = letture.flat();
    riepilogo.lette = tutte.length;

    // 2) Senza doppioni (nella ricerca e nel database), recenti.
    const limite = Date.now() - GIORNI * 86400000;
    const viste = new Map<string, any>();
    for (const n of tutte) {
      const chiave = chiaveTitolo(n.titolo);
      if (!chiave || viste.has(chiave)) continue;
      if (n.pubblicata_il && Date.parse(n.pubblicata_il) < limite) continue;
      viste.set(chiave, { ...n, chiave });
    }
    let candidate = [...viste.values()];
    const giaSalvate = new Set<string>();
    for (let i = 0; i < candidate.length; i += 200) {
      const blocco = candidate.slice(i, i + 200);
      const { data: perChiave } = await admin.from("notizia").select("chiave").in("chiave", blocco.map((n) => n.chiave));
      const { data: perUrl } = await admin.from("notizia").select("url").in("url", blocco.map((n) => n.url));
      (perChiave || []).forEach((r: any) => giaSalvate.add("k:" + r.chiave));
      (perUrl || []).forEach((r: any) => giaSalvate.add("u:" + r.url));
    }
    candidate = candidate.filter((n) => !giaSalvate.has("k:" + n.chiave) && !giaSalvate.has("u:" + n.url));

    // 3) Pre-filtro: le notizie senza parole chiave si salvano come non
    // attinenti senza chiedere a Claude.
    const scartate = candidate.filter((n) => !preFiltro(n));
    const daValutare = candidate
      .filter((n) => preFiltro(n))
      .sort((a, b) => (b.pubblicata_il ? Date.parse(b.pubblicata_il) : 0) - (a.pubblicata_il ? Date.parse(a.pubblicata_il) : 0))
      .slice(0, MASSIMO);

    // 4) Valutazione di Claude a gruppi, in parallelo.
    const gruppi: any[][] = [];
    for (let i = 0; i < daValutare.length; i += GRUPPO) gruppi.push(daValutare.slice(i, i + GRUPPO));
    const valutate = (
      await Promise.all(
        gruppi.map(async (g) => {
          const elenco = g.map((n, i) => ({ i, titolo: n.titolo, fonte: n.fonte, data: n.pubblicata_il?.slice(0, 10) || "", estratto: n.estratto }));
          const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": CHIAVE, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
              model: MODELLO,
              max_tokens: 8000,
              system: ISTRUZIONI,
              messages: [{ role: "user", content: `Notizie da valutare (JSON):\n${JSON.stringify(elenco)}` }],
            }),
            signal: AbortSignal.timeout(90000),
          });
          const risposta = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(`Claude ${r.status}: ${risposta?.error?.message || "risposta non valida"}`);
          riepilogo.token_ingresso += risposta.usage?.input_tokens || 0;
          riepilogo.token_uscita += risposta.usage?.output_tokens || 0;
          const testo = (risposta.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
          const giudizi = new Map(leggiValutazioni(testo).map((v) => [v.i, v]));
          // Una notizia senza giudizio (risposta incompleta) resta fuori:
          // la prossima ricerca la rivaluta.
          return g.map((n, i) => (giudizi.has(i) ? { ...n, ...giudizi.get(i) } : null)).filter(Boolean);
        })
      )
    ).flat() as any[];

    // 5) Salvataggio (le doppie si ignorano grazie ai vincoli unici).
    const righe = [
      ...valutate.map((n) => ({
        url: n.url, chiave: n.chiave, titolo: n.titolo, titolo_it: n.titolo_it, fonte: n.fonte, pubblicata_il: n.pubblicata_il,
        ricerca: n.ricerca, lingua: n.lingua, attinente: n.attinente, categoria: n.attinente ? n.categoria : null,
        rilevanza: n.attinente ? n.rilevanza : null, sintesi: n.sintesi, prezzi: n.prezzi, motivo: n.motivo,
      })),
      ...scartate.map((n) => ({
        url: n.url, chiave: n.chiave, titolo: n.titolo, fonte: n.fonte, pubblicata_il: n.pubblicata_il, ricerca: n.ricerca, lingua: n.lingua,
        attinente: false, motivo: "Scartata dal pre-filtro: nessuna parola chiave sui crediti di carbonio.",
      })),
    ];
    for (const riga of righe) {
      const { error } = await admin.from("notizia").insert(riga);
      if (!error) {
        riepilogo.nuove++;
        if (riga.attinente) riepilogo.attinenti++;
      } else if (!/duplicate key/i.test(error.message)) console.warn("notizia non salvata", error.message);
    }
  } catch (e) {
    riepilogo.esito = "errore";
    riepilogo.errore = String((e as Error)?.message || e).slice(0, 500);
    console.error("ricerca notizie", riepilogo.errore);
  }
  await admin
    .from("notizie_esecuzione")
    .update({ ...riepilogo, conclusa_il: new Date().toISOString() })
    .eq("id", esecuzione);
  return riepilogo;
}

// Prova di lettura dei canali con intestazioni diverse (vedi «diagnosi»).
async function diagnosiCanali() {
  const browser = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
  };
  const prove: [string, string, Record<string, string>][] = [
    ["google ricerca (controllo del blocco)", "https://news.google.com/rss/search?q=carbon%20credits&hl=en-US&gl=US&ceid=US:en", browser],
    ...CANALI.filter((c) => !c.nome.startsWith("Bing")).map((c) => [c.nome, c.url, browser] as [string, string, Record<string, string>]),
    ["bing ricerca", CANALI[0].url, browser],
  ];
  const esiti = [];
  for (const [nome, url, intestazioni] of prove) {
    try {
      const r = await fetch(url as string, { headers: intestazioni as Record<string, string>, redirect: "follow", signal: AbortSignal.timeout(20000) });
      const testo = await r.text();
      esiti.push({ nome, stato: r.status, tipo: r.headers.get("content-type"), posizione: r.headers.get("location"), voci: (testo.match(/<item[\s>]/g) || []).length, inizio: testo.slice(0, 300) });
    } catch (e) {
      esiti.push({ nome, errore: String(e) });
    }
  }
  return { esiti };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
