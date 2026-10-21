/* =========================================================================
   BackupCWP.gs — backup automatico del Portale CWP su Google Drive
   (richiesta di Luca Moretti del 21/10/2026).

   COSA FA. Due volte al giorno, tra le 13 e le 14 e tra le 21 e le 22 (ora
   italiana), crea nella cartella «Cwp» del Drive di Luca una NUOVA cartella
   «Backup_CWP_aaaa-mm-gg_hhmm» con:
     1_codice/   il codice del portale da GitHub (ZIP del ramo main, con
                 script del database, funzioni del server, manuali e
                 istruzioni) e il commit di riferimento;
     2_database/ tutte le tabelle del database Supabase (un file JSON per
                 tabella) e l'elenco degli utenti dell'autenticazione;
     3_file/     tutti i file caricati negli archivi di Supabase Storage
                 (documenti delle pratiche, modelli, allegati del feedback);
     4_servizi/  configurazione di Supabase, Vercel e Resend (nomi delle
                 funzioni e dei segreti, impostazioni; MAI i valori segreti);
     LEGGIMI.txt  cosa contiene e come si ripristina;
     Istruzioni_Ripristino_Portale_CWP.pdf (copia aggiornata da GitHub);
     esito.json   numeri e tempi del backup, eventuali errori.
   I backup vecchi NON si cancellano: li toglie Luca a mano.
   Se qualcosa non riesce arriva un'email a Luca (MailApp, dal suo account).

   DOVE GIRA. In Google Apps Script (script.google.com) con l'account
   Google di Luca: scrive nel suo Drive senza altre autorizzazioni. Non
   gira nel portale né su GitHub.

   INSTALLAZIONE (una volta, istruzioni complete in docs/ripristino.md,
   capitolo «Backup automatico su Google Drive»):
     1. script.google.com → Nuovo progetto «Backup CWP» → incollare questo
        file al posto del contenuto → Salva.
     2. Impostazioni del progetto (ingranaggio) → Fuso orario «(GMT+01:00)
        Roma» → Proprietà dello script → aggiungere:
          SUPABASE_SERVICE_ROLE_KEY  (obbligatoria: Supabase → Project
                                       Settings → API Keys → service_role)
          RESEND_API_KEY             (facoltativa: elenco dei domini Resend)
          VERCEL_TOKEN               (facoltativa: impostazioni del progetto)
        Le chiavi le inserisce solo Luca; restano nelle proprietà dello
        script, mai nei file del backup.
     3. Scegliere la funzione «installa» → Esegui → autorizzare l'accesso a
        Drive, servizi esterni ed email. Crea i due orari.
     4. Scegliere «provaOra» → Esegui: fa subito un backup di prova.

   ATTENZIONE: il backup contiene dati personali (email degli utenti,
   documenti delle pratiche). La cartella «Cwp» non va condivisa.
   Limite di Google: un'esecuzione dura al massimo 6 minuti; se il backup non
   finisce in tempo l'esito lo dice e arriva l'email.

   Registro sviluppo e deploy: capitolo «Servizi e configurazione», backup;
   Istruzioni di ripristino: capitolo «Backup automatico su Google Drive».
   ========================================================================= */

// ---- Impostazioni fisse del portale (non segrete) ----
var CONFIG = {
  SUPABASE_URL: "https://ajxrnofgunynkynozmrn.supabase.co",
  SUPABASE_PROGETTO: "ajxrnofgunynkynozmrn",
  GITHUB_REPO: "lucamorettioperate/portale-cwp",
  GITHUB_RAMO: "main",
  CARTELLA_CWP_ID: "1cH4tkO910Jredk1bvQrXEZeu_9fAgfe_", // cartella «Cwp» del Drive di Luca
  VERCEL_PROGETTO: "portale-cwp",
  ORE: [13, 21],
  FUSO: "Europe/Rome",
  TEMPO_MASSIMO_MS: 5.3 * 60 * 1000, // margine sotto i 6 minuti di Google
  RIGHE_PER_PAGINA: 1000,
};

