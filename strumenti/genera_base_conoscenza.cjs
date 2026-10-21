/* =========================================================================
   genera_base_conoscenza.cjs — base di conoscenza dell'assistente virtuale

   Scopo: unisce i testi dei manuali e delle tariffe in due file che la
     funzione del server «assistente» (supabase/functions/assistente) legge
     e passa a Claude come contesto:
     - public/assistente/kb-comune.md: per gli utenti degli enti (Manuale
       Utente + tariffe e costi);
     - public/assistente/kb-amministratore.md: per gli Amministratori
       (Manuale Utente + Manuale Amministratore + tariffe e costi + note sul
       calcolo dei crediti e sul simulatore);
     - public/assistente/kb-operatore.md (dal 21/10/2026): per gli
       Operatori (Manuale Utente + Manuale Amministratore SENZA i capitoli
       delle funzioni riservate agli Amministratori, elencati in
       CAPITOLI_SOLO_ADMIN + tariffe e costi).
   I commenti HTML dei sorgenti (<!-- … -->) si tolgono.
   Uso: node strumenti/genera_base_conoscenza.cjs (a ogni rilascio, dopo
     aver aggiornato i manuali; è nella regola di rilascio del Registro).
   Attenzione: i file in public/ sono raggiungibili da chi conosce
     l'indirizzo, come i PDF dei manuali: non metterci dati riservati.
   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (assistente).
   ========================================================================= */
const fs = require("fs");
const path = require("path");

const RADICE = path.resolve(__dirname, "..");
const leggi = (f) => fs.readFileSync(path.join(RADICE, f), "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
const oggi = new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome" });

// Ogni parte ha un titolo che l'assistente può citare come fonte.
const parte = (titolo, testo) => `\n\n=== DOCUMENTO: ${titolo} ===\n\n${testo}\n`;

const comune = [
  `# Base di conoscenza del Portale Carbon WastePrint — utenti degli enti (generata il ${oggi})`,
  parte("Manuale Utente", leggi("docs/manuale-utente.md")),
  parte("Tariffe e costi", leggi("docs/conoscenza/tariffe.md")),
].join("");

const amministratore = [
  `# Base di conoscenza del Portale Carbon WastePrint — Amministratori (generata il ${oggi})`,
  parte("Manuale Utente", leggi("docs/manuale-utente.md")),
  parte("Manuale Amministratore", leggi("docs/manuale-amministratore.md")),
  parte("Tariffe e costi", leggi("docs/conoscenza/tariffe.md")),
  parte("Note sul calcolo dei crediti e sul simulatore", leggi("docs/crediti-cwp.md")),
].join("");

// Capitoli del Manuale Amministratore che riguardano funzioni riservate agli
// Amministratori: non entrano nella base di conoscenza degli Operatori.
// Se si aggiunge un capitolo «solo Amministratori» al manuale, va aggiunto qui.
const CAPITOLI_SOLO_ADMIN = [
  "Gestione utenti",
  "Audit User",
  "Audit trail",
  "Impostazioni",
  "Calcolo dei crediti CWP",
  "Backup automatico",
  "Documentazione e manuali",
  "Notizie CO2",
  "Sicurezza",
  "Manutenzione ed emergenze",
];
// Toglie dal testo Markdown i capitoli «## …» il cui titolo inizia con uno
// di quelli indicati (fino al capitolo successivo).
function senzaCapitoli(testo, titoli) {
  return testo
    .split(/\n(?=## )/)
    .filter((blocco) => !titoli.some((t) => blocco.startsWith("## " + t)))
    .join("\n");
}

const operatore = [
  `# Base di conoscenza del Portale Carbon WastePrint — Operatori di back-office (generata il ${oggi})`,
  parte("Manuale Utente", leggi("docs/manuale-utente.md")),
  parte("Manuale Amministratore (capitoli per l'Operatore)", senzaCapitoli(leggi("docs/manuale-amministratore.md"), CAPITOLI_SOLO_ADMIN)),
  parte("Tariffe e costi", leggi("docs/conoscenza/tariffe.md")),
].join("");

const uscita = path.join(RADICE, "public", "assistente");
fs.mkdirSync(uscita, { recursive: true });
fs.writeFileSync(path.join(uscita, "kb-comune.md"), comune);
fs.writeFileSync(path.join(uscita, "kb-amministratore.md"), amministratore);
fs.writeFileSync(path.join(uscita, "kb-operatore.md"), operatore);
console.log(`kb-comune.md: ${comune.length.toLocaleString("it-IT")} caratteri`);
console.log(`kb-amministratore.md: ${amministratore.length.toLocaleString("it-IT")} caratteri`);
console.log(`kb-operatore.md: ${operatore.length.toLocaleString("it-IT")} caratteri`);

// Per le prove (test/assistente.test.mjs).
module.exports = { senzaCapitoli, CAPITOLI_SOLO_ADMIN };
