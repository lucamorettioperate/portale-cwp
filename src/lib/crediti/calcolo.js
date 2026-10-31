/* =========================================================================
   calcolo.js — motore di calcolo dei crediti — Metodologia Carbon WastePrint® v1.2.

   Scopo: funzioni pure (nessun accesso al database): ricevono i dati del calcolo
   e restituiscono risultati intermedi e finali, con il riferimento alla
   formula della Metodologia accanto a ogni passaggio.

   Unità: quantità territoriali in tonnellate/anno; per utenza in kg/anno;
   emissioni in kgCO₂eq (per utenza) e tCO₂eq (territorio e crediti).
   Convenzione dei segni: i fattori FErid sono negativi (emissione evitata
   per kg di rifiuto non prodotto); le formule mettono il "−" davanti,
   quindi EA (emissioni attese) ed EP (di progetto) sono positivi e crescono
   con i kg prodotti. ΔI = EP − EA: negativo = le utenze producono meno
   dell'atteso = crediti; positivo = debito.

   Usato da: src/pages/CalcoloCrediti.jsx (calcolaCrediti, al ricalcolo);
   test/crediti.test.mjs e test/tracciato.test.mjs.
   Dati/servizi coinvolti: nessuno. Salvataggio e conferma dei risultati
   stanno in archivio.js (tabelle di 11_crediti.sql).

   Regola per chi modifica: ogni cambio di formula deve avere un test in
   test/crediti.test.mjs (npm test) e una voce nel Registro; un calcolo già
   confermato resta com'era (immutabile nel database) e non viene ricalcolato.
   Le scelte interpretative ancora da confermare sono in docs/crediti-cwp.md.

   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti»; capitolo 6
   «Portale (frontend)» (struttura del codice).
   ========================================================================= */
import {
  BUFFER_UTENZE,
  BUFFER_CATEGORIA_UND_NON_MONITORATA,
  BUFFER_CATEGORIE_UND_MAX,
  BUFFER_MASSIMO,
  GIORNI_ANNO,
} from "./parametri.js";
// Controllo delle date inesistenti (collaudo V01, D04).
import { dataIsoEsiste } from "../date.js";
import { rdTerritorio } from "./qualita.js";

// Converte un valore in numero: accetta numeri, testi con virgola decimale
// e spazi ("1 234,5"). Vuoto o non valido → 0 (mai NaN nei calcoli).
// Attenzione: "1.234,5" non è gestito qui (diventa 0); i CSV sono già
// convertiti da csv.js.
const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
// Somma f(x) su tutti gli elementi di arr.
const somma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/* ---------------------------------------------------------------------
   Controllo dei valori impossibili nella Banca Dati Utenze (collaudo V01,
   D07, 20/10/2026). Svuotamenti, volumi, pesi, pezzi e numero di utenze
   non possono essere negativi né testi non numerici: un peso negativo
   ridurrebbe le emissioni di progetto e gonfierebbe i crediti.
   Il controllo è lo stesso in tutti gli strati: import CSV della pagina,
   salvataggio (archivio.js), controlli di coerenza (tracciato.js) e motore
   (calcolaCrediti, che con valori impossibili non dà crediti). Nel
   database lo ripetono i vincoli dello script 35.
   Parametri: conferimenti e riuso nel formato del motore.
   Restituisce { righe: numero di righe con valori non ammessi, messaggi:
   i primi 10 esempi leggibili }. Vuoto (null, "") = valore assente, ammesso.
   --------------------------------------------------------------------- */
export const CAMPI_CONFERIMENTO = {
  svuotamenti: "svuotamenti",
  volume: "volume contenitore",
  pesoStrutture: "peso strutture informatizzate",
  volumeStrutture: "volume strutture informatizzate",
  pesoCdr: "peso centri di raccolta",
  volumeCdr: "volume centri di raccolta",
  nUtenze: "N. utenze",
  kg: "kg misurati",
};
export const CAMPI_RIUSO = { pezzi: "pezzi", peso: "peso", nUtenze: "N. utenze" };

// true se v è vuoto (null, "") oppure un numero finito non negativo
// (anche testo con la virgola decimale, come num()).
export function numeroAmmesso(v) {
  if (v === null || v === undefined || v === "") return true;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0;
}

export function valoriNonAmmessiBdu({ conferimenti = [], riuso = [] }) {
  const messaggi = [];
  let righe = 0;
  const controlla = (elenco, campi, nome) => {
    elenco.forEach((r, i) => {
      const errati = Object.entries(campi).filter(([k]) => !numeroAmmesso(r[k]));
      if (!errati.length) return;
      righe++;
      if (messaggi.length < 10) {
        messaggi.push(`${nome} ${i + 1} (utenza ${r.utenza || "?"}${r.tipologia ? ", " + r.tipologia : r.bene ? ", " + r.bene : ""}): ${errati.map(([k, t]) => `${t} ${r[k]}`).join(", ")}`);
      }
    });
  };
  controlla(conferimenti, CAMPI_CONFERIMENTO, "conferimento");
  controlla(riuso, CAMPI_RIUSO, "riuso");
  return { righe, messaggi };
}


