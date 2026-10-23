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
