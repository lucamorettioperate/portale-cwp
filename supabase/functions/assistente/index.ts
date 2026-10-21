// =====================================================================
//  Edge Function: assistente
//  Scopo: assistente virtuale del portale basato su Claude (Anthropic).
//  Risponde alle domande sul funzionamento del portale e del Programma
//  usando SOLO una base di conoscenza: manuali e tariffe (file
//  public/assistente/kb-*.md, generati da strumenti/genera_base_conoscenza.cjs).
//  Ruoli e basi di conoscenza:
//   - Amministratori: Manuale Utente + Manuale Amministratore + tariffe +
//     note sul calcolo dei crediti (kb-amministratore.md);
//   - Operatori (dal 21/10/2026): Manuale Utente + capitoli del Manuale
//     Amministratore sulle funzioni dell'Operatore + tariffe
//     (kb-operatore.md);
//   - utenti degli enti (ruolo cliente): Manuale Utente + tariffe.
//  Pratica aperta (dal 21/10/2026, backlog 21): se la domanda parte dalla
//  pagina di una pratica, il portale manda il suo id e la funzione legge
//  stato, fasi, documenti richiesti mancanti, integrazioni aperte,
//  pagamenti e feedback pubblico CON I PERMESSI DI CHI CHIEDE (regole del
//  database: un Comune vede solo le sue pratiche e i documenti visibili) e
//  li passa a Claude come riepilogo (riassuntoPratica, copia identica di
//  src/lib/contestoPratica.js). Non fa operazioni nel portale: è un
//  supporto, fuori dal flusso decisionale (requisiti §17).
//
//  Sicurezza:
//   - il chiamante deve avere fatto l'accesso (Verify JWT attivo) e avere
//     un profilo attivo, senza password temporanea, con ruolo admin,
//     operatore o cliente; il ruolo lo legge il server, non il browser;
//   - la chiave di Anthropic sta solo nei segreti di Supabase
//     (ANTHROPIC_API_KEY), mai nel browser;
//   - limite di domande al giorno per utente (ASSISTENTE_LIMITE_GIORNO,
//     predefinito 40) e lunghezza massima di domande e conversazione;
//   - si conta l'uso (domande e token) in assistente_uso (script 31); il
//     testo di domande e risposte non viene salvato;
//   - gli errori arrivano all'utente in italiano semplice; il dettaglio
//     tecnico resta nei log (dal 20/10, backlog 39).
//
//  Costi: modello predefinito Claude Haiku 5.5 (ASSISTENTE_MODELLO per
//  cambiarlo); la base di conoscenza va nella cache dei prompt per 1 ora,
//  così le domande successive la rileggono a un decimo del prezzo.
//  L'uso si paga con i crediti dell'organizzazione della Claude Console
//  a cui appartiene la chiave (anche i crediti API mensili dei piani Max
//  e Team, se l'organizzazione è collegata al piano).
//
//  Segreti: ANTHROPIC_API_KEY (lo inserisce Luca); facoltativi
//  ASSISTENTE_MODELLO, ASSISTENTE_LIMITE_GIORNO, PORTALE_URL; automatici
//  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//  Usato da: src/lib/dati.js → chiediAssistente(), componente
//  src/components/AssistenteVirtuale.jsx.
//  Pubblicazione: dashboard Supabase → Edge Functions; Verify JWT attivo.
//  Registro sviluppo e deploy: capitolo 5 «Edge Functions»; backlog 21.
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Ruolo = "admin" | "operatore" | "cliente";

const MAX_MESSAGGI = 12; // ultimi messaggi della conversazione inviati a Claude
const MAX_CARATTERI = 2000; // lunghezza massima di ogni messaggio

// Base di conoscenza letta dal portale e tenuta in memoria per 10 minuti
// (ogni istanza della funzione la rilegge al più ogni 10 minuti).
const cache: Record<string, { testo: string; letto: number }> = {};
async function baseConoscenza(portale: string, nome: string): Promise<string> {
  const c = cache[nome];
  if (c && Date.now() - c.letto < 10 * 60 * 1000) return c.testo;
  const r = await fetch(`${portale}/assistente/${nome}`);
  if (!r.ok) throw new Error(`base di conoscenza non disponibile (${r.status})`);
  const testo = await r.text();
  cache[nome] = { testo, letto: Date.now() };
  return testo;
}

