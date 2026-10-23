/* =========================================================================
   utenzeNelCalcolo.test.mjs — prove del collegamento tra le utenze del
   passo «5a. Utenze del calcolo» (tabella calcolo_utenza, script 40) e il
   motore di calcolo (src/lib/crediti/calcolo.js). Richiesta di Luca
   Moretti del 23/10/2026.
   Controlla:
   - utenzeInConferimenti: classe = categoria di simulazione, kg misurati,
     frazione vuota senza righe, 0 conservato;
   - stessi numeri dei conferimenti del tracciato quando i dati coincidono
     (kg misurati = peso pesato alla struttura);
   - rifiuti attesi solo sulle frazioni indicate per quell'utenza;
   - utenze senza categoria o con categoria non in delibera fuori dal
     calcolo (avviso nel motore, errore nei controlli di coerenza);
   - priorità delle utenze (5a) sui conferimenti del tracciato (5b);
   - kg negativi: calcolo bloccato.
   Uso: npm test (oppure node test/utenzeNelCalcolo.test.mjs).
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
   ========================================================================= */
import assert from "node:assert/strict";
import { calcolaCrediti, utenzeInConferimenti } from "../src/lib/crediti/calcolo.js";
import { controllaCoerenza } from "../src/lib/crediti/tracciato.js";
import { TIPOLOGIE_RIFIUTO } from "../src/lib/crediti/parametri.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const vicino = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// Stesso piccolo Comune di crediti.test.mjs.
const base = {
  anno: 2026,
  tipo: "ex_post",
  rifiuti: [
    { codice: "200301", tipologia: "indifferenziato", qtot: 100 },
    { codice: "200108", tipologia: "organico", qtot: 60 },
    { codice: "200101", tipologia: "carta", qtot: 40 },
    { codice: "200201", tipologia: "verde", qtot: 20, soloDomestiche: true },
  ],
  pefUd: 70,
  pefUnd: 30,
  classiUd: [{ classe: "1", n: 100, kb: 0.6 }, { classe: "2", n: 50, kb: 1.4 }],
  classiUnd: [{ classe: "22", n: 10, superficie: 1000, kd: 4 }],
  fattori: TIPOLOGIE_RIFIUTO,
  beni: [],
  opzioni: { utenzeMonitorate: { res: true }, rifiutiMisurati: { indifferenziato: true } },
};
const utenza = (codice, tipo, cat, frazioni) => ({ codice, tipo, categoria_simulazione: cat, frazioni });

prova("utenzeInConferimenti: categoria come classe, kg, frazioni vuote, zero", () => {
  const r = utenzeInConferimenti([
    utenza("UD-1", "UD", " 2 ", { indifferenziato: { kg: 150, svuotamenti: 20 }, organico: { kg: 0 }, carta: { kg: null } }),
    utenza("UND-1", "UnD", null, { indifferenziato: { kg: 900 } }),
  ]);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { utenza: "UD-1", macro: "UD", classe: "2", tipologia: "indifferenziato", kg: 150, svuotamenti: 20, nUtenze: 1 });
  assert.equal(r[1].tipologia, "organico");
  assert.equal(r[1].kg, 0);
  assert.equal(r[2].classe, "");
});

prova("stessi numeri dei conferimenti del tracciato a parità di dati", () => {
  const a = calcolaCrediti({ ...base, utenze: [utenza("A", "UD", "1", { indifferenziato: { kg: 64 } })] });
  const b = calcolaCrediti({ ...base, conferimenti: [{ utenza: "A", macro: "UD", classe: "1", tipologia: "indifferenziato", pesoStrutture: 64 }] });
  assert.equal(a.fonte, "utenze");
  assert.equal(b.fonte, "conferimenti");
  vicino(a.utenze.dettaglio[0].ptot.indifferenziato, 64);
  vicino(a.deltaI, b.deltaI);
  vicino(a.crediti.netti, b.crediti.netti);
  assert.ok(a.crediti.lordi > 0);
});

