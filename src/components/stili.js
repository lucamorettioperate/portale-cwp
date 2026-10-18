/* =========================================================================
   stili.js (stili condivisi)
   Scopo: oggetti di stile in linea condivisi dai componenti delle pratiche
     e delle impostazioni (stessa grafica del resto del portale: carta,
     verde Fondazione, bordi sottili) e la funzione dataOra per mostrare
     data e ora in formato italiano.
   Usato da: Messaggi, Consultazione, NoteFase, impostazioni/EntiValidazione,
     impostazioni/ModelliDocumento, pagina ConsultazioniPubbliche.
     Altri componenti più vecchi definiscono ancora stili propri: per
     cambiare l'aspetto di un pulsante può servire intervenire anche lì.
   Chi lo vede: tutti, comprese le pagine pubbliche della consultazione.
   Dati: nessuno; colori da COLORI di src/lib/cwpProgram.js.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import { COLORI as C } from "../lib/cwpProgram.js";

// Contenitore bianco con bordo sottile (sezione di una pagina).
export const riquadro = {
  background: C.white,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  padding: "18px 20px",
};

// Titolo di un riquadro.
export const titoloRiquadro = { fontFamily: "'Archivo'", fontSize: 15, margin: 0 };

// Campo di testo, menu a tendina o area di testo a tutta larghezza.
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

// <label> che contiene il testo dell'etichetta e, sotto, il campo.
export const etichetta = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 10 };

// Pulsante principale (verde): l'azione che salva o invia.
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

// Pulsante secondario (bianco con bordo): annulla, modifica, azioni minori.
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

// Pulsante che sembra un collegamento (testo verde sottolineato).
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

// Riquadro di avviso (sfondo ocra chiaro). Oggi non importato da nessun file.
export const avviso = {
  background: C.ocraSoft || "#f3e7d6",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.5,
};

// Data e ora in formato italiano, nel fuso orario del browser:
// "18/10/2026 · 14:05". Valore vuoto → "—".
export function dataOra(valore) {
  if (!valore) return "—";
  const d = new Date(valore);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}
