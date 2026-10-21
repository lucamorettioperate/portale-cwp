/* =========================================================================
   notizie.test.mjs — prove dell'osservatorio News (src/lib/notizie.js e
   copia in supabase/functions/notizie/index.ts; richiesta di Luca del
   21/10/2026).
   Scopo: verificare che
   - un feed di Google News e uno di un sito (WordPress) si leggano con
     titolo senza testata, indirizzo, fonte, data ed estratto senza HTML;
   - la stessa notizia da due ricerche dia la stessa chiave;
   - il pre-filtro tenga le notizie sui crediti di carbonio e scarti le altre;
   - la risposta di Claude si legga anche con testo intorno e valori fuori
     elenco, e una risposta illeggibile non dia valutazioni;
   - la copia delle funzioni nella funzione del server sia identica.
   Uso: npm test (oppure node test/notizie.test.mjs).
   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (notizie).
   ========================================================================= */
import assert from "node:assert/strict";
import fs from "node:fs";
import { CANALI, CATEGORIE, leggiRss, chiaveTitolo, preFiltro, leggiValutazioni } from "../src/lib/notizie.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

const googleNews = `<?xml version="1.0"?><rss><channel><title>Google News</title>
<item><title>Crediti di carbonio: il prezzo sale a 5 euro - Il Sole 24 ORE</title><link>https://news.google.com/rss/articles/ABC?oc=5</link>
<guid isPermaLink="false">ABC</guid><pubDate>Tue, 20 Oct 2026 08:30:00 GMT</pubDate>
<description>&lt;a href="https://x"&gt;Crediti di carbonio: il prezzo sale&lt;/a&gt;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Il Sole 24 ORE&lt;/font&gt;</description>
<source url="https://www.ilsole24ore.com">Il Sole 24 ORE</source></item>
<item><title>Senza link - Fonte</title><link></link></item>
</channel></rss>`;
const wordpress = `<rss><channel><item><title><![CDATA[Verra & Gold Standard: new rules for removal credits]]></title>
<link>https://carbonherald.com/verra-gold-standard/</link><pubDate>Mon, 19 Oct 2026 14:00:00 +0000</pubDate>
<dc:creator><![CDATA[Redazione]]></dc:creator><description><![CDATA[<p>Two registries align their rules&#8230;</p>]]></description></item></channel></rss>`;

prova("feed di Google News: titolo senza testata, fonte, data ed estratto pulito", () => {
  const r = leggiRss(googleNews, { nome: "Google News · prova", lingua: "it" });
  assert.equal(r.length, 1);
  assert.equal(r[0].titolo, "Crediti di carbonio: il prezzo sale a 5 euro");
  assert.equal(r[0].fonte, "Il Sole 24 ORE");
  assert.equal(r[0].url, "https://news.google.com/rss/articles/ABC?oc=5");
  assert.equal(r[0].pubblicata_il, "2026-10-20T08:30:00.000Z");
  assert.equal(r[0].estratto, "Crediti di carbonio: il prezzo sale Il Sole 24 ORE");
  assert.equal(r[0].lingua, "it");
});
prova("feed di un sito: CDATA, entità e nome del sito come fonte", () => {
  const r = leggiRss(wordpress, { nome: "Carbon Herald", lingua: "en" });
  assert.equal(r[0].titolo, "Verra & Gold Standard: new rules for removal credits");
  assert.equal(r[0].fonte, "Carbon Herald");
  assert.equal(r[0].estratto, "Two registries align their rules…");
});
prova("stessa notizia, stessa chiave", () => {
  assert.equal(chiaveTitolo("Crediti di Carbonio: è record!"), chiaveTitolo("crediti di carbonio – e record"));
  assert.ok(chiaveTitolo("x".repeat(500)).length <= 140);
});
prova("pre-filtro: tiene i crediti di carbonio, scarta il resto", () => {
  assert.equal(preFiltro({ titolo: "Voluntary carbon market grows" }), true);
  assert.equal(preFiltro({ titolo: "Nuovo bando", estratto: "compensazione delle emissioni con crediti" }), true);
  assert.equal(preFiltro({ titolo: "Ricetta della torta di mele" }), false);
});
prova("risposta di Claude letta anche con testo intorno e valori fuori elenco", () => {
  const v = leggiValutazioni('Ecco: {"valutazioni":[{"i":0,"attinente":true,"categoria":"prezzi","rilevanza":9,"titolo_it":"T","sintesi":"S","prezzi":"5 €/t","motivo":"M"},{"i":1,"attinente":"sì","categoria":"boh","rilevanza":0},{"x":2}]} fine');
  assert.equal(v.length, 2);
  assert.deepEqual(v[0], { i: 0, attinente: true, categoria: "prezzi", rilevanza: 5, titolo_it: "T", sintesi: "S", prezzi: "5 €/t", motivo: "M" });
  assert.equal(v[1].attinente, false);
  assert.equal(v[1].categoria, "altro");
  assert.equal(v[1].rilevanza, 1);
  assert.deepEqual(leggiValutazioni("non è JSON"), []);
  assert.deepEqual(leggiValutazioni("{rotto"), []);
});
prova("canali e categorie coerenti con lo script 36", () => {
  assert.ok(CANALI.length >= 10 && CANALI.every((c) => /^https:\/\//.test(c.url) && c.nome && c.lingua));
  const sql = fs.readFileSync(new URL("../supabase/36_notizie.sql", import.meta.url), "utf8");
  for (const k of Object.keys(CATEGORIE)) assert.ok(sql.includes(`'${k}'`), k);
});
prova("la copia nella funzione del server è identica al modulo", () => {
  const blocco = (t) => t.slice(t.indexOf("// INIZIO funzioni notizie"), t.indexOf("// FINE funzioni notizie"));
  const modulo = fs.readFileSync(new URL("../src/lib/notizie.js", import.meta.url), "utf8");
  const funzione = fs.readFileSync(new URL("../supabase/functions/notizie/index.ts", import.meta.url), "utf8");
  assert.ok(blocco(modulo).length > 1000);
  assert.equal(blocco(funzione), blocco(modulo));
});
console.log(`${n} prove superate (notizie).`);
