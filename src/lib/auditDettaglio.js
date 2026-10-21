/* =========================================================================
   auditDettaglio.js — lettura dei dettagli degli eventi dell'audit
   (collaudo V01, D05, 20/10/2026).

   Scopo: rendere riconoscibile, nelle pagine Audit e Audit User, QUALE
   oggetto è stato modificato e COSA è cambiato. Il database registra già
   tutto (trigger audit_registra, script 07/21): l'id dell'oggetto e, per
   le modifiche, ogni campo cambiato come { campo: { da, a } }; per creazioni
   e cancellazioni la riga intera. Prima la pagina mostrava solo «update
   scenario_simulazione»: ora mostra il nome dello scenario, il suo codice
   breve e le variazioni (buffer, popolazione, produzione anno per anno,
   valore del credito, crediti stimati…).
   Nessuna modifica agli eventi registrati: si legge soltanto.

   Funzioni pure (nessun accesso ai dati), provate da
   test/collaudo_v01.test.mjs. Usato da src/pages/Audit.jsx e
   src/pages/AuditUtenti.jsx.
   Registro sviluppo e deploy: capitolo «Portale (frontend)», «Collaudo».
   ========================================================================= */

// Nomi leggibili dei tipi di oggetto.
const TIPI = {
  scenario_simulazione: "Scenario del simulatore",
  calcolo_crediti: "Calcolo dei crediti",
  pratica: "Pratica",
  fase: "Fase",
  documento: "Documento",
  profilo: "Utente",
  organizzazione: "Organizzazione",
  ente_validazione: "Ente di validazione e verifica",
  registro: "Registro",
};

// Nomi leggibili dei campi (primo livello e dentro i dati dello scenario).
const CAMPI = {
  nome: "Nome",
  note: "Note",
  durata: "Durata (anni)",
  anno_inizio: "Primo anno",
  comune: "Comune",
  crediti_netti_totali: "Crediti netti stimati (tCO₂eq)",
  rd_finale: "% differenziata finale",
  simulato_il: "Ultimo ricalcolo",
  stato: "Stato",
  buffer_pct: "Buffer (%)",
  crediti_lordi: "Crediti lordi (tCO₂eq)",
  crediti_netti: "Crediti netti (tCO₂eq)",
  bufferPct: "Buffer (%)",
  metodoStima: "Metodo di stima",
  popolazione: "popolazione",
  totale: "produzione totale (t)",
  seccoProCapite: "secco pro capite (kg/ab)",
  proCapite: "produzione pro capite (kg/ab)",
  annoBase: "Riferimento",
  attuale: "Situazione attuale",
  economia: "Economia",
  stimaUtenze: "Stima per utenza",
  rifiuti: "rifiuti (t)",
  prezzo: "valore del credito (€)",
  prezzi: "valore del credito (€)",
  prezzoMin: "valore minimo (€)",
  prezzoMax: "valore massimo (€)",
  crescitaPrezzo: "variazione annua del valore (%)",
  listino: "listino dei costi",
  variabilita: "variabilità (%)",
  anni: "", // gli anni compaiono come «Anno 2027»
};
const nomeCampo = (k) => (k in CAMPI ? CAMPI[k] : String(k).replace(/_/g, " "));

// Un oggetto è un «cambio» del trigger se ha solo le chiavi da/a.
const eCambio = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => k === "da" || k === "a") && ("da" in v || "a" in v);

