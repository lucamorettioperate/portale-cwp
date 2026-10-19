/* =========================================================================
   BarraFasi — indicatore a LED dell'avanzamento di una pratica sulle 7 fasi
   Scopo: barra orizzontale di 7 «luci», una per fase (richiesta di Luca del
     19/10/2026). Le fasi completate sono accese, quelle ancora da fare
     spente. Le luci accese delle fasi 1-6 sono ambra; la settima
     (Chiusura) è verde. La fase in corso resta spenta ma ha un contorno
     ambra, così si vede dove è arrivata la pratica. Accanto, il conteggio
     «n/7». Passando il mouse su una luce compaiono numero, nome e stato
     della fase.
   Usato da: src/pages/Cruscotto.jsx (Dashboard), colonna «Avanzamento».
   Props:
     - fasi: elenco delle fasi della pratica, ognuna { numero, nome, stato }
       (tabella fase, script 01); stato = non_iniziata | in_corso |
       in_attesa_integrazione | completata. Le fasi mancanti valgono
       «non iniziata».
     - totale: numero di luci (predefinito 7).
   Solo visualizzazione: nessun dato scritto.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React from "react";
import { STATI_FASE } from "../lib/cwpProgram.js";

// Colori delle luci accese (colore e alone). Le spente sono grigio scuro
// (la settima con una punta di verde) con un leggero incavo.
const AMBRA = { acceso: "#f2a516", alone: "rgba(242,165,22,0.55)" };
const VERDE = { acceso: "#2fb24c", alone: "rgba(47,178,76,0.55)" };

export default function BarraFasi({ fasi = [], totale = 7 }) {
  // Stato di ogni fase per numero (1..totale).
  const perNumero = {};
  for (const f of fasi) perNumero[f.numero] = f;
  const completate = Array.from({ length: totale }, (_, i) => perNumero[i + 1]?.stato === "completata").filter(Boolean).length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }} aria-label={`Avanzamento: ${completate} fasi completate su ${totale}`}>
      {/* Il «pannello» scuro che contiene le luci */}
      {/* Barra sottile e corta (richiesta di Luca del 19/10): luci da 7 px. */}
      <div style={{ display: "flex", gap: 3, padding: "2px 4px", background: "#2a2f27", borderRadius: 999 }}>
        {Array.from({ length: totale }, (_, i) => {
          const numero = i + 1;
          const f = perNumero[numero];
          const stato = f?.stato || "non_iniziata";
          const accesa = stato === "completata";
          const inCorso = stato === "in_corso" || stato === "in_attesa_integrazione";
          const colori = numero === totale ? VERDE : AMBRA;
          const titolo = `Fase ${numero}${f?.nome ? ` — ${f.nome}` : ""}: ${STATI_FASE[stato]?.label || stato}`;
          return (
            <span
              key={numero}
              title={titolo}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: accesa ? colori.acceso : numero === totale ? "#4a5a46" : "#4a4d45",
                boxShadow: accesa
                  ? `0 0 3px 0.5px ${colori.alone}`
                  : inCorso
                    ? `inset 0 0 0 1.5px ${colori.acceso}`
                    : "inset 0 1px 1px rgba(0,0,0,0.5)",
                display: "inline-block",
              }}
            />
          );
        })}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#5a5e54", whiteSpace: "nowrap" }}>
        {completate}/{totale}
      </span>
    </div>
  );
}