/* ---------------------------------------------------------------------
   Banca Dati Utenze per utenza (passo «5a. Utenze del calcolo», tabella
   calcolo_utenza dello script 40; richiesta di Luca Moretti del 23/10/2026:
   collegare le utenze al motore).
   Trasforma le utenze in righe nel formato dei conferimenti, così il resto
   del motore (pesi, emissioni, controlli di coerenza, buffer) non cambia:
   - utenza = codice utenza; macro = tipo (UD / UnD);
   - classe = CATEGORIA DI SIMULAZIONE (decide la classe della delibera e
     quindi i rifiuti attesi, formule 9-12); vuota = utenza «da assegnare»;
   - una riga per ogni frazione con i kg indicati (anche 0): kg = peso
     MISURATO, usato così com'è al posto di svuotamenti × volume × peso
     specifico (formula 20); gli svuotamenti restano solo informativi;
   - una frazione lasciata vuota nel file (non raccolta o non misurata per
     quell'utenza) non dà righe: vedi «tipologie per utenza» in
     calcolaCrediti.
   Parametro: utenze come le restituisce admin_utenze_calcolo (codice, tipo,
   categoria_simulazione, frazioni { id: { kg, svuotamenti } }).
   Restituisce l'elenco delle righe (nUtenze = 1: ogni riga è un'utenza vera).
   --------------------------------------------------------------------- */
export function utenzeInConferimenti(utenze = []) {
  const righe = [];
  utenze.forEach((u) => {
    const classe = u.categoria_simulazione == null ? "" : String(u.categoria_simulazione).trim();
    Object.entries(u.frazioni || {}).forEach(([tipologia, v]) => {
      if (!v || v.kg === null || v.kg === undefined || v.kg === "") return;
      righe.push({
        utenza: u.codice,
        macro: u.tipo,
        classe,
        tipologia,
        kg: v.kg,
        svuotamenti: v.svuotamenti ?? null,
        nUtenze: 1,
      });
    });
  });
  return righe;
}

/* ---------------------------------------------------------------------
   Capitolo 2 — Periodo di riferimento (formula 1)
   Coefficiente GGe/GG per un primo anno parziale (dall'avvio al 31/12).
   Parametri: dataAvvio (aaaa-mm-gg o vuota), anno di riferimento.
   Restituisce { coefficiente (0-1), giorni effettivi GGe }. Se l'avvio
   manca o cade in un altro anno vale 1 (anno intero). GG è fisso a 365
   anche negli anni bisestili; il tetto a 1 evita 366/365.
   Una data che non esiste (es. 2025-02-31) o scritta male NON vale come
   anno intero: restituisce { coefficiente: null, giorni: null, errore }
   e calcolaCrediti non produce crediti (collaudo V01, D04).
   --------------------------------------------------------------------- */
export function coefficientePrimoAnno(dataAvvio, anno) {
  if (!dataAvvio) return { coefficiente: 1, giorni: GIORNI_ANNO };
  if (!dataIsoEsiste(dataAvvio)) {
    return { coefficiente: null, giorni: null, errore: `La data di avvio «${dataAvvio}» non esiste nel calendario: correggila.` };
  }
  const avvio = new Date(dataAvvio + "T00:00:00");
  if (isNaN(avvio) || avvio.getFullYear() !== Number(anno)) return { coefficiente: 1, giorni: GIORNI_ANNO };
  const fine = new Date(avvio.getFullYear(), 11, 31);
  // +1: il giorno di avvio e il 31/12 sono entrambi compresi.
  const giorni = Math.round((fine - avvio) / 86400000) + 1;
  return { coefficiente: Math.min(1, giorni / GIORNI_ANNO), giorni };
}

/* ---------------------------------------------------------------------
   Capitolo 5 — Fattore di emissione dell'indifferenziato (formule 16-17)
   FErid(rur) = Σ FErid(r=rec) × M(r=rec),  M = Qtot(r) / Σ Qtot(r=rec)
   Cioè: media dei FE delle frazioni a recupero, pesata sulle loro quantità.
   Parametri: { tipologia: Qtot in t/anno }, { tipologia: fattore }.
   Restituisce { fe, composizione: [{ tipologia, quantita, quota, fe }],
   fuoriPaniere: [tipologie usate oltre le cinque nominate dal testo],
   escluse: [tipologie a recupero con quantità ma senza FE numerico] };
   fe = null se nessuna frazione a recupero ha quantità e FE validi.
   Criterio attuale: tutte le frazioni a recupero con quantità > 0 e FE
   numerico. Il testo del cap. 5 nomina organico, carta e cartone, vetro,
   plastica e tessili e ammette altre classificazioni motivate nel
   Progetto: quale paniere usare è in attesa della Fondazione (rilievo
   N06, ATTESA_REGOLA). Per trasparenza il risultato elenca quantità e FE
   di ogni frazione usata, quelle oltre le cinque nominate e quelle
   escluse per FE mancante; la formula non cambia.
   --------------------------------------------------------------------- */
export const PANIERE_METODOLOGIA = ["organico", "carta", "vetro", "plastica", "tessili"];

