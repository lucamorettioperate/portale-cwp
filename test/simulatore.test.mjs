/* =========================================================================
   simulatore.test.mjs — test del simulatore di scenari
   (src/lib/crediti/simulatore.js)

   Scopo: verificare il riepilogo dell'anno base (totale, pro capite, %
   differenziata, fattore del secco), i dati dal cluster SOSE e da un
   calcolo, gli anni del periodo (7, 10, 21), la traiettoria lineare e la
   stima dei crediti anno per anno (riduzione → crediti; stesso totale con
   più differenziata → nessun credito; aumento → debito; buffer).
   Uso: npm test (oppure node test/simulatore.test.mjs).
   Esito: "✓" per prova e "N prove superate"; altrimenti si ferma con
   l'errore.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti», backlog 37.
   ========================================================================= */
import assert from "node:assert/strict";
import {
  DURATE, riepilogoAnnoBase, rifiutiDaCluster, rifiutiDaCalcolo, anniDelPeriodo,
  traiettoriaLineare, simula, righeCsv, fattoriPredefiniti, puntoDiPartenza,
} from "../src/lib/crediti/simulatore.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };
const vicino = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

// Comune di prova, anno di riferimento con il 65% di differenziata
// (Standard 4.8.1): 10.000 abitanti, 4.000 t (400 kg/ab), secco 1.400 t.
const annoBase = { metodo: "anno", anno: 2019, popolazione: 10000, rifiuti: { organico: 1300, carta: 750, vetro: 350, plastica: 200, indifferenziato: 1400 } };

prova("anno base: totale, pro capite, % differenziata e fattore del secco", () => {
  const b = riepilogoAnnoBase(annoBase);
  assert.equal(b.totale, 4000);
  assert.equal(b.proCapite, 400);
  assert.equal(b.seccoProCapite, 140);
  assert.equal(b.differenziata, 2600);
  vicino(b.rd, 65);
  vicino(b.composizione.organico, 0.5);
  // Formule 16-17: media pesata dei fattori della differenziata.
  const f = fattoriPredefiniti();
  const atteso = (1300 * f.organico.fe + 750 * f.carta.fe + 350 * f.vetro.fe + 200 * f.plastica.fe) / 2600;
  vicino(b.feSecco, atteso);
});

prova("dati dal cluster SOSE (Tabella 3) e da un calcolo esistente", () => {
  const r = rifiutiDaCluster(4, 10000);
  assert.equal(r.indifferenziato, 950);
  assert.equal(r.organico, 820);
  assert.deepEqual(rifiutiDaCluster(11, 10000), {});
  const c = rifiutiDaCalcolo({ rifiuti: [{ tipologia: "carta", qtot: "10,5" }, { tipologia: "carta", qtot: 2 }, { tipologia: "vetro", qtot: 3, considerato: false }] });
  assert.deepEqual(c, { carta: 12.5 });
});

prova("anni del periodo: 7, 10 o 21, valori già inseriti conservati", () => {
  assert.deepEqual(DURATE, [7, 10, 21]);
  const base = riepilogoAnnoBase(annoBase);
  const a10 = anniDelPeriodo({ durata: 10, annoInizio: 2027, base });
  assert.equal(a10.length, 10);
  assert.equal(a10[0].anno, 2027);
  assert.equal(a10[9].anno, 2036);
  assert.equal(a10[0].totale, 4000);
  a10[1].totale = 3500;
  const a21 = anniDelPeriodo({ durata: 21, annoInizio: 2027, anni: a10, base });
  assert.equal(a21.length, 21);
  assert.equal(a21[1].totale, 3500);
  assert.equal(anniDelPeriodo({ durata: 7, annoInizio: 2027, anni: a21, base }).length, 7);
});

