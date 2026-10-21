/* =========================================================================
   assistente.test.mjs — prove della seconda fase dell'assistente virtuale
   (21/10/2026): riepilogo della pratica aperta e base di conoscenza degli
   Operatori.
   - riassuntoPratica (src/lib/contestoPratica.js): stato, fasi con
     scadenze, documenti richiesti mancanti, integrazioni, pagamenti
     scaduti, feedback pubblico;
   - la copia della funzione dentro supabase/functions/assistente/index.ts
     deve essere IDENTICA a quella del modulo (la funzione del server si
     pubblica come un solo file);
   - kb-operatore.md non contiene i capitoli riservati agli Amministratori.
   Uso: npm test (oppure node test/assistente.test.mjs). Richiede che la
   base di conoscenza sia stata generata (node strumenti/genera_base_conoscenza.cjs).
   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (assistente).
   ========================================================================= */
import assert from "node:assert/strict";
import fs from "node:fs";
import { riassuntoPratica } from "../src/lib/contestoPratica.js";

let n = 0;
const prova = (nome, f) => { f(); n++; console.log("✓", nome); };

const pratica = { id: "p", codice: "COLLAUDO-V03-B-20261020", tipo: "progetto", titolo: "Prova B", stato: "attiva", organizzazione: { denominazione: "Comune B" } };
const fasi = [
  { id: "f1", numero: 1, nome: "Adesione", stato: "in_corso", data_prevista_chiusura: "2026-10-25" },
  { id: "f2", numero: 2, nome: "Prima verifica documentale", stato: "non_iniziata" },
];
const richiesti = [
  { tipo_pratica: "progetto", fase_numero: 1, tipologia: "Modulo di adesione", attivo: true },
  { tipo_pratica: "progetto", fase_numero: 1, tipologia: "Descrizione del progetto", attivo: true },
  { tipo_pratica: "progetto", fase_numero: 1, tipologia: "Documento disattivato", attivo: false },
  { tipo_pratica: "rapporto", fase_numero: 1, tipologia: "Solo per i rapporti", attivo: true },
];
const documenti = [{ fase_id: "f1", tipologia: "Modulo di adesione", corrente: true }];

prova("riepilogo: stato, fasi, scadenza e documenti mancanti", () => {
  const t = riassuntoPratica({ pratica, fasi, documenti, richiesti, oggi: "2026-10-21" });
  assert.match(t, /Pratica COLLAUDO-V03-B-20261020 — Progetto — «Prova B»/);
  assert.match(t, /Organizzazione: Comune B/);
  assert.match(t, /1\. Adesione — in corso, scadenza 25\/10\/2026 \(tra 4 giorni\)/);
  assert.match(t, /2\. Prima verifica documentale — non iniziata/);
  assert.match(t, /non ancora caricati nella fase 1: Descrizione del progetto$/m);
  assert.doesNotMatch(t, /Documento disattivato|Solo per i rapporti/);
});
prova("riepilogo: scadenza passata, integrazioni, pagamenti scaduti, feedback", () => {
  const t = riassuntoPratica({
    pratica: { ...pratica, tipo: "rapporto", anno_monitoraggio: 2 }, fasi: [{ id: "f1", numero: 1, nome: "Avvio", stato: "in_attesa_integrazione", data_prevista_chiusura: "2026-10-18" }],
    documenti: [], richiesti: [], integrazioni: [{ descrizione: "Manca la delibera", risolta: false, creato_il: "2026-10-19T10:00:00Z" }, { descrizione: "chiusa", risolta: true }],
    pagamenti: [{ descrizione: "Iscrizione", importo: 1234.5, scadenza: "2026-10-01", pagato: false }],
    consultazioni: [{ attiva: true, data_apertura: "2026-10-17", data_chiusura: "2026-11-16" }], oggi: "2026-10-21",
  });
  assert.match(t, /Rapporto di Monitoraggio anno 2/);
  assert.match(t, /scaduta da 3 giorni/);
  assert.match(t, /Richieste di integrazione aperte: 1\n  - del 19\/10\/2026: Manca la delibera/);
  assert.match(t, /Iscrizione: 1234,50 €, scadenza 01\/10\/2026 \(SCADUTO/); // in italiano le migliaia si separano da 5 cifre (10.000)
  assert.match(t, /Feedback pubblico aperto dal 17\/10\/2026 al 16\/11\/2026/);
  assert.match(t, /tutti i documenti richiesti risultano caricati/);
});
prova("la copia nella funzione del server è identica al modulo", () => {
  const blocco = (testo) => testo.slice(testo.indexOf("// INIZIO riassuntoPratica"), testo.indexOf("// FINE riassuntoPratica"));
  const modulo = blocco(fs.readFileSync("src/lib/contestoPratica.js", "utf8"));
  const server = blocco(fs.readFileSync("supabase/functions/assistente/index.ts", "utf8"));
  assert.ok(modulo.length > 500);
  assert.equal(server, modulo);
});
prova("base di conoscenza degli Operatori senza i capitoli riservati", () => {
  const kb = fs.readFileSync("public/assistente/kb-operatore.md", "utf8");
  for (const c of ["## Gestione utenti", "## Audit User", "## Audit trail", "## Impostazioni", "## Calcolo dei crediti CWP", "## Backup automatico", "## Sicurezza"]) {
    assert.ok(!kb.includes(c), c);
  }
  for (const c of ["## Pratiche: Progetti e Rapporti di monitoraggio", "## Simulatore di scenari", "## Crediti emessi", "## Reclami e richieste di chiarimento"]) {
    assert.ok(kb.includes(c), c);
  }
});

console.log(`${n} prove superate (assistente).`);
