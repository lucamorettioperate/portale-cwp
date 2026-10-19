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

   Conformità al modello CWP (controllata il 19/10/2026):
   - scenario di riferimento = anno di riferimento dello Standard 4.8.1:
     l'anno in cui il Comune ha raggiunto il 65% di differenziata (tra 64%
     e 66%, Catasto ISPRA) oppure, se non c'è, i valori medi pro capite del
     cluster SOSE (Tabella 3) × popolazione ISPRA 2022; il simulatore
     avvisa se la % dell'anno indicato è fuori dall'intervallo
     (addizionalità normativa, Standard 4.9.1) e se le quantità si
     scostano più del 30% dalla Tabella 3 (Gestione qualità dei dati 3.1.2);
   - stima ex ante a livello di Comune: ammessa dalla Metodologia (Cap. 6.1,
     semplificazione a: valori medi su tutte le utenze; Cap. 6.2: emissioni
     di progetto ex ante anche «complessivamente a livello di Ente»);
   - beni a riuso: zero nella stima ex ante (Cap. 6.1); nessun leakage
     (Cap. 6.3); durata 7 (fino a 3 volte) o 10 anni (Standard 4.3.8).
   Modello semplificato (da confermare con la Fondazione, docs/crediti-cwp.md):
   - scenario di riferimento (EA) dell'anno = produzione pro capite
     dell'anno di riferimento, per tipologia, × popolazione dell'anno
     (i valori attesi per utenza applicati alle utenze presenti);
   - situazione attuale (facoltativa): punto di partenza degli obiettivi
     annui e della traiettoria; se manca si parte dal riferimento;
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
import { TABELLA3_CLUSTER, scostamentiTabella3 } from "./qualita.js";
import {
  ISCRIZIONE_PROGETTO, ISCRIZIONE_RAPPORTO, SALDO_PROGETTO, SALDO_RAPPORTO, VARIABILE_PROGETTO, VARIABILE_RAPPORTO,
  saldoPerPopolazione, tariffaEmissione, tariffaVendita,
} from "../tariffe.js";

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
    // annoBase = scenario di riferimento (Standard 4.8.1); metodo "anno"
    // (anno con differenziata 64-66%) o "cluster" (Tabella 3 × pop. 2022).
    annoBase: { metodo: "anno", anno: "", popolazione: "", cluster: "", rifiuti: {} },
    // Situazione attuale (facoltativa): punto di partenza degli obiettivi.
    attuale: { anno: "", popolazione: "", proCapite: "", seccoProCapite: "" },
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
  // Composizione della differenziata: solo le frazioni a recupero con un
  // fattore di emissione, come nella formula 17 (le altre, es. metallo,
  // non entrano nel calcolo delle emissioni). Così il fattore del secco e
  // la differenziata usano gli stessi pesi.
  const conFattore = Object.entries(rifiuti).filter(
    ([t]) => t !== SECCO && fattori[t]?.recupero && Number.isFinite(Number(fattori[t]?.fe)) && fattori[t]?.fe !== null
  );
  const diffConFattore = somma(conFattore, ([, q]) => q);
  const composizione = {};
  conFattore.forEach(([t, q]) => {
    if (diffConFattore > 0) composizione[t] = q / diffConFattore;
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

// Intervallo dello Standard 4.8.1 per l'anno di riferimento (65% ± 1%).
export const RD_RIFERIMENTO_MIN = 64;
export const RD_RIFERIMENTO_MAX = 66;
// Soglia minima di differenziata del Programma (obiettivo di legge, Standard
// 4.8.1 e 4.9.1): lo scenario di riferimento si porta sempre al 65% e i
// risultati si calcolano per differenza da questa soglia (richiesta di Luca
// del 19/10/2026).
export const RD_SOGLIA = 65;
// Produzione pro capite plausibile (kg/ab/anno): fuori da qui quasi sempre
// i dati sono in un'unità di misura sbagliata.
const PRO_CAPITE_MIN = 150;
const PRO_CAPITE_MAX = 1200;

/* Punto di partenza degli obiettivi: la situazione attuale se compilata
   (pro capite e secco pro capite), altrimenti lo scenario di riferimento.
   Restituisce { popolazione, totale, proCapite, seccoProCapite, fonte }. */
export function puntoDiPartenza(base, attuale) {
  const pc = num(attuale?.proCapite);
  const sc = num(attuale?.seccoProCapite);
  if (pc > 0) {
    const pop = num(attuale?.popolazione) || base.popolazione;
    return { popolazione: pop, totale: (pc * pop) / 1000, proCapite: pc, seccoProCapite: sc || base.seccoProCapite, fonte: "attuale" };
  }
  return { popolazione: base.popolazione, totale: base.totale, proCapite: base.proCapite, seccoProCapite: base.seccoProCapite, fonte: "riferimento" };
}

/* Anni del periodo: N righe { anno, popolazione, totale, seccoProCapite }
   dall'anno di inizio. Conserva i valori già inseriti per gli stessi anni;
   i nuovi anni partono dal punto di partenza (nessun cambiamento).
   Parametro base: riepilogo del riferimento o puntoDiPartenza(). */
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

/* Traiettoria lineare: dal punto di partenza (situazione attuale o
   riferimento: parametro base) agli obiettivi dell'ultimo anno
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
  if (!base.popolazione) avvisi.push("Manca la popolazione dello scenario di riferimento.");
  if (!base.totale) avvisi.push("Mancano i rifiuti dello scenario di riferimento.");
  if (base.totale && !base.secco) avvisi.push("Nello scenario di riferimento manca il secco residuo (indifferenziato).");
  // Conformità dello scenario di riferimento (Standard 4.8.1 e 4.9.1): il
  // riferimento si porta sempre alla soglia del 65% di differenziata.
  const metodo = dati.annoBase?.metodo || "anno";
  if (base.totale && Math.abs(base.rd - RD_SOGLIA) > 1e-6) {
    avvisi.push(`I dati del riferimento hanno il ${base.rd.toFixed(1).replace(".", ",")}% di differenziata: il calcolo li riporta alla soglia del ${RD_SOGLIA}% (Standard 4.8.1), con la stessa produzione totale e il secco al ${100 - RD_SOGLIA}%.`);
  }
  if (base.totale && base.popolazione && (base.proCapite < PRO_CAPITE_MIN || base.proCapite > PRO_CAPITE_MAX)) {
    avvisi.push(`Produzione del riferimento di ${base.proCapite.toFixed(1).replace(".", ",")} kg per abitante all'anno: valore fuori scala (di solito tra 300 e 700). Controllate che i rifiuti siano in tonnellate all'anno e la popolazione.`);
  }
  if (metodo === "anno" && base.totale && base.popolazione && dati.annoBase?.cluster) {
    const fuori = scostamentiTabella3({
      rifiuti: Object.entries(base.rifiuti).map(([tipologia, qtot]) => ({ tipologia, qtot })),
      popolazione: base.popolazione,
      cluster: dati.annoBase.cluster,
    }).filter((r) => r.oltre);
    if (fuori.length) {
      avvisi.push(`Scostamento oltre il 30% dai valori medi del cluster (Tabella 3, Gestione qualità dei dati 3.1.2) per: ${fuori.map((r) => r.tipologia).join(", ")}. Nel Progetto serve una motivazione.`);
    }
  }
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
    // Scenario di riferimento alla soglia del 65%: produzione pro capite
    // del riferimento × popolazione; secco = 35% del totale, differenziata
    // = 65% con la composizione del riferimento.
    const totRiferimento = base.totale * fattorePop;
    const riferimento = { [SECCO]: totRiferimento * (1 - RD_SOGLIA / 100) };
    Object.entries(base.composizione).forEach(([t, quota]) => {
      riferimento[t] = totRiferimento * (RD_SOGLIA / 100) * quota;
    });
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
      rdOltreSoglia: totale ? (differenziata / totale) * 100 - RD_SOGLIA : 0,
      seccoRiferimento: riferimento[SECCO],
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
export function righeCsv(scenario, risultato, economia = null) {
  const f = (v, d = 1) => (v == null ? "" : Number(v).toFixed(d).replace(".", ","));
  const intest = ["Anno", "Popolazione", "Produzione totale (t)", "Pro capite (kg/ab)", "Secco (t)", "Secco pro capite (kg/ab)", "Differenziata (t)", "% differenziata", "Punti oltre il 65%", "Scenario di riferimento (t)", "Riduzione (t)", "Crediti lordi (tCO2eq)", "Buffer (tCO2eq)", "Crediti netti (tCO2eq)", "Netti cumulati (tCO2eq)"];
  const righe = risultato.righe.map((r) => [r.anno, Math.round(r.popolazione), f(r.totale), f(r.proCapite), f(r.secco), f(r.seccoProCapite), f(r.differenziata), f(r.rd), f(r.rdOltreSoglia), f(r.riferimento), f(r.riduzione), f(r.lordi), f(r.buffer), f(r.netti), f(r.cumulatoNetti)]);
  const testa = [[`Scenario: ${scenario.nome}`], [`Comune: ${scenario.comune}`], [`Durata: ${scenario.durata} anni dal ${scenario.anno_inizio}`], ["Stima ex ante non certificabile (Metodologia CWP v1.2, modello semplificato)"], []];
  const eco = economia
    ? [[], ["Simulazione economica (importi IVA esclusa)"], ["Anno", "Crediti", "Valore unitario (€)", "Ricavi (€)", "Partecipazione al Programma (€)", "Consulenza (€)", "Ente di validazione e verifica (€)", "Altri costi (€)", "Costi totali (€)", "Margine (€)", "Margine cumulato (€)"],
       ...economia.righe.map((r) => [r.anno, r.crediti, f(r.prezzo, 2), f(r.ricavi, 0), f(r.partecipazione, 0), f(r.consulenza, 0), f(r.costiEnte, 0), f(r.altriCosti, 0), f(r.costi, 0), f(r.margine, 0), f(r.cumulato, 0)])]
    : [];
  return [...testa, intest, ...righe, ...eco].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

/* =========================================================================
   Simulazione economica (richieste di Luca del 19/10/2026).
   Dai crediti netti stimati anno per anno e dal valore del credito
   digitato ANNO PER ANNO (€ per credito = € per tCO₂eq; valore proposto
   32 €, applicabile a tutti gli anni con una variazione annua facoltativa;
   facoltativi un valore minimo e uno massimo per lo scenario peggiore e
   migliore) stima ricavi, costi a carico del
   Comune o del gestore e margine. Tre listini dei costi del Programma:
   - "contratto" (predefinito): voci dei contratti tipo di Fondazione
     Operate (bozze EsaCom del 15/10/2026), modificabili, IVA esclusa, ogni
     anno del periodo:
       contratto di partecipazione al Programma: registrazione del Progetto
       3.000 €, registrazione dei crediti del Progetto 6.000 €,
       registrazione del Rapporto di Monitoraggio 15.000 €, registrazione dei
       crediti del Rapporto 0,10 € per abitante;
       contratto di consulenza: redazione del Progetto 0,08 € per abitante,
       redazione del Rapporto 0,20 € per abitante
     (nei contratti EsaCom, 154.247 abitanti: 6.000 €, 15.425 €, 12.340 €,
     30.849 €; i valori per abitante ne sono ricavati);
   - "schema": tariffe MASSIME dello Schema tariffario v1.2
     (src/lib/tariffe.js): Progetto nel primo anno (3.000 € + saldo per
     popolazione + 0,15 € per credito previsto nel periodo); ogni anno
     Rapporto (1.000 € + saldo per popolazione + 0,20 € per credito),
     emissione a scaglioni, vendita (20% del valore, con il minimo);
   - "nessuno": solo i costi indicati dall'utente.
   In tutti i casi si aggiungono: validazione dell'ente (una tantum, primo
   anno), verifica annuale dell'ente e altri costi annui.
   I crediti si contano interi (parte intera dei crediti netti). È una
   stima indicativa, non un piano finanziario.
   ========================================================================= */

// Voci predefinite del listino «contratto» (bozze EsaCom del 15/10/2026).
export const CONTRATTO_PREDEFINITO = {
  regProgetto: 3000, // € all'anno – contratto di partecipazione, art. 6.2
  regCreditiProgetto: 6000, // € all'anno
  regRapporto: 15000, // € per Rapporto annuale
  regCreditiRapportoAb: 0.1, // € per abitante per Rapporto
  redProgettoAb: 0.08, // € per abitante all'anno – contratto di consulenza, art. 6
  redRapportoAb: 0.2, // € per abitante per Rapporto
};

// Valore del credito proposto (€ per credito), da confermare anno per anno.
export const PREZZO_PROPOSTO = 32;

// Valori iniziali della parte economica di uno scenario. prezzi: valore
// del credito per anno { anno: € }; prezzo: valore proposto per gli anni
// senza un valore proprio.
export function economiaIniziale() {
  return {
    prezzo: PREZZO_PROPOSTO, prezzi: {}, prezzoMin: "", prezzoMax: "", crescitaPrezzo: 0, listino: "contratto",
    contratto: { ...CONTRATTO_PREDEFINITO },
    costoValidazione: "", costoVerificaAnnua: "", altriCostiAnnui: "",
  };
}

// Valori del credito per tutti gli anni: il valore di partenza con la
// variazione annua (%). Restituisce { anno: € } arrotondato ai centesimi.
export function prezziPerAnni(anni, prezzo, crescitaPct = 0) {
  const out = {};
  anni.forEach((anno, i) => {
    out[anno] = Math.round(num(prezzo) * Math.pow(1 + num(crescitaPct) / 100, i) * 100) / 100;
  });
  return out;
}

// Listino effettivo (compatibilità con gli scenari salvati con includiTariffe).
function listinoDi(economia) {
  if (economia.listino) return economia.listino;
  return economia.includiTariffe === false ? "nessuno" : "schema";
}

/* Parametri: righe della simulazione (simula().righe), economia (vedi
   economiaIniziale), popolazione (per le voci per abitante e le fasce dello
   Schema tariffario). Restituisce { righe, totali, avvisi } oppure null se
   manca il valore unitario. Ogni riga: anno, crediti, prezzo, ricavi,
   partecipazione (contratto di partecipazione o Schema tariffario),
   consulenza, costiEnte, altriCosti, costi, margine, cumulato e il
   dettaglio delle voci. */
export function simulaEconomia(righe, economia = {}, popolazione) {
  const prezzo0 = num(economia.prezzo);
  if (!prezzo0 || !righe?.length) return null;
  const avvisi = [];
  const pop = num(popolazione);
  const crescita = num(economia.crescitaPrezzo) / 100;
  const listino = listinoDi(economia);
  const k = { ...CONTRATTO_PREDEFINITO, ...(economia.contratto || {}) };
  Object.keys(k).forEach((c) => { k[c] = num(k[c]); });
  const validazione = num(economia.costoValidazione);
  const verifica = num(economia.costoVerificaAnnua);
  const altri = num(economia.altriCostiAnnui);
  const creditiPeriodo = Math.floor(somma(righe, (r) => r.netti));
  const saldoProgetto = saldoPerPopolazione(pop || null, SALDO_PROGETTO) ?? 0;
  const saldoRapporto = saldoPerPopolazione(pop || null, SALDO_RAPPORTO) ?? 0;
  if (listino !== "nessuno" && !pop) avvisi.push("Senza popolazione le voci per abitante (o per fascia) non si possono calcolare.");
  let cumulato = 0;
  const out = righe.map((r, i) => {
    const crediti = Math.floor(r.netti);
    const fattore = Math.pow(1 + crescita, i);
    // Valore digitato per l'anno; se manca, il valore proposto con la variazione annua.
    const proprio = num((economia.prezzi || {})[r.anno]);
    const prezzo = proprio || prezzo0 * fattore;
    const ricavi = crediti * prezzo;
    const voci = {};
    if (listino === "contratto") {
      voci.regProgetto = k.regProgetto;
      voci.regCreditiProgetto = k.regCreditiProgetto;
      voci.regRapporto = k.regRapporto;
      voci.regCreditiRapporto = k.regCreditiRapportoAb * pop;
      voci.redProgetto = k.redProgettoAb * pop;
      voci.redRapporto = k.redRapportoAb * pop;
    } else if (listino === "schema") {
      voci.progetto = i === 0 ? ISCRIZIONE_PROGETTO + saldoProgetto + VARIABILE_PROGETTO * creditiPeriodo : 0;
      voci.rapporto = ISCRIZIONE_RAPPORTO + saldoRapporto + VARIABILE_RAPPORTO * crediti;
      voci.emissione = tariffaEmissione(crediti);
      voci.vendita = crediti > 0 ? tariffaVendita(crediti, ricavi) : 0;
    }
    const partecipazione = listino === "contratto"
      ? voci.regProgetto + voci.regCreditiProgetto + voci.regRapporto + voci.regCreditiRapporto
      : listino === "schema" ? voci.progetto + voci.rapporto + voci.emissione + voci.vendita : 0;
    const consulenza = listino === "contratto" ? voci.redProgetto + voci.redRapporto : 0;
    const costiEnte = (i === 0 ? validazione : 0) + verifica;
    const costi = partecipazione + consulenza + costiEnte + altri;
    const margine = ricavi - costi;
    cumulato += margine;
    return {
      anno: r.anno, crediti, prezzo, prezzoDigitato: !!proprio, ricavi,
      ricaviMin: num(economia.prezzoMin) ? crediti * num(economia.prezzoMin) * fattore : null,
      ricaviMax: num(economia.prezzoMax) ? crediti * num(economia.prezzoMax) * fattore : null,
      voci, partecipazione, consulenza, tariffeProgramma: partecipazione + consulenza,
      costiEnte, altriCosti: altri, costi, margine, cumulato,
    };
  });
  if (out.some((r) => r.margine < 0)) avvisi.push("In alcuni anni i costi superano i ricavi (margine negativo).");
  const tot = (c) => somma(out, (r) => r[c] || 0);
  const anni = out.length;
  const perAb = (v) => (pop ? v / pop : null);
  return {
    listino,
    righe: out,
    totali: {
      crediti: tot("crediti"),
      ricavi: tot("ricavi"),
      ricaviMin: num(economia.prezzoMin) ? tot("ricaviMin") : null,
      ricaviMax: num(economia.prezzoMax) ? tot("ricaviMax") : null,
      partecipazione: tot("partecipazione"),
      consulenza: tot("consulenza"),
      tariffeProgramma: tot("tariffeProgramma"),
      costiEnte: tot("costiEnte"),
      altriCosti: tot("altriCosti"),
      costi: tot("costi"),
      margine: tot("margine"),
      prezzoMedio: tot("crediti") ? tot("ricavi") / tot("crediti") : prezzo0,
      primoAnnoPositivo: (out.find((r) => r.cumulato > 0) || {}).anno || null,
      // Indicatori per abitante sull'intero periodo (come nell'Allegato A).
      costoProCapite: perAb(tot("costi")),
      ricavoProCapite: perAb(tot("ricavi")),
      ricavoProCapiteMin: num(economia.prezzoMin) ? perAb(tot("ricaviMin")) : null,
      ricavoProCapiteMax: num(economia.prezzoMax) ? perAb(tot("ricaviMax")) : null,
      costoAnnuoMedio: tot("costi") / anni,
    },
    avvisi,
  };
}
