/* =========================================================================
   carica_file_ripristino.mjs — ricarica negli archivi di Supabase Storage i
   file di un backup automatico (cartella 3_file), con gli stessi percorsi
   (Istruzioni di ripristino, capitolo «Ripristino da un backup automatico»).

   Uso (Node 18 o più recente), dopo aver ripristinato il database:
     SUPABASE_URL="https://<nuovo-progetto>.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="<chiave service_role del nuovo progetto>" \
     node strumenti/backup/carica_file_ripristino.mjs <cartella 3_file>
   La chiave la inserisce chi esegue il ripristino (non va scritta in
   nessun file). Gli archivi (documenti, modelli, allegati-consultazione)
   li creano gli script 04, 14 e 17; un file già presente non si
   sovrascrive (si segnala). I percorsi devono restare identici perché le
   tabelle (documento.storage_path, modello_documento…) li contengono.
   Registro sviluppo e deploy: capitolo «Servizi e configurazione», backup.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const cartella = process.argv[2];
const URL = process.env.SUPABASE_URL;
const CHIAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!cartella || !URL || !CHIAVE) {
  console.error("Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node strumenti/backup/carica_file_ripristino.mjs <cartella 3_file>");
  process.exit(1);
}

// Tipo dei file dall'elenco del backup (se c'è) o dall'estensione.
const TIPI = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", odt: "application/vnd.oasis.opendocument.text", zip: "application/zip", csv: "text/csv", txt: "text/plain" };
const tipo = (f) => TIPI[f.split(".").pop().toLowerCase()] || "application/octet-stream";

// Tutti i file di una cartella, con il percorso relativo.
function elenca(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((v) =>
    v.isDirectory() ? elenca(path.join(dir, v.name), base ? `${base}/${v.name}` : v.name) : [base ? `${base}/${v.name}` : v.name]
  );
}

let caricati = 0, presenti = 0, errori = 0;
for (const bucket of fs.readdirSync(cartella, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name)) {
  for (const rel of elenca(path.join(cartella, bucket))) {
    const corpo = fs.readFileSync(path.join(cartella, bucket, rel));
    const r = await fetch(`${URL}/storage/v1/object/${bucket}/${rel.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, "Content-Type": tipo(rel), "x-upsert": "false" },
      body: corpo,
    });
    if (r.ok) caricati++;
    else if (r.status === 409 || r.status === 400) { presenti++; console.log(`già presente: ${bucket}/${rel}`); }
    else { errori++; console.error(`ERRORE ${r.status} ${bucket}/${rel}: ${(await r.text()).slice(0, 200)}`); }
  }
}
console.log(`File caricati: ${caricati}; già presenti: ${presenti}; errori: ${errori}.`);
process.exit(errori ? 1 : 0);
