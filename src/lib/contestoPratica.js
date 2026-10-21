/* =========================================================================
   contestoPratica.js — riepilogo della pratica aperta per l'assistente
   virtuale (backlog 21, seconda fase, 21/10/2026).

   Scopo: trasformare i dati di UNA pratica (letti dalla funzione del server
   «assistente» con i permessi di chi fa la domanda) in un breve testo che
   l'assistente usa per rispondere a domande come «a che punto è la mia
   pratica?», «cosa manca per chiudere la fase?», «ho pagamenti scaduti?».
   Nessun accesso ai dati qui: funzione pura, provata da
   test/assistente.test.mjs.

   IMPORTANTE: la funzione riassuntoPratica è COPIATA identica dentro
   supabase/functions/assistente/index.ts (tra i segni «INIZIO
   riassuntoPratica» e «FINE riassuntoPratica»): la funzione del server si
   pubblica come un solo file. La prova controlla che le due copie siano
   uguali: se si cambia qui, si ricopia là (e viceversa).
   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (assistente).
   ========================================================================= */

// INIZIO riassuntoPratica
// Parametri: { pratica, fasi, documenti, richiesti, integrazioni,
// pagamenti, consultazioni, oggi } (oggi = "aaaa-mm-gg" in ora italiana).
// Restituisce il testo del riepilogo (righe semplici, date gg/mm/aaaa).
function riassuntoPratica({ pratica, fasi = [], documenti = [], richiesti = [], integrazioni = [], pagamenti = [], consultazioni = [], oggi }) {
  const data = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
  const giorni = (d) => Math.round((Date.parse(String(d).slice(0, 10)) - Date.parse(oggi)) / 86400000);
  const parole = (s) => String(s || "").replace(/_/g, " ");
  const euro = (n) => Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const righe = [];
  const tipo = pratica.tipo === "rapporto" ? `Rapporto di Monitoraggio${pratica.anno_monitoraggio ? " anno " + pratica.anno_monitoraggio : ""}` : "Progetto";
  righe.push(`Pratica ${pratica.codice || "(senza codice)"} — ${tipo} — «${pratica.titolo || ""}»`);
  if (pratica.organizzazione?.denominazione) righe.push(`Organizzazione: ${pratica.organizzazione.denominazione}`);
  righe.push(`Stato della pratica: ${parole(pratica.stato)}${pratica.motivazione_stato ? ` (motivazione: ${pratica.motivazione_stato})` : ""}`);
  if (pratica.ente?.denominazione) righe.push(`Ente di validazione e verifica: ${pratica.ente.denominazione}`);

  // Fasi in ordine, con scadenze e giorni mancanti per quelle aperte.
  const ordinate = [...fasi].sort((a, b) => a.numero - b.numero);
  if (ordinate.length) {
    righe.push("Fasi:");
    ordinate.forEach((f) => {
      let r = `  ${f.numero}. ${f.nome} — ${parole(f.stato)}`;
      if (f.stato === "completata") r += f.data_effettiva_chiusura ? ` il ${data(f.data_effettiva_chiusura)}` : "";
      else if (f.data_prevista_chiusura) {
        const g = giorni(f.data_prevista_chiusura);
        r += `, scadenza ${data(f.data_prevista_chiusura)} (${g > 0 ? `tra ${g} giorni` : g === 0 ? "oggi" : `scaduta da ${-g} giorni`})`;
      }
      righe.push(r);
    });
  }

  // Documenti richiesti mancanti nelle fasi aperte (tra quelli visibili a
  // chi chiede: per il Comune solo i documenti che può vedere).
  const aperte = ordinate.filter((f) => f.stato === "in_corso" || f.stato === "in_attesa_integrazione");
  aperte.forEach((f) => {
    const presenti = new Set(documenti.filter((d) => d.fase_id === f.id).map((d) => d.tipologia));
    const mancanti = richiesti.filter((r) => r.attivo !== false && r.tipo_pratica === pratica.tipo && r.fase_numero === f.numero && !presenti.has(r.tipologia)).map((r) => r.tipologia);
    righe.push(mancanti.length ? `Documenti richiesti non ancora caricati nella fase ${f.numero}: ${mancanti.join("; ")}` : `Fase ${f.numero}: tutti i documenti richiesti risultano caricati.`);
  });

  const aperteInt = integrazioni.filter((i) => !i.risolta);
  if (aperteInt.length) {
    righe.push(`Richieste di integrazione aperte: ${aperteInt.length}`);
    aperteInt.forEach((i) => righe.push(`  - del ${data(i.creato_il)}: ${String(i.descrizione || "").slice(0, 200)}`));
  }

  const daPagare = pagamenti.filter((p) => !p.pagato);
  if (daPagare.length) {
    righe.push("Pagamenti non ancora saldati:");
    daPagare.forEach((p) => {
      const scaduto = p.scadenza && giorni(p.scadenza) < 0;
      righe.push(`  - ${p.descrizione}: ${euro(p.importo)}, scadenza ${data(p.scadenza)}${scaduto ? " (SCADUTO: le attività restano sospese fino al saldo)" : ""}`);
    });
  } else if (pagamenti.length) righe.push("Pagamenti: tutti saldati.");

  const attiva = consultazioni.find((c) => c.attiva);
  if (attiva) righe.push(`Feedback pubblico aperto dal ${data(attiva.data_apertura)} al ${data(attiva.data_chiusura)}.`);
  righe.push(`Documenti visibili nella pratica: ${documenti.filter((d) => d.corrente !== false).length} (versioni correnti).`);
  return righe.join("\n");
}
// FINE riassuntoPratica

export { riassuntoPratica };