// Messaggi d'errore in italiano semplice (richiesta di Luca del 19/10,
// backlog 39). Il dettaglio tecnico (in inglese) resta solo nei log della
// funzione (dashboard Supabase → Edge Functions → assistente → Logs).
// Agli utenti degli enti si dice solo di riprovare; agli Amministratori si
// aggiunge la causa, per sapere cosa sistemare.
const NON_DISPONIBILE = "L'assistente non è disponibile in questo momento. Riprova più tardi; se serve subito, scrivi a Fondazione Operate con i Messaggi della pratica.";
function messaggioErrore(stato: number, tipo: string, testo: string, ruolo: Ruolo): string {
  const t = (testo || "").toLowerCase();
  // Errori passeggeri: uguali per tutti.
  if (stato === 429 || tipo === "rate_limit_error") return "In questo momento arrivano troppe domande. Riprova tra un minuto.";
  if (stato === 529 || stato >= 500 || tipo === "overloaded_error" || tipo === "api_error") return "L'assistente è momentaneamente sovraccarico. Riprova tra qualche istante.";
  if (ruolo !== "admin") return NON_DISPONIBILE;
  // Per gli Amministratori: la causa, in parole semplici.
  let causa = "errore del servizio Claude (codice " + stato + ")";
  if (t.includes("credit balance")) causa = "il credito della Claude Console è esaurito: aggiungi crediti in platform.claude.com → Fatturazione";
  else if (t.includes("workspace")) causa = "la chiave non è legata a uno spazio di lavoro: creane una nuova legata a un solo spazio di lavoro e aggiorna ANTHROPIC_API_KEY";
  else if (stato === 401 || tipo === "authentication_error") causa = "la chiave ANTHROPIC_API_KEY non è valida o è stata disattivata";
  else if (stato === 403 || tipo === "permission_error") causa = "la chiave non ha il permesso di usare questo modello o questo spazio di lavoro";
  else if (stato === 404 || tipo === "not_found_error") causa = "modello o spazio di lavoro non trovato (controlla ASSISTENTE_MODELLO)";
  else if (stato === 413 || tipo === "request_too_large") causa = "la base di conoscenza è troppo grande per il modello";
  return NON_DISPONIBILE + " (Per gli Amministratori: " + causa + ".)";
}

