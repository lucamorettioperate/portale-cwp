/* =========================================================================
   Timeline
   Scopo: linea del tempo orizzontale delle fasi di una pratica, con la
     barra di avanzamento in giorni e il responsabile di ogni fase.
   Usato da: nessun file. Non usato: resto del prototipo, si può eliminare.
     Attenzione: è scritto per il vecchio modello del prototipo (6 fasi,
     campi f.n / f.giorno / f.titolo / f.attore, costante ATTORI) che non
     esiste più in src/lib/cwpProgram.js; se venisse rimontato non
     funzionerebbe senza essere riscritto.
   Chi lo vede: nessuno (non montato in alcuna pagina).
   Dati: nessuno dal database; solo costanti di src/lib/cwpProgram.js.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";
import { FASI, ATTORI, COLORI as C } from "../lib/cwpProgram.js";
import Pill from "./Pill.jsx";

// Timeline orizzontale delle 6 fasi, con avanzamento della pratica.
// Props: progetto (oggetto del prototipo con giornoCorrente e faseCorrente).
export default function Timeline({ progetto }) {
  // Durata complessiva del percorso in giorni (fondo scala della barra).
  const maxG = 150;
  return (
    <div style={{ position: "relative", padding: "44px 8px 8px" }}>
      <div
        style={{ position: "absolute", top: 58, left: 24, right: 24, height: 2, background: C.line }}
      />
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 24,
          width: `calc(${(progetto.giornoCorrente / maxG) * 100}% - 24px)`,
          height: 2,
          background: C.green,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
        {FASI.map((f) => {
          // Fase superata se il giorno corrente ha passato il suo giorno di riferimento.
          const done = progetto.giornoCorrente > f.giorno;
          const current = progetto.faseCorrente === f.n;
          const att = ATTORI[f.attore];
          return (
            <div
              key={f.n}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -34,
                  fontFamily: "'Archivo', sans-serif",
                  fontWeight: 800,
                  fontSize: 19,
                  color: done || current ? C.green : C.line,
                  letterSpacing: -0.5,
                }}
              >
                G{f.giorno}
              </div>
              <div
                style={{
                  width: current ? 22 : 16,
                  height: current ? 22 : 16,
                  borderRadius: "50%",
                  background: C.white,
                  border: `3px solid ${done || current ? C.green : C.line}`,
                  backgroundColor: done ? C.green : C.white,
                  boxShadow: current ? `0 0 0 5px ${C.greenSoft}` : "none",
                  zIndex: 2,
                  transition: "all .2s",
                }}
              />
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.ink,
                  textAlign: "center",
                  lineHeight: 1.3,
                  maxWidth: 120,
                }}
              >
                {f.titolo}
              </div>
              <div style={{ marginTop: 6 }}>
                <Pill bg={att.soft} fg={att.color}>
                  {att.short}
                </Pill>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