prova("rifiuti attesi solo sulle frazioni indicate per l'utenza", () => {
  const r = calcolaCrediti({
    ...base,
    utenze: [
      utenza("A", "UD", "1", { indifferenziato: { kg: 100 }, organico: { kg: 50 } }),
      utenza("B", "UD", "1", { indifferenziato: { kg: 100 } }),
    ],
  });
  const classe = r.attesa.classi.find((c) => c.macro === "UD" && c.classe === "1");
  const fe = Object.fromEntries(r.attesa.tipologie.map((t) => [t.tipologia, t.fe]));
  const A = r.utenze.dettaglio.find((u) => u.utenza === "A");
  const B = r.utenze.dettaglio.find((u) => u.utenza === "B");
  vicino(A.ea, -classe.atteso.indifferenziato * fe.indifferenziato - classe.atteso.organico * fe.organico);
  // B non ha l'organico: niente organico atteso (con la regola del
  // tracciato sarebbe entrato, perché A lo misura).
  vicino(B.ea, -classe.atteso.indifferenziato * fe.indifferenziato);
  vicino(B.ep, -100 * fe.indifferenziato);
});

prova("utenze senza categoria o con categoria non in delibera: fuori dal calcolo", () => {
  const valida = utenza("A", "UD", "1", { indifferenziato: { kg: 100 } });
  const r = calcolaCrediti({
    ...base,
    utenze: [valida, utenza("B", "UD", null, { indifferenziato: { kg: 900 } }), utenza("C", "UnD", "99", { indifferenziato: { kg: 9000 } })],
  });
  const solo = calcolaCrediti({ ...base, utenze: [valida] });
  assert.equal(r.utenze.totale, 1);
  assert.equal(r.utenze.escluse, 2);
  vicino(r.deltaI, solo.deltaI);
  assert.ok(r.avvisi.some((a) => a.startsWith("1 utenze senza categoria di simulazione")));
  assert.ok(r.avvisi.some((a) => a.includes("UnD «99»")));
  assert.equal(r.bloccato, false);
  // Controlli di coerenza: errori (la conferma non è disponibile).
  const esiti = controllaCoerenza({ ...base, conferimenti: utenzeInConferimenti([valida, utenza("B", "UD", null, { indifferenziato: { kg: 900 } }), utenza("C", "UnD", "99", { indifferenziato: { kg: 9000 } })]), origine: "utenze" });
  const errori = esiti.filter((e) => e.livello === "errore").map((e) => e.testo);
  assert.ok(errori.some((e) => /^1 utenze senza categoria di simulazione \(es\. B\)/.test(e)));
  assert.ok(errori.some((e) => /^1 utenze con una categoria di simulazione che non è tra le classi della delibera \(UnD «99»\)/.test(e)));
});

prova("coerenza: kg a zero non sono righe vuote; nessun errore con dati giusti", () => {
  const righe = utenzeInConferimenti([utenza("A", "UD", "1", { indifferenziato: { kg: 100 }, organico: { kg: 0 } })]);
  const esiti = controllaCoerenza({ ...base, conferimenti: righe, origine: "utenze" });
  assert.deepEqual(esiti.filter((e) => e.livello === "errore"), []);
  assert.ok(!esiti.some((e) => /senza alcun conferimento/.test(e.testo)));
  const vuoto = controllaCoerenza({ ...base, conferimenti: [], origine: "utenze" });
  assert.match(vuoto[0].testo, /passo 5a/);
});

prova("le utenze del passo 5a hanno la precedenza sui conferimenti del 5b", () => {
  const r = calcolaCrediti({
    ...base,
    utenze: [utenza("A", "UD", "1", { indifferenziato: { kg: 64 } })],
    conferimenti: [{ utenza: "X", macro: "UD", classe: "1", tipologia: "indifferenziato", pesoStrutture: 9999 }],
  });
  assert.equal(r.fonte, "utenze");
  assert.deepEqual(r.utenze.dettaglio.map((u) => u.utenza), ["A"]);
  assert.ok(r.avvisi.some((a) => /1 utenze del passo 5a: le 1 righe di conferimento del passo 5b/.test(a)));
});

prova("kg negativi: calcolo bloccato", () => {
  const r = calcolaCrediti({ ...base, utenze: [utenza("A", "UD", "1", { indifferenziato: { kg: -5 } })] });
  assert.equal(r.bloccato, true);
  assert.equal(r.crediti.lordi, 0);
  assert.ok(r.errori[0].includes("kg misurati -5"));
});

console.log(`\n${n} prove superate (utenze nel calcolo).`);
