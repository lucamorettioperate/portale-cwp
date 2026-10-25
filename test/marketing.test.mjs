/* =========================================================================
   marketing.test.mjs — sezione Marketing (richiesta di Luca Moretti del
   23/10/2026; src/lib/marketing.js, funzione del server «marketing»,
   script 44).
   Controlla:
   - le parti tra INIZIO-… e FINE-… sono IDENTICHE nella libreria del
     portale e nella funzione del server (email della campagna e regole di
     IndicePA);
   - riconoscimento delle PEC (mai usate per le campagne) e stessa regola
     del database (mkt_sembra_pec dello script 44);
   - ruolo dei referenti dagli uffici dei Comuni;
   - email della campagna: link «Approfondisci» e di disiscrizione con il
     codice dell'invio, testo protetto dai caratteri HTML, informativa;
   - micro simulazione della landing page: controlli dei dati, valori noti,
     somme anno per anno, Caso 2 più caro del Caso 1, durate 7/10/21.
   Uso: npm test (oppure node test/marketing.test.mjs).
   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  htmlCampagna, testoCampagna, sembraPec, ruoloUfficio, ufficioGenerico, erroriMicro, microSimulazione,
} from "../src/lib/marketing.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const blocco = (testo, nome) => {
  const m = testo.match(new RegExp(`// INIZIO-${nome}\\n([\\s\\S]*?)// FINE-${nome}`));
  assert.ok(m, `blocco ${nome} mancante`);
  return m[1];
};

prova("Copie identiche tra portale e funzione del server", () => {
  const lib = readFileSync(new URL("../src/lib/marketing.js", import.meta.url), "utf8");
  const fn = readFileSync(new URL("../supabase/functions/marketing/index.ts", import.meta.url), "utf8");
  for (const b of ["EMAIL-CAMPAGNA", "REGOLE-IPA"]) assert.equal(blocco(fn, b), blocco(lib, b), `blocco ${b} diverso`);
});

prova("PEC riconosciute dal dominio; email generiche no", () => {
  for (const e of ["comune.x@pec.it", "protocollo@cert.comune.y.it", "a@legalmail.it", "b@postacert.toscana.it", "c@pecveneto.it", "d@arubapec.it", "E@PEC.COMUNE.Z.IT"]) assert.equal(sembraPec(e), true, e);
  for (const e of ["info@comune.x.it", "protocollo@comune.specchia.le.it", "ufficio.tributi@comune.y.it", "pecora@allevamento.it"]) assert.equal(sembraPec(e), false, e);
});

prova("Stessa regola PEC del database (script 44)", () => {
  const sql = readFileSync(new URL("../supabase/44_marketing.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("'@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura))'"));
});

prova("Ruolo dei referenti dagli uffici", () => {
  assert.equal(ruoloUfficio("Ufficio Tributi"), "tributi");
  assert.equal(ruoloUfficio("Servizio Entrate e TARI"), "tributi");
  assert.equal(ruoloUfficio("Area Ambiente ed Ecologia"), "ambiente");
  assert.equal(ruoloUfficio("Ragioneria"), "finanziario");
  assert.equal(ruoloUfficio("Ufficio Tecnico - Lavori Pubblici"), "tecnico");
  assert.equal(ruoloUfficio("Polizia Locale"), null);
  assert.equal(ufficioGenerico("Ufficio Protocollo"), true);
  assert.equal(ufficioGenerico("Anagrafe"), false);
});

prova("Email della campagna: link, disiscrizione, testo protetto", () => {
  const token = "123e4567-e89b-12d3-a456-426614174000";
  const h = htmlCampagna({ portale: "https://portale-cwp.vercel.app", grafica: "territorio", oggetto: "Prova", testo: "Primo <b>paragrafo</b>\n\nSecondo", ente: "Comune di Prova & C.", token });
  assert.ok(h.includes(`https://portale-cwp.vercel.app/scopri?c=${token}`));
  assert.ok(h.includes(`https://portale-cwp.vercel.app/scopri/disiscrizione?c=${token}`));
  assert.ok(h.includes("banner-territorio.png"));
  assert.ok(h.includes("Primo &lt;b&gt;paragrafo&lt;/b&gt;"));
  assert.ok(h.includes("Comune di Prova &amp; C."));
  assert.ok(h.includes("Titolare del trattamento"));
  for (const a of [7, 10, 21]) assert.ok(h.includes(`>${a}</div>`));
  const t = testoCampagna({ portale: "https://p", testo: "Ciao", ente: "Comune", token });
  assert.ok(t.includes(`https://p/scopri?c=${token}`) && t.includes("disiscrizione"));
});

prova("Controlli dei dati della micro simulazione", () => {
  assert.deepEqual(erroriMicro({ abitanti: 16735, secco: 2400, totale: 8000, anni: 10 }), []);
  assert.ok(erroriMicro({ abitanti: "", secco: 1, totale: 2, anni: 10 }).length > 0);
  assert.ok(erroriMicro({ abitanti: 1000, secco: 600, totale: 500, anni: 10 }).some((e) => e.includes("secco")));
  assert.ok(erroriMicro({ abitanti: 1000, secco: 1, totale: 500, anni: 8 }).some((e) => e.includes("durata")));
  // 8.000 scritto con il punto = 8 tonnellate: avviso sulle unità.
  assert.ok(erroriMicro({ abitanti: 16735, secco: 2, totale: "8.000", anni: 10 }).some((e) => e.includes("kg per abitante")));
  assert.deepEqual(erroriMicro({ abitanti: "16 735", secco: "2400,5", totale: "8000", anni: "21" }), []);
});

prova("Micro simulazione: valori noti e somme coerenti", () => {
  const r = microSimulazione({ abitanti: 16735, totale: 8000, secco: 2400, anni: 10, caso: "caso1", annoInizio: 2027 });
  assert.deepEqual(r.errori, []);
  assert.equal(r.anni.length, 10);
  assert.equal(r.anni[0].anno, 2027);
  assert.equal(Math.round(r.totali.crediti), 20445);
  assert.equal(Math.round(r.totali.ricavi), 654240);
  assert.equal(Math.round(r.totali.costi), 162330);
  assert.equal(Math.round(r.totali.margine), 491910);
  const somma = (k) => r.anni.reduce((s, a) => s + a[k], 0);
  assert.ok(Math.abs(somma("ricavi") - r.totali.ricavi) < 1);
  assert.ok(Math.abs(somma("costi") - r.totali.costi) < 1);
  assert.ok(Math.abs(r.anni.at(-1).cumulato - r.totali.margine) < 1);
  assert.ok(r.ipotesi.length >= 3);
});

prova("Caso 2 più caro del Caso 1; durate 7, 10 e 21 anni", () => {
  const base = { abitanti: 20000, totale: 9800, secco: 3000, annoInizio: 2027 };
  for (const anni of [7, 10, 21]) {
    const c1 = microSimulazione({ ...base, anni, caso: "caso1" }).totali;
    const c2 = microSimulazione({ ...base, anni, caso: "caso2" }).totali;
    assert.equal(c1.ricavi, c2.ricavi);
    assert.ok(c2.costi > c1.costi);
    assert.equal(microSimulazione({ ...base, anni, caso: "caso1" }).anni.length, anni);
  }
});

console.log(`\n${n} prove superate (marketing).`);

// ---------------------------------------------------------------------
// Lettore dei siti (25/10/2026, script 46, src/lib/marketingLettura.js)
// ---------------------------------------------------------------------
const L = await import("../src/lib/marketingLettura.js");
let m = 0;
const prova2 = (nome, f) => { f(); m++; console.log("✓", nome); };

prova2("Lettore: copia identica nella funzione del server", () => {
  const lib = readFileSync(new URL("../src/lib/marketingLettura.js", import.meta.url), "utf8");
  const fn = readFileSync(new URL("../supabase/functions/marketing/index.ts", import.meta.url), "utf8");
  assert.equal(blocco(fn, "LETTURA-SITI"), blocco(lib, "LETTURA-SITI"));
});

prova2("Lettore: testo dall'HTML, email dei mailto, entità", () => {
  const html = `<html><head><title>x</title><script>var a="no@x.it"</script></head><body>
    <h2>Ufficio Tributi</h2><p>Responsabile: dott.ssa Maria Rossi<br>Tel. 0362 123456</p>
    <a href="mailto:tributi@comune.prova.it">scrivici</a><p>Citt&agrave; &amp; servizi</p></body></html>`;
  const t = L.htmlInTesto(html);
  assert.ok(t.includes("Ufficio Tributi") && t.includes("Maria Rossi") && t.includes("tributi@comune.prova.it"));
  assert.ok(!t.includes("no@x.it"));
  assert.ok(t.includes("Città & servizi"));
});

prova2("Lettore: collegamenti utili prima, esterni solo se trasparenza", () => {
  const html = `<a href="/contatti">Contatti</a><a href="/news/1">News</a><a href="doc.pdf">PDF</a>
    <a href="https://altro.it/x">Altro sito</a><a href="https://trasparenza.halleyweb.com/c1">Amministrazione trasparente</a>
    <a href="/uffici/tributi">Ufficio tributi</a><a href="mailto:a@b.it">mail</a>`;
  const ls = L.collegamenti(html, "https://www.comune.prova.it/");
  assert.equal(ls.length, 5);
  const p = (u) => L.punteggioLink(ls.find((l) => l.url.includes(u)), "comune", "www.comune.prova.it");
  assert.ok(p("/contatti") >= 9 && p("/uffici/tributi") >= 9);
  assert.ok(p("halleyweb") >= 8);
  assert.equal(p("altro.it"), 0);
  assert.ok(p("/news/1") <= 2);
});

prova2("Lettore: robots.txt rispettato", () => {
  const r = "User-agent: *\nDisallow: /privato/\nAllow: /privato/contatti\n\nUser-agent: Googlebot\nDisallow: /";
  assert.equal(L.robotsConsente(r, "/contatti"), true);
  assert.equal(L.robotsConsente(r, "/privato/x"), false);
  assert.equal(L.robotsConsente(r, "/privato/contatti"), true);
  assert.equal(L.robotsConsente("User-agent: *\nDisallow: /", "/"), false);
  assert.equal(L.robotsConsente("", "/"), true);
});

prova2("Lettore: solo dati presenti nel testo, PEC separate", () => {
  const testo = "Ufficio tributi\nResponsabile Maria Rossi\nEmail tributi@comune.prova.it\nTel. 0362 123456\nPEC protocollo@pec.comune.prova.it\ninfo@comune.prova.it";
  const grezzo = {
    email: "protocollo@pec.comune.prova.it", pec: null, telefono: "0362/123456",
    uffici: [
      { ruolo: "tributi", ufficio: "Ufficio tributi", nome: "Maria", cognome: "Rossi", email: "tributi@comune.prova.it", telefono: "0362 123456", fonte: "https://www.comune.prova.it/contatti" },
      { ruolo: "ambiente", nome: "Luigi", cognome: "Inventato", email: "ambiente@comune.prova.it", fonte: "https://altro.it" },
      { ruolo: "sindaco", cognome: "Rossi" },
    ],
  };
  const e = L.controlloEsito(grezzo, testo, ["https://www.comune.prova.it/", "https://www.comune.prova.it/contatti"], "comune");
  assert.equal(e.email, null); // la PEC non va nell'email generica
  assert.equal(e.pec, "protocollo@pec.comune.prova.it");
  assert.equal(e.telefono, "0362/123456");
  assert.equal(e.uffici.length, 1); // l'ufficio ambiente inventato e il ruolo non previsto sono scartati
  assert.equal(e.uffici[0].cognome, "Rossi");
  assert.equal(e.uffici[0].fonte, "https://www.comune.prova.it/contatti");
  const g = L.controlloEsito({ email: "info@comune.prova.it", referenti: [{ ruolo: "amministratore", nome: "Mario", cognome: "Bianchi" }], attivita_raccolta: true, comuni_serviti: ["Prova", "Inesistente"] }, testo + "\nComune di Prova", ["https://x.it/"], "gestore");
  assert.equal(g.email, "info@comune.prova.it");
  assert.equal(g.referenti.length, 0); // Bianchi non compare nel testo
  assert.equal(g.attivita_raccolta, true);
  assert.deepEqual(g.comuni_serviti, ["Prova"]);
});

prova2("Lettore: regole fisse per i Comuni (uffici tributi e ambiente)", () => {
  const pag = [{ url: "https://www.comune.prova.it/uffici", testo: "Ufficio Tributi\nResponsabile: dott.ssa Maria Rossi\nTel. 0362 123456\nEmail: tributi@comune.prova.it\nArea Ambiente ed Ecologia\nResponsabile del Servizio: ing. BIANCHI Luca\necologia@comune.prova.it\nPEC protocollo@pec.comune.prova.it\nprotocollo@comune.prova.it\nprivacy@comune.prova.it" }];
  const d = L.estraiDati(pag, "comune", "www.comune.prova.it");
  assert.equal(d.email, "protocollo@comune.prova.it");
  assert.equal(d.pec, "protocollo@pec.comune.prova.it");
  const t = d.uffici.find((u) => u.ruolo === "tributi"), a = d.uffici.find((u) => u.ruolo === "ambiente");
  assert.deepEqual([t.nome, t.cognome, t.email, t.telefono], ["Maria", "Rossi", "tributi@comune.prova.it", "0362 123456"]);
  assert.deepEqual([a.nome, a.cognome, a.email], ["Luca", "BIANCHI", "ecologia@comune.prova.it"]);
  const e = L.controlloEsito(d, pag[0].testo, [pag[0].url], "comune");
  assert.equal(e.uffici.length, 2);
});

prova2("Lettore: regole fisse per i gestori (direttori, raccolta, tariffa, Comuni)", () => {
  const g = [{ url: "https://www.gest.it/chi-siamo", testo: "Gest Ambiente SpA\nPresidente del CdA: Mario Verdi\nDirettore Generale ing. Paolo Neri\nSvolgiamo la raccolta porta a porta per i Comuni soci: Comune di Monza, Comune di Seregno.\nSportello TARI\ninfo@gest.it  centralino 039 1234567" }];
  const d = L.estraiDati(g, "gestore", "www.gest.it");
  assert.deepEqual(d.referenti.map((r) => [r.ruolo, r.nome, r.cognome]), [["amministratore", "Mario", "Verdi"], ["direttore_generale", "Paolo", "Neri"]]);
  assert.equal(d.email, "info@gest.it");
  assert.equal(d.telefono, "039 1234567");
  assert.equal(d.attivita_raccolta, true);
  assert.equal(d.attivita_tariffa, true);
  assert.deepEqual(d.comuni_serviti, ["Monza", "Seregno"]);
  const v = L.estraiDati([{ url: "u", testo: "Responsabile: Ufficio Tributi\nPresidente: Consiglio Comunale" }], "comune", "x.it");
  assert.equal(v.uffici.filter((u) => u.cognome).length, 0);
});

console.log(`${m} prove superate (lettore dei siti).`);
