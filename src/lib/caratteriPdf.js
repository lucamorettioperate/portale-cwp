/* =========================================================================
   caratteriPdf.js — carattere tipografico incorporato nei PDF
   (collaudo V01, R08, 21/10/2026).

   Scopo: i PDF del portale usavano i caratteri standard «Helvetica» NON
   incorporati: ogni lettore li sostituiva con un carattere locale e, se le
   larghezze erano diverse, la spaziatura diventava irregolare e i glifi si
   sovrapponevano (rilievo R08 del collaudo). Ora nei PDF si incorpora
   Liberation Sans, con le stesse larghezze di Helvetica/Arial, così
   l'impaginazione resta identica e ogni lettore mostra lo stesso testo.
   I file .ttf sono in public/caratteri/ (licenza SIL Open Font License 1.1,
   testo in public/caratteri/LICENZA_OFL_Liberation.txt) e si scaricano solo
   quando si crea un PDF.

   Uso: const FONT = await caratteriPdf(doc); poi doc.setFont(FONT, "bold")
   e styles: { font: FONT } nelle tabelle di autotable.
   Se i file non si possono scaricare (per esempio nelle prove in Node)
   restituisce "helvetica": il PDF si crea comunque, come prima.
   Usato da: src/lib/crediti/rapportoPdf.js, src/lib/crediti/simulatorePdf.js,
   src/lib/fascicoloPdf.js.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»; Registro issue
   e test, R08.
   ========================================================================= */

export const NOME_CARATTERE = "LiberationSans";

// Varianti usate dai PDF del portale (nessun corsivo): stile di jsPDF →
// file in public/caratteri/. Per il corsivo aggiungere qui il file.
const VARIANTI = {
  normal: "LiberationSans-Regular.ttf",
  bold: "LiberationSans-Bold.ttf",
};

// I file scaricati restano in memoria per i PDF successivi della pagina.
let inMemoria = null;

// Da ArrayBuffer a testo base64 (a blocchi, per non superare i limiti degli argomenti).
function base64(buffer) {
  const byte = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
  return btoa(s);
}

// Scarica le varianti (una volta sola). Restituisce { stile: base64 } o null.
async function scarica() {
  if (inMemoria) return inMemoria;
  if (typeof window === "undefined" || typeof fetch !== "function") return null;
  try {
    const voci = await Promise.all(
      Object.entries(VARIANTI).map(async ([stile, file]) => {
        const r = await fetch(`/caratteri/${file}`);
        if (!r.ok) throw new Error(file);
        return [stile, base64(await r.arrayBuffer())];
      })
    );
    inMemoria = Object.fromEntries(voci);
    return inMemoria;
  } catch {
    return null;
  }
}

/* Registra il carattere nel documento jsPDF. Parametro: doc (jsPDF).
   Restituisce il nome da usare in setFont e negli stili delle tabelle. */
export async function caratteriPdf(doc) {
  const file = await scarica();
  if (!file) return "helvetica";
  Object.entries(file).forEach(([stile, dati]) => {
    doc.addFileToVFS(VARIANTI[stile], dati);
    doc.addFont(VARIANTI[stile], NOME_CARATTERE, stile);
  });
  doc.setFont(NOME_CARATTERE, "normal");
  return NOME_CARATTERE;
}