export function fattoreIndifferenziato(quantitaPerTipologia, fattori) {
  const voci = Object.entries(quantitaPerTipologia).filter(
    ([t, q]) => q > 0 && fattori[t] && fattori[t].recupero && Number.isFinite(fattori[t].fe)
  );
  const escluse = Object.entries(quantitaPerTipologia)
    .filter(([t, q]) => q > 0 && fattori[t] && fattori[t].recupero && !Number.isFinite(fattori[t].fe))
    .map(([t]) => t);
  const totale = somma(voci, ([, q]) => q);
  if (!totale) return { fe: null, composizione: [], fuoriPaniere: [], escluse };
  const composizione = voci.map(([t, q]) => ({ tipologia: t, quantita: q, quota: q / totale, fe: fattori[t].fe }));
  const fuoriPaniere = composizione.map((c) => c.tipologia).filter((t) => !PANIERE_METODOLOGIA.includes(t));
  return { fe: somma(composizione, (c) => c.fe * c.quota), composizione, fuoriPaniere, escluse };
}

/* ---------------------------------------------------------------------
   Capitolo 3 — Produzione attesa per classe di utenza (formule 2-12)
   Ripartisce i rifiuti del territorio tra utenze domestiche (UD) e non
   domestiche (UnD) secondo le percentuali del PEF, poi tra le classi della
   delibera tariffaria (UD: N × Kb; UnD: superficie × Kd), e ricava la
   produzione attesa per singola utenza in kg/anno.
   Parametri: rifiuti [{ tipologia, qtot (t/anno), soloDomestiche,
   considerato }], pefUd e pefUnd (%), classiUd [{ classe, n, kb }],
   classiUnd [{ classe, n, superficie, kd }], coefficiente (formula 1).
   Restituisce i totali (Qtot, QUD, QUnD, QUDes, pUd, pUnD), le quantità per
   tipologia e, per ogni classe, la quota e l'atteso per utenza.
   --------------------------------------------------------------------- */
export function produzioneAttesa({ rifiuti, pefUd, pefUnd, classiUd, classiUnd, coefficiente = 1 }) {
  const considerati = rifiuti.filter((r) => r.considerato !== false && r.tipologia);
  // Quantità per tipologia (più codici EER possono confluire in una tipologia).
  const perTipologia = {};
  const soloDomestica = {};
  considerati.forEach((r) => {
    perTipologia[r.tipologia] = (perTipologia[r.tipologia] || 0) + num(r.qtot);
    soloDomestica[r.tipologia] = soloDomestica[r.tipologia] || !!r.soloDomestiche;
  });

  const Qtot = somma(Object.values(perTipologia), (q) => q); // formula 4
  const QUD = Qtot * num(pefUd) / 100; // formula 2
  const QUnD = Qtot * num(pefUnd) / 100; // formula 3
  // QUDes: rifiuti prodotti solo dalle domestiche (es. verde, inerti). Si
  // tolgono dal denominatore perché non vanno ripartiti con le non domestiche.
  const QUDes = somma(Object.entries(perTipologia), ([t, q]) => (soloDomestica[t] ? q : 0));
  const denominatore = QUD + QUnD - QUDes;
  const pUnD = denominatore > 0 ? QUnD / denominatore : 0; // formula 5
  const pUd = 1 - pUnD; // formula 6

  // Formule 7-8: ripartizione per tipologia.
  const tipologie = Object.keys(perTipologia).map((t) => {
    const q = perTipologia[t];
    const qud = soloDomestica[t] ? q : pUd * q;
    const qund = soloDomestica[t] ? 0 : pUnD * q;
    return { tipologia: t, qtot: q, soloDomestiche: !!soloDomestica[t], qud, qund };
  });

  // Formula 9: quota per classe domestica; formula 10: atteso per utenza.
  const pesoUd = somma(classiUd, (c) => num(c.n) * num(c.kb));
  const ud = classiUd.map((c) => {
    const n = num(c.n);
    const quota = pesoUd > 0 ? (n * num(c.kb)) / pesoUd : 0;
    const atteso = {};
    tipologie.forEach((t) => {
      // ×1000: da tonnellate a kg; ×coefficiente: primo anno parziale (formula 1).
      atteso[t.tipologia] = n > 0 ? ((t.qud * 1000 * quota) / n) * coefficiente : 0; // kg/anno
    });
    return { macro: "UD", classe: c.classe, n, kb: num(c.kb), quota, atteso };
  });

  // Formula 11: quota per classe non domestica; formula 12: atteso per utenza.
  const pesoUnd = somma(classiUnd, (c) => num(c.superficie) * num(c.kd));
  const und = classiUnd.map((c) => {
    const n = num(c.n);
    const quota = pesoUnd > 0 ? (num(c.superficie) * num(c.kd)) / pesoUnd : 0;
    const atteso = {};
    tipologie.forEach((t) => {
      atteso[t.tipologia] = n > 0 ? ((t.qund * 1000 * quota) / n) * coefficiente : 0;
    });
    return { macro: "UnD", classe: c.classe, n, superficie: num(c.superficie), kd: num(c.kd), quota, atteso };
  });

  return { Qtot, QUD, QUnD, QUDes, pUd, pUnD, perTipologia, tipologie, classi: [...ud, ...und] };
}

