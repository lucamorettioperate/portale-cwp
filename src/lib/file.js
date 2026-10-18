/* =========================================================================
   file.js — controlli sui file prima del caricamento (requisiti §13 "Upload").

   Scopo: prima di inviare un file all'archivio controlla formato ammesso,
   dimensione, contenuto reale (primi byte, "firma" del formato) e prepara
   un nome sicuro per il percorso nell'archivio. Traduce anche gli errori
   dello Storage di Supabase.

   Gli stessi limiti sono imposti anche dal database e dall'archivio
   (script 14): qui servono a dare subito un messaggio chiaro e a
   verificare il contenuto reale del file, non solo il nome.

   Usato da: src/lib/dati.js (caricamento documenti, integrazioni, modelli),
   src/components/Documenti.jsx, src/components/Integrazioni.jsx,
   src/components/impostazioni/ModelliDocumento.jsx.

   Dati/servizi coinvolti: nessuna chiamata diretta. I limiti devono restare
   allineati a supabase/14_controlli_file.sql (funzione cwp_formati_ammessi,
   limite 52428800 byte, trigger sul documento) e alla configurazione del
   bucket `documenti`.

   Sicurezza: il controllo nel browser si può aggirare; quello che conta è
   il controllo del database/archivio. Manca ancora l'antivirus (backlog).

   Registro sviluppo e deploy: capitolo 4 «Database» (14_controlli_file.sql);
   capitolo 6 «Portale (frontend)»; vedi anche docs/controlli-file.md.
   ========================================================================= */

// Limite per singolo file: 50 MB (massimo del piano Supabase Free).
export const DIMENSIONE_MASSIMA = 50 * 1024 * 1024; // 50 MB

// Estensione → tipo MIME canonico e famiglia di contenuto attesa.
// Aggiungendo un formato qui va aggiunto anche in cwp_formati_ammessi()
// (14_controlli_file.sql), altrimenti il database rifiuta il file.
// "firma" indica quale controllo dei primi byte applicare (contenutoCompatibile).
export const FORMATI = {
  pdf: { mime: "application/pdf", firma: "pdf" },
  p7m: { mime: "application/pkcs7-mime", firma: "p7m" },
  doc: { mime: "application/msword", firma: "ole" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", firma: "zip" },
  odt: { mime: "application/vnd.oasis.opendocument.text", firma: "zip" },
  rtf: { mime: "application/rtf", firma: "rtf" },
  xls: { mime: "application/vnd.ms-excel", firma: "ole" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", firma: "zip" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", firma: "zip" },
  csv: { mime: "text/csv", firma: "testo" },
  txt: { mime: "text/plain", firma: "testo" },
  jpg: { mime: "image/jpeg", firma: "jpg" },
  jpeg: { mime: "image/jpeg", firma: "jpg" },
  png: { mime: "image/png", firma: "png" },
  zip: { mime: "application/zip", firma: "zip" }, // dati voluminosi (CSV del tracciato dati CWP)
};

// Per l'attributo "accept" dei campi di caricamento.
export const ACCEPT = Object.keys(FORMATI).map((e) => "." + e).join(",");

// Testo da mostrare vicino ai pulsanti di caricamento.
export const FORMATI_LEGGIBILI = "PDF (anche firmati .p7m), Word, Excel, OpenDocument, RTF, CSV, TXT, JPG, PNG, ZIP · max 50 MB";

function estensione(nome) {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome || "");
  return m ? m[1].toLowerCase() : "";
}

function inizia(b, sequenza, da = 0) {
  return sequenza.every((v, i) => b[da + i] === v);
}

// Riconosce il contenuto dai primi byte del file.
function contenutoCompatibile(b, firma) {
  switch (firma) {
    case "pdf": {
      // "%PDF" entro i primi 1024 byte
      for (let i = 0; i < Math.min(b.length - 4, 1024); i++) if (inizia(b, [0x25, 0x50, 0x44, 0x46], i)) return true;
      return false;
    }
    case "p7m":
      // busta CAdES: binaria (DER, inizia con 0x30) o in base64 ("MI…" / "-----BEGIN")
      return b[0] === 0x30 || inizia(b, [0x4d, 0x49]) || inizia(b, [0x2d, 0x2d, 0x2d, 0x2d, 0x2d]);
    case "ole":
      return inizia(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "zip":
      return inizia(b, [0x50, 0x4b, 0x03, 0x04]);
    case "rtf":
      return inizia(b, [0x7b, 0x5c, 0x72, 0x74, 0x66]); // {\rtf
    case "jpg":
      return inizia(b, [0xff, 0xd8, 0xff]);
    case "png":
      return inizia(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "testo":
      // niente byte nulli (tipici dei file binari ed eseguibili)
      return !b.includes(0x00);
    default:
      return false;
  }
}

/* Verifica un file prima del caricamento.
   Restituisce { ok: true, mime, nomeSicuro } oppure { ok: false, errore }. */
export async function verificaFile(file) {
  if (!file) return { ok: false, errore: "Nessun file selezionato." };
  const ext = estensione(file.name);
  const formato = FORMATI[ext];
  if (!formato) {
    return { ok: false, errore: `Formato non ammesso${ext ? ` (.${ext})` : ""}. Formati accettati: ${FORMATI_LEGGIBILI}.` };
  }
  if (file.size === 0) return { ok: false, errore: "Il file è vuoto." };
  if (file.size > DIMENSIONE_MASSIMA) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace(".", ",");
    return { ok: false, errore: `File troppo grande (${mb} MB): il limite è 50 MB.` };
  }
  const testa = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!contenutoCompatibile(testa, formato.firma)) {
    return {
      ok: false,
      errore: `Il contenuto del file non corrisponde a un file .${ext}. Controlla di aver scelto il file giusto o salvalo di nuovo nel formato corretto.`,
    };
  }
  return { ok: true, mime: formato.mime, nomeSicuro: nomeSicuro(file.name) };
}

// Nome adatto all'archivio: senza accenti, spazi e caratteri speciali.
export function nomeSicuro(nome) {
  const ext = estensione(nome);
  const base = (nome || "file")
    .replace(/\.[A-Za-z0-9]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

// Messaggio comprensibile per gli errori dell'archivio.
export function traduciErroreArchivio(error) {
  const m = (error && (error.message || error.error)) || "";
  if (/exceeded the maximum allowed size|too large|413/i.test(m)) return "File troppo grande: il limite è 50 MB.";
  if (/mime type|not supported|invalid_mime/i.test(m)) return "Formato non ammesso.";
  return m || "errore sconosciuto";
}
