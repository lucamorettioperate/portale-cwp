/* =========================================================================
   Rapporti
   Scopo: elenco dei Rapporti di Monitoraggio annuali di un Progetto
     (requisiti §2): uno per anno, in sequenza, fino a 10 con il periodo
     di riferimento di 10 anni o fino a 21 con 7 anni rinnovabili 3 volte
     (Standard 4.3.8, script 23). Ognuno è una pratica autonoma (tipo
     «rapporto») con le sue 7 fasi (Guida 6.3.1). Lo staff può creare il
     Rapporto dell'anno successivo; un clic apre il Rapporto.
   Usato da: DettaglioPratica.jsx (solo per le pratiche di tipo progetto).
   Chi lo vede: cliente/Comune (sola consultazione), operatore e admin
     (anche il pulsante «+ Rapporto anno N»).
   Dati: elencaRapporti, creaRapporto (src/lib/dati.js) sulla tabella
     pratica (righe con progetto_padre_id = progetto) e fase.
   Sicurezza: solo lo staff può creare pratiche (staff_crea_pratica e RLS
     pratica_insert, script 20-21). Il limite è controllato da creaRapporto e
     dal trigger rapporto_coerente (script 23), che rifiuta anche i Rapporti
     di un Progetto ritirato o annullato. Il codice
     (es. CWP-2026-0001-RM1) lo assegna un trigger del database (script 09).
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA, PERIODI_RIFERIMENTO } from "../lib/cwpProgram.js";
import Badge from "./Badge.jsx";
import { elencaRapporti, creaRapporto } from "../lib/dati.js";
import { useOrdinamento, SceltaOrdinamento } from "./Ordinamento.jsx";

/* Rapporti di Monitoraggio annuali di un Progetto (requisiti §2):
   uno per anno, in sequenza, fino al massimo del periodo di riferimento.
   Props: progetto (pratica di tipo progetto), staff (true per
   operatore/admin), onApri(id) (apre un Rapporto nel dettaglio),
   onCreato() (avvisa il genitore che l'elenco pratiche è cambiato). */
export default function Rapporti({ progetto, staff, onApri, onCreato }) {
  const [rapporti, setRapporti] = useState([]);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const { data } = await elencaRapporti(progetto.id);
    setRapporti(data || []);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progetto.id]);

  // Crea il Rapporto dell'anno successivo (con le 7 fasi, la prima in
  // corso), ricarica l'elenco e apre subito il nuovo Rapporto.
  async function nuovo() {
    setErrore("");
    setInCorso(true);
    const { data, error } = await creaRapporto(progetto);
    setInCorso(false);
    if (error) setErrore(error.message);
    else {
      await carica();
      onCreato && onCreato();
      data && onApri && onApri(data.id);
    }
  }

  // Numero mostrato sul pulsante. L'anno vero lo calcola creaRapporto
  // (massimo anno esistente + 1), quindi resta corretto anche con buchi.
  const prossimo = rapporti.length + 1;
  // Massimo dal periodo di riferimento del Progetto (10 o 21).
  const massimo = (PERIODI_RIFERIMENTO[progetto.periodo_riferimento] || PERIODI_RIFERIMENTO["10 anni"]).rapporti;

  // Ordinamento dei Rapporti («Ordina per»); senza scelta per anno.
  const ord = useOrdinamento(rapporti, {
    anno: (r) => r.anno_monitoraggio, codice: (r) => r.codice, stato: (r) => (STATI_PRATICA[r.stato] || {}).label || r.stato,
  });

  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>
          Rapporti di Monitoraggio <span style={{ color: C.grafite, fontWeight: 600 }}>({rapporti.length}/{massimo})</span>
        </h3>
        {/* Nuovo Rapporto: solo staff, solo su Progetto attivo, entro il massimo */}
        {staff && progetto.stato === "attiva" && prossimo <= massimo && (
          <button onClick={nuovo} disabled={inCorso} style={btnPrimario}>
            {inCorso ? "Creazione…" : `+ Rapporto anno ${prossimo}`}
          </button>
        )}
      </div>
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
      {rapporti.length === 0 && (
        <div style={{ fontSize: 13, color: C.grafite }}>Nessun Rapporto di Monitoraggio ancora.</div>
      )}
      {rapporti.length > 1 && <SceltaOrdinamento ord={ord} opzioni={[["anno", "Anno"], ["codice", "Codice"], ["stato", "Stato"]]} style={{ marginBottom: 8, flexWrap: "wrap" }} />}
      <div style={{ display: "grid", gap: 6 }}>
        {ord.ordinate.map((r) => {
          const st = STATI_PRATICA[r.stato] || STATI_PRATICA.attiva;
          return (
            <button key={r.id} onClick={() => onApri && onApri(r.id)} style={riga}>
              <span>
                <b>Anno {r.anno_monitoraggio}</b>
                <span style={{ color: C.grafite }}> · {r.codice}</span>
              </span>
              <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Stili locali (questo componente non usa ancora stili.js).
const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
// Riga cliccabile dell'elenco Rapporti.
const riga = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  width: "100%",
  textAlign: "left",
  background: C.white,
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13,
  cursor: "pointer",
};
