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
  traiettoriaLineare, simula, righeCsv, fattoriPredefiniti, puntoDiPartenza, simulaEconomia,
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

prova("riferimento sempre alla soglia del 65% e controllo dei valori fuori scala", () => {
  const anni = [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }];
  // Dati al 65%: nessun avviso, secco di riferimento = 35% del totale.
  const r65 = simula({ annoBase, anni });
  assert.equal(r65.avvisi.length, 0);
  vicino(r65.righe[0].seccoRiferimento, 1400);
  vicino(r65.righe[0].rdOltreSoglia, (2800 / 3600) * 100 - 65);
  // Dati all'85%: riportati al 65% con avviso, stessa produzione totale.
  const al85 = { ...annoBase, rifiuti: { organico: 1700, carta: 1000, vetro: 450, plastica: 250, indifferenziato: 600 } };
  const r85 = simula({ annoBase: al85, anni });
  assert.ok(r85.avvisi.some((x) => x.includes("riporta alla soglia del 65%")));
  vicino(r85.righe[0].seccoRiferimento, 1400);
  vicino(r85.righe[0].riferimento, 4000);
  // Tabella 3: avviso di scostamento; valori fuori scala (es. 2,5 kg/ab).
  assert.ok(simula({ annoBase: { ...annoBase, cluster: 4 }, anni }).avvisi.some((x) => x.includes("Tabella 3")));
  const piccolo = { metodo: "anno", popolazione: 44000, rifiuti: { organico: 11, carta: 18, plastica: 31, indifferenziato: 16 } };
  assert.ok(simula({ annoBase: piccolo, anni: [] }).avvisi.some((x) => x.includes("fuori scala")));
});

prova("frazioni senza fattore (metallo): nessun credito fittizio a parità di totale", () => {
  const conMetallo = { ...annoBase, rifiuti: { ...annoBase.rifiuti, metallo: 100, indifferenziato: 1500 } };
  const b = riepilogoAnnoBase(conMetallo);
  assert.equal(b.composizione.metallo, undefined);
  const r = simula({ annoBase: conMetallo, anni: [{ anno: 2027, popolazione: 10000, totale: b.totale, seccoProCapite: 50 }], bufferPct: 0 });
  vicino(r.righe[0].lordi, 0, 1e-6);
});

prova("avvisi: dati mancanti e secco oltre il totale", () => {
  assert.ok(simula({ annoBase: { popolazione: "", rifiuti: {} }, anni: [] }).avvisi.length >= 2);
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 500, seccoProCapite: 120 }], bufferPct: 0 });
  assert.equal(r.righe[0].secco, 500);
  assert.ok(r.avvisi.some((x) => x.includes("supera")));
});

prova("simulazione economica: ricavi, tariffe dello Schema tariffario, costi e margine", () => {
  const righe = [{ anno: 2027, netti: 1500.7 }, { anno: 2028, netti: 2000.2 }];
  assert.equal(simulaEconomia(righe, { prezzo: "" }, 10000), null);
  const e = simulaEconomia(righe, { prezzo: 20, crescitaPrezzo: 10, includiTariffe: true, costoValidazione: 5000, costoVerificaAnnua: 3000, altriCostiAnnui: 1000 }, 16735);
  const [a, b] = e.righe;
  assert.equal(a.crediti, 1500);
  assert.equal(a.ricavi, 30000);
  vicino(b.prezzo, 22);
  vicino(b.ricavi, 44000);
  // Progetto (solo il 1° anno): 3.000 + 4.000 (fascia fino a 30.000 ab) + 0,15 × 3.500 crediti del periodo.
  vicino(a.progetto, 3000 + 4000 + 0.15 * 3500);
  assert.equal(b.progetto, 0);
  // Rapporto: 1.000 + 2.000 + 0,20 × crediti; emissione a scaglioni; vendita 20% del valore.
  vicino(a.rapporto, 1000 + 2000 + 0.2 * 1500);
  vicino(a.emissione, 1000 * 1 + 500 * 0.5);
  vicino(a.vendita, 6000);
  vicino(a.costiEnte, 8000);
  vicino(b.costiEnte, 3000);
  vicino(a.margine, a.ricavi - a.costi);
  vicino(e.totali.margine, a.margine + b.margine);
  // Senza tariffe restano solo i costi indicati.
  const s2 = simulaEconomia(righe, { prezzo: 20, includiTariffe: false }, 16735);
  vicino(s2.totali.margine, 30000 + 40000);
});

prova("export CSV con separatore punto e virgola", () => {
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }], bufferPct: 20 });
  const csv = righeCsv({ nome: "Obiettivo", comune: "Prova", durata: 10, anno_inizio: 2027 }, r);
  assert.ok(csv.includes('"2027";"10000";"3600,0"'));
  assert.ok(csv.startsWith('"Scenario: Obiettivo"'));
});

console.log(`${n} prove superate`);
