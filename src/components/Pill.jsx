/* =========================================================================
   Pill
   Scopo: etichetta colorata compatta, a forma di pillola.
   Usato da: Timeline.jsx e ProjectCard.jsx, che però non sono più usati.
     Di fatto non usato: resto del prototipo, si può eliminare insieme a
     loro. Nel portale attuale si usa Badge.jsx (quasi identico).
   Chi lo vede: nessuno (non montato in alcuna pagina).
   Dati: nessuno.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React from "react";

// Etichetta colorata compatta (badge).
// Props: children (testo), bg (colore di sfondo), fg (colore del testo).
export default function Pill({ children, bg, fg }) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