// Funzioni del server e nomi dei loro segreti (per ricrearli: i valori non
// si possono leggere e non si salvano).
var FUNZIONI = {
  "assistente": ["ANTHROPIC_API_KEY", "ASSISTENTE_MODELLO", "ASSISTENTE_LIMITE_GIORNO", "PORTALE_URL"],
  "crea-utente": ["RESEND_API_KEY", "EMAIL_MITTENTE", "PORTALE_URL"],
  "reimposta-password": ["RESEND_API_KEY", "EMAIL_MITTENTE", "PORTALE_URL"],
  "recupera-password": ["RESEND_API_KEY", "EMAIL_MITTENTE", "PORTALE_URL"],
  "invia-email-notifica": ["RESEND_API_KEY", "EMAIL_MITTENTE", "PORTALE_URL"],
  "consultazione-pubblica": ["RESEND_API_KEY", "EMAIL_MITTENTE", "PORTALE_URL"],
};

/* Crea (o ricrea) i due orari giornalieri. Da eseguire una volta. */
function installa() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "eseguiBackup") ScriptApp.deleteTrigger(t);
  });
  CONFIG.ORE.forEach(function (ora) {
    ScriptApp.newTrigger("eseguiBackup").timeBased().atHour(ora).everyDays(1).inTimezone(CONFIG.FUSO).create();
  });
  if (!chiave("SUPABASE_SERVICE_ROLE_KEY")) {
    throw new Error("Manca la proprietà SUPABASE_SERVICE_ROLE_KEY (Impostazioni del progetto → Proprietà dello script).");
  }
  Logger.log("Orari installati: " + CONFIG.ORE.join(" e ") + " (" + CONFIG.FUSO + ").");
}

/* Backup immediato, per provare l'installazione. */
function provaOra() {
  eseguiBackup();
}

/* Il backup vero e proprio (chiamato dagli orari). */
function eseguiBackup() {
  var inizio = Date.now();
  var esito = { avviato: data(new Date(), "yyyy-MM-dd HH:mm:ss"), parti: {}, errori: [], completo: true };
  var cartella;
  try {
    var radice = DriveApp.getFolderById(CONFIG.CARTELLA_CWP_ID);
    cartella = radice.createFolder("Backup_CWP_" + data(new Date(), "yyyy-MM-dd_HHmm"));
    esito.cartella = cartella.getName();
    passo(esito, "codice", function () { return backupCodice(cartella); });
    passo(esito, "database", function () { return backupDatabase(cartella, inizio); });
    passo(esito, "file", function () { return backupFile(cartella, inizio); });
    passo(esito, "servizi", function () { return backupServizi(cartella); });
    passo(esito, "istruzioni", function () { return backupIstruzioni(cartella, esito); });
  } catch (e) {
    esito.errori.push("Generale: " + e.message);
    esito.completo = false;
  }
  esito.durata_secondi = Math.round((Date.now() - inizio) / 1000);
  esito.completo = esito.completo && esito.errori.length === 0;
  if (cartella) cartella.createFile("esito.json", JSON.stringify(esito, null, 2), MimeType.PLAIN_TEXT);
  if (!esito.completo) avvisa(esito);
  Logger.log(JSON.stringify(esito, null, 2));
  return esito;
}

// Esegue una parte del backup e ne registra l'esito senza fermare le altre.
function passo(esito, nome, f) {
  try {
    esito.parti[nome] = f();
  } catch (e) {
    esito.errori.push(nome + ": " + e.message);
    esito.completo = false;
  }
}

/* ---- 1. Codice da GitHub ---- */
function backupCodice(cartella) {
  var dir = cartella.createFolder("1_codice");
  var zip = UrlFetchApp.fetch("https://codeload.github.com/" + CONFIG.GITHUB_REPO + "/zip/refs/heads/" + CONFIG.GITHUB_RAMO);
  dir.createFile(zip.getBlob().setName("portale-cwp_" + CONFIG.GITHUB_RAMO + ".zip"));
  var commit = {};
  try {
    var c = JSON.parse(UrlFetchApp.fetch("https://api.github.com/repos/" + CONFIG.GITHUB_REPO + "/commits/" + CONFIG.GITHUB_RAMO, { headers: { Accept: "application/vnd.github+json" } }).getContentText());
    commit = { sha: c.sha, data: c.commit && c.commit.committer && c.commit.committer.date, messaggio: c.commit && c.commit.message };
  } catch (e) {
    commit = { nota: "commit non letto: " + e.message };
  }
  commit.repository = "https://github.com/" + CONFIG.GITHUB_REPO;
  dir.createFile("commit.json", JSON.stringify(commit, null, 2), MimeType.PLAIN_TEXT);
  return { zip_byte: zip.getBlob().getBytes().length, commit: commit.sha || null };
}

