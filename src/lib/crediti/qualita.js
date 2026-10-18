/* =========================================================================
   qualita.js — controlli del documento «Gestione della qualità dei dati»
   del Programma CWP (v1.2 del 04/09/2025).

   Scopo: indicatori di qualità dei dati di un calcolo dei crediti, oltre ai
   controlli di coerenza di tracciato.js:
   - soglia di scostamento ±30% (cap. 3.1.2) tra la produzione pro capite
     dei rifiuti del territorio e i valori medi del cluster SOSE della
     Tabella 3 dello Standard CWP: oltre la soglia serve una motivazione
     (la pagina non conferma il calcolo senza);
   - completezza: utenze della Banca Dati rispetto alla delibera;
   - unicità: utenze ripetute con la stessa tipologia;
   - letture a buon fine: letture valide sulle letture importate (la
     Metodologia, cap. 8.1, chiede almeno il 70%, o il 50% se il contratto
     prevede penali al gestore);
   - tempestività: anno dei dati uguale all'anno del calcolo.

   Usato da: src/pages/CalcoloCrediti.jsx (passo «Risultati») e dal
   rapporto PDF; prove in test/qualita.test.mjs.
   Dati/servizi coinvolti: nessuno (solo calcoli).
   Registro sviluppo e deploy: capitolo «Calcolo crediti».
   ========================================================================= */

// Standard CWP, Tabella 3: quantità pro capite media (kg/ab/anno) per
// frazione e cluster SOSE 1-10 (Catasto ISPRA). Chiavi = id delle
// tipologie di parametri.js (il metallo non è nella tabella).
export const TABELLA3_CLUSTER = {
  organico: [85, 64, 90, 82, 125, 70, 99, 77, 101, 122],
  verde: [26, 21, 38, 61, 50, 37, 29, 11, 21, 31],
  carta: [74, 51, 50, 62, 63, 59, 66, 42, 56, 57],
  vetro: [38, 52, 38, 43, 56, 43, 40, 40, 34, 46],
  legno: [16, 18, 15, 29, 16, 23, 18, 9, 18, 14],
  plastica: [29, 29, 32, 33, 33, 29, 32, 25, 28, 27],
  raee: [4, 7, 5, 5, 5, 6, 5, 4, 4, 5],
  tessili: [3, 2, 3, 3, 3, 3, 3, 2, 3, 3],
  inerti: [5, 5, 5, 10, 5, 9, 6, 3, 6, 6],
  ingombranti: [15, 25, 18, 22, 23, 26, 18, 16, 18, 22],
  indifferenziato: [218, 225, 123, 95, 267, 135, 141, 137, 137, 204],
};

// Standard CWP, Tabella 2: descrizione breve dei cluster.
export const CLUSTER = [
  "Poli urbani",
  "Comuni interni montani, bassa densità, età media avanzata",
  "Comuni di pianura del nord-est, basso benessere",
  "Comuni di pianura, benessere medio-alto",
  "Comuni turistici montani o litoranei",
  "Comuni montani dell'arco alpino e appennino centro-nord",
  "Hinterland delle grandi città",
  "Comuni montani dell'appennino centro-sud",
  "Comuni del centro-sud ad alta densità",
  "Comuni litoranei a basso benessere",
];

export const SOGLIA_SCOSTAMENTO = 30; // % (Gestione qualità dati, cap. 3.1.2)
export const LETTURE_MINIME = 70; // % (Metodologia, cap. 8.1)
export const LETTURE_MINIME_PENALI = 50; // % con penali al gestore