/* ---------------------------------------------------------------------
   Capitolo 6.1 — Pesi specifici (formula 18 o Tabella 8)
   PS(r) = Qtot(r) × 10⁶ / (Σ S×VC utenze + Σ S×VC contenitori centralizzati)
   S = svuotamenti, VC = volume del contenitore in litri. Qtot in tonnellate:
   × 10⁶ porta a grammi, quindi PS esce in g/litro = kg/m³.
   La formula 18 si usa solo a consuntivo (ex post, opzione attiva) e se ci
   sono quantità e volumi; altrimenti si usa il valore di Tabella 8 o del
   Progetto (pesiDefault). Restituisce { ps: {tipologia: kg/m³ o null},
   dettaglio: {tipologia: metodo usato} }.
   --------------------------------------------------------------------- */
export function pesiSpecifici({ perTipologia, conferimenti, volumiCentralizzati = {}, consuntivo, pesiDefault }) {
  const ps = {};
  const dettaglio = {};
  Object.keys({ ...pesiDefault, ...perTipologia }).forEach((t) => {
    // Litri conferiti dalle utenze; una riga con nUtenze > 1 rappresenta
    // dati medi di classe e vale per tutte le sue utenze.
    const volUtenze = somma(
      conferimenti.filter((c) => c.tipologia === t),
      (c) => num(c.svuotamenti) * num(c.volume) * Math.max(1, num(c.nUtenze) || 1)
    );
    const volIn = num(volumiCentralizzati[t]);
    const q = num(perTipologia[t]);
    if (consuntivo && q > 0 && volUtenze + volIn > 0) {
      ps[t] = (q * 1e6) / (volUtenze + volIn);
      dettaglio[t] = { metodo: "formula 18", litri: volUtenze + volIn };
    } else {
      ps[t] = num(pesiDefault[t]) || null;
      dettaglio[t] = { metodo: ps[t] ? "Tabella 8 / Progetto" : "non disponibile" };
    }
  });
  return { ps, dettaglio };
}

/* ---------------------------------------------------------------------
   Capitolo 6.1 — Conferimenti in peso per utenza (formule 19-22)
   Ptot(r,i) = PD + PStIn + PCdR;  PD = S × VC × PS / 1000
   Righe delle utenze del passo 5a (utenzeInConferimenti): il campo kg è
   il peso già misurato e si somma così com'è.
   Priut(b,i) = Np × Pb (o peso misurato)
   PD = conferimenti domiciliari, PStIn = strutture informatizzate,
   PCdR = centri di raccolta (pesati direttamente o convertiti da litri).
   PS in kg/m³ e volumi in litri: / 1000 dà kg.
   Parametri: righe di conferimento e di riuso della Banca Dati Utenze,
   pesi specifici, beni a riuso. Restituisce { utenze: [{ utenza, macro,
   classe, nUtenze, ptot: {tipologia: kg}, priut: {bene: kg} }], avvisi }.
   Più righe della stessa utenza si sommano.
   --------------------------------------------------------------------- */
export function conferimentiInPeso({ conferimenti, riuso = [], ps, beni }) {
  const utenze = new Map();
  const avvisi = [];
  // Restituisce (creandola alla prima occorrenza) la scheda dell'utenza "id".
  const prendi = (id, macro, classe, nUtenze) => {
    if (!utenze.has(id)) utenze.set(id, { utenza: id, macro, classe, nUtenze: nUtenze || 1, ptot: {}, priut: {} });
    return utenze.get(id);
  };

  conferimenti.forEach((c) => {
    const u = prendi(c.utenza, c.macro, c.classe, Math.max(1, num(c.nUtenze) || 1));
    const pesoSpec = ps[c.tipologia];
    const litriDomiciliare = num(c.svuotamenti) * num(c.volume); // formula 19
    const litriAltri = num(c.volumeStrutture) + num(c.volumeCdr);
    if ((litriDomiciliare > 0 || litriAltri > 0) && !pesoSpec) {
      avvisi.push(`Manca il peso specifico per «${c.tipologia}»: volumi non convertiti in peso.`);
    }
    const pd = pesoSpec ? (litriDomiciliare * pesoSpec) / 1000 : 0; // formula 20
    const pStIn = num(c.pesoStrutture) + (pesoSpec ? (num(c.volumeStrutture) * pesoSpec) / 1000 : 0);
    const pCdR = num(c.pesoCdr) + (pesoSpec ? (num(c.volumeCdr) * pesoSpec) / 1000 : 0);
    const pMisurato = num(c.kg); // kg misurati (utenze del passo 5a)
    u.ptot[c.tipologia] = (u.ptot[c.tipologia] || 0) + pd + pStIn + pCdR + pMisurato; // formula 21
  });

  riuso.forEach((r) => {
    const u = prendi(r.utenza, r.macro, r.classe, Math.max(1, num(r.nUtenze) || 1));
    const bene = beni[r.bene];
    const peso = num(r.peso) || (bene ? num(r.pezzi) * num(bene.peso) : 0); // formula 22
    if (!bene && !num(r.peso)) avvisi.push(`Bene «${r.bene}» sconosciuto e senza peso: ignorato.`);
    u.priut[r.bene] = (u.priut[r.bene] || 0) + peso;
  });

  return { utenze: [...utenze.values()], avvisi: [...new Set(avvisi)] };
}

