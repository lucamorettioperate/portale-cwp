/* =========================================================================
   notizie.js — osservatorio «Notizie CO2» sui crediti di carbonio volontari
   (richiesta di Luca Moretti del 21/10/2026: sezione solo per gli
   Amministratori, ricerca ogni 2 ore, solo notizie attinenti).

   Scopo: funzioni pure usate dalla funzione del server «notizie»
   (supabase/functions/notizie) e dalla pagina /news:
   - CANALI: dove si cercano le notizie (Bing News e Google News in
     italiano e in inglese con ricerche mirate, più quattro siti
     specializzati);
   - leggiRss: legge un feed RSS (testo XML) e restituisce le notizie;
   - chiaveTitolo: titolo normalizzato per riconoscere la stessa notizia
     trovata da due ricerche;
   - preFiltro: scarta subito ciò che non parla di carbonio o crediti
     (prima di chiedere a Claude, per non spendere);
   - leggiValutazioni: legge la risposta di Claude (JSON) senza fidarsi
     del formato;
   - CATEGORIE: nomi delle categorie mostrati nella pagina.
   Nessun accesso ai dati qui. Prove: test/notizie.test.mjs.

   IMPORTANTE: il blocco tra «INIZIO funzioni notizie» e «FINE funzioni
   notizie» è COPIATO identico in supabase/functions/notizie/index.ts (la
   funzione del server si pubblica come un solo file). La prova controlla
   che le due copie siano uguali: se si cambia qui, si ricopia là.
   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (notizie);
   script 36.
   ========================================================================= */

// INIZIO funzioni notizie
// Ricerca su Google News (feed RSS pubblico), ultimi 7 giorni. Google
// blocca le richieste dai server di Supabase (503, pagina «Sorry…»,
// ISS-036): questi canali si leggono attraverso il tramite in Google Apps
// Script (strumenti/notizie/ProxyGoogleNews.gs, impostazione
// url_proxy_google_news). Senza tramite si saltano.
const googleNews = (q, lingua) =>
  lingua === "it"
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=it&gl=IT&ceid=IT:it`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=en-US&gl=US&ceid=US:en`;

// Ricerca su Bing News (feed RSS pubblico), ultima settimana: si legge
// direttamente dai server di Supabase.
const bingNews = (q, lingua) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&qft=${encodeURIComponent('interval="7"')}&format=rss` +
  (lingua === "it" ? "&setlang=it-IT&cc=IT" : "&setlang=en-US&cc=US");

// Canali dell'osservatorio: { nome, url, lingua, via? } (via = "google":
// si legge attraverso il tramite). Le ricerche coprono i
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
  { nome: "Google News · crediti di carbonio", lingua: "it", via: "google", url: googleNews('"crediti di carbonio"', "it") },
  { nome: "Google News · mercato volontario del carbonio", lingua: "it", via: "google", url: googleNews('"mercato volontario" carbonio', "it") },
  { nome: "Google News · prezzo dei crediti di carbonio", lingua: "it", via: "google", url: googleNews('"crediti di carbonio" prezzo OR prezzi OR valore', "it") },
  { nome: "Google News · crediti di carbonio e rifiuti", lingua: "it", via: "google", url: googleNews('"crediti di carbonio" rifiuti OR riciclo OR "economia circolare"', "it") },
  { nome: "Google News · voluntary carbon market", lingua: "en", via: "google", url: googleNews('"voluntary carbon market"', "en") },
  { nome: "Google News · carbon credit prices", lingua: "en", via: "google", url: googleNews('"carbon credit" OR "carbon credits" price OR prices OR traded', "en") },
  { nome: "Google News · carbon credit marketplaces", lingua: "en", via: "google", url: googleNews('"carbon credit" marketplace OR exchange OR platform', "en") },
  { nome: "Google News · standards and registries", lingua: "en", via: "google", url: googleNews('Verra OR "Gold Standard" OR ICVCM OR VCMI "carbon credits"', "en") },
  { nome: "Google News · waste carbon credits", lingua: "en", via: "google", url: googleNews('"carbon credits" waste OR recycling OR landfill OR composting', "en") },
  { nome: "Carbon Herald", lingua: "en", url: "https://carbonherald.com/feed/" },
  { nome: "CarbonCredits.com", lingua: "en", url: "https://carboncredits.com/feed/" },
  { nome: "Ecosystem Marketplace", lingua: "en", url: "https://www.ecosystemmarketplace.com/feed/" },
  { nome: "Verra", lingua: "en", url: "https://verra.org/feed/" },
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
function preFiltro(n) {
  const t = `${n.titolo || ""} ${n.estratto || ""}`.toLowerCase();
  return PAROLE_CHIAVE.some((p) => t.includes(p));
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

export { CANALI, CATEGORIE, leggiRss, chiaveTitolo, preFiltro, leggiValutazioni, testoPulito };
