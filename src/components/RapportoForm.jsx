import React, { useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";

// Form del rapporto consuntivo annuale sui conferimenti.
export default function RapportoForm() {
  const [d, setD] = useState({
    anno: "2025",
    rifiutiTot: "9120",
    differenziata: "78.4",
    indifferenziato: "1970",
    organico: "2840",
    carta: "1510",
    plastica: "980",
    vetro: "820",
    kmMezzi: "184200",
    consumiImpianto: "412",
  });
  const campi = [
    ["anno", "Anno di riferimento", ""],
    ["rifiutiTot", "Rifiuti urbani totali", "t"],
    ["differenziata", "Raccolta differenziata", "%"],
    ["indifferenziato", "Indifferenziato a smaltimento", "t"],
    ["organico", "Frazione organica", "t"],
    ["carta", "Carta e cartone", "t"],
    ["plastica", "Plastica e imballaggi", "t"],
    ["vetro", "Vetro", "t"],
    ["kmMezzi", "Km percorsi dai mezzi", "km"],
    ["consumiImpianto", "Consumi energetici impianti", "MWh"],
  ];
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {campi.map(([k, label, unit]) => (
          <label key={k} style={{ display: "block" }}>
            <span style={{ fontSize: 11, color: C.grafite, fontWeight: 600 }}>
              {label} {unit && <span style={{ color: C.line }}>({unit})</span>}
            </span>
            <input
              value={d[k]}
              onChange={(e) => setD({ ...d, [k]: e.target.value })}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "9px 11px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "'Archivo', sans-serif",
                fontWeight: 600,
                color: C.ink,
                background: C.white,
                boxSizing: "border-box",
              }}
            />
          </label>
        ))}
      </div>
      <button
        style={{
          marginTop: 16,
          background: C.green,
          color: C.white,
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Invia rapporto consuntivo annuale
      </button>
      <p style={{ fontSize: 11.5, color: C.grafite, marginTop: 10, lineHeight: 1.5 }}>
        Il rapporto consuntivo annuale sui conferimenti è la base per la verifica e
        l'emissione dei crediti di CO₂eq. Monitoraggio cadenzato 1° gen → 31 dic.
      </p>
    </div>
  );
}
