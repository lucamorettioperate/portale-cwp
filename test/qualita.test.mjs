/* =========================================================================
   qualita.test.mjs — test dei controlli di qualità dei dati
   (src/lib/crediti/qualita.js)

   Scopo: verificare il confronto con la Tabella 3 dello Standard CWP
   (soglia ±30%) e gli indicatori di completezza, unicità, letture a buon
   fine e tempestività.
   Uso: npm test (oppure node test/qualita.test.mjs).
   Esito: "✓" per prova e "N prove superate"; altrimenti si ferma con
   l'errore.
   Registro sviluppo e deploy: capitolo «Codice sorgente» (prove automatiche).
   ========================================================================= */
import assert from "node:assert/strict";
import { scostamentiTabella3, indicatoriQualita } from "../src/lib/crediti/qualita.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

prova("Tabella 3: scostamenti e soglia del 30%", () => {
  // Cluster 4, 10.000 abitanti: indifferenziato 95 kg/ab → 950 t; organico 82 kg/ab.
  const r = scostamentiTabella3({ rifiuti: [{ tipologia: "indifferenziato", qtot: 950 }, { tipologia: "organico", qtot: 1200 }, { tipologia: "metallo", qtot: 5 }], popolazione: 10000, cluster: 4 });
  const ind = r.find((x) => x.tipologia === "indifferenziato");
  const org = r.find((x) => x.tipologia === "organico");
  assert.equal(Math.round(ind.scostamento), 0);
  assert.equal(ind.oltre, false);
  assert.equal(Math.round(org.procapite), 120);
  assert.equal(org.oltre, true);
  assert.equal(r.some((x) => x.tipologia === "metallo"), false);
  assert.deepEqual(scostamentiTabella3({ rifiuti: [{ tipologia: "carta", qtot: 1 }], popolazione: 0, cluster: 4 }), []);
});
prova("indicatori: completezza, unicità, letture, tempestività", () => {
  const i = indicatoriQualita({
    anno: 2025, annoDati: 2024,
    classiUd: [{ n: 10 }], classiUnd: [],
    conferimenti: [{ utenza: "a", tipologia: "carta" }, { utenza: "a", tipologia: "carta" }, { utenza: "b", tipologia: "carta" }],
    conteggi: { letture: 100, lettureUsate: 65 },
  });
  assert.equal(i[0].esito, "avviso"); // 2 utenze su 10
  assert.equal(i[1].valore, "1");
  assert.equal(i[2].esito, "avviso"); // 65% < 70%
  assert.equal(i[3].esito, "avviso"); // anno diverso
});
console.log(`${n} prove superate`);
