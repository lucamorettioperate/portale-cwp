/* =========================================================================
   simulatore.test.mjs — test del simulatore di scenari
   (src/lib/crediti/simulatore.js)

   Scopo: verificare il riepilogo dell'anno base (totale, pro capite, %
   differenziata, fattore del secco), i dati dal cluster SOSE e da un
   calcolo, gli anni del periodo (7, 10, 21), la traiettoria lineare e la
   stima dei crediti anno per anno (riduzione → crediti; stesso totale con
   più differenziata → nessun credito; aumento → debito; buffer), il
   metodo per utenza con le sole utenze virtuose, il buffer del Capitolo 7
   e la taratura sulla stima dell'Allegato A EsaCom.
   Uso: npm test (oppure node test/simulatore.test.mjs).
   Esito: "✓" per prova e "N prove superate"; altrimenti si ferma con
   l'errore.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti», backlog 37.
   ========================================================================= */
import assert from "node:assert/strict";
import {
  DURATE, riepilogoAnnoBase, rifiutiDaCluster, rifiutiDaCalcolo, anniDelPeriodo,
  traiettoriaLineare, simula, righeCsv, fattoriPredefiniti, puntoDiPartenza, simulaEconomia, economiaIniziale, prezziPerAnni, costiPerCaso, costoUnitario,
  bufferMetodologia, quotaVirtuose, taraVariabilita,
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

prova("avvisi: dati mancanti; secco oltre il totale è un errore (collaudo V01, D01)", () => {
  assert.ok(simula({ annoBase: { popolazione: "", rifiuti: {} }, anni: [] }).avvisi.length >= 2);
  // Prima il secco oltre il totale si «tagliava» al totale con un avviso;
  // dal 20/10/2026 è un dato impossibile: nessun risultato e un errore.
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 500, seccoProCapite: 120 }], bufferPct: 0 });
  assert.equal(r.righe.length, 0);
  assert.ok(r.errori.some((x) => x.includes("supera")));
});

prova("simulazione economica: ricavi, tariffe dello Schema tariffario, costi e margine", () => {
  const righe = [{ anno: 2027, netti: 1500.7 }, { anno: 2028, netti: 2000.2 }];
  assert.equal(simulaEconomia(righe, { prezzo: "" }, 10000), null);
  const e = simulaEconomia(righe, { prezzo: 20, crescitaPrezzo: 10, listino: "schema", costoValidazione: 5000, costoVerificaAnnua: 3000, altriCostiAnnui: 1000 }, 16735);
  const [a, b] = e.righe;
  assert.equal(a.crediti, 1500);
  assert.equal(a.ricavi, 30000);
  vicino(b.prezzo, 22);
  vicino(b.ricavi, 44000);
  // Progetto (solo il 1° anno): 3.000 + 4.000 (fascia fino a 30.000 ab) + 0,15 × 3.500 crediti del periodo.
  vicino(a.voci.progetto, 3000 + 4000 + 0.15 * 3500);
  assert.equal(b.voci.progetto, 0);
  // Rapporto: 1.000 + 2.000 + 0,20 × crediti; emissione a scaglioni; vendita 20% del valore.
  vicino(a.voci.rapporto, 1000 + 2000 + 0.2 * 1500);
  vicino(a.voci.emissione, 1000 * 1 + 500 * 0.5);
  vicino(a.voci.vendita, 6000);
  vicino(a.costiEnte, 8000);
  vicino(b.costiEnte, 3000);
  vicino(a.margine, a.ricavi - a.costi);
  vicino(e.totali.margine, a.margine + b.margine);
  // Senza tariffe restano solo i costi indicati (anche per gli scenari salvati con includiTariffe).
  const s2 = simulaEconomia(righe, { prezzo: 20, includiTariffe: false }, 16735);
  vicino(s2.totali.margine, 30000 + 40000);
});

prova("costi Caso 1 e Caso 2: fasce, interpolazione, minimi e massimi; Caso 1 = contratti EsaCom", () => {
  // EsaCom, 154.247 abitanti, Caso 1: le cifre dei contratti tipo.
  const es = Object.fromEntries(costiPerCaso("caso1", 154247).map((c) => [c.voce, c.importo]));
  vicino(es.progetto, 12339.76, 0.01); // contratto: 12.340 €
  vicino(es.rapporto, 30849.4, 0.01); // contratto: 30.849 €
  assert.equal(es.regProgetto, 3000); // 0,02 × ab = 3.085 → massimo 3.000
  assert.equal(es.regCreditiProgetto, 6000); // massimo 6.000
  assert.equal(es.regRapporto, 15000); // massimo 15.000
  vicino(es.regCreditiRapporto, 15424.7, 0.01); // contratto: 15.425 €
  // Interpolazione tra 5.000 e 20.000 ab. con arrotondamento per eccesso.
  assert.equal(costoUnitario([0, 0.2, 0.1, 0.08, 0], 16735), 0.13); // 0,1218 → 0,13
  assert.equal(costoUnitario([0, 0.4, 0.3, 0.2, 0], 20000), 0.3);
  assert.equal(costoUnitario([0, 0.4, 0.3, 0.2, 0], 60000), 0.25);
  // Comune piccolo: si applica il minimo €/anno.
  const piccolo = costiPerCaso("caso1", 1000);
  assert.equal(piccolo[0].importo, 300);
  assert.equal(piccolo[0].limite, "minimo");
  // Caso 2 più caro del Caso 1 a parità di popolazione.
  const tot = (c) => costiPerCaso(c, 16735).reduce((x, v) => x + v.importo, 0);
  assert.ok(tot("caso2") > tot("caso1"));
  // Nel simulatore: partecipazione = registrazioni, consulenza = redazioni.
  const righe = Array.from({ length: 10 }, (_, i) => ({ anno: 2027 + i, netti: 32000 }));
  const e = simulaEconomia(righe, { prezzo: 32, listino: "caso1" }, 154247);
  vicino(e.righe[0].consulenza, 12339.76 + 30849.4, 0.01);
  vicino(e.righe[0].partecipazione, 3000 + 6000 + 15000 + 15424.7, 0.01);
  // Scenari salvati con il vecchio listino «contratto» = Caso 1.
  vicino(simulaEconomia(righe, { prezzo: 32, listino: "contratto" }, 154247).totali.costi, e.totali.costi, 1e-6);
  // Durata diversa da 10 anni: avviso.
  assert.ok(simulaEconomia(righe.slice(0, 7), { prezzo: 32, listino: "caso2" }, 20000).avvisi.some((x) => x.includes("10 anni")));
});

