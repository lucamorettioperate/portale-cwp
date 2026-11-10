/* =========================================================================
   rilievi_t3.test.mjs — prove dei rilievi del terzo collaudo
   («TEST_PORTALE_CWP_9_11_2026», mandato da Luca Moretti il 10/11/2026):
   - T34: il buffer mostrato nel passo «Buffer» è quello del motore
     (calcolaBuffer) sulle caselle spuntate: per il calcolo di prova di
     Borgoval (solo utenze virtuose, secco e organico misurati) è 40%, lo
     stesso dei risultati salvati; spuntando le cinque frazioni, le misure
     ai centri e la tariffa puntuale scende intorno al 10%;
   - T36: filtro delle fasi della Dashboard su 6 fasi (NUMERO_FASI).
   T37 (conferma nascosta per gli ex post non confermabili) usa la stessa
   regola del database (trg_calcolo_ex_post, provata in t48.sql).
   Uso: node test/rilievi_t3.test.mjs (anche dentro npm test).
   ========================================================================= */
import assert from "node:assert/strict";
import { calcolaBuffer } from "../src/lib/crediti/calcolo.js";
import { NUMERO_FASI } from "../src/lib/cwpProgram.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

// Opzioni salvate nel calcolo di prova di Borgoval (26/10/2026).
const borgoval = {
  soloVirtuose: true, bufferVirtuose: 20, bufferManuale: "", motivazioneBuffer: "",
  rifiutiMisurati: { indifferenziato: true, organico: true },
  utenzeMonitorate: { res: true, nonres: true, und: true }, categorieUndNonMonitorate: 0,
  misuraCentralizzate: false, misuraAltriNonCentralizzati: false, tariffaPuntuale: false,
};

prova("T34: buffer di Borgoval con le opzioni salvate = 40% (come i risultati salvati)", () => {
  assert.equal(calcolaBuffer(borgoval).totale, 40);
});

prova("T34: con cinque frazioni, misure ai centri e fuori, tariffa puntuale il buffer scende", () => {
  const b = calcolaBuffer({
    ...borgoval,
    soloVirtuose: false,
    rifiutiMisurati: { indifferenziato: true, organico: true, carta: true, plastica: true, vetro: true },
    misuraCentralizzate: true, misuraAltriNonCentralizzati: true, tariffaPuntuale: true,
  });
  assert.ok(b.totale < 10, `buffer ${b.totale}%`);
});

prova("T36: il filtro delle fasi ha 6 voci", () => {
  assert.equal(NUMERO_FASI, 6);
});

console.log(`${n} prove superate (rilievi del terzo collaudo).`);