/* ---------------------------------------------------------------------
   Capitolo 7 — Buffer (Tabelle 15 e 16)
   Percentuale dei crediti lordi trattenuta a garanzia. Si sommano le voci:
   solo utenze virtuose (Cap. 7), utenze monitorate (Tab. 15), categorie non
   domestiche non monitorate (Tab. 15), rifiuti misurati (Tab. 16, con le
   riduzioni per misure nei centri); poi la tariffa puntuale dimezza il
   totale e si applica il tetto dell'80%.
   bufferManuale (se indicato) sostituisce il valore calcolato, sempre entro 0-80;
   un valore fuori da 0-80 o non numerico dà erroreManuale (bloccante).
   Restituisce { voci: [{ voce, valore }], calcolato, totale, manuale, erroreManuale? }.
   --------------------------------------------------------------------- */
export function calcolaBuffer({
  soloVirtuose,
  bufferVirtuose,
  utenzeMonitorate, // { res, nonres, und }
  categorieUndNonMonitorate,
  rifiutiMisurati, // { indifferenziato, organico, carta, plastica, vetro }
  misuraCentralizzate,
  misuraAltriNonCentralizzati, // ingombranti, verde, indumenti
  tariffaPuntuale,
  bufferManuale,
}) {
  const voci = [];
  if (soloVirtuose) voci.push({ voce: "Solo utenze che riducono la CO₂eq (Cap. 7)", valore: num(bufferVirtuose) });

  // Chiave della Tabella 15 in ordine fisso (es. "res+und"), come in BUFFER_UTENZE.
  const chiave = ["res", "nonres", "und"].filter((k) => utenzeMonitorate?.[k]).join("+");
  if (chiave && BUFFER_UTENZE[chiave] !== undefined) {
    voci.push({ voce: `Utenze monitorate (Tab. 15): ${chiave.replace(/\+/g, ", ")}`, valore: BUFFER_UTENZE[chiave] });
  }
  const nonMon = Math.min(BUFFER_CATEGORIE_UND_MAX, num(categorieUndNonMonitorate) * BUFFER_CATEGORIA_UND_NON_MONITORATA);
  if (nonMon > 0) voci.push({ voce: `Categorie non domestiche non monitorate (Tab. 15)`, valore: nonMon });

  // Tabella 16: rifiuti misurati.
  // Senza indifferenziato E organico misurati si resta alla condizione minima
  // (30%), anche se altre frazioni sono misurate: scelta cautelativa
  // (docs/crediti-cwp.md, punto 5).
  const m = rifiutiMisurati || {};
  let t16 = 30;
  let descr = "solo indifferenziato (condizione minima)";
  if (m.indifferenziato && m.organico) {
    const pv = (m.plastica ? 1 : 0) + (m.vetro ? 1 : 0);
    if (m.carta && pv === 2) [t16, descr] = [3, "indifferenziato, organico, carta, plastica e vetro"];
    else if (m.carta && pv === 1) [t16, descr] = [6, "indifferenziato, organico, carta e una tra plastica e vetro"];
    else if (m.carta) [t16, descr] = [10, "indifferenziato, organico e carta"];
    else if (pv === 2) [t16, descr] = [10, "indifferenziato, organico, plastica e vetro"];
    else if (pv === 1) [t16, descr] = [15, "indifferenziato, organico e una tra plastica e vetro"];
    else [t16, descr] = [20, "indifferenziato e organico"];
  }
  voci.push({ voce: `Rifiuti misurati (Tab. 16): ${descr}`, valore: t16 });
  if (misuraCentralizzate) voci.push({ voce: "Misura presso Centri di Raccolta / Riuso (Tab. 16)", valore: -2 });
  if (misuraAltriNonCentralizzati) voci.push({ voce: "Misura ingombranti / verde / indumenti fuori dai centri (Tab. 16)", valore: -1 });

  // Le riduzioni (−2, −1) non possono portare il totale sotto zero.
  let totale = Math.max(0, somma(voci, (v) => v.valore));
  if (tariffaPuntuale) {
    voci.push({ voce: "Tariffa puntuale attiva: buffer dimezzato", valore: -totale / 2 });
    totale = totale / 2;
  }
  totale = Math.min(BUFFER_MASSIMO, totale);

  if (bufferManuale !== null && bufferManuale !== undefined && bufferManuale !== "") {
    // Fuori da 0-80% o non numerico: errore esplicito (collaudo V01, D02),
    // non più un taglio silenzioso; calcolaCrediti non dà crediti.
    const v = typeof bufferManuale === "number" ? bufferManuale : Number(String(bufferManuale).replace(",", "."));
    const erroreManuale = !Number.isFinite(v) || v < 0 || v > BUFFER_MASSIMO
      ? `Buffer indicato a mano «${bufferManuale}»: deve essere un numero tra 0 e ${BUFFER_MASSIMO}% (Capitolo 7).`
      : null;
    return { voci, calcolato: totale, totale: Math.min(BUFFER_MASSIMO, Math.max(0, num(bufferManuale))), manuale: true, erroreManuale };
  }
  return { voci, calcolato: totale, totale, manuale: false };
}

