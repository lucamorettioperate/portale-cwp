/* Utilità per le date mostrate nel portale (formato italiano). */

// "2026-10-17" o un timestamp → "17/10/2026"
export function formatoData(valore) {
  if (!valore) return "—";
  const d = typeof valore === "string" && valore.length === 10 ? new Date(valore + "T00:00:00") : new Date(valore);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Giorni che mancano a una data (negativo se già passata).
export function giorniA(dataIso) {
  if (!dataIso) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(dataIso + "T00:00:00");
  return Math.round((d - oggi) / (24 * 60 * 60 * 1000));
}

// Oggi in formato ISO (aaaa-mm-gg), ora locale.
export function oggiIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
