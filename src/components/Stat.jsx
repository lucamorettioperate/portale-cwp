/* =========================================================================
   Stat
   Scopo: riquadro con un dato numerico in evidenza (etichetta, valore,
     unità di misura facoltativa).
   Usato da: nessun file. Non usato: resto del prototipo, si può eliminare.
   Chi lo vede: nessuno (non montato in alcuna pagina).
   Dati: nessuno; solo la palette COLORI di src/lib/cwpProgram.js.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";

// Riquadro con un dato numerico in evidenza.
// Props: label (testo sopra), value (numero mostrato grande), unit (facoltativa),
// accent (colore del valore; se assente usa il colore del testo).
export default function Stat({ label, value, unit, accent }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "16px 18px",
        flex: 1,
        minWidth: 150,
      }}
    >
      <div style={{ fontSize: 11, color: C.grafite, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 5 }}>
        <span
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontWeight: 800,
            fontSize: 26,
            color: accent || C.ink,
            letterSpacing: -0.5,
          }}
        >
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, color: C.grafite, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}
