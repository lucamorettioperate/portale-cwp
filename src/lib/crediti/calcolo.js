/* =========================================================================
   Motore di calcolo dei crediti — Metodologia Carbon WastePrint® v1.2.
   Funzioni pure (nessun accesso al database): ricevono i dati del calcolo
   e restituiscono risultati intermedi e finali, con il riferimento alla
   formula della Metodologia accanto a ogni passaggio.

   Unità: quantità territoriali in tonnellate/anno; per utenza in kg/anno;
   emissioni in kgCO₂eq (per utenza) e tCO₂eq (territorio e crediti).
   ========================================================================= */
import {
  BUFFER_UTENZE,
  BUFFER_CATEGORIA_UND_NON_MONITORATA,
  BUFFER_CATEGORIE_UND_MAX,
  BUFFER_MASSIMO,
  GIORNI_ANNO,
} from "./parametri.js";

const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const somma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/* ---------------------------------------------------------------------
   Capitolo 2 — Periodo di riferimento (formula 1)
   Coefficiente GGe/GG per un primo anno parziale (dall'avvio al 31/12).
   --------------------------------------------------------------------- */
export function coefficientePrimoAnno(dataAvvio, anno) {
  if (!dataAvvio) return { coefficiente: 1, giorni: GIORNI_ANNO };
  const avvio = new Date(dataAvvio + "T00:00:00");
  if (isNaN(avvio) || avvio.getFullYear() !== Number(anno)) return { coefficiente: 1, giorni: GIORNI_ANNO };
  const fine = new Date(avvio.getFullYear(), 11, 31);
  const giorni = Math.round((fine - avvio) / 86400000) + 1;
  return { coefficiente: Math.min(1, giorni / GIORNI_ANNO), giorni };
}

/* ---------------------------------------------------------------------
   Capitolo 5 — Fattore di emissione dell'indifferenziato (formule 16-17)
   FErid(rur) = Σ FErid(r=rec) × M(r=rec),  M = Qtot(r) / Σ Qtot(r=rec)
   --------------------------------------------------------------------- */
export function fattoreIndifferenziato(quantitaPerTipologia, fattori) {
  const voci = Object.entries(quantitaPerTipologia).filter(
    ([t, q]) => q > 0 && fattori[t] && fattori[t].recupero && Number.isFinite(fattori[t].fe)
  );
  const totale = somma(voci, ([, q]) => q);
  if (!totale) return { fe: null, composizione: [] };
  const composizione = voci.map(([t, q]) => ({ tipologia: t, quota: q / totale, fe: fattori[t].fe }));
  return { fe: somma(composizione, (c) => c.fe * c.quota), composizione };
}

/* ---------------------------------------------------------------------
   Capitolo 3 — Produzione attesa per classe di utenza (formule 2-12)
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
   --------------------------------------------------------------------- */
