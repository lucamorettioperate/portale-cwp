/* =========================================================================
   ProjectCard
   Scopo: scheda di una pratica nella lista laterale del prototipo (nome,
     stato, codice, barra di avanzamento in giorni su 150).
   Usato da: nessun file. Non usato: resto del prototipo, si può eliminare.
     Usa i campi del prototipo (p.nome, p.giornoCorrente, p.faseCorrente,
     stati «Validato», «In istruttoria») e non quelli della tabella pratica.
   Chi lo vede: nessuno (non montato in alcuna pagina).
   Dati: nessuno dal database; colori da src/lib/cwpProgram.js e
     statoColor da src/lib/stato.js (anch'esso del prototipo).
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { statoColor } from "../lib/stato.js";
import Pill from "./Pill.jsx";

// Card di una pratica nella lista laterale.
// Props: p (pratica del prototipo), active (evidenziata se selezionata),
// onClick (selezione della pratica).
export default function ProjectCard({ p, active, onClick }) {
  const sc = statoColor(p.stato);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        width: "100%",
        background: active ? C.white : "transparent",
        border: `1px solid ${active ? C.green : C.line}`,
        borderLeft: `4px solid ${active ? C.green : C.line}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        marginBottom: 10,
        transition: "all .15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 14, color: C.ink }}>
          {p.nome}
        </span>
        <Pill bg={sc.bg} fg={sc.fg}>{p.stato}</Pill>
      </div>
      <div style={{ fontSize: 12, color: C.grafite, marginTop: 4 }}>
        {p.id} · {p.tipo}
      </div>
      <div style={{ marginTop: 10, height: 5, background: C.paperWarm, borderRadius: 99 }}>
        <div
          style={{
            width: `${(p.giornoCorrente / 150) * 100}%`,
            height: "100%",
            background: p.stato === "Validato" ? C.green : C.amber,
            borderRadius: 99,
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: C.grafite, marginTop: 5 }}>
        Fase {p.faseCorrente}/6 · Giorno {p.giornoCorrente}
      </div>
    </button>
  );
}
