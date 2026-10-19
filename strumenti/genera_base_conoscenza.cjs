/* =========================================================================
   genera_base_conoscenza.cjs — base di conoscenza dell'assistente virtuale

   Scopo: unisce i testi dei manuali e delle tariffe in due file che la
     funzione del server «assistente» (supabase/functions/assistente) legge
     e passa a Claude come contesto:
     - public/assistente/kb-comune.md: per gli utenti degli enti (Manuale
       Utente + tariffe e costi);
     - public/assistente/kb-amministratore.md: per gli Amministratori
       (Manuale Utente + Manuale Amministratore + tariffe e costi + note sul
       calcolo dei crediti e sul simulatore).
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

const uscita = path.join(RADICE, "public", "assistente");
fs.mkdirSync(uscita, { recursive: true });
fs.writeFileSync(path.join(uscita, "kb-comune.md"), comune);
fs.writeFileSync(path.join(uscita, "kb-amministratore.md"), amministratore);
console.log(`kb-comune.md: ${comune.length.toLocaleString("it-IT")} caratteri`);
console.log(`kb-amministratore.md: ${amministratore.length.toLocaleString("it-IT")} caratteri`);