// Istruzioni per Claude, diverse per Amministratori e utenti degli enti.
function istruzioni(ruolo: Ruolo, conPratica: boolean): string {
  const comune = [
    "Sei l'assistente virtuale del Portale Carbon WastePrint (CWP) di Fondazione Operate, il portale con cui Comuni, enti e soggetti gestori partecipano al Programma Carbon WastePrint® per i crediti di carbonio dalla gestione dei rifiuti.",
    "Rispondi in italiano, in modo chiaro e cordiale, con frasi semplici: chi ti scrive spesso non è un tecnico.",
    "Usa SOLO le informazioni della base di conoscenza qui sotto (manuali del portale e tariffe). Se la risposta non c'è, dillo con franchezza e suggerisci di scrivere a Fondazione Operate con i Messaggi della pratica o di consultare il manuale; non inventare procedure, scadenze, importi o regole.",
    "Quando spieghi come fare qualcosa nel portale, indica i passi in ordine con i nomi dei menu e dei pulsanti come appaiono nel manuale, e cita il capitolo del manuale da cui prendi l'informazione.",
    "Per i costi riporta le cifre della base di conoscenza, specificando che sono IVA esclusa e che l'importo definitivo lo conferma Fondazione Operate.",
    conPratica
      ? "Più sotto c'è il RIEPILOGO DELLA PRATICA APERTA dall'utente, letto ora dal portale con i suoi permessi: usalo per le domande su quella pratica (stato, fasi, scadenze, documenti mancanti, integrazioni, pagamenti), citando le date. Non hai dati di altre pratiche e non puoi fare operazioni nel portale: per agire indica i passi del manuale."
      : "Non hai i dati delle pratiche, dei documenti o dei pagamenti dell'utente e non puoi fare operazioni nel portale: se ti chiedono lo stato di una pratica, spiega dove vederlo nel portale oppure di aprire la pratica e farti la domanda da lì.",
    "Risposte brevi: di solito da 3 a 8 righe; usa elenchi puntati solo per passi o liste. Niente tabelle lunghe.",
    "Non dare consulenze legali o fiscali e non chiedere né accettare password o dati personali.",
  ];
  if (ruolo === "admin") {
    comune.push(
      "Chi ti scrive è un Amministratore di Fondazione Operate: puoi spiegare anche le funzioni riservate (gestione utenti, audit, impostazioni, calcolo ed emissione dei crediti, simulatore) come descritte nel Manuale Amministratore e nelle note sul calcolo.",
    );
  } else if (ruolo === "operatore") {
    comune.push(
      "Chi ti scrive è un Operatore di back-office di Fondazione Operate: spiega le funzioni che l'Operatore usa (pratiche, fasi, documenti, integrazioni, feedback pubblico, pagamenti, anagrafiche, simulatore, crediti emessi, reclami). Gestione utenti, audit, impostazioni e calcolo dei crediti sono riservati agli Amministratori: se te li chiede, dillo e suggerisci di rivolgersi a un Amministratore.",
    );
  } else {
    comune.push(
      "Chi ti scrive è il referente di un ente (Comune, ente locale o soggetto gestore): spiega solo ciò che l'ente vede e fa nel portale; le funzioni interne della Fondazione non sono nella tua base di conoscenza.",
    );
  }
  return comune.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CHIAVE = Deno.env.get("ANTHROPIC_API_KEY");
    const MODELLO = Deno.env.get("ASSISTENTE_MODELLO") || "claude-haiku-5-5";
    const LIMITE = Number(Deno.env.get("ASSISTENTE_LIMITE_GIORNO") || 40);
    const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");
    if (!CHIAVE) return json({ error: "L'assistente non è ancora attivo: manca la chiave di Anthropic nei segreti del server." }, 503);

    // Chi chiama: utente collegato (token) e il suo profilo letto dal server.
    const clientChiamante = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: userData } = await clientChiamante.auth.getUser();
    const utente = userData?.user;
    if (!utente) return json({ error: "Non autenticato" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profilo } = await admin.from("profilo").select("ruolo, attivo, password_temporanea").eq("id", utente.id).single();
    if (!profilo?.attivo || profilo.password_temporanea || !["admin", "operatore", "cliente"].includes(profilo.ruolo)) {
      return json({ error: "L'assistente non è disponibile per questo account." }, 403);
    }
    const ruolo = profilo.ruolo as Ruolo;

    // Limite giornaliero di domande.
    const { data: fatte } = await admin.rpc("assistente_domande_oggi", { p_utente: utente.id });
    if ((fatte ?? 0) >= LIMITE) {
      return json({ error: `Hai raggiunto il limite di ${LIMITE} domande per oggi. Riprova domani.` }, 429);
    }

    // Conversazione dal browser: ultimi messaggi, testi accorciati, ruoli
    // alternati che iniziano e finiscono con l'utente.
    const body = await req.json().catch(() => ({}));
    const grezzi = Array.isArray(body.messaggi) ? body.messaggi.slice(-MAX_MESSAGGI) : [];
    const messaggi: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of grezzi) {
      const role = m?.ruolo === "assistente" ? "assistant" : "user";
      const content = String(m?.testo || "").trim().slice(0, MAX_CARATTERI);
      if (!content) continue;
      if (messaggi.length && messaggi[messaggi.length - 1].role === role) messaggi[messaggi.length - 1].content += "\n\n" + content;
      else messaggi.push({ role, content });
    }
    while (messaggi.length && messaggi[0].role !== "user") messaggi.shift();
    if (!messaggi.length || messaggi[messaggi.length - 1].role !== "user") return json({ error: "Scrivi una domanda." }, 400);

    let kb: string;
    try {
      kb = await baseConoscenza(PORTALE, ruolo === "admin" ? "kb-amministratore.md" : ruolo === "operatore" ? "kb-operatore.md" : "kb-comune.md");
    } catch (e) {
      console.error("Base di conoscenza", e);
      return json({ error: ruolo === "admin" ? NON_DISPONIBILE + " (Per gli Amministratori: la base di conoscenza non si legge dal portale; controlla PORTALE_URL e i file public/assistente.)" : NON_DISPONIBILE }, 502);
    }

    // Pratica aperta (facoltativa): letta con il client di chi chiede, così
    // valgono le sue regole di accesso. Se non si legge, si risponde senza.
    let riepilogo = "";
    const praticaId = typeof body.pratica_id === "string" && /^[0-9a-f-]{36}$/i.test(body.pratica_id) ? body.pratica_id : null;
    if (praticaId) {
      try {
        riepilogo = await contestoPratica(clientChiamante, praticaId);
      } catch (e) {
        console.error("Contesto pratica", e);
      }
    }

    // Chiamata a Claude (Messages API). La base di conoscenza è l'ultimo
    // blocco del system con cache di 1 ora: le domande successive la
    // rileggono dalla cache.
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": CHIAVE, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: 4000, // comprende l'eventuale ragionamento del modello
        system: [
          { type: "text", text: istruzioni(ruolo, !!riepilogo) },
          { type: "text", text: "BASE DI CONOSCENZA\n\n" + kb, cache_control: { type: "ephemeral", ttl: "1h" } },
          // Dopo il blocco in cache: cambia a ogni pratica senza rovinare la cache.
          ...(riepilogo ? [{ type: "text", text: "RIEPILOGO DELLA PRATICA APERTA (dati del portale, ora)\n\n" + riepilogo }] : []),
        ],
        messages: messaggi,
      }),
    });
    const risposta = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Il dettaglio tecnico va solo nei log; all'utente un messaggio semplice.
      console.error("Anthropic", r.status, JSON.stringify(risposta));
      return json({ error: messaggioErrore(r.status, risposta?.error?.type || "", risposta?.error?.message || "", ruolo) }, 502);
    }
    const testo = (risposta.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    // Conteggio dell'uso (senza testi).
    const u = risposta.usage || {};
    const ingresso = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const { data: domandeOggi } = await admin.rpc("assistente_registra_uso", { p_utente: utente.id, p_ingresso: ingresso, p_uscita: u.output_tokens || 0 });

    return json({ testo: testo || "Non ho una risposta: prova a riformulare la domanda.", domande_oggi: domandeOggi ?? null, limite: LIMITE });
  } catch (e) {
    console.error(e);
    return json({ error: NON_DISPONIBILE }, 500);
  }
});

