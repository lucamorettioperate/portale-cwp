/* Stili condivisi dai componenti delle pratiche (stessa grafica del resto
   del portale: carta, verde Fondazione, bordi sottili). */
import { COLORI as C } from "../lib/cwpProgram.js";

export const riquadro = {
  background: C.white,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  padding: "18px 20px",
};

export const titoloRiquadro = { fontFamily: "'Archivo'", fontSize: 15, margin: 0 };

export const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: C.white,
};

export const etichetta = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 10 };

export const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

export const btnMini = {
  background: C.white,
  color: C.grafite,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

export const btnLink = {
  background: "none",
  border: "none",
  padding: 0,
  color: C.green,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
};

export const avviso = {
  background: C.ocraSoft || "#f3e7d6",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.5,
};

// "18/10/2026 · 14:05"
export function dataOra(valore) {
  if (!valore) return "—";
  const d = new Date(valore);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}
