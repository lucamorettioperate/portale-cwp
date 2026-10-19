/* =========================================================================
   simulatore.js — motore del simulatore di scenari (stima ex ante dei
   crediti di un Comune su 7, 10 o 21 anni).

   Scopo: dati i rifiuti dell'anno base (per tipologia) e, per ogni anno del
   periodo, gli obiettivi di produzione totale e di secco residuo pro capite,
   ricalcola la percentuale di raccolta differenziata e stima i crediti
   anno per anno con le formule della Metodologia CWP v1.2:
   - emissioni di una quantità di rifiuti: E = − Σ Q(r) × FE(r)
     (formule 13 e 25, FE = FErid della Tabella 3/4, come in calcolo.js);
   - fattore dell'indifferenziato (secco): media dei fattori delle frazioni
     a recupero pesata con le quantità dell'anno base (formule 16-17);
   - variazione di impatto ΔI = EP − EA; crediti lordi = −ΔI se negativa;
     crediti netti = lordi × (1 − buffer) (formule 31-32, Cap. 7).

   Modello semplificato (da confermare con la Fondazione, docs/crediti-cwp.md):
   - scenario di riferimento (EA) dell'anno = produzione pro capite
     dell'anno base, per tipologia, × popolazione dell'anno;
   - scenario simulato (EP) dell'anno = secco obiettivo + differenziata
     (totale − secco) ripartita tra le frazioni con le proporzioni
     dell'anno base;
   - non c'è la Banca Dati Utenze: è una stima a livello di Comune, non un
     calcolo certificabile.
   Conseguenza da far notare all'utente: poiché il fattore del secco è la
   media dei fattori della differenziata, spostare rifiuti dal secco alla
   differenziata a parità di totale alza la % di differenziata ma non
   genera crediti; i crediti nascono dalla riduzione dei rifiuti prodotti
   rispetto allo scenario di riferimento (prevenzione).

   Usato da: src/pages/Simulatore.jsx; prove in test/simulatore.test.mjs.
   Dati/servizi coinvolti: nessuno (solo calcoli). Gli scenari si salvano in
   scenario_simulazione (supabase/28_simulatore.sql) tramite scenari.js.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti», backlog 37.
   ========================================================================= */
import { TIPOLOGIE_RIFIUTO } from "./parametri.js";
import { fattoreIndifferenziato } from "./calcolo.js";
import { TABELLA3_CLUSTER } from "./qualita.js";

// Durate ammesse del periodo (Standard 4.3.8: 10 anni, oppure 7 rinnovabili
// fino a 21). Il database accetta solo questi valori (script 28).
export const DURATE = [7, 10, 21];
export const BUFFER_PREDEFINITO = 20; // % (Cap. 7, valore cautelativo)

// Converte in numero (accetta la virgola decimale); vuoto o non valido → 0.
const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const somma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

// Tipologie di rifiuto del simulatore (stessi id del calcolo crediti).
export const TIPOLOGIE = TIPOLOGIE_RIFIUTO.map((t) => ({ id: t.id, nome: t.nome }));
const SECCO = "indifferenziato";

// Fattori predefiniti { id: { fe, recupero } } dalla Metodologia.
export function fattoriPredefiniti() {
  const f = {};
  TIPOLOGIE_RIFIUTO.forEach((t) => {
    f[t.id] = { fe: t.fe, recupero: t.recupero };
  });
  return f;
}

// Dati iniziali di un nuovo scenario (anno base vuoto, buffer 20%).
export function datiIniziali(annoInizio) {
  return {
    annoBase: { anno: annoInizio - 1, popolazione: "", cluster: "", rifiuti: {} },
    bufferPct: BUFFER_PREDEFINITO,
    anni: [],
  };
}

/* Riepilogo dell'anno base. Parametro: annoBase { popolazione, rifiuti:
   { tipologia: tonnellate } }. Restituisce totale (t), pro capite (kg/ab),
   secco (t e kg/ab), differenziata (t), % differenziata, composizione della
   differenziata (quote per tipologia) e fattore del secco (formule 16-17). */
export function riepilogoAnnoBase(annoBase, fattori = fattoriPredefiniti()) {
  const pop = num(annoBase?.popolazione);
  const rifiuti = {};
  Object.entries(annoBase?.rifiuti || {}).forEach(([t, q]) => {
    if (num(q) > 0) rifiuti[t] = num(q);
  });
  const totale = somma(Object.values(rifiuti), (q) => q);
  const secco = rifiuti[SECCO] || 0;
  const differenziata = totale - secco;
  const composizione = {};
  Object.entries(rifiuti).forEach(([t, q]) => {
    if (t !== SECCO && differenziata > 0) composizione[t] = q / differenziata;
  });
  const ind = fattoreIndifferenziato(rifiuti, fattori);
  return {
    popolazione: pop,
    rifiuti,
    totale,
    proCapite: pop ? (totale * 1000) / pop : 0,
    secco,
    seccoProCapite: pop ? (secco * 1000) / pop : 0,
    differenziata,
    rd: totale ? (differenziata / totale) * 100 : 0,
    composizione,
    feSecco: ind.fe,
  };
}