export function pesiSpecifici({ perTipologia, conferimenti, volumiCentralizzati = {}, consuntivo, pesiDefault }) {
  const ps = {};
  const dettaglio = {};
  Object.keys({ ...pesiDefault, ...perTipologia }).forEach((t) => {
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
   Priut(b,i) = Np × Pb (o peso misurato)
   --------------------------------------------------------------------- */
export function conferimentiInPeso({ conferimenti, riuso = [], ps, beni }) {
  const utenze = new Map();
  const avvisi = [];
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
    u.ptot[c.tipologia] = (u.ptot[c.tipologia] || 0) + pd + pStIn + pCdR; // formula 21
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

  const chiave = ["res", "nonres", "und"].filter((k) => utenzeMonitorate?.[k]).join("+");
  if (chiave && BUFFER_UTENZE[chiave] !== undefined) {
    voci.push({ voce: `Utenze monitorate (Tab. 15): ${chiave.replace(/\+/g, ", ")}`, valore: BUFFER_UTENZE[chiave] });
  }
  const nonMon = Math.min(BUFFER_CATEGORIE_UND_MAX, num(categorieUndNonMonitorate) * BUFFER_CATEGORIA_UND_NON_MONITORATA);
  if (nonMon > 0) voci.push({ voce: `Categorie non domestiche non monitorate (Tab. 15)`, valore: nonMon });

  // Tabella 16: rifiuti misurati.
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

  let totale = Math.max(0, somma(voci, (v) => v.valore));
  if (tariffaPuntuale) {
    voci.push({ voce: "Tariffa puntuale attiva: buffer dimezzato", valore: -totale / 2 });
    totale = totale / 2;
  }
  totale = Math.min(BUFFER_MASSIMO, totale);

  if (bufferManuale !== null && bufferManuale !== undefined && bufferManuale !== "") {
    return { voci, calcolato: totale, totale: Math.min(BUFFER_MASSIMO, Math.max(0, num(bufferManuale))), manuale: true };
  }
  return { voci, calcolato: totale, totale, manuale: false };
}

/* ---------------------------------------------------------------------
   Calcolo completo: emissioni attese (Cap. 4), di progetto (Cap. 6.2),
   variazione di impatto (formule 31-32), buffer e crediti.
   --------------------------------------------------------------------- */
export function calcolaCrediti(dati) {
  const avvisi = [];
  const { coefficiente, giorni } = coefficientePrimoAnno(dati.dataAvvio, dati.anno);

  // Fattori di emissione per tipologia e per bene.
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

  // Fattore dell'indifferenziato (formule 16-17), se non indicato dal Progetto.
  const ind = fattori.indifferenziato;
  let indifferenziato = null;
  if (ind && (ind.fe == null || ind.calcolato)) {
    indifferenziato = fattoreIndifferenziato(attesa.perTipologia, fattori);
    fattori.indifferenziato = { ...ind, fe: indifferenziato.fe };
  }

  const fe = (t) => {
    const f = fattori[t]?.fe;
    if (f == null || !Number.isFinite(f)) {
      avvisi.push(`Manca il fattore di emissione per «${t}»: escluso dal calcolo.`);
      return 0;
    }
    return f;
  };

  // 2. Emissioni attese del territorio (formule 13-15), in tCO₂eq.
  const eaTipologie = attesa.tipologie.map((t) => ({ ...t, fe: fe(t.tipologia), ea: -t.qtot * fe(t.tipologia) }));
  const EAterritorio = somma(eaTipologie, (t) => t.ea);

  // 3. Conferimenti in peso per utenza (Cap. 6.1).
  const conferimenti = dati.conferimenti || [];
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
  const classiPerChiave = new Map(attesa.classi.map((c) => [`${c.macro}|${c.classe}`, c]));
  const senzaClasse = new Set();
  const risultatiUtenze = pesi.utenze.map((u) => {
    const classe = classiPerChiave.get(`${u.macro}|${u.classe}`);
    if (!classe) senzaClasse.add(`${u.macro} ${u.classe}`);
    const n = u.nUtenze || 1;
    // EA(i): formula 13 applicata ai valori attesi della classe dell'utenza.
    const ea = classe ? somma(tipologieMisurate, (t) => -num(classe.atteso[t]) * fe(t)) * n : 0;
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
  const virtuose = risultatiUtenze.filter((u) => u.deltaI < 0);
  const deltaITutte = somma(risultatiUtenze, (u) => u.deltaI);
  const deltaIVirtuose = somma(virtuose, (u) => u.deltaI);
  const deltaI = dati.opzioni?.soloVirtuose ? deltaIVirtuose : deltaITutte;

  // 6. Buffer e crediti (tCO₂eq).
  const buffer = calcolaBuffer({ ...(dati.opzioni || {}), soloVirtuose: !!dati.opzioni?.soloVirtuose });
  const creditiLordi = deltaI < 0 ? -deltaI / 1000 : 0;
  const debito = deltaI > 0 ? deltaI / 1000 : 0;
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
    utenze: {
      totale: risultatiUtenze.length,
      equivalenti: somma(risultatiUtenze, (u) => u.nUtenze),
      virtuose: virtuose.length,
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
  };
}
