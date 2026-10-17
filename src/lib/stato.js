import { COLORI as C } from "./cwpProgram.js";

// Colori del badge di stato di una pratica.
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