// Rifiuti dell'anno base dai valori medi pro capite della Tabella 3 dello
// Standard per un cluster SOSE (1-10): kg/ab × popolazione → tonnellate.
export function rifiutiDaCluster(cluster, popolazione) {
  const k = Number(cluster);
  const pop = num(popolazione);
  if (!(k >= 1 && k <= 10) || !pop) return {};
  const out = {};
  Object.entries(TABELLA3_CLUSTER).forEach(([t, valori]) => {
    out[t] = Math.round((valori[k - 1] * pop) / 1000 * 10) / 10;
  });
  return out;
}

// Rifiuti dell'anno base da un calcolo dei crediti esistente
// (calcolo_crediti.dati.rifiuti: [{ tipologia, qtot, considerato }]).
export function rifiutiDaCalcolo(datiCalcolo) {
  const out = {};
  (datiCalcolo?.rifiuti || []).forEach((r) => {
    if (r.considerato === false || !r.tipologia) return;
    out[r.tipologia] = Math.round(((out[r.tipologia] || 0) + num(r.qtot)) * 1000) / 1000;
  });
  return out;
}

/* Anni del periodo: N righe { anno, popolazione, totale, seccoProCapite }
   dall'anno di inizio. Conserva i valori già inseriti per gli stessi anni;
   i nuovi anni partono dai valori dell'anno base (nessun cambiamento). */
export function anniDelPeriodo({ durata, annoInizio, anni = [], base }) {
  const perAnno = new Map(anni.map((a) => [Number(a.anno), a]));
  return Array.from({ length: Number(durata) }, (_, i) => {
    const anno = Number(annoInizio) + i;
    const predefinito = {
      anno,
      popolazione: base?.popolazione || "",
      totale: base?.totale ? Math.round(base.totale * 10) / 10 : "",
      seccoProCapite: base?.seccoProCapite ? Math.round(base.seccoProCapite * 10) / 10 : "",
    };
    // I campi lasciati vuoti prendono il valore dell'anno base (utile se
    // l'anno base si compila dopo aver creato lo scenario).
    const esistente = perAnno.get(anno) || {};
    const pieno = {};
    Object.entries(esistente).forEach(([k, v]) => {
      if (v !== "" && v != null) pieno[k] = v;
    });
    return { ...predefinito, ...pieno, anno };
  });
}

/* Traiettoria lineare: dall'anno base agli obiettivi dell'ultimo anno
   (produzione pro capite e secco pro capite in kg/ab). La popolazione
   resta quella già indicata per ogni anno (o quella dell'anno base). */
export function traiettoriaLineare({ anni, base, proCapiteFinale, seccoProCapiteFinale }) {
  const n = anni.length;
  const pc0 = base.proCapite;
  const sc0 = base.seccoProCapite;
  const pcF = proCapiteFinale === "" || proCapiteFinale == null ? pc0 : num(proCapiteFinale);
  const scF = seccoProCapiteFinale === "" || seccoProCapiteFinale == null ? sc0 : num(seccoProCapiteFinale);
  return anni.map((a, i) => {
    const quota = (i + 1) / n;
    const pop = num(a.popolazione) || base.popolazione;
    const pc = pc0 + (pcF - pc0) * quota;
    const sc = sc0 + (scF - sc0) * quota;
    return {
      ...a,
      popolazione: pop,
      totale: Math.round(((pc * pop) / 1000) * 10) / 10,
      seccoProCapite: Math.round(sc * 10) / 10,
    };
  });
}

/* Simulazione. Parametro dati { annoBase, anni, bufferPct, fattori? }.
   Restituisce { base, righe: [per anno], totali, avvisi }.
   Ogni riga: anno, popolazione, totale (t), proCapite (kg/ab), secco (t),
   seccoProCapite, differenziata (t), rd (%), riferimento (t, scenario di
   riferimento), riduzione (t), EA ed EP (tCO₂eq), deltaI, lordi, buffer,
   netti, debito (tCO₂eq) e cumulati. */
