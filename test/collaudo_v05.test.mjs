/* =========================================================================
   collaudo_v05.test.mjs — prove di regressione dell'integrazione V05 del
   collaudo (profili Cliente A/B e Operatore, 20-21/10/2026).
   D05-R1: nel dettaglio dell'Audit i testi lunghi erano accorciati a 77
   caratteri anche aprendo «1 modifica»: due note con lo stesso inizio
   sembravano uguali. Ora il valore intero resta leggibile e si calcola la
   parte tolta / aggiunta. Casi chiesti dal collaudo: stringhe vuote,
   brevi, di 80/81 caratteri, lungo prefisso comune, più righe.
   Uso: npm test (oppure node test/collaudo_v05.test.mjs).
   Registro sviluppo e deploy: capitolo «Collaudo».
   ========================================================================= */
import assert from "node:assert/strict";
import { valoreBreve, valoreCompleto, valoreLungo, differenzaTesto, testoRicercaEvento, etichettaOggetto, modificheEvento } from "../src/lib/auditDettaglio.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

// Le due note reali del collaudo (OP09): testo originale e testo con la riga temporanea.
const ORIGINALE = "Organizzazione interamente fittizia per il collaudo del 20/10/2026. Solo dati sintetici. Non usare per atti, comunicazioni o crediti ufficiali. Gruppo B per verifica separazione dati.";
const RIGA = "COLLAUDO V05 20261021: prova temporanea di salvataggio e riapertura come Operatore; da ripristinare.";
const CON_RIGA = ORIGINALE + "\n" + RIGA;
const aggiunta = { oggetto_tipo: "organizzazione", oggetto_id: "916f3283-aaaa-bbbb-cccc-000000000000", dettaglio: { note: { da: ORIGINALE, a: CON_RIGA } } };
const ripristino = { oggetto_tipo: "organizzazione", oggetto_id: "916f3283-aaaa-bbbb-cccc-000000000000", dettaglio: { note: { da: CON_RIGA, a: ORIGINALE } } };

prova("D05-R1: nella riga i due valori sembrano uguali, ma il testo completo è integro", () => {
  const [m] = modificheEvento(aggiunta);
  assert.equal(valoreBreve(m.da), valoreBreve(m.a)); // il limite osservato
  assert.equal(valoreCompleto(m.a), CON_RIGA); // intero, con l'a capo
  assert.equal(valoreLungo(m.da), true);
});
prova("D05-R1: aggiunta e rimozione della riga temporanea si distinguono", () => {
  const d1 = differenzaTesto(ORIGINALE, CON_RIGA);
  assert.equal(d1.tolto, "");
  assert.equal(d1.aggiunto, "\n" + RIGA);
  assert.equal(d1.inizio, ORIGINALE.length);
  const d2 = differenzaTesto(CON_RIGA, ORIGINALE);
  assert.equal(d2.tolto, "\n" + RIGA);
  assert.equal(d2.aggiunto, "");
});
prova("D05-R1: vuoti, brevi, 80 e 81 caratteri, più righe", () => {
  assert.equal(valoreLungo(""), false);
  assert.equal(valoreLungo(null), false);
  assert.equal(valoreLungo("breve"), false);
  const s80 = "x".repeat(80);
  const s81 = "x".repeat(81);
  assert.equal(valoreLungo(s80), false);
  assert.equal(valoreBreve(s80), s80);
  assert.equal(valoreLungo(s81), true);
  assert.equal(valoreBreve(s81).length, 78); // 77 caratteri + «…»
  assert.equal(valoreLungo("riga 1\nriga 2"), true);
  assert.deepEqual(differenzaTesto("", "nuovo"), { inizio: 0, tolto: "", aggiunto: "nuovo", fine: 0 });
  assert.deepEqual(differenzaTesto("abcXdef", "abcYYdef"), { inizio: 3, tolto: "X", aggiunto: "YY", fine: 3 });
  // caratteri speciali conservati così come sono (la pagina li mostra come testo)
  assert.equal(valoreCompleto("<b>=1+1</b>"), "<b>=1+1</b>");
});
prova("D05-R1: la ricerca trova la riga temporanea e il nome dell'organizzazione", () => {
  const nomi = { "916f3283-aaaa-bbbb-cccc-000000000000": "COLLAUDO AL V03 - COMUNE B - 20261020" };
  assert.ok(testoRicercaEvento(aggiunta, nomi).includes("prova temporanea di salvataggio"));
  assert.ok(testoRicercaEvento(ripristino, nomi).includes("COMUNE B"));
  assert.equal(etichettaOggetto(aggiunta, nomi), "Organizzazione «COLLAUDO AL V03 - COMUNE B - 20261020» (916f3283)");
  // creazione di un'organizzazione: nome dalla denominazione registrata
  assert.match(etichettaOggetto({ oggetto_tipo: "organizzazione", oggetto_id: "12345678-x", dettaglio: { denominazione: "Comune X" } }), /«Comune X» \(12345678\)/);
});

console.log(`${n} prove superate (collaudo V05).`);