const n0 = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Confronto con la Tabella 3. Parametri: rifiuti del territorio (qtot in
// tonnellate, per tipologia), popolazione residente, cluster (1-10).
// Restituisce le righe { tipologia, procapite, riferimento, scostamento,
// oltre } per le tipologie presenti nella tabella; [] se mancano
// popolazione o cluster.
export function scostamentiTabella3({ rifiuti = [], popolazione, cluster }) {
  const pop = n0(popolazione);
  const k = Number(cluster);
  if (!pop || !(k >= 1 && k <= 10)) return [];
  const perTipo = {};
  rifiuti.forEach((r) => { perTipo[r.tipologia] = (perTipo[r.tipologia] || 0) + n0(r.qtot); });
  return Object.entries(perTipo)
    .filter(([t]) => TABELLA3_CLUSTER[t])
    .map(([t, tonnellate]) => {
      const procapite = (tonnellate * 1000) / pop;
      const riferimento = TABELLA3_CLUSTER[t][k - 1];
      const scostamento = riferimento ? ((procapite - riferimento) / riferimento) * 100 : null;
      return { tipologia: t, procapite, riferimento, scostamento, oltre: scostamento != null && Math.abs(scostamento) > SOGLIA_SCOSTAMENTO };
    });
}

// Indicatori di qualità. Parametri: anno del calcolo, anno indicato nel
// tracciato, classi della delibera, Banca Dati Utenze (conferimenti),
// conteggi dell'ultimo import (letture, lettureUsate). Ogni indicatore è
// { nome, valore, esito: "ok" | "avviso" | "nd", nota }.
export function indicatoriQualita({ anno, annoDati, classiUd = [], classiUnd = [], conferimenti = [], conteggi = null }) {
  const out = [];
  // Completezza
  const utenze = new Map();
  conferimenti.forEach((c) => { if (!utenze.has(c.utenza)) utenze.set(c.utenza, Number(c.nUtenze) || 1); });
  const inBdu = [...utenze.values()].reduce((s, v) => s + v, 0);
  const inDelibera = [...classiUd, ...classiUnd].reduce((s, c) => s + n0(c.n), 0);
  if (inDelibera && inBdu) {
    const pct = (inBdu / inDelibera) * 100;
    out.push({ nome: "Completezza (utenze della Banca Dati sulla delibera)", valore: `${pct.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`, esito: pct >= 90 ? "ok" : "avviso", nota: `${inBdu.toLocaleString("it-IT")} su ${inDelibera.toLocaleString("it-IT")}` });
  } else {
    out.push({ nome: "Completezza (utenze della Banca Dati sulla delibera)", valore: "—", esito: "nd", nota: "mancano la delibera o la Banca Dati" });
  }
  // Unicità
  const viste = new Map();
  conferimenti.forEach((c) => { const k = `${c.utenza}|${c.tipologia}`; viste.set(k, (viste.get(k) || 0) + 1); });
  const doppie = [...viste.values()].filter((v) => v > 1).length;
  out.push({ nome: "Unicità (utenza e tipologia ripetute)", valore: String(doppie), esito: doppie ? "avviso" : "ok", nota: doppie ? "le righe ripetute si sommano: verificare che non siano duplicati" : "nessun duplicato" });
  // Letture a buon fine
  if (conteggi && conteggi.letture) {
    const pct = (n0(conteggi.lettureUsate) / n0(conteggi.letture)) * 100;
    out.push({
      nome: "Letture valide sulle letture importate",
      valore: `${pct.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`,
      esito: pct >= LETTURE_MINIME ? "ok" : "avviso",
      nota: pct >= LETTURE_MINIME ? `almeno il ${LETTURE_MINIME}% (Metodologia 8.1)` : `sotto il ${LETTURE_MINIME}% (${LETTURE_MINIME_PENALI}% ammesso solo con penali al gestore)`,
    });
  } else {
    out.push({ nome: "Letture valide sulle letture importate", valore: "—", esito: "nd", nota: "dati importati già come totali annui (foglio 5): chiedere al gestore la % di letture a buon fine" });
  }
  // Tempestività
  if (annoDati && anno) {
    const ok = Number(annoDati) === Number(anno);
    out.push({ nome: "Tempestività (anno dei dati)", valore: String(annoDati), esito: ok ? "ok" : "avviso", nota: ok ? "uguale all'anno del calcolo" : `diverso dall'anno del calcolo (${anno})` });
  } else {
    out.push({ nome: "Tempestività (anno dei dati)", valore: "—", esito: "nd", nota: "anno non indicato nel tracciato" });
  }
  return out;
}
