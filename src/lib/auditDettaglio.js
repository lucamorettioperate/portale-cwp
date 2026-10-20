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
  const nome = (eCambio(d.nome) ? d.nome.a : null) || (typeof d.nome === "string" ? d.nome : null) || (typeof d.titolo === "string" ? d.titolo : null) || (e?.oggetto_id && nomi[e.oggetto_id]) || null;
  const codice = e?.oggetto_id ? String(e.oggetto_id).slice(0, 8) : null;
  return [tipo, nome ? `«${nome}»` : null, codice ? `(${codice})` : null].filter(Boolean).join(" ");
}