/* ---- 2. Database: tutte le tabelle e gli utenti ---- */
function backupDatabase(cartella, inizio) {
  var dir = cartella.createFolder("2_database");
  // Elenco delle tabelle dal descrittore di PostgREST (tabelle e viste).
  var api = JSON.parse(supabase("/rest/v1/", { headers: { Accept: "application/openapi+json" } }).getContentText());
  var tabelle = Object.keys(api.definitions || {}).sort();
  var conteggi = {};
  tabelle.forEach(function (t) {
    if (Date.now() - inizio > CONFIG.TEMPO_MASSIMO_MS) throw new Error("tempo esaurito alla tabella " + t);
    // Ordine stabile tra le pagine: chiave primaria (segnata «<pk/>» nel
    // descrittore di PostgREST), altrimenti tutte le colonne.
    var colonne = (api.definitions[t] && api.definitions[t].properties) || {};
    var chiavi = Object.keys(colonne).filter(function (c) { return /<pk\/>/.test(colonne[c].description || ""); });
    if (!chiavi.length) chiavi = Object.keys(colonne);
    var ordine = chiavi.length ? "&order=" + chiavi.map(encodeURIComponent).join(",") : "";
    var righe = [];
    for (var da = 0; ; da += CONFIG.RIGHE_PER_PAGINA) {
      var pagina = JSON.parse(supabase("/rest/v1/" + encodeURIComponent(t) + "?select=*" + ordine, {
        headers: { Range: da + "-" + (da + CONFIG.RIGHE_PER_PAGINA - 1), "Range-Unit": "items" },
      }).getContentText());
      righe = righe.concat(pagina);
      if (pagina.length < CONFIG.RIGHE_PER_PAGINA) break;
    }
    dir.createFile(t + ".json", JSON.stringify(righe), MimeType.PLAIN_TEXT);
    conteggi[t] = righe.length;
  });
  // Utenti dell'autenticazione (senza password: non si possono esportare).
  var utenti = [];
  for (var p = 1; ; p++) {
    var r = JSON.parse(supabase("/auth/v1/admin/users?page=" + p + "&per_page=1000").getContentText());
    var lista = r.users || [];
    utenti = utenti.concat(lista.map(function (u) {
      return { id: u.id, email: u.email, phone: u.phone || null, created_at: u.created_at, email_confirmed_at: u.email_confirmed_at || null, last_sign_in_at: u.last_sign_in_at || null, user_metadata: u.user_metadata || {}, app_metadata: u.app_metadata || {}, banned_until: u.banned_until || null };
    }));
    if (lista.length < 1000) break;
  }
  dir.createFile("auth_utenti.json", JSON.stringify(utenti, null, 2), MimeType.PLAIN_TEXT);
  conteggi["auth_utenti"] = utenti.length;
  dir.createFile("conteggi.json", JSON.stringify(conteggi, null, 2), MimeType.PLAIN_TEXT);
  return { tabelle: tabelle.length, righe: conteggi };
}

/* ---- 3. File degli archivi (Storage) ---- */
function backupFile(cartella, inizio) {
  var dir = cartella.createFolder("3_file");
  var archivi = JSON.parse(supabase("/storage/v1/bucket").getContentText());
  var totale = {};
  var elenco = [];
  archivi.forEach(function (b) {
    var dirB = dir.createFolder(b.id);
    var n = 0;
    elencaOggetti(b.id, "").forEach(function (percorso) {
      if (Date.now() - inizio > CONFIG.TEMPO_MASSIMO_MS) throw new Error("tempo esaurito nei file di " + b.id);
      var blob = supabase("/storage/v1/object/" + b.id + "/" + percorso.split("/").map(encodeURIComponent).join("/")).getBlob();
      // Struttura delle cartelle ricreata come nel bucket.
      var parti = percorso.split("/");
      var dest = dirB;
      for (var i = 0; i < parti.length - 1; i++) dest = sottocartella(dest, parti[i]);
      dest.createFile(blob.setName(parti[parti.length - 1]));
      elenco.push({ bucket: b.id, percorso: percorso, byte: blob.getBytes().length });
      n++;
    });
    totale[b.id] = n;
  });
  dir.createFile("elenco_file.json", JSON.stringify({ archivi: archivi.map(function (b) { return { id: b.id, pubblico: b.public, limite_byte: b.file_size_limit, tipi: b.allowed_mime_types }; }), file: elenco }, null, 2), MimeType.PLAIN_TEXT);
  return totale;
}