prova("traiettoria lineare verso gli obiettivi dell'ultimo anno", () => {
  const base = riepilogoAnnoBase(annoBase);
  const anni = traiettoriaLineare({ anni: anniDelPeriodo({ durata: 10, annoInizio: 2027, base }), base, proCapiteFinale: 350, seccoProCapiteFinale: 60 });
  assert.equal(anni[9].totale, 3500);
  assert.equal(anni[9].seccoProCapite, 60);
  assert.equal(anni[4].seccoProCapite, 100);
  assert.equal(anni[0].totale, 3950);
  // Con la situazione attuale compilata si parte da lì, non dal riferimento.
  const p = puntoDiPartenza(base, { proCapite: 380, seccoProCapite: 100 });
  assert.equal(p.fonte, "attuale");
  assert.equal(p.totale, 3800);
  const da = traiettoriaLineare({ anni: anniDelPeriodo({ durata: 10, annoInizio: 2027, base: p }), base: p, proCapiteFinale: 330, seccoProCapiteFinale: 50 });
  assert.equal(da[9].totale, 3300);
  assert.equal(da[0].totale, 3750);
  assert.equal(puntoDiPartenza(base, {}).fonte, "riferimento");
});

prova("crediti: la riduzione dei rifiuti genera crediti, il buffer li riduce", () => {
  const base = riepilogoAnnoBase(annoBase);
  const anni = [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }];
  const r = simula({ annoBase, anni, bufferPct: 20 });
  const a = r.righe[0];
  assert.equal(a.totale, 3600);
  assert.equal(a.secco, 800);
  vicino(a.rd, (2800 / 3600) * 100);
  // Gli obiettivi si confrontano con il riferimento (4.000 t), non con l'oggi.
  vicino(a.riduzione, 400);
  // Composizione costante: crediti = riduzione × |fattore del secco|.
  vicino(a.lordi, 400 * -base.feSecco, 1e-6);
  vicino(a.netti, a.lordi * 0.8, 1e-9);
  vicino(r.totali.netti, a.netti, 1e-9);
  assert.equal(r.avvisi.length, 0);
});

prova("stesso totale con più differenziata: % più alta ma nessun credito", () => {
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 4000, seccoProCapite: 60 }], bufferPct: 20 });
  const a = r.righe[0];
  vicino(a.rd, 85);
  vicino(a.lordi, 0, 1e-6);
  vicino(a.debito, 0, 1e-6);
});

prova("aumento dei rifiuti: debito e nessun credito; popolazione in crescita", () => {
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 4200, seccoProCapite: 120 }, { anno: 2028, popolazione: 11000, totale: 4400, seccoProCapite: 120 }], bufferPct: 0 });
  assert.equal(r.righe[0].lordi, 0);
  assert.ok(r.righe[0].debito > 0);
  // Con 11.000 abitanti il riferimento è 4.400 t: nessuna riduzione.
  vicino(r.righe[1].riferimento, 4400);
  vicino(r.righe[1].lordi, 0, 1e-6);
});

prova("conformità del riferimento: 64-66% di differenziata e Tabella 3 ±30%", () => {
  const anni = [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }];
  const al70 = { ...annoBase, rifiuti: { organico: 1400, carta: 800, vetro: 400, plastica: 200, indifferenziato: 1200 } };
  assert.ok(simula({ annoBase: al70, anni }).avvisi.some((x) => x.includes("Standard 4.8.1")));
  assert.ok(!simula({ annoBase: { ...al70, metodo: "cluster" }, anni }).avvisi.some((x) => x.includes("Standard 4.8.1")));
  assert.ok(simula({ annoBase: { ...annoBase, cluster: 4 }, anni }).avvisi.some((x) => x.includes("Tabella 3")));
  const cl = { metodo: "cluster", cluster: 4, popolazione: 10000, rifiuti: rifiutiDaCluster(4, 10000) };
  assert.equal(simula({ annoBase: cl, anni }).avvisi.length, 0);
});

prova("avvisi: dati mancanti e secco oltre il totale", () => {
  assert.ok(simula({ annoBase: { popolazione: "", rifiuti: {} }, anni: [] }).avvisi.length >= 2);
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 500, seccoProCapite: 120 }], bufferPct: 0 });
  assert.equal(r.righe[0].secco, 500);
  assert.ok(r.avvisi.some((x) => x.includes("supera")));
});

prova("export CSV con separatore punto e virgola", () => {
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }], bufferPct: 20 });
  const csv = righeCsv({ nome: "Obiettivo", comune: "Prova", durata: 10, anno_inizio: 2027 }, r);
  assert.ok(csv.includes('"2027";"10000";"3600,0"'));
  assert.ok(csv.startsWith('"Scenario: Obiettivo"'));
});

console.log(`${n} prove superate`);
