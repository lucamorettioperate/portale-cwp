/* =========================================================================
   rilievi_t.test.mjs — prove dei rilievi «TEST_PORTALE_CWP» (29/10/2026)
   corretti il 30/10/2026: codice fiscale e partita IVA (T08), nomi delle
   fasi (T01, T02), differenziata dell'anno di riferimento nel calcolo
   (T19), avviso dei conferimenti oltre i rifiuti del territorio (T23).
   Il riferimento del simulatore come da Standard 4.8.1 (T10) è provato
   in simulatore.test.mjs; le regole del database in t48.sql.
   Uso: node test/rilievi_t.test.mjs (anche dentro npm test).
   ========================================================================= */
import assert from "node:assert/strict";
import { cfValido, pivaValida, erroriDatiFiscali } from "../src/lib/codiciFiscali.js";
import { FASI, FASI_RAPPORTO } from "../src/lib/cwpProgram.js";
import { rdTerritorio } from "../src/lib/crediti/qualita.js";
import { controllaCoerenza } from "../src/lib/crediti/tracciato.js";
import { calcolaCrediti } from "../src/lib/crediti/calcolo.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("T08: codice fiscale e partita IVA (stesse regole del database)", () => {
  assert.equal(pivaValida("01199250158"), true);
  assert.equal(pivaValida("IT 01199250158"), true);
  assert.equal(pivaValida("01199250159"), false);
  assert.equal(pivaValida("123456789"), false);
  assert.equal(cfValido("01199250158"), true);
  assert.equal(cfValido("RSSMRA85T10A562S"), true);
  assert.equal(cfValido("rssmra85t10a562s"), true);
  assert.equal(cfValido("RSSMRA85T10A562T"), false);
  assert.equal(cfValido("123456789"), false);
  assert.deepEqual(erroriDatiFiscali({ codice_fiscale: "", partita_iva: "" }), []);
  assert.equal(erroriDatiFiscali({ codice_fiscale: "123456789", partita_iva: "01199250159" }).length, 2);
});

prova("T01 e T02: nomi delle fasi come nella Guida", () => {
  assert.equal(FASI.find((f) => f.numero === 5).nome, "Validazione del progetto");
  assert.equal(FASI.find((f) => f.numero === 7).nome, "Registrazione del progetto");
  assert.equal(FASI_RAPPORTO.find((f) => f.numero === 5).nome, "Verifica del rapporto");
  assert.equal(FASI_RAPPORTO.find((f) => f.numero === 7).nome, "Emissione dei crediti");
});

const rifiuti65 = [
  { tipologia: "organico", qtot: 1300 }, { tipologia: "carta", qtot: 750 }, { tipologia: "vetro", qtot: 350 },
  { tipologia: "plastica", qtot: 200 }, { tipologia: "indifferenziato", qtot: 1400 },
];

prova("T19: differenziata dei rifiuti del territorio e avviso fuori dal 64-66%", () => {
  assert.equal(Math.round(rdTerritorio(rifiuti65)), 65);
  assert.equal(rdTerritorio([{ tipologia: "organico", qtot: 10 }]), null);
  const base = { anno: 2025, tipo: "ex_post", pefUd: 100, pefUnd: 0, classiUd: [{ classe: "1", n: 1, kb: 1 }], rifiuti: rifiuti65 };
  assert.ok(!calcolaCrediti(base).avvisi.some((a) => a.includes("64% e il 66%")));
  const al80 = { ...base, rifiuti: rifiuti65.map((r) => (r.tipologia === "indifferenziato" ? { ...r, qtot: 650 } : r)) };
  assert.ok(calcolaCrediti(al80).avvisi.some((a) => a.includes("64% e il 66%")));
  assert.ok(!calcolaCrediti({ ...al80, riferimento: { fonte: "cluster", cluster: 4 } }).avvisi.some((a) => a.includes("64% e il 66%")));
});

prova("T23: conferimenti oltre i rifiuti del passo 2, con e senza anno di riferimento diverso", () => {
  const rif = [{ tipologia: "organico", qtot: 4 }];
  const conf = (kg) => [{ utenza: "U1", macro: "UD", classe: "1", tipologia: "organico", kg }];
  const avv = (esiti) => esiti.filter((e) => e.tipo === "avviso" || e.livello === "avviso" || true).map((e) => e.testo || e.messaggio || String(e));
  // Stesso anno: oltre il +10% avvisa.
  const stesso = avv(controllaCoerenza({ anno: 2025, rifiuti: rif, conferimenti: conf(5000) })).join(" | ");
  assert.match(stesso, /oltre il 10%/);
  // Anno di riferimento diverso: +25% non avvisa, +60% sì.
  const diverso25 = avv(controllaCoerenza({ anno: 2025, annoRiferimento: 2019, rifiuti: rif, conferimenti: conf(5000) })).join(" | ");
  assert.doesNotMatch(diverso25, /superano/);
  const diverso60 = avv(controllaCoerenza({ anno: 2025, annoRiferimento: 2019, rifiuti: rif, conferimenti: conf(6400) })).join(" | ");
  assert.match(diverso60, /oltre il 50% i rifiuti dell'anno di riferimento 2019/);
});

console.log(`\n${n} prove superate (rilievi TEST_PORTALE_CWP).`);