// Tutti i percorsi dei file di un bucket (anche nelle sottocartelle).
function elencaOggetti(bucket, prefisso) {
  var out = [];
  for (var da = 0; ; da += 1000) {
    var voci = JSON.parse(supabase("/storage/v1/object/list/" + bucket, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ prefix: prefisso, limit: 1000, offset: da, sortBy: { column: "name", order: "asc" } }),
    }).getContentText());
    voci.forEach(function (v) {
      var percorso = prefisso ? prefisso + "/" + v.name : v.name;
      if (v.id === null || v.id === undefined) out = out.concat(elencaOggetti(bucket, percorso)); // cartella
      else out.push(percorso);
    });
    if (voci.length < 1000) break;
  }
  return out;
}

// Sottocartella con quel nome (la crea se non c'è).
function sottocartella(padre, nome) {
  var it = padre.getFoldersByName(nome);
  return it.hasNext() ? it.next() : padre.createFolder(nome);
}

/* ---- 4. Configurazione dei servizi (mai i valori segreti) ---- */
function backupServizi(cartella) {
  var dir = cartella.createFolder("4_servizi");
  var conf = {
    supabase: {
      progetto: CONFIG.SUPABASE_PROGETTO,
      url: CONFIG.SUPABASE_URL,
      organizzazione: "Fondazione Operate",
      estensioni_da_attivare: ["pg_cron", "pg_net"],
      funzioni_del_server: FUNZIONI,
      verify_jwt_spento: ["consultazione-pubblica", "invia-email-notifica", "recupera-password"],
      auth: { site_url: "https://portale-cwp.vercel.app", redirect_url: "https://portale-cwp.vercel.app/**", smtp: "Resend (smtp.resend.com, porta 465, utente resend)" },
      archivi: ["documenti", "modelli", "allegati-consultazione"],
      nota: "Struttura del database: script supabase/01…35 nello ZIP del codice (in ordine). Dati: cartella 2_database. File: cartella 3_file.",
    },
    vercel: {
      progetto: CONFIG.VERCEL_PROGETTO,
      dominio: "https://portale-cwp.vercel.app",
      origine: "GitHub " + CONFIG.GITHUB_REPO + " ramo main (pubblicazione automatica)",
      variabili: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      configurazione: "vercel.json nello ZIP del codice (instradamento e intestazioni di sicurezza)",
    },
    resend: { uso: "email del portale e SMTP di Supabase Auth", mittente_provvisorio: "onboarding@resend.dev" },
  };
  // Facoltativi: dati letti dalle API se Luca ha inserito le chiavi.
  if (chiave("RESEND_API_KEY")) {
    try {
      conf.resend.domini = JSON.parse(UrlFetchApp.fetch("https://api.resend.com/domains", { headers: { Authorization: "Bearer " + chiave("RESEND_API_KEY") } }).getContentText());
    } catch (e) { conf.resend.domini_errore = e.message; }
  }
  if (chiave("VERCEL_TOKEN")) {
    try {
      var p = JSON.parse(UrlFetchApp.fetch("https://api.vercel.com/v9/projects/" + CONFIG.VERCEL_PROGETTO, { headers: { Authorization: "Bearer " + chiave("VERCEL_TOKEN") } }).getContentText());
      conf.vercel.impostazioni = { framework: p.framework, nodeVersion: p.nodeVersion, buildCommand: p.buildCommand, outputDirectory: p.outputDirectory, rootDirectory: p.rootDirectory, variabili: (p.env || []).map(function (v) { return { nome: v.key, ambienti: v.target }; }) };
    } catch (e) { conf.vercel.impostazioni_errore = e.message; }
  }
  dir.createFile("configurazione_servizi.json", JSON.stringify(conf, null, 2), MimeType.PLAIN_TEXT);
  return { resend: !!conf.resend.domini, vercel: !!conf.vercel.impostazioni };
}