/* ---------------------------------------------------------------------
   Calcolo completo: emissioni attese (Cap. 4), di progetto (Cap. 6.2),
   variazione di impatto (formule 31-32), buffer e crediti.
   Parametro "dati": l'oggetto calcolo_crediti.dati (pefUd, pefUnd, rifiuti,
   classiUd, classiUnd, fattori, beni, psConsuntivo, volumiCentralizzati,
   opzioni del buffer e dell'interpretazione) più anno, tipo
   (ex_ante/ex_post) e dataAvvio dalla testata del calcolo, e conferimenti e
   riuso dalle tabelle calcolo_conferimento / calcolo_riuso (11_crediti.sql).
   Restituisce il risultato completo (la pagina ne salva un riepilogo senza
   il dettaglio per utenza in calcolo_crediti.risultato; lo usa anche il
   rapporto PDF): periodo, attesi, pesi specifici, dettaglio per
   utenza, ΔI, buffer, crediti { lordi, buffer, netti, debito } in tCO₂eq,
   avvisi (dati mancanti o incoerenti, senza duplicati), errori (dati
   impossibili: valori negativi, date inesistenti, buffer fuori da 0-80%) e
   bloccato = true se ci sono errori: allora crediti e debito valgono zero e
   la pagina non salva il risultato (collaudo V01, D02/D04/D07).
   --------------------------------------------------------------------- */
