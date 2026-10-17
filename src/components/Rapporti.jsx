import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA } from "../lib/cwpProgram.js";
import Badge from "./Badge.jsx";
import { elencaRapporti, creaRapporto } from "../lib/dati.js";

/* Rapporti di Monitoraggio annuali di un Progetto (requisiti §2):
   fino a 10, uno per anno, in sequenza. Ognuno è una pratica autonoma. */
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

  const prossimo = rapporti.length + 1;

  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>
          Rapporti di Monitoraggio <span style={{ color: C.grafite, fontWeight: 600 }}>({rapporti.length}/10)</span>
        </h3>
        {staff && progetto.stato === "attiva" && prossimo <= 10 && (
          <button onClick={nuovo} disabled={inCorso} style={btnPrimario}>
            {inCorso ? "Creazione…" : `+ Rapporto anno ${prossimo}`}
          </button>
        )}
      </div>
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
      {rapporti.length === 0 && (
        <div style={{ fontSize: 13, color: C.grafite }}>Nessun Rapporto di Monitoraggio ancora.</div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        {rapporti.map((r) => {
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