// Valore breve da mostrare.
export function valoreBreve(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + "…" : s;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return new Date(s).toLocaleString("it-IT");
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

// Soglia oltre la quale un valore si mostra accorciato nella tabella
// (il testo completo resta disponibile con «Testo completo», D05-R1).
export const LUNGHEZZA_BREVE = 80;

// Testo completo di un valore registrato: le stringhe così come sono (con
// gli a capo), oggetti e liste come JSON leggibile. Vuoto = "".
export function valoreCompleto(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

// true se il valore nella tabella viene accorciato o ha più righe: allora
// serve il pulsante «Testo completo» (collaudo V05, D05-R1).
export function valoreLungo(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "object") return JSON.stringify(v).length > 60;
  const t = String(v);
  return t.length > LUNGHEZZA_BREVE || t.includes("\n");
}

/* Parte che cambia tra due testi (collaudo V05, D05-R1): si toglie
   l'inizio e la fine in comune e restano il pezzo tolto e quello aggiunto.
   Esempio: "Nota. Riga di prova." → "Nota." dà tolto " Riga di prova.",
   aggiunto "". Serve quando due testi lunghi hanno lo stesso inizio e nella
   tabella sembrerebbero uguali. Restituisce { inizio, tolto, aggiunto, fine }
   (inizio e fine = lunghezze in caratteri della parte comune). */
export function differenzaTesto(da, a) {
  const x = valoreCompleto(da);
  const y = valoreCompleto(a);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return { inizio: i, tolto: x.slice(i, x.length - j), aggiunto: y.slice(i, y.length - j), fine: j };
}

/* Testo su cui cercare nell'audit: oggetto, campi cambiati e valori
   completi (così si trova anche una riga aggiunta a metà di una nota). */
export function testoRicercaEvento(e, nomi = {}) {
  const m = modificheEvento(e).map((x) => `${x.campo} ${valoreCompleto(x.da)} ${valoreCompleto(x.a)}`);
  return [etichettaOggetto(e, nomi), e?.oggetto_id, ...m].filter(Boolean).join(" ");
}

/* Differenze tra due valori JSON, come elenco [{ campo, da, a }].
   Gli array di anni ({ anno, … }) si confrontano per anno, gli altri per
   posizione. percorso: etichette già raccolte (uso interno). */
export function differenze(da, a, percorso = []) {
  const uguali = JSON.stringify(da) === JSON.stringify(a);
  if (uguali) return [];
  const oggetto = (x) => x && typeof x === "object" && !Array.isArray(x);
  const conAnno = (x) => Array.isArray(x) && x.every((e) => oggetto(e) && "anno" in e);
  if ((conAnno(da) || da == null) && (conAnno(a) || a == null) && (conAnno(da) || conAnno(a))) {
    const mappa = (x) => new Map((x || []).map((e) => [String(e.anno), e]));
    const m1 = mappa(da);
    const m2 = mappa(a);
    const anni = [...new Set([...m1.keys(), ...m2.keys()])].sort();
    return anni.flatMap((anno) => differenze(m1.get(anno), m2.get(anno), [...percorso, `Anno ${anno}`]).filter((d) => !d.campo.endsWith("› anno")));
  }
  if (oggetto(da) || oggetto(a)) {
    const k = [...new Set([...Object.keys(da || {}), ...Object.keys(a || {})])];
    return k.flatMap((c) => differenze((da || {})[c], (a || {})[c], [...percorso, nomeCampo(c)]));
  }
  return [{ campo: percorso.filter(Boolean).join(" › ") || "valore", da, a }];
}

/* Modifiche di un evento dell'audit: [{ campo, da, a }].
   - modifica (UPDATE): il dettaglio è { campo: { da, a } }; i campi JSON
     (es. «dati» dello scenario) si scompongono campo per campo;
   - creazione o cancellazione: nessun elenco (la riga intera è nel
     dettaglio; il nome compare nell'oggetto). */
export function modificheEvento(e) {
  const d = e?.dettaglio;
  if (!d || typeof d !== "object") return [];
  const voci = Object.entries(d);
  if (!voci.length || !voci.every(([, v]) => eCambio(v))) return [];
  return voci.flatMap(([campo, { da, a }]) => {
    if (campo === "dati") return differenze(da, a);
    return differenze(da, a, [nomeCampo(campo)]);
  });
}

/* Oggetto dell'evento in parole: tipo, nome e codice breve dell'id.
   Parametri: evento e nomi { id: nome } (es. scenari attuali). Il nome si
   cerca nell'ordine: nome nuovo della modifica, nome nel dettaglio
   (creazione/cancellazione), elenco dei nomi attuali. */
export function etichettaOggetto(e, nomi = {}) {
  const tipo = TIPI[e?.oggetto_tipo] || (e?.oggetto_tipo || "—").replace(/_/g, " ");
  const d = e?.dettaglio || {};
  // Anche la denominazione (organizzazioni, enti): collaudo V05, D05-R1.
  const testo = (k) => (eCambio(d[k]) && typeof d[k].a === "string" ? d[k].a : typeof d[k] === "string" ? d[k] : null);
  const nome = testo("nome") || testo("denominazione") || testo("titolo") || (e?.oggetto_id && nomi[e.oggetto_id]) || null;
  const codice = e?.oggetto_id ? String(e.oggetto_id).slice(0, 8) : null;
  return [tipo, nome ? `«${nome}»` : null, codice ? `(${codice})` : null].filter(Boolean).join(" ");
}