/* ---- 5. Istruzioni di ripristino ---- */
function backupIstruzioni(cartella, esito) {
  try {
    var pdf = UrlFetchApp.fetch("https://raw.githubusercontent.com/" + CONFIG.GITHUB_REPO + "/" + CONFIG.GITHUB_RAMO + "/public/documentazione/Istruzioni_Ripristino_Portale_CWP.pdf");
    cartella.createFile(pdf.getBlob().setName("Istruzioni_Ripristino_Portale_CWP.pdf"));
  } catch (e) {
    esito.errori.push("istruzioni PDF: " + e.message);
  }
  cartella.createFile("LEGGIMI.txt", [
    "BACKUP DEL PORTALE CARBON WASTEPRINT (CWP) — " + esito.avviato + " (ora italiana)",
    "",
    "Contenuto:",
    "  1_codice/     codice da GitHub (ZIP) e commit di riferimento: portale, script del database 01-35, funzioni del server, manuali",
    "  2_database/   una tabella per file JSON + auth_utenti.json (utenti, senza password) + conteggi.json",
    "  3_file/       file degli archivi Supabase (documenti, modelli, allegati), con elenco_file.json",
    "  4_servizi/    configurazione di Supabase, Vercel, Resend (nomi dei segreti, mai i valori)",
    "  esito.json    esito del backup",
    "",
    "Ripristino completo (dettagli nel PDF «Istruzioni di ripristino», capitolo «Ripristino da un backup automatico»):",
    "  1. Nuovo progetto Supabase; estensioni pg_cron e pg_net; script 01-35 dallo ZIP, in ordine.",
    "  2. Dati: node strumenti/backup/genera_sql_ripristino.mjs <cartella 2_database> → eseguire ripristino_dati.sql (psql o SQL Editor).",
    "  3. File: node strumenti/backup/carica_file_ripristino.mjs <cartella 3_file> (con URL e chiave service_role del nuovo progetto).",
    "  4. Funzioni del server dallo ZIP (supabase/functions) e segreti elencati in 4_servizi.",
    "  5. Vercel: importare il repository GitHub, variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY del nuovo progetto.",
    "  6. Resend: dominio, chiave API (segreto RESEND_API_KEY), SMTP di Supabase Auth.",
    "  7. Gli utenti ritornano con lo stesso id ed email: al primo accesso usano «Password dimenticata?».",
    "",
    "Dati personali: non condividere questa cartella.",
  ].join("\n"), MimeType.PLAIN_TEXT);
  return true;
}

/* ---- Utilità ---- */

// Chiamata a Supabase con la chiave service_role (dalle proprietà dello script).
function supabase(percorso, opzioni) {
  var k = chiave("SUPABASE_SERVICE_ROLE_KEY");
  if (!k) throw new Error("manca la proprietà SUPABASE_SERVICE_ROLE_KEY");
  opzioni = opzioni || {};
  var headers = opzioni.headers || {};
  headers.apikey = k;
  headers.Authorization = "Bearer " + k;
  opzioni.headers = headers;
  opzioni.muteHttpExceptions = true;
  var r = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + percorso, opzioni);
  var codice = r.getResponseCode();
  if (codice >= 300) throw new Error(percorso.split("?")[0] + " → HTTP " + codice + " " + r.getContentText().slice(0, 200));
  return r;
}

function chiave(nome) {
  return PropertiesService.getScriptProperties().getProperty(nome);
}

function data(d, formato) {
  return Utilities.formatDate(d, CONFIG.FUSO, formato);
}

// Email a Luca (proprietario dello script) se il backup non è completo.
function avvisa(esito) {
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Backup CWP NON completo — " + esito.avviato,
      "Il backup del Portale CWP delle " + esito.avviato + " non è completo.\n\nErrori:\n- " + esito.errori.join("\n- ") +
      "\n\nCartella: " + (esito.cartella || "non creata") + "\nDettagli in esito.json.");
  } catch (e) {
    Logger.log("Email non inviata: " + e.message);
  }
}