prova("valore del credito anno per anno (proposto 32 €)", () => {
  assert.equal(economiaIniziale().prezzo, 32);
  const righe = [{ anno: 2027, netti: 100 }, { anno: 2028, netti: 100 }, { anno: 2029, netti: 100 }];
  const e = simulaEconomia(righe, { prezzo: 32, prezzi: { 2028: 40 }, listino: "nessuno" }, 10000);
  assert.deepEqual(e.righe.map((r) => r.prezzo), [32, 40, 32]);
  assert.equal(e.righe[1].prezzoDigitato, true);
  vicino(e.totali.ricavi, 100 * (32 + 40 + 32));
  assert.deepEqual(prezziPerAnni([2027, 2028], 32, 10), { 2027: 32, 2028: 35.2 });
});

prova("export CSV con separatore punto e virgola", () => {
  const r = simula({ annoBase, anni: [{ anno: 2027, popolazione: 10000, totale: 3600, seccoProCapite: 80 }], bufferPct: 20 });
  const csv = righeCsv({ nome: "Obiettivo", comune: "Prova", durata: 10, anno_inizio: 2027 }, r);
  assert.ok(csv.includes('"2027";"10000";"3600,0"'));
  assert.ok(csv.startsWith('"Scenario: Obiettivo"'));
});

prova("buffer del Capitolo 7 (Tabelle 15 e 16, tariffa puntuale, massimo 80%)", () => {
  // Esempio del testo: indifferenziato, organico, vetro e centri di raccolta = 15 − 2 = 13%.
  assert.equal(bufferMetodologia({ rifiuti: "rur_org_vetro", centriRaccolta: true }).totale, 13);
  // Scenario EsaCom: solo utenze virtuose 20% + secco e organico 20% dimezzato = 30%.
  assert.equal(bufferMetodologia({ soloVirtuose: true, rifiuti: "rur_org", tariffaPuntuale: true }).totale, 30);
  // Caso limite del testo: 20 + 30 + 30 = 80%.
  assert.equal(bufferMetodologia({ soloVirtuose: true, utenze: "nonres", rifiuti: "rur" }).totale, 80);
});

prova("quota evitata dalle utenze virtuose", () => {
  vicino(quotaVirtuose(0.8, 0), 0.2);          // senza variabilità = riduzione media
  vicino(quotaVirtuose(1.2, 0), 0);           // aumento medio, nessuna utenza virtuosa
  vicino(quotaVirtuose(1, 0.3), 0.3 * 0.398942, 1e-5); // media invariata: σ·φ(0)
  assert.ok(quotaVirtuose(1.2, 0.3) > 0);     // anche se in media peggiora, qualcuno migliora
});

prova("metodo per utenza: solo utenze virtuose, confronto con il bilancio del Comune", () => {
  // Stessa produzione e stesso secco del riferimento: bilancio zero,
  // per utenza crediti dalle sole utenze virtuose.
  const anni = [{ anno: 2027, popolazione: 10000, totale: 4000, seccoProCapite: 140 }];
  const terr = simula({ annoBase, anni, bufferPct: 0 });
  vicino(terr.righe[0].lordi, 0, 1e-6);
  const ut = simula({ annoBase, anni, bufferPct: 30, metodoStima: "utenze", stimaUtenze: { rifiuti: "rur_org", variabilita: 30 } });
  const r = ut.righe[0];
  vicino(r.lordiTerritorio, 0, 1e-6);
  // Secco 1.400 t e organico 1.300 t: (1400 + 1300) × 0,3 × φ(0) t evitate.
  vicino(r.evitateVirtuose, 2700 * 0.3 * 0.398942, 0.01);
  vicino(r.netti, r.lordi * 0.7, 1e-6);
  assert.equal(r.debito, 0);
  // Buffer più basso del minimo del Capitolo 7: avviso.
  assert.ok(simula({ annoBase, anni, bufferPct: 10, metodoStima: "utenze", stimaUtenze: { rifiuti: "rur_org" } }).avvisi.some((a) => a.includes("buffer minimo")));
});

prova("taratura della variabilità su una stima di crediti per abitante", () => {
  const anni = [{ anno: 2027, popolazione: 10000, totale: 4000, seccoProCapite: 140 }];
  const dati = { annoBase, anni, bufferPct: 30, stimaUtenze: { rifiuti: "rur_org" } };
  const v = taraVariabilita(dati, 0.19);
  assert.ok(v > 0 && v < 150);
  const r = simula({ ...dati, metodoStima: "utenze", stimaUtenze: { rifiuti: "rur_org", variabilita: v } });
  vicino(r.righe[0].netti / 10000, 0.19, 0.002);
  assert.equal(taraVariabilita(dati, 50), null); // irraggiungibile
});

console.log(`${n} prove superate`);
