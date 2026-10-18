/* =========================================================================
   stato.js — colori del badge di stato (resto del prototipo).

   Scopo: restituisce i colori di sfondo e testo per gli stati usati dai
   dati di esempio ("Validato", "In istruttoria", "Adesione"). Le pratiche
   reali usano invece STATI_PRATICA e STATI_FASE di cwpProgram.js.

   Usato da: src/components/ProjectCard.jsx (componente del prototipo,
   non più usato dalle pagine attuali).
   Dati/servizi coinvolti: nessuno.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)».
   ========================================================================= */
import { COLORI as C } from "./cwpProgram.js";

// Colori del badge di stato di una pratica.
// Parametro: stato (testo). Restituisce { bg, fg } (sfondo, testo);
// per uno stato sconosciuto restituisce un grigio neutro.
export function statoColor(stato) {
  switch (stato) {
    case "Validato":
      return { bg: C.greenSoft, fg: C.green };
    case "In istruttoria":
      return { bg: C.ocraSoft, fg: C.amber };
    case "Adesione":
      return { bg: "#e8e8e2", fg: C.grafite };
    default:
      return { bg: "#eee", fg: "#555" };
  }
}