// Legge la pratica e i dati collegati con il client di chi chiede (regole
// del database applicate) e ne fa il riepilogo. Restituisce "" se la pratica
// non è visibile a questo utente.
// deno-lint-ignore no-explicit-any
async function contestoPratica(client: any, id: string): Promise<string> {
  const { data: pratica } = await client
    .from("pratica")
    .select("id, codice, tipo, titolo, stato, motivazione_stato, anno_monitoraggio, organizzazione:organizzazione_id (denominazione), ente:ente_validazione_id (denominazione)")
    .eq("id", id)
    .maybeSingle();
  if (!pratica) return "";
  const [fasi, documenti, richiesti, integrazioni, pagamenti, consultazioni] = await Promise.all([
    client.from("fase").select("id, numero, nome, stato, data_apertura, data_prevista_chiusura, data_effettiva_chiusura").eq("pratica_id", id),
    client.from("documento").select("fase_id, tipologia, corrente").eq("pratica_id", id),
    client.from("documento_richiesto").select("tipo_pratica, fase_numero, tipologia, attivo").eq("tipo_pratica", pratica.tipo),
    client.from("richiesta_integrazione").select("descrizione, risolta, creato_il").eq("pratica_id", id),
    client.from("pagamento").select("descrizione, importo, scadenza, pagato").eq("pratica_id", id),
    client.from("consultazione").select("data_apertura, data_chiusura, attiva").eq("pratica_id", id),
  ]);
  const oggi = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
  return riassuntoPratica({
    pratica, oggi,
    fasi: fasi.data || [], documenti: documenti.data || [], richiesti: richiesti.data || [],
    integrazioni: integrazioni.data || [], pagamenti: pagamenti.data || [], consultazioni: consultazioni.data || [],
  });
}

// Copia identica di src/lib/contestoPratica.js (la prova
// test/assistente.test.mjs controlla che coincidano).
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
