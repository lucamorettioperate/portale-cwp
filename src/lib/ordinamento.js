/* =========================================================================
   ordinamento.js — confronto e ordinamento delle righe di tabelle ed elenchi
   Scopo: logica pura (senza React) usata dal componente
     src/components/Ordinamento.jsx. Numeri come numeri, booleani (falso
     prima di vero), date ISO e testi in ordine alfabetico italiano senza
     distinguere maiuscole e con i numeri nel testo in ordine naturale
     («CWP-2» prima di «CWP-10»); valori vuoti sempre in fondo, in entrambi
     i versi; a parità resta l'ordine di partenza (ordinamento stabile).
   Prove: test/ordinamento.test.mjs.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
const collatore = new Intl.Collator("it", { numeric: true, sensitivity: "base" });
const vuoto = (v) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

// Confronto di due valori in ordine crescente (vuoti esclusi).
export function confronta(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collatore.compare(String(a), String(b));
}

// Righe ordinate. colonne: { chiave: funzione(riga) → valore }.
// ordine: { chiave, verso: "asc" | "desc" }; senza chiave restano come sono.
export function ordina(righe, colonne, ordine) {
  const valore = ordine?.chiave ? colonne[ordine.chiave] : null;
  if (!valore) return righe;
  const segno = ordine.verso === "desc" ? -1 : 1;
  return righe
    .map((r, i) => ({ r, i, v: valore(r) }))
    .sort((x, y) => {
      const vx = vuoto(x.v);
      const vy = vuoto(y.v);
      if (vx || vy) return vx === vy ? x.i - y.i : vx ? 1 : -1;
      return segno * confronta(x.v, y.v) || x.i - y.i;
    })
    .map((x) => x.r);
}