export function calcolaCrediti(dati) {
  const avvisi = [];
  // Errori bloccanti (collaudo V01, D04 e D07): con dati impossibili il
  // calcolo non produce crediti (lordi, buffer e netti a zero, «bloccato»)
  // e la pagina non salva il risultato.
  const errori = [];
  const periodo = coefficientePrimoAnno(dati.dataAvvio, dati.anno);
  if (periodo.errore) errori.push(periodo.errore);
  const coefficiente = periodo.coefficiente ?? 1;
  const giorni = periodo.giorni;
  // Fonte della Banca Dati Utenze. Con le utenze del passo 5a (dati.utenze)
  // il motore usa quelle; i conferimenti del passo 5b (tracciato) restano
  // per i calcoli che non hanno utenze (compresi quelli già fatti).
  const utenzeBdu = dati.utenze || [];
  const daUtenze = utenzeBdu.length > 0;
  const conferimenti = daUtenze ? utenzeInConferimenti(utenzeBdu) : (dati.conferimenti || []);
  if (daUtenze && (dati.conferimenti || []).length) {
    avvisi.push(`Il calcolo usa le ${utenzeBdu.length.toLocaleString("it-IT")} utenze del passo 5a: le ${dati.conferimenti.length.toLocaleString("it-IT")} righe di conferimento del passo 5b (tracciato) non sono usate.`);
  }
  const nonAmmessi = valoriNonAmmessiBdu({ conferimenti, riuso: dati.riuso || [] });
  if (nonAmmessi.righe) {
    errori.push(`Banca Dati Utenze: ${nonAmmessi.righe} righe con valori negativi o non numerici (es. ${nonAmmessi.messaggi.slice(0, 3).join("; ")}). Correggi il file e importalo di nuovo.`);
  }
  const rifiutiNegativi = (dati.rifiuti || []).filter((r) => !numeroAmmesso(r.qtot));
  if (rifiutiNegativi.length) errori.push(`Rifiuti del territorio con quantità negativa o non numerica: ${rifiutiNegativi.map((r) => r.codice || r.tipologia).slice(0, 5).join(", ")}.`);

  // Fattori di emissione per tipologia e per bene.
  // FE vuoto resta null (= mancante), non 0: così l'avviso lo segnala.
  const fattori = {};
  (dati.fattori || []).forEach((f) => {
    fattori[f.id] = { ...f, fe: f.fe === "" || f.fe == null ? null : num(f.fe) };
  });
  const beni = {};
  (dati.beni || []).forEach((b) => {
    beni[b.id] = { ...b, peso: num(b.peso), fe: num(b.fe) };
  });

  // 1. Valori attesi (Cap. 3).
  const attesa = produzioneAttesa({
    rifiuti: dati.rifiuti || [],
    pefUd: dati.pefUd,
    pefUnd: dati.pefUnd,
    classiUd: dati.classiUd || [],
    classiUnd: dati.classiUnd || [],
    coefficiente,
  });
  const sommaPef = num(dati.pefUd) + num(dati.pefUnd);
  if (Math.abs(sommaPef - 100) > 0.01) avvisi.push(`PEF%UD + PEF%UnD = ${sommaPef}% (atteso 100%).`);
  // Rilievo T19 (30/10/2026): i rifiuti del passo 2 sono quelli dell'anno di
  // riferimento dello Standard 4.8.1, con il 64-66% di differenziata (o i
  // valori del cluster). Fuori intervallo resta un avviso da spiegare.
  const rdRif = rdTerritorio(dati.rifiuti || []);
  if ((dati.riferimento?.fonte || "ispra") === "ispra" && rdRif != null && (rdRif < 64 || rdRif > 66)) {
    avvisi.push(`Rifiuti del territorio con il ${rdRif.toFixed(1).replace(".", ",")}% di differenziata: l'anno di riferimento dello Standard 4.8.1 deve avere tra il 64% e il 66% (oppure si usano i valori del cluster).`);
  }

  // Fattore dell'indifferenziato (formule 16-17), se non indicato dal Progetto.
  const ind = fattori.indifferenziato;
  let indifferenziato = null;
  if (ind && (ind.fe == null || ind.calcolato)) {
    indifferenziato = fattoreIndifferenziato(attesa.perTipologia, fattori);
    fattori.indifferenziato = { ...ind, fe: indifferenziato.fe };
  }

  // FE di una tipologia; se manca vale 0 (tipologia esclusa) con avviso.
  const fe = (t) => {
    const f = fattori[t]?.fe;
    if (f == null || !Number.isFinite(f)) {
      avvisi.push(`Manca il fattore di emissione per «${t}»: escluso dal calcolo.`);
      return 0;
    }
    return f;
  };

  // 2. Emissioni attese del territorio (formule 13-15), in tCO₂eq.
  // EA(r) = − Qtot(r) × FEdes(r), con FEdes = FErid (docs/crediti-cwp.md, punto 1).
  // Qtot in t e FE in kgCO₂eq/kg danno direttamente tCO₂eq.
  const eaTipologie = attesa.tipologie.map((t) => ({ ...t, fe: fe(t.tipologia), ea: -t.qtot * fe(t.tipologia) }));
  const EAterritorio = somma(eaTipologie, (t) => t.ea);

  // 3. Conferimenti in peso per utenza (Cap. 6.1).
  // Tipologie presenti nella Banca Dati Utenze: solo su queste si calcola
  // EA(i) (docs/crediti-cwp.md, punto 2). Con le utenze del passo 5a la
  // regola vale utenza per utenza (vedi sotto).
  const tipologieMisurate = [...new Set(conferimenti.map((c) => c.tipologia))];
  const pesiDefault = {};
  (dati.fattori || []).forEach((f) => {
    if (f.ps) pesiDefault[f.id] = num(f.ps);
  });
  const { ps, dettaglio: dettaglioPs } = pesiSpecifici({
    perTipologia: attesa.perTipologia,
    conferimenti,
    volumiCentralizzati: dati.volumiCentralizzati,
    consuntivo: dati.tipo === "ex_post" && dati.psConsuntivo,
    pesiDefault,
  });
  const pesi = conferimentiInPeso({ conferimenti, riuso: dati.riuso || [], ps, beni });
  avvisi.push(...pesi.avvisi);

  // 4. Per ogni utenza: EA(i) sui soli rifiuti misurati, EP(i), ΔI(i).
  // Valori in kgCO₂eq. L'utenza si aggancia alla sua classe con "macro|classe"
  // (UD o UnD + codice classe della delibera).
  const classiPerChiave = new Map(attesa.classi.map((c) => [`${String(c.macro)}|${String(c.classe).trim()}`, c]));
  const senzaClasse = new Set();
  // Utenze del passo 5a senza categoria di simulazione o con una categoria
  // che non è nella delibera: senza rifiuti attesi darebbero un debito
  // falso, quindi restano FUORI dal calcolo (avviso qui; i controlli di
  // coerenza le segnalano come errore e la conferma è bloccata, anche dal
  // database, script 41).
  const escluse = { senzaCategoria: 0, categoriaIgnota: 0, esempi: new Set() };
  const utenzeValide = pesi.utenze.filter((u) => {
    if (!daUtenze) return true;
    if (classiPerChiave.has(`${u.macro}|${String(u.classe).trim()}`)) return true;
    if (!String(u.classe ?? "").trim()) escluse.senzaCategoria++;
    else { escluse.categoriaIgnota++; escluse.esempi.add(`${u.macro} «${u.classe}»`); }
    return false;
  });
  if (escluse.senzaCategoria) {
    avvisi.push(`${escluse.senzaCategoria} utenze senza categoria di simulazione: escluse dal calcolo finché non la si assegna (passo 5a).`);
  }
  if (escluse.categoriaIgnota) {
    avvisi.push(`${escluse.categoriaIgnota} utenze con una categoria di simulazione che non è tra le classi della delibera (${[...escluse.esempi].slice(0, 6).join(", ")}): escluse dal calcolo.`);
  }
  const risultatiUtenze = utenzeValide.map((u) => {
    const classe = classiPerChiave.get(`${u.macro}|${String(u.classe).trim()}`);
    if (!classe) senzaClasse.add(`${u.macro} ${u.classe}`);
    const n = u.nUtenze || 1;
    // EA(i): formula 13 applicata ai valori attesi della classe dell'utenza.
    // Tipologie: con le utenze del passo 5a quelle con i kg indicati per
    // QUELLA utenza (anche 0); una frazione vuota (non raccolta o non
    // misurata) non entra né nelle emissioni attese né in quelle di
    // progetto. Con i conferimenti del tracciato: le tipologie presenti in
    // tutta la Banca Dati (regola precedente, invariata).
    const tipologieUtenza = daUtenze ? Object.keys(u.ptot) : tipologieMisurate;
    const ea = classe ? somma(tipologieUtenza, (t) => -num(classe.atteso[t]) * fe(t)) * n : 0;
    // EP(i): formule 28-30 (Ptot già moltiplicato per n se dati medi di classe).
    const epR = somma(Object.entries(u.ptot), ([t, kg]) => -kg * fe(t)) * n;
    // Formula 29 come scritta: EP(b,i) = − Priut × FErid(b). Con FErid(b)
    // negativo il riuso aumenta EP; l'opzione "riusoComeCredito" (da far
    // confermare alla Fondazione) lo tratta invece come riduzione.
    const segnoRiuso = dati.opzioni?.riusoComeCredito ? 1 : -1;
    const epB = somma(Object.entries(u.priut), ([b, kg]) => segnoRiuso * kg * (beni[b]?.fe || 0)) * n;
    const ep = epR + epB;
    return { utenza: u.utenza, macro: u.macro, classe: u.classe, nUtenze: n, ptot: u.ptot, priut: u.priut, ea, ep, deltaI: ep - ea };
  });
  if (senzaClasse.size) {
    avvisi.push(`Classi di utenza non trovate tra quelle della delibera: ${[...senzaClasse].slice(0, 8).join(", ")}${senzaClasse.size > 8 ? "…" : ""}. Per queste utenze l'atteso è zero.`);
  }

  // 5. Variazione di impatto del territorio (formula 32), kgCO₂eq.
  // Virtuose = utenze con ΔI(i) < 0. Con l'opzione soloVirtuose si sommano
  // solo queste (e calcolaBuffer aggiunge la relativa voce di buffer).
  const virtuose = risultatiUtenze.filter((u) => u.deltaI < 0);
  const deltaITutte = somma(risultatiUtenze, (u) => u.deltaI);
  const deltaIVirtuose = somma(virtuose, (u) => u.deltaI);
  const deltaI = dati.opzioni?.soloVirtuose ? deltaIVirtuose : deltaITutte;

  // 6. Buffer e crediti (tCO₂eq).
  // ΔI < 0 → crediti lordi = −ΔI / 1000 (da kg a t); ΔI > 0 → debito, nessun credito.
  // Crediti netti = lordi × (1 − buffer%) (docs/crediti-cwp.md, punto 4).
  const buffer = calcolaBuffer({ ...(dati.opzioni || {}), soloVirtuose: !!dati.opzioni?.soloVirtuose });
  if (buffer.erroreManuale) errori.push(buffer.erroreManuale);
  // Con errori bloccanti nessun credito e nessun debito: il risultato
  // serve solo a mostrare i dati e gli errori, non si salva.
  const bloccato = errori.length > 0;
  const creditiLordi = !bloccato && deltaI < 0 ? -deltaI / 1000 : 0;
  const debito = !bloccato && deltaI > 0 ? deltaI / 1000 : 0;
  const quotaBuffer = (creditiLordi * buffer.totale) / 100;
  const creditiNetti = creditiLordi - quotaBuffer;

  return {
    versioneMetodologia: "1.2",
    calcolatoIl: new Date().toISOString(),
    periodo: { anno: dati.anno, dataAvvio: dati.dataAvvio || null, coefficiente, giorni },
    attesa: {
      Qtot: attesa.Qtot,
      QUD: attesa.QUD,
      QUnD: attesa.QUnD,
      QUDes: attesa.QUDes,
      pUd: attesa.pUd,
      pUnD: attesa.pUnD,
      tipologie: eaTipologie,
      classi: attesa.classi,
      EAterritorio,
    },
    indifferenziato,
    pesiSpecifici: { ps, dettaglio: dettaglioPs },
    tipologieMisurate,
    // Fonte della Banca Dati Utenze: "utenze" (passo 5a) o "conferimenti"
    // (passo 5b, tracciato).
    fonte: daUtenze ? "utenze" : "conferimenti",
    utenze: {
      totale: risultatiUtenze.length,
      equivalenti: somma(risultatiUtenze, (u) => u.nUtenze),
      virtuose: virtuose.length,
      // Utenze del passo 5a lasciate fuori (categoria mancante o non in delibera).
      escluse: escluse.senzaCategoria + escluse.categoriaIgnota,
      deltaITutte,
      deltaIVirtuose,
      EA: somma(risultatiUtenze, (u) => u.ea),
      EP: somma(risultatiUtenze, (u) => u.ep),
      dettaglio: risultatiUtenze,
    },
    deltaI,
    buffer,
    crediti: { lordi: creditiLordi, buffer: quotaBuffer, netti: creditiNetti, debito },
    avvisi: [...new Set(avvisi)],
    errori: [...new Set(errori)],
    bloccato,
  };
}