export function simula(dati) {
  const avvisi = [];
  const fattori = { ...fattoriPredefiniti(), ...(dati.fattori || {}) };
  const base = riepilogoAnnoBase(dati.annoBase, fattori);
  const bufferPct = Math.min(Math.max(num(dati.bufferPct), 0), 100);
  if (!base.popolazione) avvisi.push("Manca la popolazione dell'anno base.");
  if (!base.totale) avvisi.push("Mancano i rifiuti dell'anno base.");
  if (base.totale && !base.secco) avvisi.push("Nell'anno base manca il secco residuo (indifferenziato).");
  if (base.feSecco == null && base.totale) avvisi.push("Non è possibile ricavare il fattore del secco: servono frazioni a recupero con fattore di emissione.");
  if (!base.popolazione || !base.totale || base.feSecco == null) {
    return { base, righe: [], totali: null, avvisi };
  }

  // Fattore di una tipologia: secco = media pesata (formule 16-17);
  // tipologie senza fattore (es. metallo) contano zero, con avviso.
  const senzaFattore = new Set();
  const fe = (t) => {
    if (t === SECCO) return base.feSecco;
    const f = fattori[t]?.fe;
    if (f == null || !Number.isFinite(Number(f))) {
      senzaFattore.add(t);
      return 0;
    }
    return Number(f);
  };
  // Emissioni (tCO₂eq) di un insieme { tipologia: t }: − Σ Q × FE.
  const emissioni = (q) => somma(Object.entries(q), ([t, t_]) => -t_ * fe(t));

  let cumLordi = 0;
  let cumNetti = 0;
  const righe = (dati.anni || []).map((a) => {
    const pop = num(a.popolazione) || base.popolazione;
    const fattorePop = pop / base.popolazione;
    // Scenario di riferimento: pro capite dell'anno base × popolazione.
    const riferimento = {};
    Object.entries(base.rifiuti).forEach(([t, q]) => {
      riferimento[t] = q * fattorePop;
    });
    const totRiferimento = base.totale * fattorePop;
    // Scenario simulato: secco obiettivo + differenziata con la
    // composizione dell'anno base.
    let totale = num(a.totale);
    let secco = (num(a.seccoProCapite) * pop) / 1000;
    if (!totale) {
      avvisi.push(`Anno ${a.anno}: manca la produzione totale prevista.`);
    }
    if (secco > totale) {
      avvisi.push(`Anno ${a.anno}: il secco previsto supera la produzione totale; considerato uguale al totale.`);
      secco = totale;
    }
    const differenziata = totale - secco;
    const progetto = { [SECCO]: secco };
    Object.entries(base.composizione).forEach(([t, quota]) => {
      progetto[t] = differenziata * quota;
    });
    const EA = emissioni(riferimento);
    const EP = emissioni(progetto);
    const deltaI = EP - EA;
    const lordi = deltaI < 0 ? -deltaI : 0;
    const debito = deltaI > 0 ? deltaI : 0;
    const quotaBuffer = (lordi * bufferPct) / 100;
    const netti = lordi - quotaBuffer;
    cumLordi += lordi;
    cumNetti += netti;
    return {
      anno: Number(a.anno),
      popolazione: pop,
      totale,
      proCapite: pop ? (totale * 1000) / pop : 0,
      secco,
      seccoProCapite: pop ? (secco * 1000) / pop : 0,
      differenziata,
      rd: totale ? (differenziata / totale) * 100 : 0,
      riferimento: totRiferimento,
      riduzione: totRiferimento - totale,
      EA,
      EP,
      deltaI,
      lordi,
      buffer: quotaBuffer,
      netti,
      debito,
      cumulatoLordi: cumLordi,
      cumulatoNetti: cumNetti,
    };
  });
  if (senzaFattore.size) {
    avvisi.push(`Tipologie senza fattore di emissione, escluse dal calcolo: ${[...senzaFattore].join(", ")}.`);
  }
  const ultimo = righe[righe.length - 1];
  const totali = righe.length
    ? {
        anni: righe.length,
        lordi: cumLordi,
        buffer: somma(righe, (r) => r.buffer),
        netti: cumNetti,
        debito: somma(righe, (r) => r.debito),
        riduzione: somma(righe, (r) => r.riduzione),
        rdFinale: ultimo.rd,
        proCapiteFinale: ultimo.proCapite,
        seccoProCapiteFinale: ultimo.seccoProCapite,
        mediaAnnuaNetti: cumNetti / righe.length,
      }
    : null;
  return { base, bufferPct, righe, totali, avvisi: [...new Set(avvisi)] };
}

// Righe per l'export CSV (separatore «;», decimali con la virgola).
export function righeCsv(scenario, risultato) {
  const f = (v, d = 1) => (v == null ? "" : Number(v).toFixed(d).replace(".", ","));
  const intest = ["Anno", "Popolazione", "Produzione totale (t)", "Pro capite (kg/ab)", "Secco (t)", "Secco pro capite (kg/ab)", "Differenziata (t)", "% differenziata", "Scenario di riferimento (t)", "Riduzione (t)", "Crediti lordi (tCO2eq)", "Buffer (tCO2eq)", "Crediti netti (tCO2eq)", "Netti cumulati (tCO2eq)"];
  const righe = risultato.righe.map((r) => [r.anno, Math.round(r.popolazione), f(r.totale), f(r.proCapite), f(r.secco), f(r.seccoProCapite), f(r.differenziata), f(r.rd), f(r.riferimento), f(r.riduzione), f(r.lordi), f(r.buffer), f(r.netti), f(r.cumulatoNetti)]);
  const testa = [[`Scenario: ${scenario.nome}`], [`Comune: ${scenario.comune}`], [`Durata: ${scenario.durata} anni dal ${scenario.anno_inizio}`], ["Stima ex ante non certificabile (Metodologia CWP v1.2, modello semplificato)"], []];
  return [...testa, intest, ...righe].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
