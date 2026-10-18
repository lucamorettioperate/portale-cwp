# Registro sviluppo e deploy — Portale Carbon WastePrint

| | |
|---|---|
| **Ultimo aggiornamento** | 18 ottobre 2026 |
| **Versione del portale** | 0.14 (ultimo script database: `14_controlli_file.sql`) |
| **Indirizzo** | https://portale-cwp.vercel.app |
| **Repository** | https://github.com/lucamorettioperate/portale-cwp (pubblico: solo codice, nessun dato) |
| **Responsabile** | Luca Moretti — Fondazione Operate |

> **Regola di manutenzione.** Ogni volta che si implementa o si modifica una
> funzione, un servizio, uno script del database o una configurazione:
> 1. si aggiunge una voce in cima alla **Cronologia** (§9) con data, cosa,
>    dove (commit, script, servizio) e come è stato verificato;
> 2. si aggiornano le sezioni interessate (architettura, servizi, database,
>    funzionalità, backlog);
> 3. si aggiornano i **manuali** Utente e Amministratore se cambia qualcosa
>    che gli utenti vedono o fanno.
>
> Copia di questo registro: documento di progetto `claude/registro-dev-deploy.md`
> nel Progetto claude.ai "CARBON WASTE PRINT".

---

## 1. Cos'è il portale

Piattaforma operativa del **Programma Carbon WastePrint®** di Fondazione
Operate: gestisce in digitale il percorso di partecipazione al Programma,
dalla registrazione del Progetto alla conclusione delle verifiche e dei
Rapporti di Monitoraggio annuali (fino a 10 per Progetto). È un *case
management* "stile gare": fasi tracciabili, documenti versionati, apertura e
chiusura delle fasi, richieste di integrazione, consultazione pubblica, audit
di ogni operazione. Include una sezione riservata agli Amministratori per il
**calcolo dei crediti CO₂eq** secondo la *Metodologia CWP v1.2*.

Specifica di riferimento: *Programma Carbon WastePrint — Requisiti della
piattaforma* (15 settembre 2026). Metodo di calcolo: *Metodologia Carbon
WastePrint® v1.2* (Studio Associato Wastelab e Altraleonia S.r.l.), validata
da RINA Services SpA secondo ISO 14064-2:2019.

**Ruoli applicativi**

| Ruolo | Chi | Cosa fa |
|---|---|---|
| Cliente / Organizzazione | Comuni, enti locali, soggetti gestori (Soggetto Promotore del Progetto) | Segue le proprie pratiche, carica documenti, risponde alle integrazioni e ai commenti |
| Operatore di back-office | Personale di Fondazione Operate | Gestisce pratiche, fasi, scadenze, integrazioni, consultazione, pagamenti |
| Amministratore | Fondazione Operate | Tutto ciò che fa l'Operatore + utenti, audit, impostazioni, calcolo crediti |

L'**Ente di Validazione** (RINA) non è un utente: è un'anagrafica; il suo
rapporto viene caricato dall'Operatore.

---

## 2. Architettura

### 2.1 Schema generale

```
 Utenti (browser)                         Pubblico senza account
 Comuni · Operatori · Amministratori      (consultazioni, formato dati)
      │  HTTPS                                   │  HTTPS
      ▼                                          ▼
 ┌────────────────────────────────────────────────────────────┐
 │ VERCEL — portale-cwp.vercel.app                            │
 │ Sito statico React + Vite: pagine, controlli dei file,     │
 │ lettura del tracciato Excel, calcolo crediti, PDF          │
 │ (nessun server proprio: il codice gira nel browser)        │
 └───────────▲──────────────────────────────┬─────────────────┘
             │ deploy automatico            │ API Supabase (chiave pubblica
 ┌───────────┴──────────────┐               │ + sessione dell'utente)
 │ GITHUB                   │               ▼
 │ lucamorettioperate/      │  ┌──────────────────────────────────────────────┐
 │ portale-cwp (main)       │  │ SUPABASE — progetto portale-cwp              │
 └──────────────────────────┘  │  Auth: email+password, MFA TOTP, recupero    │
                               │  Postgres: tabelle, RLS, funzioni (RPC),     │
                               │    trigger di audit, notifiche, immutabilità │
                               │  Storage: documenti · modelli ·              │
                               │    allegati-consultazione (privati)          │
                               │  Edge Functions (Deno): crea-utente,         │
                               │    reimposta-password, recupera-password,    │
                               │    invia-email-notifica,                     │
                               │    consultazione-pubblica                    │
                               │  pg_cron: scadenze (giornaliero),            │
                               │    email da ritentare (15 min)               │
                               │  pg_net: il database chiama la funzione email│
                               └───────────────────────┬──────────────────────┘
                                                       │ API HTTPS
                                                       ▼
                                          ┌──────────────────────────┐
                                          │ RESEND — invio email     │
                                          │ (API e SMTP di Supabase) │
                                          └──────────────────────────┘
```

In breve: **GitHub conserva** il codice, **Vercel mostra** il portale,
**Supabase ricorda** dati, utenti e documenti e **decide chi può fare
cosa**, **Resend spedisce** le email.

### 2.2 I livelli

| Livello | Dove | Cosa fa | Regola |
|---|---|---|---|
| Interfaccia | `src/pages`, `src/components` | Mostra dati e moduli, guida l'utente | Non è una difesa: tutto ciò che nasconde è comunque protetto più sotto |
| Accesso ai dati | `src/lib/dati.js`, `src/lib/crediti/archivio.js` | Unico punto in cui il portale legge e scrive su Supabase | Le pagine non chiamano Supabase direttamente (eccezioni: autenticazione in `AuthContext.jsx`, registro crediti) |
| Logica nel browser | `src/lib/file.js`, `src/lib/crediti/*.js`, `src/lib/fascicolo.js` | Controllo dei file, lettura del tracciato, motore di calcolo, PDF, ZIP | Funzioni pure e provate da `npm test` dove possibile |
| Regole del database | `supabase/*.sql` | RLS per ogni tabella, funzioni per le azioni sensibili, trigger per audit, notifiche, versioni e immutabilità | **Qui** si decide chi vede e chi modifica |
| Funzioni server | `supabase/functions/*` | Operazioni che richiedono la chiave di servizio o un servizio esterno (utenti, email, pagina pubblica) | La chiave di servizio non arriva mai al browser |

### 2.3 Modello di sicurezza
- **Ruoli** nel profilo (`profilo.ruolo`): `cliente`, `operatore`, `admin`.
  Le funzioni `app_ruolo()`, `app_is_staff()`, `app_is_admin()` e
  `pratica_mia()` (script 02, 06, 10) sono usate da tutte le regole.
- **Row Level Security** su ogni tabella: il Comune vede solo le pratiche
  delle organizzazioni a cui è associato; lo staff vede tutto; alcune
  tabelle sono solo Admin (calcoli dei crediti, durata fasi, enti, modelli).
- **Azioni sensibili** solo tramite funzioni del database
  (`staff_apri_fase`, `staff_cambia_stato_pratica`, `staff_errata_corrige`…)
  che controllano ruolo, stato della pratica e motivazione.
- **Audit** scritto da trigger (`audit_registra`, script 07/08/17), non
  modificabile e non scrivibile dal browser.
- **Immutabilità**: documenti mai sovrascritti (versioni), calcoli
  confermati non modificabili, numero di registro assegnato dal database.
- **MFA**: lo staff ha i poteri del back-office solo con sessione a due
  fattori quando `mfa_obbligatoria` è acceso (oggi **spento**).
- **Dati personali**: i commentatori esterni sono noti solo allo staff; la
  Banca Dati Utenze deve contenere solo codici anonimi (import bloccato
  altrimenti); il rapporto PDF non contiene il dettaglio per utenza.
- **Segreti** solo in Supabase (Edge Functions → Secrets) e Vercel
  (variabili d'ambiente); il repository è pubblico ma non contiene chiavi.

### 2.4 Come viaggia una richiesta: esempi passo per passo

**Accesso.** Il browser invia email e password a Supabase Auth
(`AuthContext.jsx`) → riceve la sessione → il portale legge il profilo
(ruolo, organizzazioni, `password_temporanea`) → se la password è
temporanea apre `CambiaPassword`, se serve l'MFA `VerificaMfa`, altrimenti
il menu del ruolo (`Header.jsx`).

**Il Comune carica un documento.** `Documenti.jsx` → `caricaDocumento()`
(`dati.js`) controlla formato, dimensione e contenuto (`file.js`) → carica
il file nell'archivio `documenti/<pratica>/…` → inserisce la riga in
`documento` → nel database: la regola RLS verifica che la pratica sia del
Comune e attiva (script 08), il trigger calcola la versione (07), verifica
il file nell'archivio (14), scrive l'audit (07/08) e crea le notifiche per
lo staff (09/17) → la notifica genera l'email tramite pg_net e
`invia-email-notifica` (12) → Resend.

**Richiesta di integrazione.** L'Operatore preme «Richiedi integrazione»
(`DettaglioPratica.jsx`) → RPC `staff_richiedi_integrazione` (08) → fase
*In attesa di integrazione*, notifica ed email al Comune → il Comune
carica il file e chiama `cliente_rispondi_integrazione` → l'Operatore
chiude con `staff_chiudi_integrazione` → se non restano richieste la fase
torna *In corso*.

**Osservazione dalla consultazione pubblica.** Pagina pubblica
`/consultazioni/:id` (`ConsultazioniPubbliche.jsx`) → Edge Function
`consultazione-pubblica`, azione `invia`: controlli, limiti di invio,
allegato in `allegati-consultazione`, riga in `commento_in_attesa`, email
di conferma con Resend → l'autore apre il collegamento
`/consultazioni/conferma` → azione `conferma`: la riga passa in `commento`
come *Ricevuto* → trigger di notifica allo staff → moderazione nel portale
(`Consultazione.jsx`).

**Calcolo dei crediti.** L'Admin crea il calcolo (`Crediti.jsx`) → passo
«Importa il tracciato» (`ImportaTracciato.jsx`): il file è letto nel
browser (`tracciato.js`), controllato per dati personali e coerenza,
salvato in `calcolo_crediti.dati`, `calcolo_conferimento`,
`calcolo_riuso` (script 11) → «Calcola» esegue il motore
(`calcolo.js`) nel browser e salva il riepilogo → «Conferma» rende il
calcolo immutabile e il database assegna il numero di registro (18) →
«Scarica il rapporto (PDF)» (`rapportoPdf.js`) → «Archivia» carica il PDF
tra i documenti della pratica → il calcolo compare nel **Registro dei
crediti** (`admin_registro_crediti`).

**Email di notifica.** Un trigger inserisce una riga in `notifica` (09/17)
→ il trigger dello script 12 chiama con pg_net la funzione
`invia-email-notifica` → la funzione rilegge la notifica con la chiave di
servizio e spedisce con Resend → se non riesce, `pg_cron` riprova ogni 15
minuti per 6 ore.

---

## 3. Servizi e configurazione

| Servizio | Uso | Piano | Dove si configura | Segreti / variabili (solo nomi) |
|---|---|---|---|---|
| GitHub | Codice sorgente, storico | Free (repo pubblico) | github.com/lucamorettioperate/portale-cwp | — |
| Vercel | Pubblicazione del portale; deploy automatico a ogni push su `main` | Hobby (gratuito) | Dashboard Vercel → progetto portale-cwp | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Supabase | Database, autenticazione, archivio file, funzioni, cron | Free | supabase.com → organizzazione Fondazione Operate → progetto `ajxrnofgunynkynozmrn`; Auth: Site URL `https://portale-cwp.vercel.app`, Redirect URL `https://portale-cwp.vercel.app/**` | Edge Functions → Secrets: `RESEND_API_KEY` (impostata 17/10), `EMAIL_MITTENTE` (da impostare dopo verifica dominio), `PORTALE_URL` (facoltativo) |
| Resend | Invio email delle notifiche (Edge Function) e delle email di autenticazione (SMTP di Supabase Auth) | Free (3.000 email/mese, 100/giorno) | resend.com (account di Luca) | Chiave API → Secrets di Supabase e password SMTP in Authentication → Emails |

**Note sui servizi**
- Vercel Hobby non pubblica da repository **privati** ("Hobby teams do not
  support collaboration"): per questo il repository è pubblico.
- Finché il dominio non è verificato su Resend, il mittente è
  `onboarding@resend.dev` e le email arrivano **solo** all'indirizzo del
  titolare dell'account Resend.
- Supabase Free: 50 MB massimo per file, progetto in pausa dopo 7 giorni
  senza attività (si riattiva dalla dashboard).
- Ambiente unico (produzione). I requisiti §15 chiedono un ambiente di prova
  separato: in backlog.
- **Decisione del 18/10:** Vercel e Supabase passeranno a piani a pagamento
  (backlog punto 29). I limiti dei piani gratuiti descritti qui sopra
  valgono fino ad allora.

---

## 4. Database (Supabase / Postgres)

Gli script SQL stanno in `supabase/` e si eseguono **in ordine** nel SQL
Editor di Supabase. Dal 07 in poi sono rieseguibili.

| Script | Contenuto | Eseguito in produzione |
|---|---|---|
| `01_schema.sql` | Tabelle: organizzazione, ente_validazione, profilo, pratica, fase, documento, richiesta_integrazione, consultazione, commento, pagamento, audit_event; tipi enumerati | 17/10/2026 |
| `02_sicurezza.sql` | Regole RLS sui tre ruoli, funzioni di ruolo, creazione automatica del profilo alla registrazione | 17/10/2026 |
| `03_dati_esempio.sql` | Dati di prova (Comune di Borgoval e altri) | 17/10/2026 — da ripulire a fine collaudo |
| `04_storage.sql` | Bucket privato `documenti` e regole di accesso ai file | 17/10/2026 |
| `05_gestione_utenti.sql` | Funzioni Admin per elencare e aggiornare utenti | 17/10/2026 |
| `06_utente_multi_org.sql` | Un utente associato a più organizzazioni (tabella utente_organizzazione) | 17/10/2026 |
| `07_correzioni_sicurezza.sql` | Audit scritto dal database (immutabile), versioni dei documenti calcolate dal database, commenti controllati, risposta del cliente ai commenti | 17/10/2026 |
| `08_integrazioni_azioni.sql` | Richieste di integrazione; apertura/chiusura fasi con scadenza; modifica scadenza e cambio stato pratica con motivazione | 17/10/2026 |
| `09_cruscotto_pagamenti_notifiche.sql` | Codice pratica automatico (CWP-AAAA-NNNN, rapporti -RMn), cruscotto, pagamenti, visibilità documenti, notifiche interne, cron delle scadenze | 17/10/2026 |
| `10_mfa_profilo.sql` | MFA per lo staff (interruttore `mfa_obbligatoria`, oggi `false`), protezione del profilo da autopromozione, disattivazione utenti | 17/10/2026 |
| `11_crediti.sql` | Tabelle del calcolo crediti (calcolo_crediti, calcolo_conferimento, calcolo_riuso); solo Admin; calcolo confermato immutabile | 17/10/2026 |
| `12_email_notifiche.sql` | Trigger che chiama la funzione email per ogni nuova notifica (pg_net), nuovi tentativi ogni 15 minuti | 17/10/2026 |
| `13_durata_fasi.sql` | Durata delle fasi in tabella, modificabile dall'Admin con motivazione | 18/10/2026 |
| `14_controlli_file.sql` | Limite 50 MB, formati ammessi, controllo tipo/estensione/cartella; ZIP ammesso | 18/10/2026 (riesecuzione per ZIP lo stesso giorno) |
| `15_password.sql` | Cambio obbligatorio dopo password temporanea (`password_temporanea`), funzione `password_cambiata`, audit dei cambi password | 18/10/2026 |
| `19_correzioni_revisione_codice.sql` | Il Comune legge solo le osservazioni ammesse della consultazione (policy `commento_select`) | 18/10/2026 |
| `18_registro_crediti.sql` | Numero di registro `CWP-REG-AAAA-NNNN` assegnato alla conferma dei calcoli ex post (contatore per anno `contatore_registro`, funzione `cwp_numero_registro`, `calcolo_immutabile` aggiornata, numero vietato su inserimento e bozze); funzione `admin_registro_crediti` (stato valido / sostituito) | 18/10/2026 |
| `17_pratiche.sql` | Pagamenti leggibili dal Comune; note di fase (`nota_fase`); anagrafica Enti di Validazione (solo Admin) e `staff_imposta_ente_validazione`; modelli di documento (`modello_documento`, archivio `modelli`); messaggi (`messaggio`); consultazione pubblica: dati dell'autore sul commento, `commento_in_attesa`, archivio `allegati-consultazione`, errata corrige (`consultazione_errata`, `staff_errata_corrige`), `staff_autori_commenti`; inserimento diretto dei commenti dal portale tolto; audit e notifiche per le nuove tabelle | 18/10/2026 |
| `16_recupero_password.sql` | Tabella `recupero_password_richiesta` (ultima richiesta di recupero per indirizzo, nessuna policy: la usa solo la funzione `recupera-password`) | 18/10/2026 |

`schema_completo.sql` è la fotografia iniziale (01+02) ed è superata dagli
script successivi.

**Tabelle principali**: organizzazione, utente_organizzazione,
ente_validazione, profilo, pratica, fase, durata_fase, documento,
richiesta_integrazione, consultazione, commento, pagamento, notifica,
audit_event, impostazione, calcolo_crediti, calcolo_conferimento,
calcolo_riuso, recupero_password_richiesta, nota_fase, messaggio,
modello_documento, consultazione_errata, commento_in_attesa.

**Archivi (Storage)**: `documenti` (file delle pratiche, 50 MB),
`modelli` (modelli di documento, lettura per chi ha l'accesso),
`allegati-consultazione` (allegati alle osservazioni, 10 MB, scritto solo
dalla funzione `consultazione-pubblica`).

**Funzioni del database usate dal portale** (selezione):
`staff_apri_fase`, `staff_chiudi_fase`, `staff_modifica_scadenza`,
`staff_cambia_stato_pratica`, `staff_richiedi_integrazione`,
`staff_chiudi_integrazione`, `cliente_rispondi_integrazione`,
`rispondi_commento`, `staff_cruscotto`, `admin_elenco_utenti`,
`admin_aggiorna_utente`, `admin_imposta_organizzazioni`,
`admin_imposta_attivo`, `admin_imposta_durata_fase`, `mio_stato_mfa`,
`sono_admin`, `richiedi_email_notifica`.

**Lavori pianificati (pg_cron)**

| Nome | Quando | Cosa fa |
|---|---|---|
| `cwp_notifiche_scadenze` | ogni giorno alle 05:00 UTC | Notifiche per fasi in scadenza e scadute |
| `cwp_riprova_email` | ogni 15 minuti | Rispedisce le email delle ultime 6 ore non ancora inviate |

**Impostazioni** (tabella `impostazione`, modificabile solo dal SQL Editor):
`mfa_obbligatoria` (`false`), `url_email_notifiche` (indirizzo della
funzione email).

**Interruttore di emergenza MFA**: se un amministratore perde l'app di
autenticazione, dal SQL Editor:
`update impostazione set valore = 'false' where chiave = 'mfa_obbligatoria';`

---

## 5. Edge Functions (Supabase)

| Funzione | Cosa fa | Protezione | Pubblicazione |
|---|---|---|---|
| `crea-utente` | L'Amministratore crea un utente con password temporanea e lo associa a organizzazioni | Verifica che il chiamante sia Admin (`sono_admin`) | Dashboard Supabase (editor web); ripubblicata 17/10 |
| `reimposta-password` | L'Amministratore assegna una password temporanea a un Cliente o Operatore; il flag obbliga al cambio al primo accesso; audit | Verifica `sono_admin`; esclusi amministratori e sé stessi | Dashboard Supabase (editor web), 18/10; Verify JWT attivo |
| `consultazione-pubblica` | Pagine pubbliche della consultazione: elenco, dettaglio (documento, errata corrige, osservazioni ammesse), invio di un'osservazione con allegato facoltativo ed email di conferma, conferma dell'email (l'osservazione diventa *Ricevuto*) | Verify JWT **disattivato** di proposito (pubblico senza account): nessun dato personale restituito, 3 invii/ora per indirizzo e 100/ora per consultazione, campo trappola anti-robot, allegati max 10 MB con controllo del contenuto, token monouso 48 ore salvato come SHA-256 | Dashboard Supabase (editor web), 18/10 |
| `recupera-password` | «Password dimenticata?»: genera il collegamento di recupero (`auth.admin.generateLink`) e spedisce con Resend l'email in italiano «Portale Carbon WastePrint (CWP) — Richiesta di reimpostazione della password», al posto del modello email di Supabase | Verify JWT **disattivato** di proposito (la chiama chi non ha fatto l'accesso): risponde sempre `ok` senza rivelare se l'indirizzo esiste; niente email agli utenti disattivati; massimo una richiesta ogni 2 minuti per indirizzo; il collegamento porta solo al portale | Dashboard Supabase (editor web), 18/10 |
| `invia-email-notifica` | Spedisce per email una notifica interna (pulsante "Apri nel portale") tramite Resend | Verify JWT **disattivato** di proposito: usa solo l'id ricevuto e rilegge tutto dal database; ogni notifica parte una volta sola | Dashboard Supabase; prima pubblicazione 17/10, aggiornata 17/10 (pulsante per tema scuro) |

Sorgenti in `supabase/functions/<nome>/index.ts`. Si pubblicano dalla
dashboard (Edge Functions → funzione → Code → *Deploy updates*). Dopo ogni
pubblicazione verificare che l'impostazione *Verify JWT* sia quella attesa.

---

## 6. Portale (frontend)

React 18 + Vite 5, React Router 6, `@supabase/supabase-js`, `jspdf` e `jspdf-autotable` (rapporto di calcolo), `jszip` (lettura del tracciato ed export
fascicolo). Nessun server proprio: tutto passa da Supabase.

**Pagine**

| Indirizzo | Pagina | Chi |
|---|---|---|
| `/login` | Accesso, «Password dimenticata?» | tutti |
| `/reimposta-password` | Nuova password dal link dell'email di recupero | **pubblica** (sessione di recupero) |
| `/profilo` | Il mio profilo: account, cambio password, manuali e documentazione per ruolo | tutti |
| `/password` | Cambio password volontario | tutti |
| `/consultazioni`, `/consultazioni/:id`, `/consultazioni/conferma` | Consultazioni pubbliche: elenco, documento e osservazioni, invio con conferma dell'email | **pubbliche**, senza login |
| `/formato-dati` | Formato dei dati per il calcolo crediti, download del tracciato Excel | **pubblica**, senza login |
| `/` | Cruscotto (staff) oppure Le mie pratiche (cliente) | tutti |
| `/pratiche` | Back-office: elenco e dettaglio pratiche (`?id=` apre una pratica) | Operatore, Admin |
| `/documenti` | I tuoi documenti, modelli generali, manuale | Cliente |
| `/utenti` | Gestione utenti | Admin |
| `/audit` | Audit trail | Admin |
| `/crediti`, `/crediti/:id` | Calcolo crediti CWP | Admin |
| `/impostazioni` | Durata delle fasi, Enti di Validazione, Modelli di documento | Admin |
| `/documentazione` | Documentazione: Manuale Utente (PDF; Word solo Admin), Manuale Amministratore e Registro (solo Admin) | tutti (contenuto per ruolo) |

**Struttura del codice** (in sintesi; descrizione completa file per file nel capitolo 14 «Codice sorgente»)
- `src/pages/` — pagine elencate sopra (+ `VerificaMfa.jsx`;
  `ConsultazioniPubbliche.jsx` contiene le tre pagine pubbliche).
- `src/components/` — `DettaglioPratica`, `Documenti`, `Integrazioni`,
  `Consultazione`, `Rapporti`, `Pagamenti`, `Notifiche`, `NuovoProgetto`,
  `Header`, `Messaggi`, `NoteFase`, `stili.js` (stili condivisi),
  `impostazioni/{EntiValidazione,ModelliDocumento}`, `crediti/TabellaDati`; (`Timeline`, `AzioniRuolo`, `ProjectCard`,
  `Stat` sono resti del prototipo, non più usati).
- `src/lib/` — `dati.js` (accesso ai dati), `AuthContext.jsx` (sessione,
  ruolo, MFA), `file.js` (controlli sui file), `fascicolo.js` (export ZIP),
  `csv.js`, `date.js`, `cwpProgram.js` (fasi, ruoli, colori),
  `crediti/{parametri,calcolo,archivio}.js` (motore di calcolo).
- `public/loghi/` — loghi Carbon WastePrint, Fondazione Operate, RINA,
  Carbon Credit. `public/modelli/` — tracciato dati Excel.
- `test/` — test del motore crediti, del lettore CSV e dell'import del
  tracciato (`npm test`); `test/dati/` file di esempio.
- `strumenti/genera_tracciato_dati.py` — rigenera il tracciato Excel;
  `strumenti/genera_esempi_tracciato.py` — file di esempio compilati.

---

## 7. Funzionalità per area (stato al 18/10/2026)

| Area (requisiti) | Stato | Dettaglio |
|---|---|---|
| Accesso e ruoli (§3, §13) | Fatto | Email+password, tre ruoli, utenti multi-organizzazione, disattivazione; password temporanea da cambiare al primo accesso, cambio e recupero password, reimpostazione dall'Admin; MFA pronta ma spenta |
| Pratiche (§2) | Fatto | Progetti e Rapporti di Monitoraggio annuali, codice automatico, stati attiva/sospesa/annullata/chiusa con motivazione |
| Fasi (§4) | Fatto | 7 fasi, apertura con scadenza automatica, chiusura, modifica scadenza; durata modificabile dall'Admin; note di fase interne o condivise |
| Documenti (§5) | Fatto (manca antivirus) | Versioni mai sovrascritte, hash SHA-256, visibilità Cliente/Fondazione/Pubblico, per fase o generali; limite 50 MB, formati ammessi, controllo contenuto |
| Integrazioni (§4) | Fatto | Richiesta → risposta del Cliente con documento → chiusura; fase "in attesa di integrazione" |
| Consultazione pubblica (§6) | Fatto | Pagina pubblica, osservazioni con email confermata e allegato, moderazione, firma «Partecipante» o nome a scelta dell'autore, risposte del Comune, errata corrige con ripartenza facoltativa dei 30 giorni |
| Pagamenti (§7) | Fatto | Voci, incassi, operatore registrato; visibili al Comune in sola lettura |
| Back-office (§8) | Fatto | Cruscotto con scadenze/scaduti, ricerca, azioni con motivazione |
| Notifiche (§9) | Fatto | Interne + email (Resend); messaggi Comune-Fondazione nella pratica; manca verifica dominio |
| Audit (§10) | Fatto | Scritto dal database, immutabile, pagina di consultazione |
| Export fascicolo (§11) | Fatto | ZIP con documenti e riepiloghi |
| Calcolo crediti (Metodologia v1.2) | Parziale | Motore formule 1-32, Tabelle 3-5, 8, 15, 16; import diretto del tracciato con aggregazione delle letture, blocco dei dati personali e controlli di coerenza; calcoli confermati immutabili con numero di registro; rapporto PDF; registro dei crediti (manca la parte prevista dallo Standard CWP) |
| Amministrazione | Fatto | Utenti, audit, impostazioni: durata fasi, Enti di Validazione, modelli di documento |
| Sicurezza (§13) | Parziale | RLS, audit, controlli file; mancano registro di sicurezza, antivirus, ambiente di prova |

---

## 8. Procedure di rilascio (runbook)

**Modifica al portale (frontend)**
1. Modifica del codice, `npm run build` e `npm test` in locale.
2. Commit su `main` e push su GitHub.
3. Vercel pubblica da solo in 1-2 minuti; verifica online.

**Modifica al database**
1. Nuovo script numerato in `supabase/` (rieseguibile).
2. Prova sulla copia locale di Postgres (banco di prova con stub di
   Supabase) con casi positivi e negativi.
3. Esecuzione nel SQL Editor di Supabase (conferma *Run query* per gli
   script che modificano oggetti).
4. Query di verifica in produzione; poi commit dello script.
5. Prima il database, poi il portale: il portale nuovo non deve mai
   chiamare funzioni che il database non ha ancora.

**Edge Function**: sorgente nel repository → incolla nell'editor della
dashboard → *Deploy updates* → controlla *Verify JWT* → prova.

**Documenti in Word/PDF (Manuale Utente, Manuale Amministratore e questo Registro)**: si modifica il
testo (`docs/manuale-utente.md` o `docs/manuale-amministratore.md`, e lo stesso nel manuale online;
`docs/REGISTRO_DEV_DEPLOY.md`), si rigenera l'inventario del codice (`python3 strumenti/inventario_codice.py`, capitolo 14), si aggiunge una riga in
`strumenti/revisioni_documenti.json` (nuovo numero di revisione e data), si
esegue `node strumenti/genera_documenti.cjs` (richiede la libreria `docx`,
LibreOffice e, per il PDF impaginato, WeasyPrint) e si pubblica con commit e
push. I file vanno in
`public/manuali/` e `public/documentazione/` e si scaricano dalla pagina
Documentazione del portale.

**Regole di lavoro (richieste di Luca del 18/10)**
- A ogni rilascio si aggiornano insieme quattro documenti: questo Registro,
  il Manuale Utente, il Manuale Amministratore e il Manuale Test
  (`docs/manuale-test.md`, sintetico, per i collaudatori).
- Il codice si commenta in italiano mentre si scrive: in testa a ogni file
  lo scopo e il capitolo del registro di riferimento; sopra ogni funzione
  cosa fa; nel corpo le regole di sicurezza e i passaggi non ovvi (punto 31).

**Segreti**: li inserisce solo Luca (Edge Functions → Secrets). Le chiavi non
si scrivono mai in chat, nel codice o nel registro.

---

## 9. Cronologia sviluppo e deploy

Voci più recenti in alto. Commit = identificativo nel repository GitHub.

### 18 ottobre 2026
- **Codice commentato e correzioni dalla revisione (punto 31)** — tutti i
  file del portale, delle Edge Functions, dei test e degli strumenti hanno
  ora intestazione e commenti in italiano; verifica: il portale compilato è
  identico byte per byte a quello senza commenti. La revisione ha fatto
  emergere e correggere: osservazioni non ancora ammesse leggibili dal
  Comune (solo il testo, senza autore) → script
  `19_correzioni_revisione_codice.sql` (provato in locale, eseguito e
  verificato in produzione); importi dei pagamenti con il punto delle
  migliaia («1.234,50») rifiutati o letti male → corretto; avviso «fase
  chiusa» mostrato due volte al Comune → corretto. Segnalati per dopo
  (punto 33): creazione di Progetto e fasi non atomica; componenti del
  prototipo non usati (`Timeline`, `AzioniRuolo`, `ProjectCard`, `Stat`,
  `Pill`) da eliminare; stile `avviso` non usato.
- **Crediti: rapporto di calcolo in PDF e registro dei crediti (backlog 6,
  7)** — `src/lib/crediti/rapportoPdf.js` (jsPDF 4.2.1 + jspdf-autotable
  5.0.9, caricati solo quando servono): scheda con numero di registro e
  impronta SHA-256 di dati e risultato, sintesi, buffer, dati di ingresso,
  risultati per tipologia e classe, avvisi e coerenza, scelte
  interpretative, filigrana BOZZA; pulsanti «Scarica il rapporto (PDF)» e
  «Archivia il rapporto nella pratica» (documento non visibile al Comune,
  nuova tipologia «Rapporto di calcolo dei crediti»). Script
  `18_registro_crediti.sql` (provato sul banco locale: numero assegnato solo
  agli ex post alla conferma, non falsificabile, sostituzione con nuova
  versione, accesso solo Admin; eseguito in produzione e verificato);
  vista «Registro dei crediti» in Crediti CWP (`RegistroCrediti`), con
  totali per ente e anno ed export CSV. Regole di emissione e annullamento
  in attesa dello Standard CWP. Commit `f84e49a`.
- **Crediti: import diretto del tracciato dati (backlog 1-5)** — nuovo passo
  «Importa il tracciato» nel calcolo: file .xlsx (letto nel browser con
  JSZip, senza librerie esterne) o ZIP di CSV, scelto dai documenti della
  pratica del calcolo o dal computer; aggregazione del foglio 6_Letture per
  utenza e tipologia (letture fuori anno escluse); blocco dell'import se ci
  sono dati personali (codici fiscali, email, IBAN, telefoni, indirizzi,
  colonne nome/indirizzo…); controlli di coerenza (PEF, classi, utenze,
  valori anomali, totali del territorio) mostrati anche nei passi 5 e 7;
  file di origine annotato nel calcolo (`dati.importazione`). Codice:
  `src/lib/crediti/tracciato.js`, `src/components/crediti/ImportaTracciato.jsx`;
  test `test/tracciato.test.mjs` (5 prove) con i file generati da
  `strumenti/genera_esempi_tracciato.py`, pubblicati anche in
  `public/documentazione/esempi/` per i collaudatori. Commit `f72cc67`.
- **Capitolo pratiche (backlog 10-13, 20, 24-27)** — script
  `17_pratiche.sql` (provato sul banco locale: permessi di Comune, Operatore
  e Admin, autore dei messaggi forzato dal database, errata corrige con e
  senza motivazione, notifiche e voci di audit; eseguito in produzione e
  verificato: 5 tabelle, 2 archivi, 3 funzioni, 10 trigger di notifica);
  Edge Function `consultazione-pubblica` (Verify JWT disattivato; provati
  elenco, dettaglio e invio con email di conferma a luca.moretti@operate.it).
  Portale: note di fase (`NoteFase`), messaggi (`Messaggi`), Ente di
  Validazione nell'intestazione della pratica, modelli per fase e generali,
  pagamenti in sola lettura per il Comune, avviso e niente «+ Carica» sulle
  pratiche non attive, consultazione rifatta (date gg/mm/aaaa, autori e
  allegati per lo staff, errata corrige, link alla pagina pubblica; tolto
  l'invio di osservazioni dal portale), pagine pubbliche `/consultazioni`
  con link dalla pagina di accesso, Impostazioni con Enti di Validazione e
  Modelli di documento. Decisioni A, B, D e pagamenti registrate. Commit
  `502e5ce`.
- **Manuale Test (test-user)** — richiesta di Luca: guida sintetica per
  chi collauda il portale senza conoscere il Programma (metodo CWP in breve,
  ruolo del portale, percorso di prova in 8 blocchi dalla fase 1 al calcolo
  dei crediti con i risultati attesi, limiti noti). Sorgente
  `docs/manuale-test.md`, file `public/documentazione/Manuale_Test_Portale_CWP.{docx,pdf}`,
  scaricabile da Documentazione e dal profilo (solo Admin). Rev. 1.0.
  Aggiunti al backlog i punti 31 (codice commentato) e 32.
- **Manuale Amministratore in Word e PDF** (richiesta di Luca) — terzo
  documento, riservato agli Amministratori: funzioni della Fondazione
  (back-office, utenti, audit, impostazioni, notifiche, documentazione,
  manutenzione) e capitolo dettagliato sul **calcolo dei crediti CWP**
  (concetti, preparazione dei dati dal tracciato, sette passi, lettura dei
  risultati, conferma e nuove versioni, scelte da confermare). Sorgente
  `docs/manuale-amministratore.md`, generato da `strumenti/genera_documenti.cjs`
  e `strumenti/impagina_pdf.py` (chiave `amministratore`), file in
  `public/documentazione/Manuale_Amministratore_Portale_CWP.{docx,pdf}`;
  scaricabile da Documentazione e dal profilo (solo Admin). Rev. 1.0.
- **Manuale Utente solo in PDF per gli utenti** (richiesta di Luca): il
  pulsante «Scarica Word» resta solo agli Amministratori; tolto il link Word
  da «Le mie pratiche».
- **Manuale anche in «I tuoi documenti»** — su segnalazione di Luca (prova come
  referente): riquadro «Manuale del portale» in fondo alla pagina
  `/documenti` (componente `ElencoDocumenti`). Manuale Utente Rev. 1.5.
- **Email di recupero password spedita dal portale** — le email di recupero
  arrivavano con il testo inglese predefinito di Supabase anche dopo aver
  salvato il modello italiano (tre prove, anche dopo il riavvio del servizio
  Auth). Soluzione: nuova Edge Function `recupera-password` (Verify JWT
  disattivato) che genera il collegamento di recupero e spedisce con Resend
  l'email in italiano con la grafica delle notifiche (oggetto «Portale
  Carbon WastePrint (CWP) — Richiesta di reimpostazione della password»,
  pulsante «Scegli una nuova password →»); script
  `16_recupero_password.sql` (limite di una richiesta ogni 2 minuti per
  indirizzo); `AuthContext.richiediRecuperoPassword` chiama la funzione
  invece di `resetPasswordForEmail` (commit 21306fb). Il modello italiano
  resta salvato in Supabase ma non è più usato dal portale. Prova in
  produzione: richiesta per luca.moretti@operate.it accettata, collegamento
  generato (`recovery_sent_at` aggiornato), email arrivata alle 14:04 in
  italiano con oggetto, testo e pulsante corretti (confermato da Luca).
- **Pagina «Il mio profilo»** (`/profilo`, collegamento sotto l'email in alto):
  dati dell'account, «Cambia password» e documenti da scaricare per il ruolo
  (Manuale Utente per tutti; Registro sviluppo e deploy solo per gli
  Amministratori); componente `ElencoDocumenti` condiviso con
  `/documentazione`. Su segnalazione di Luca, che cercava i PDF nel profilo.
- **Password: primo accesso, cambio, recupero, reimpostazione** — script
  `15_password.sql` (colonna `password_temporanea` sul profilo, funzione
  `password_cambiata`, protezione del flag); Edge Function
  `reimposta-password` (pubblicata dalla dashboard, Verify JWT attivo);
  pagina `CambiaPassword` (cambio obbligatorio dopo password temporanea,
  cambio volontario su `/password`, recupero su `/reimposta-password`),
  «Password dimenticata?» nella pagina di accesso, «Cambia password» sotto
  l'email in alto, «Reimposta password» in Gestione utenti; dopo l'accesso
  da un link email si torna alla pagina richiesta. Verificato: banco di
  prova locale (flag, protezione, audit) e controllo in produzione (2
  utenti esistenti non obbligati). Supabase Auth → URL Configuration:
  Site URL `https://portale-cwp.vercel.app` e Redirect URL
  `https://portale-cwp.vercel.app/**` impostati e verificati. SMTP
  personalizzato attivo (Resend: `smtp.resend.com`, porta 465, utente
  `resend`, chiave inserita da Luca; mittente provvisorio
  `onboarding@resend.dev`, nome «Portale CWP»). Email di recupero in italiano
  (Authentication → Emails → Templates → Reset password; copia in
  `supabase/email/reset-password.html`; oggetto «Portale Carbon WastePrint
  (CWP) — Richiesta di reimpostazione della password», testo che dichiara
  la provenienza dal portale). Prova: richieste di recupero per
  luca.moretti@operate.it accettate da Supabase (risposta 200) e
  consegnate; le prime due sono arrivate ancora con il testo inglese
  predefinito: Supabase applica un modello modificato solo dopo alcuni
  minuti. Dopo la
  verifica del dominio: cambiare il mittente SMTP con l'indirizzo del dominio.
- **PDF impaginati tipograficamente** (Manuale Utente e Registro): copertina
  a tutta pagina con loghi, scheda del documento e revisioni, sommario con
  pagine reali, aperture di capitolo numerate, passi numerati, riquadri
  «Da sapere / Attenzione / Suggerimento», schema delle 7 fasi, intestazioni
  correnti. Script `strumenti/impagina_pdf.py` (WeasyPrint), chiamato da
  `strumenti/genera_documenti.cjs`; il Word resta la versione modificabile.
- **Pagina Documentazione** (`/documentazione`): l'Amministratore scarica il
  Registro sviluppo e deploy e il Manuale Utente (Word e PDF, con revisione
  e data); Operatori e Clienti scaricano il Manuale Utente (voce di menu
  "Manuale"). Registro in Word/PDF con copertina, revisioni e sommario;
  generatore unico `strumenti/genera_documenti.cjs`, revisioni in
  `strumenti/revisioni_documenti.json`.
- **Manuale Utente in Word, Rev. 1.0** — copertina con loghi, registro delle
  revisioni, sommario con numeri di pagina, intestazione e piè di pagina;
  generato da `docs/manuale-utente.md` con
  `strumenti/genera_documenti.cjs` (revisioni in
  `strumenti/revisioni_documenti.json`); pubblicato in
  `public/manuali/` (.docx e .pdf) e collegato dalla pagina di accesso e da
  "Le mie pratiche". Verificato: rendering PDF di tutte le pagine.
- **Registro sviluppo e deploy** (questo documento) e **manuali** Utente e
  Amministratore (Claude Doc) creati ripercorrendo chat, repository e
  artefatti; README aggiornato. Commit `bfa9cb6`.
- **Tracciato dati standard CWP v1.0** — file Excel
  `public/modelli/Tracciato_dati_CWP_v1.xlsx` (istruzioni, anagrafica,
  rifiuti per EER, classi della delibera, Banca Dati Utenze come totali o
  singole letture, riuso, codici, regole privacy) e pagina pubblica
  `/formato-dati`; link dal login e dal menu Cliente; ZIP ammesso tra i
  formati (script 14 rieseguito). Commit `bfc929f`. Verificato: file
  scaricabile online.
- **Controlli sui file caricati** — script `14_controlli_file.sql`
  (bucket: 50 MB e tipi ammessi; trigger `documento_verifica_file`),
  `src/lib/file.js` (verifica dei primi byte, nomi file sicuri). Commit
  `7278f95`. Verificato: 12 casi nel banco di prova locale e test del
  modulo; bucket e trigger controllati in produzione.
- **Durata delle fasi modificabile dall'Amministratore** — script
  `13_durata_fasi.sql`, pagina `/impostazioni`. Commit `5daab31`.
  Verificato: banco di prova (permessi, motivazione, scadenza calcolata con
  la nuova durata, voce di audit); tabella controllata in produzione.
- Decisione: la regola "una sola utenza per Organizzazione" **non è
  vincolante**.

### 17 ottobre 2026 — pomeriggio e sera
- **Email: pulsante leggibile col tema scuro** e link di riserva —
  funzione `invia-email-notifica` ripubblicata. Commit `027efe1`.
  Verificato: seconda email di prova inviata (`inviata: true`).
- **Resend attivato** — Luca ha inserito `RESEND_API_KEY` nei Secrets;
  prima email di prova ricevuta da luca.moretti@operate.it.
- **Notifiche via email** — script `12_email_notifiche.sql` (trigger +
  pg_net + cron `cwp_riprova_email`), funzione `invia-email-notifica`
  (Verify JWT disattivato), funzione `crea-utente` ripubblicata con il
  controllo `sono_admin`, `docs/email-notifiche.md`. Commit `48e78e0`.
- **Loghi** — logo Carbon WastePrint raddoppiato, loghi RINA e Carbon
  Credit sotto Fondazione Operate, Fondazione +30%. Commit `5976062`,
  `f85e7d3`, `311e037`.
- **Sezione Crediti CWP** (solo Admin) — script `11_crediti.sql`, motore
  `src/lib/crediti/`, pagine `/crediti`, `/crediti/:id`,
  `docs/crediti-cwp.md` (scelte interpretative da confermare). Commit
  `8cf4ef2`. Verificato: test automatici e confronto con calcolo a mano.
- **MFA per lo staff e protezione del profilo** — script
  `10_mfa_profilo.sql` (corretta una falla che permetteva a un utente di
  modificare il proprio ruolo), pagina `VerificaMfa`, export fascicolo ZIP.
  MFA lasciata spenta. Commit `324a1bf`.
- **Cruscotto, rapporti annuali, pagamenti, I tuoi documenti, notifiche
  interne, audit** — script `09_cruscotto_pagamenti_notifiche.sql`. Commit
  `8c82a66`.
- **Integrazioni e azioni del back-office con motivazione** — script
  `08_integrazioni_azioni.sql`. Commit `cf10703`.
- **Correzioni dall'analisi dei requisiti** — script
  `07_correzioni_sicurezza.sql` (audit nel database, versioni dei documenti,
  commenti, file visibili solo se il documento è visibile; rimosso il modulo
  dati tecnici del prototipo). Commit `8af1ced`. Documento di progetto
  `claude/analisi-requisiti-vs-portale.md`.
- **Utente associato a più organizzazioni** — script
  `06_utente_multi_org.sql` eseguito; pagina Gestione utenti aggiornata.
  Commit `512df3e`, `35d5b3f`.

### 17 ottobre 2026 — mattina (chat "Sviluppo portale Carbon WastePrint")
- Repository `lucamorettioperate/portale-cwp` creato e collegato;
  impalcatura React + Vite; prototipo portato dentro il progetto.
- Pubblicazione su **Vercel** (portale-cwp.vercel.app); repository reso
  pubblico per superare il limite del piano Hobby; variabili Supabase
  configurate in Vercel.
- **Documento di progetto** (Claude Doc) scritto e poi riallineato
  all'analisi funzionale: 7 fasi, RINA come anagrafica, Rapporti di
  Monitoraggio come pratiche autonome.
- **Supabase**: script 01-05 eseguiti (schema, sicurezza, dati di esempio,
  storage, gestione utenti); login email+password funzionante con l'utente
  amministratore di Luca.
- Back-office con fasi e audit, Area Cliente, documenti versionati per fase,
  consultazione pubblica con moderazione, gestione utenti con funzione
  `crea-utente` (pubblicata dall'editor web di Supabase), loghi nel portale.
- Nota: lo storico Git di questa giornata è stato riscritto durante il
  tentativo di risolvere il blocco di Vercel; il commit `512df3e` contiene
  l'intero lavoro della mattina.

### Prima di ottobre 2026 — prototipo
- Prototipo dimostrativo in React (artifact `portale-cwp.jsx`, poi file
  HTML autonomo `portale-cwp.html`) con le 6 fasi pubblicate su
  carbonwasteprint.com, viste per ruolo e progetti di esempio. Superato
  dall'analisi funzionale del 15/09/2026.

---

## 10. Artefatti e documenti

| Artefatto | Dove | Contenuto |
|---|---|---|
| Portale CWP — Documento di progetto | Claude Doc: https://claude.ai/artifact/L9duSXhNfKejbz6RKXDQQv | Obiettivi, attori, fasi, architettura, piano di lavoro (17/10) |
| Analisi requisiti vs portale | Progetto claude.ai: `claude/analisi-requisiti-vs-portale.md` | Stato per modulo, decisioni prese e aperte |
| Registro sviluppo e deploy | `docs/REGISTRO_DEV_DEPLOY.md` + Progetto: `claude/registro-dev-deploy.md` | Questo documento |
| Manuale Utente (Comuni) | Claude Doc: https://claude.ai/code/artifact/e2dd2bd5-8042-4744-8d5a-54d34dc50153 (creato 18/10) | Prima stesura online, **superata** dal 18/10 (ferma alla Rev. 1.4, con avviso in testa): fa fede il Word/PDF generato da `docs/manuale-utente.md` |
| Manuale Utente in Word/PDF (Rev. 1.0) | `public/manuali/Manuale_Utente_Portale_CWP.docx` e `.pdf`, online su `/manuali/…` | Versione rifinita e stampabile per i Comuni |
| Registro sviluppo e deploy in Word/PDF | `public/documentazione/Registro_Dev_Deploy_Portale_CWP.docx` e `.pdf`, scaricabile da `/documentazione` (Admin) | Versione impaginata di questo registro |
| Manuale Amministratore in Word/PDF | `docs/manuale-amministratore.md` → `public/documentazione/Manuale_Amministratore_Portale_CWP.docx` e `.pdf`, scaricabile da `/documentazione` (Admin) | Versione impaginata e riservata del manuale per la Fondazione |
| Manuale Amministratore online | Claude Doc: https://claude.ai/code/artifact/cc36ab09-61e6-4dad-aaf0-4082ea0a46da (creato 18/10) | Prima stesura online, **superata** dal 18/10 (avviso in testa): fa fede il Word/PDF generato da `docs/manuale-amministratore.md` |
| Tracciato dati CWP v1.0 | `public/modelli/Tracciato_dati_CWP_v1.xlsx`, online su `/formato-dati` | Modello unico dei dati per il calcolo crediti |
| Note sul calcolo crediti | `docs/crediti-cwp.md` | Corrispondenza con le formule, scelte interpretative |
| Notifiche email | `docs/email-notifiche.md` | Funzionamento e configurazione Resend |
| Controlli sui file | `docs/controlli-file.md` | Regole di caricamento, opzioni antivirus |
| Crediti volontari dalla raccolta differenziata: valore e criticità | https://claude.ai/artifact/CLvQ82y6UwHznZBUujHy9J (15/10) | Analisi di contesto correlata al Programma |
| Documenti di riferimento | allegati in chat del 17/10 | *Requisiti della piattaforma* (15/09/2026), *Metodologia CWP v1.2* |

---

## 11. Decisioni

**Prese**
- 17/10 — Stack: GitHub + Vercel + Supabase; login email+password; MFA per
  lo staff prevista.
- 17/10 — Repository pubblico (solo codice) per il piano gratuito Vercel.
- 17/10 — Sezione calcolo crediti riservata agli Amministratori (fuori dal
  perimetro della piattaforma secondo i requisiti, aggiunta su richiesta).
- 17/10 — MFA: in attesa, interruttore spento.
- 18/10 — Una sola utenza per Organizzazione: non vincolante.
- 18/10 — Durata delle fasi modificabile dall'Amministratore.
- 18/10 — Antivirus necessario (possibili dati sensibili), da affrontare a
  fine progetto.
- 18/10 — Formato dati: standard unico definito dalla Fondazione (tracciato
  v1.0), con ZIP ammesso per i dati voluminosi.
- 18/10 — **Vercel e Supabase passeranno a piani a pagamento** (decisione di
  Luca). Conseguenze previste, da verificare al momento dell'attivazione:
  repository GitHub di nuovo privato (il piano gratuito di Vercel lo
  impedisce), nessuna pausa del database per inattività, backup automatici
  giornalieri di Supabase, limite per file caricato aumentabile oltre 50 MB.

- 18/10 — **A**: una nuova versione di un documento durante una fase **non**
  fa ripartire il termine (resta la modifica manuale della scadenza).
- 18/10 — **B**: con un'errata corrige in consultazione decide lo staff, caso
  per caso e con motivazione, se far ripartire i 30 giorni.
- 18/10 — **D**: chi commenta dall'esterno conferma la propria email; nome ed
  email li vede solo lo staff; il nome è pubblicato solo se l'autore lo sceglie.
- 18/10 — Pagamenti visibili al Comune in sola lettura.

**Aperte**
- Scelte interpretative del calcolo crediti (soprattutto il segno del riuso,
  formule 26 e 29).
- Antivirus: ClamAV su server proprio o servizio a pagamento.

---

## 12. Backlog per chiudere lo sviluppo

Numerazione stabile: un punto mantiene il suo numero anche quando è
completato (va barrato qui e annotato in Cronologia).

**Calcolo crediti (back-office)**

- ~~**1.** Import diretto del tracciato dati (Excel/ZIP) nel calcolo~~ — fatto il 18/10.
- ~~**2.** Aggregazione automatica delle singole letture (foglio 6_Letture)~~ — fatto il 18/10.
- ~~**3.** Controllo privacy all'import~~ — fatto il 18/10 (blocco dell'import).
- ~~**4.** Scelta del file direttamente dalla pratica del Comune~~ — fatto il 18/10.
- ~~**5.** Controlli di coerenza (classi, totali, valori anomali)~~ — fatto il 18/10.
- ~~**6.** Rapporto di calcolo in PDF~~ — fatto il 18/10.
- **7.** Registro dei crediti calcolati e confermati — base fatta il 18/10 (numero di registro, stato valido/sostituito, totali); da completare con le regole di *Guida al Programma* e *Standard CWP* (emissione, trasferimento, annullamento).
- **8.** Collaudo con dati reali di un Comune.
- **9.** Conferma delle scelte interpretative.

**Pratiche**

- ~~**10.** Note di fase~~ — fatto il 18/10 (script 17).
- ~~**11.** Schermata Enti di Validazione~~ — fatto il 18/10 (Impostazioni).
- ~~**12.** Template di documenti scaricabili dai Comuni~~ — fatto il 18/10 (Impostazioni → Modelli).
- ~~**13.** Consultazione: errata corrige, allegati ai commenti, identificazione dei commentatori esterni~~ — fatto il 18/10 (pagina pubblica, funzione `consultazione-pubblica`).

**Sicurezza**

- **14.** Registro di sicurezza (accessi, tentativi falliti, cambi di permessi).
- **15.** Attivazione della verifica in due passaggi (MFA).
- **16.** Antivirus sui file caricati (a fine progetto).
- **17.** Verifica del dominio email su Resend.
- **18.** Ambiente di prova, backup e procedura di ripristino.

**Chiusura**

- **19.** Collaudo completo e pulizia dei dati di test (comprese le notifiche "Email di prova").
- ~~**20.** Decisioni A e B della Fondazione~~ — prese il 18/10 (capitolo Decisioni).

**Rifiniture emerse dalla stesura del Manuale Utente (18/10)**

- ~~**22.** Recupero e cambio password per gli utenti~~ — fatto il 18/10 (resta la configurazione di Site URL, Redirect URLs e SMTP in Supabase per l'email di recupero).
- ~~**23.** Dopo l'accesso da un link email, riportare l'utente alla pratica del link~~ — fatto il 18/10.
- ~~**24.** Pratica non attiva: spiegare perché i pulsanti di risposta alle integrazioni non compaiono e nascondere "+ Carica"~~ — fatto il 18/10.
- ~~**25.** Date della consultazione in formato gg/mm/aaaa~~ — fatto il 18/10.
- ~~**26.** Canale di messaggi tra Comune e Fondazione nella pratica~~ — fatto il 18/10 (sezione Messaggi).
- ~~**27.** Mostrare ai Comuni le voci di pagamento~~ — fatto il 18/10 (sola lettura).
- **28.** Riservatezza della documentazione: il registro è nel repository pubblico e i suoi file Word/PDF sono raggiungibili da chi conosce l'indirizzo (il portale li mostra solo agli Amministratori). Per renderli davvero riservati: archivio privato su Supabase con accesso solo Admin, o repository privato (oggi incompatibile con il piano gratuito di Vercel).

**Infrastruttura**

- **29.** Passaggio a piani a pagamento di **Vercel** e **Supabase** (decisione del 18/10). Dopo l'attivazione: rendere privato il repository GitHub e ricollegarlo a Vercel (risolve in buona parte il punto 28); verificare i backup automatici di Supabase e scrivere la procedura di ripristino (punto 18); valutare l'ambiente di prova separato (punto 18); decidere se alzare il limite di 50 MB per file; aggiornare i §2-3 di questo registro con piani, costi e intestatario dei contratti.

**Sicurezza informatica (cyber security) — richiesta di Luca del 18/10**

- **30.** Protezione dagli attacchi informatici, in un piano unico che riprende anche i punti 14-18. Da fare:
    - **Verifica di sicurezza** del portale secondo le linee OWASP (accessi, permessi, caricamento file, iniezioni) e controllo automatico delle regole del database con il *Security Advisor* di Supabase; a fine sviluppo, test di intrusione (penetration test) affidato a terzi.
    - **Intestazioni di sicurezza** del sito (Content-Security-Policy, HSTS, protezione dal clickjacking, nessun riferimento esterno non necessario) configurate su Vercel.
    - **Protezione degli accessi**: limiti ai tentativi di login e di recupero password, CAPTCHA sulle pagine pubbliche, verifica in due passaggi per lo staff (punto 15), regole sulle password, scadenza delle sessioni inattive.
    - **Dipendenze e segreti**: controllo periodico delle librerie vulnerabili (npm audit, avvisi automatici di GitHub), scansione dei segreti nel repository, rotazione delle chiavi. `npm audit` del 18/10 segnala due avvisi moderati da risolvere con aggiornamenti maggiori: esbuild/vite (solo server di sviluppo, non il portale pubblicato) e react-router 6 (open redirect: aggiornare a react-router 7).
    - **Monitoraggio e allarmi**: registro di sicurezza (punto 14), avvisi su accessi anomali, errori e indisponibilità del portale.
    - **Continuità**: backup verificati e prova di ripristino (punti 18 e 29), antivirus sui file (punto 16).
    - **Organizzazione e privacy**: procedura di risposta agli incidenti, valutazione d'impatto sulla protezione dei dati (DPIA) e registro dei trattamenti per i dati delle utenze, nomina dei fornitori (Vercel, Supabase, Resend) come responsabili del trattamento.

**Codice e documentazione — richieste di Luca del 18/10**

- **31.** Codice sorgente commentato per sviluppatori umani: ogni file (portale, script SQL, Edge Functions, strumenti) deve avere in testa lo scopo e il collegamento al capitolo del registro, e commenti in italiano su funzioni, regole di sicurezza e passaggi non ovvi. Vale anche per tutto il codice nuovo. Da completare con una revisione file per file.
- **32.** Manuale Test (test-user): guida sintetica per i collaudatori, riservata agli Amministratori, da aggiornare a ogni rilascio insieme a registro, Manuale Utente e Manuale Amministratore.

- **33.** Pulizia del codice emersa dalla revisione del 18/10: creazione del Progetto e delle sue 7 fasi in un'unica funzione del database (oggi due inserimenti: se il secondo fallisce la pratica resta senza fasi); eliminare i componenti del prototipo non usati (`Timeline`, `AzioniRuolo`, `ProjectCard`, `Stat`, `Pill`) e lo stile `avviso`.

**Da rifinire**

- **21.** Agente AI (Claude) integrato nel portale — richiesto da Luca il 18/10. Ambito da definire; usi possibili: assistente per gli utenti dei Comuni (come compilare, cosa manca nella pratica), supporto agli Operatori (controllo completezza dei documenti, bozze di richieste di integrazione e di risposte ai commenti), verifica del tracciato dati prima dell'import, spiegazione dei risultati del calcolo crediti. Richiede: chiave API Anthropic (segreto in Supabase), una Edge Function che faccia da tramite, regole su quali dati l'agente può leggere (privacy) e registrazione delle sue azioni nell'audit.

---

## 13. Problemi incontrati e soluzioni

| Problema | Soluzione |
|---|---|
| Vercel non pubblicava ("Hobby teams do not support collaboration") | Non dipende dai coautori dei commit ma dalla visibilità: repository reso pubblico |
| Un utente poteva modificare il proprio ruolo dal profilo | Corretto con `10_mfa_profilo.sql` (solo il nome è modificabile) |
| Regole multi-organizzazione incomplete nello script 06 | Corrette con la funzione `app_org_mia` |
| La procedura guidata dei Database Webhook di Supabase selezionava la tabella sbagliata | Annullata senza creare nulla; webhook realizzato via SQL (script 12) |
| Email con pulsante invisibile nel tema scuro dei client di posta | Pulsante "a prova di tema scuro" e link testuale di riserva |
| Mittente di prova Resend consegna solo al titolare | Verifica del dominio da completare |
| Site URL di Supabase Auth ancora `http://localhost:3000` e nessun Redirect URL: i link delle email di Supabase (recupero password) non funzionavano | Impostati il 18/10 (autorizzazione di Luca): Site URL `https://portale-cwp.vercel.app`, Redirect URL `https://portale-cwp.vercel.app/**` |
| Il servizio email predefinito di Supabase Auth consegna solo ai membri del progetto | SMTP personalizzato con Resend attivato il 18/10 (Authentication → Emails → SMTP Settings); limite 30 email di autenticazione all'ora, modificabile in Rate Limits |

---

## 14. Codice sorgente

Questo capitolo descrive tutto il codice del portale per chi deve
intervenire a mano. Ogni file ha in testa un'intestazione in italiano
(scopo, chi lo usa, dati coinvolti, sicurezza, capitolo di questo
registro) e commenti sopra ogni funzione e sui passaggi non ovvi (regola
del punto 31). L'inventario in fondo al capitolo si rigenera con
`python3 strumenti/inventario_codice.py`.

### 14.1 Struttura delle cartelle

```
portale-cwp/
├── index.html, vite.config.js, package.json   avvio e configurazione di Vite
├── vercel.json                                 instradamento del sito su Vercel
├── src/
│   ├── main.jsx, App.jsx                       avvio di React e pagine (route)
│   ├── pages/                                  una pagina per indirizzo del portale
│   ├── components/                             parti riusate dalle pagine
│   │   ├── crediti/                            tabelle, import del tracciato, registro
│   │   └── impostazioni/                       Enti di Validazione, modelli di documento
│   └── lib/                                    accesso ai dati, autenticazione, utilità
│       └── crediti/                            motore di calcolo, parametri, tracciato, PDF
├── supabase/
│   ├── 01_…18_*.sql                            script del database, da eseguire in ordine
│   ├── functions/<nome>/index.ts               Edge Functions (Deno)
│   └── email/                                  modello dell'email di recupero (copia)
├── public/                                     file serviti così come sono
│   ├── loghi/, modelli/ (tracciato Excel)
│   ├── manuali/ (Manuale Utente)
│   └── documentazione/ (manuali riservati, registro, esempi)
├── docs/                                       testi sorgente di manuali e registro
├── strumenti/                                  generatori di documenti, tracciato, inventario
└── test/                                       prove automatiche (npm test) e file di esempio
```

### 14.2 Convenzioni
- **Lingua**: nomi, commenti e messaggi in italiano (`caricaDocumento`,
  `pratica_mia`). I testi per gli utenti non usano gergo tecnico.
- **Accesso ai dati**: le funzioni di `src/lib/dati.js` restituiscono
  sempre `{ data, error }` come il client Supabase; le pagine mostrano
  `error.message`. Gli errori del database sono scritti in italiano dalle
  funzioni SQL (`raise exception '…'`).
- **Regole nel database**: ogni controllo che conta (permessi, stato della
  pratica, motivazioni) è nel database; l'interfaccia lo ripete solo per
  dare messaggi chiari.
- **Stili**: in linea negli oggetti `style`, colori da `COLORI` in
  `src/lib/cwpProgram.js`; quelli condivisi in `src/components/stili.js`.
  Nessuna libreria grafica esterna.
- **Date**: nel database in ISO (`aaaa-mm-gg`), a video con `formatoData`
  (`src/lib/date.js`) in `gg/mm/aaaa`.
- **Script SQL**: numerati, rieseguibili (`create … if not exists`,
  `create or replace`, `drop policy if exists`), con intestazione che dice
  dopo quale script eseguirli.
- **Commenti**: intestazione obbligatoria per ogni file nuovo; niente
  commenti `/*! … */` (finirebbero nel sito pubblicato).

### 14.3 Mappa delle dipendenze

```
main.jsx → App.jsx (route, Protetta: accesso, password temporanea, MFA)
   ├── pages/* ──────────────┐
   │     └── components/* ───┤
   │                         ▼
   │                  lib/dati.js ── lib/crediti/archivio.js ──▶ Supabase (tabelle, RPC, Storage, Edge Functions)
   │                  lib/AuthContext.jsx ─────────────────────▶ Supabase Auth
   │                  lib/file.js, lib/csv.js, lib/date.js, lib/password.js, lib/cwpProgram.js
   └── pages/CalcoloCrediti.jsx ── lib/crediti/calcolo.js (motore), parametri.js,
                                   tracciato.js (import), rapportoPdf.js (jsPDF, caricato a richiesta)
```

### 14.4 Funzioni del database chiamate dal portale (RPC)

| Funzione | Script | Chi | Cosa fa |
|---|---|---|---|
| `staff_cruscotto` | 09 | staff | Una riga per pratica con fase corrente, scadenza, cose da fare |
| `staff_apri_fase`, `staff_chiudi_fase` | 08 | staff | Apertura (scadenza dalla durata della fase) e chiusura delle fasi |
| `staff_modifica_scadenza` | 08 | staff | Nuova scadenza con motivazione |
| `staff_cambia_stato_pratica` | 08 | staff | Attiva / sospesa / annullata / chiusa con motivazione |
| `staff_richiedi_integrazione`, `staff_chiudi_integrazione` | 08 | staff | Ciclo delle integrazioni |
| `cliente_rispondi_integrazione` | 08 | Comune | Risposta con documento |
| `rispondi_commento` | 07 | Comune | Risposta a un'osservazione ammessa |
| `staff_autori_commenti` | 17 | staff | Nome ed email degli autori delle osservazioni |
| `staff_errata_corrige` | 17 | staff | Errata corrige, eventuale ripartenza dei 30 giorni |
| `staff_imposta_ente_validazione` | 17 | staff | Ente di Validazione della pratica |
| `admin_elenco_utenti`, `admin_aggiorna_utente`, `admin_imposta_organizzazioni`, `admin_imposta_attivo` | 05, 06, 10 | admin | Gestione utenti |
| `admin_imposta_durata_fase` | 13 | admin | Durata delle fasi con motivazione |
| `admin_registro_crediti` | 18 | admin | Registro dei crediti (valido / sostituito) |
| `mio_stato_mfa`, `sono_admin` | 10 | tutti | Stato della verifica in due passaggi, controllo Admin per le Edge Functions |
| `password_cambiata` | 15 | tutti | Toglie l'obbligo di cambio password e scrive l'audit |

### 14.5 Tabelle e archivi

| Tabella | Script | Contenuto |
|---|---|---|
| `organizzazione`, `utente_organizzazione`, `profilo` | 01, 06 | Comuni ed enti, utenti, associazioni utente-organizzazione |
| `pratica`, `fase`, `durata_fase` | 01, 13 | Progetti e Rapporti, 7 fasi, durate |
| `documento` | 01 (07, 14) | Documenti con versioni, visibilità, impronta |
| `richiesta_integrazione` | 01 (08) | Integrazioni |
| `nota_fase`, `messaggio` | 17 | Note di fase, messaggi Comune-Fondazione |
| `consultazione`, `commento`, `commento_in_attesa`, `consultazione_errata` | 01, 17 | Consultazione pubblica |
| `pagamento` | 01 (09, 17) | Voci di pagamento e incassi |
| `ente_validazione`, `modello_documento` | 01, 17 | Anagrafica enti, modelli per i Comuni |
| `notifica` | 09 | Notifiche interne (e stato dell'email) |
| `audit_event` | 01 (07) | Registro delle operazioni, immutabile |
| `impostazione` | 10 | Interruttori (MFA, indirizzo della funzione email) |
| `calcolo_crediti`, `calcolo_conferimento`, `calcolo_riuso`, `contatore_registro` | 11, 18 | Calcoli dei crediti, Banca Dati Utenze, numerazione del registro |
| `recupero_password_richiesta` | 16 | Limite alle richieste di recupero password |

Archivi (Storage, tutti privati): `documenti` (file delle pratiche,
cartella = id della pratica), `modelli` (modelli per i Comuni),
`allegati-consultazione` (allegati alle osservazioni, scritti solo dalla
funzione `consultazione-pubblica`).

### 14.6 Librerie esterne (package.json)

| Libreria | Versione | Uso |
|---|---|---|
| `react`, `react-dom` | 18.3 | Interfaccia |
| `react-router-dom` | 6.26 | Indirizzi delle pagine (aggiornamento a 7 nel punto 30) |
| `@supabase/supabase-js` | 2.45 | Collegamento a Supabase (dati, accesso, archivi, funzioni) |
| `jszip` | 3.10 | Lettura del tracciato Excel/ZIP, export del fascicolo |
| `jspdf`, `jspdf-autotable` | 4.2 / 5.0 | Rapporto di calcolo in PDF |
| `vite`, `@vitejs/plugin-react` | 5.4 / 4.3 | Compilazione e server di sviluppo |

Strumenti (non nel sito): Python 3 con `openpyxl` (tracciato), `weasyprint`
e `Pillow` (PDF dei documenti); Node con `docx` (Word dei documenti);
LibreOffice (numeri di pagina del Word).

### 14.7 Come si aggiunge una funzione (procedura per sviluppatori)
1. **Database**: nuovo script `supabase/NN_nome.sql` rieseguibile, con
   intestazione; tabelle con RLS attiva e policy; azioni sensibili come
   funzioni `security definer` che controllano ruolo e stato; trigger di
   audit (`audit_registra`) e, se serve, di notifica (`notifiche_eventi`).
   Prova sul banco locale (Postgres con stub di Supabase), poi esecuzione
   nel SQL Editor.
2. **Accesso ai dati**: nuove funzioni in `src/lib/dati.js` (con commento
   su tabella/RPC e script).
3. **Interfaccia**: componente in `src/components/` o pagina in
   `src/pages/` (route in `src/App.jsx`, voce di menu in
   `components/Header.jsx`), con intestazione.
4. **Prove**: `npm run build`, `npm test`; per le funzioni pure aggiungere
   un test in `test/`.
5. **Rilascio**: prima il database, poi il portale (capitolo 8).
6. **Documenti**: aggiornare insieme registro, Manuale Utente, Manuale
   Amministratore e Manuale Test; `python3 strumenti/inventario_codice.py`;
   nuova revisione in `strumenti/revisioni_documenti.json`;
   `node strumenti/genera_documenti.cjs`.

### 14.8 Inventario dei file

<!-- INVENTARIO-INIZIO -->
Inventario generato da `strumenti/inventario_codice.py`: 90 file, 17.090 righe in tutto.

**Avvio e instradamento**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/App.jsx` | 204 | associa ogni indirizzo alla sua pagina e decide chi può aprirla. Le pagine riservate passano dal componente Protetta, che nell'ordine chiede: sessione attiva, eventuale nuova password (link di recupero o password temporanea),… |
| `src/main.jsx` | 32 | monta l'applicazione nell'elemento #root di index.html e la avvolge nei contesti globali: StrictMode (controlli di React in sviluppo), BrowserRouter (indirizzi /pratiche, /crediti, …) e AuthProvider (sessione, ruolo, MFA).… |

**Pagine (src/pages)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/pages/AreaCliente.jsx` | 138 | il Comune/azienda vede l'elenco dei propri Progetti (schede compatte con stato) e, sotto, il dettaglio della pratica selezionata: fasi, documenti, integrazioni, messaggi. Link al Manuale Utente in PDF. |
| `src/pages/Audit.jsx` | 143 | tabella degli eventi registrati (data, utente, operazione, pratica, passaggio di stato, motivazione), con ricerca testuale e pulsante per caricare eventi meno recenti (requisiti §10). |
| `src/pages/BackOffice.jsx` | 221 | a sinistra l'elenco dei Progetti (con ricerca oltre 4 voci), a destra il dettaglio della pratica scelta con le 7 fasi, documenti, integrazioni, consultazione, pagamenti, rapporti. Pulsante «+ Nuovo progetto» per registrare un… |
| `src/pages/CalcoloCrediti.jsx` | 1134 | Editor di un calcolo dei crediti (Metodologia CWP v1.2). |
| `src/pages/CambiaPassword.jsx` | 163 | scegliere una nuova password, con le regole di src/lib/password.js. - "obbligatorio": primo accesso con password temporanea (o reimpostata dall'Amministratore): finché non la cambia l'utente non entra; - "volontario": l'utente… |
| `src/pages/ConsultazioniPubbliche.jsx` | 266 | ---------- Elenco ---------- |
| `src/pages/Crediti.jsx` | 196 | Crediti CWP — sezione riservata agli Amministratori. |
| `src/pages/Cruscotto.jsx` | 231 | Una pratica è "in scadenza" se la fase aperta scade entro questi giorni. |
| `src/pages/Documentazione.jsx` | 110 | Documentazione scaricabile. |
| `src/pages/FormatoDati.jsx` | 113 | Pagina pubblica: standard dei dati da inviare per il calcolo dei crediti. |
| `src/pages/GestioneUtenti.jsx` | 544 | Gestione utenti — solo Admin. |
| `src/pages/Impostazioni.jsx` | 211 | Impostazioni del Programma — solo Amministratori. Tre sezioni: |
| `src/pages/Login.jsx` | 224 | Pagina di accesso — email e password. |
| `src/pages/Profilo.jsx` | 66 | mostra i dati dell'account (nome, email di accesso, ruolo), il collegamento al cambio password («/password») e i documenti da scaricare per il proprio ruolo: Manuale Utente per tutti; Manuale Amministratore e Registro sviluppo e… |
| `src/pages/TuoiDocumenti.jsx` | 141 | "I tuoi documenti" (requisiti §5): contratto, allegati, documentazione |
| `src/pages/VerificaMfa.jsx` | 162 | (requisiti §13) - primo accesso: attivazione con QR code da inquadrare con un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy…), con chiave da inserire a mano in alternativa; - accessi successivi:… |

**Componenti (src/components)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/components/AzioniRuolo.jsx` | 83 | pulsanti di azione del prototipo, diversi per ruolo (promotore, operate, validatore), con il pulsante «avanza fase» attivo solo quando tocca a quel ruolo. |
| `src/components/Badge.jsx` | 37 | etichetta colorata compatta per mostrare uno stato (pratica, fase, documento, pagamento, calcolo…). Solo grafica. |
| `src/components/Consultazione.jsx` | 317 | Consultazione pubblica (fase 3, requisiti §6). |
| `src/components/DettaglioPratica.jsx` | 559 | Dettaglio di una pratica con le sue 7 fasi. |
| `src/components/Documenti.jsx` | 243 | Gestione documentale: elenco versionato e upload. |
| `src/components/Header.jsx` | 154 | intestazione in cima a ogni pagina riservata. A sinistra i loghi (Carbon WastePrint, Fondazione Operate, RINA, Carbon Credit) con collegamento alla pagina iniziale; a destra, se l'utente ha fatto l'accesso: menu per ruolo,… |
| `src/components/Integrazioni.jsx` | 224 | Richieste di integrazione di una fase (requisiti §4). |
| `src/components/Messaggi.jsx` | 106 | Messaggi tra Comune e Fondazione dentro la pratica (backlog 26). |
| `src/components/NoteFase.jsx` | 87 | Note di fase (backlog 10). |
| `src/components/Notifiche.jsx` | 177 | campanella delle notifiche interne (requisiti §9) nell'intestazione. Mostra il numero delle non lette, apre un elenco a tendina delle ultime 50 notifiche, segna come lette e porta alla pratica collegata. |
| `src/components/NuovoProgetto.jsx` | 226 | Finestra per creare un nuovo progetto. |
| `src/components/Pagamenti.jsx` | 184 | Pagamenti (requisiti §7): nessun incasso online. Il back-office censisce |
| `src/components/Pill.jsx` | 32 | etichetta colorata compatta, a forma di pillola. |
| `src/components/ProjectCard.jsx` | 63 | scheda di una pratica nella lista laterale del prototipo (nome, stato, codice, barra di avanzamento in giorni su 150). |
| `src/components/Rapporti.jsx` | 95 | Rapporti di Monitoraggio annuali di un Progetto (requisiti §2): |
| `src/components/Stat.jsx` | 47 | riquadro con un dato numerico in evidenza (etichetta, valore, unità di misura facoltativa). |
| `src/components/Timeline.jsx` | 105 | linea del tempo orizzontale delle fasi di una pratica, con la barra di avanzamento in giorni e il responsabile di ogni fase. |
| `src/components/crediti/ImportaTracciato.jsx` | 232 | — |
| `src/components/crediti/RegistroCrediti.jsx` | 136 | — |
| `src/components/crediti/TabellaDati.jsx` | 161 | Tabella di dati modificabile in pagina, con importazione da CSV (anche |
| `src/components/impostazioni/EntiValidazione.jsx` | 107 | Anagrafica degli Enti di Validazione (backlog 11) — Impostazioni, solo |
| `src/components/impostazioni/ModelliDocumento.jsx` | 121 | Modelli di documento (backlog 12) — Impostazioni, solo Amministratori. |
| `src/components/stili.js` | 96 | oggetti di stile in linea condivisi dai componenti delle pratiche e delle impostazioni (stessa grafica del resto del portale: carta, verde Fondazione, bordi sottili) e la funzione dataOra per mostrare data e ora in formato… |

**Librerie (src/lib)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/lib/AuthContext.jsx` | 189 | tiene in memoria la sessione Supabase Auth, il profilo applicativo (ruolo, organizzazione, flag password temporanea) e lo stato MFA. Espone le funzioni accedi, esci, richiediRecuperoPassword, cambiaPassword e caricaMfa. Ogni… |
| `src/lib/crediti/archivio.js` | 191 | Lettura e salvataggio dei calcoli dei crediti (tabelle dello script 11). |
| `src/lib/crediti/calcolo.js` | 362 | — |
| `src/lib/crediti/parametri.js` | 63 | Tipologie di rifiuto "r" con il fattore di emissione per lo scenario |
| `src/lib/crediti/rapportoPdf.js` | 309 | I caratteri standard del PDF non hanno i pedici: CO₂ → CO2, ≤ → <=. |
| `src/lib/crediti/tracciato.js` | 561 | "Peso strutture informatizzate (kg)" → "pesostruttureinformatizzatekg" |
| `src/lib/csv.js` | 117 | Lettura e scrittura di file CSV (anche salvati da Excel in italiano, |
| `src/lib/cwpProgram.js` | 84 | Le 7 fasi operative ufficiali (intervalli di giorni dall'infografica). |
| `src/lib/date.js` | 50 | formattare le date del database (gg/mm/aaaa), contare i giorni alle scadenze e ottenere la data di oggi in formato ISO. |
| `src/lib/dati.js` | 609 | ---- Organizzazioni ---- |
| `src/lib/datiEsempio.js` | 71 | tre progetti fittizi a stadi diversi di avanzamento. Servivano finché il backend Supabase non era attivo; oggi le pratiche reali si leggono dal database (src/lib/dati.js). |
| `src/lib/fascicolo.js` | 222 | CSV con separatore ";" (si apre direttamente in Excel in italiano). |
| `src/lib/file.js` | 117 | Estensione → tipo MIME canonico e famiglia di contenuto attesa. |
| `src/lib/password.js` | 70 | controllo delle regole della password prima dell'invio, generazione della password temporanea assegnata dall'Amministratore, traduzione in italiano degli errori di Supabase Auth. |
| `src/lib/stato.js` | 30 | restituisce i colori di sfondo e testo per gli stati usati dai dati di esempio ("Validato", "In istruttoria", "Adesione"). Le pratiche reali usano invece STATI_PRATICA e STATI_FASE di cwpProgram.js. |
| `src/lib/supabase.js` | 37 | crea l'unico client @supabase/supabase-js usato dal portale (database, Auth, Storage, Edge Functions). Legge URL e chiave dalle variabili d'ambiente (file .env in locale, mai pubblicato; in produzione le variabili del progetto… |

**Database: script SQL (supabase)**

| File | Righe | Cosa contiene |
|---|---|---|
| `supabase/01_schema.sql` | 256 | PORTALE CARBON WASTEPRINT — Schema del database (Supabase / PostgreSQL) |
| `supabase/02_sicurezza.sql` | 178 | PORTALE CARBON WASTEPRINT — Sicurezza (RLS) e automatismi |
| `supabase/03_dati_esempio.sql` | 48 | DATI DI ESEMPIO per il collaudo del back-office. |
| `supabase/04_storage.sql` | 55 | STORAGE — archivio dei documenti delle pratiche. |
| `supabase/05_gestione_utenti.sql` | 63 | GESTIONE UTENTI (Admin) |
| `supabase/06_utente_multi_org.sql` | 125 | ASSOCIAZIONE UTENTE ↔ PIÙ ORGANIZZAZIONI |
| `supabase/07_correzioni_sicurezza.sql` | 362 | CORREZIONI DI SICUREZZA E FUNZIONAMENTO (analisi requisiti, ott. 2026) |
| `supabase/08_integrazioni_azioni.sql` | 377 | INTEGRAZIONI E AZIONI DEL BACK-OFFICE (requisiti §4 e §8) |
| `supabase/09_cruscotto_pagamenti_notifiche.sql` | 410 | CRUSCOTTO, RAPPORTI, PAGAMENTI, DOCUMENTI E NOTIFICHE |
| `supabase/10_mfa_profilo.sql` | 199 | MFA OBBLIGATORIA PER LO STAFF E PROTEZIONE DEL PROFILO (requisiti §13) |
| `supabase/11_crediti.sql` | 135 | CALCOLO DEI CREDITI CWP — sezione riservata agli Amministratori |
| `supabase/12_email_notifiche.sql` | 85 | INVIO DELLE NOTIFICHE PER EMAIL (requisiti §9) |
| `supabase/13_durata_fasi.sql` | 81 | DURATA DELLE FASI MODIFICABILE DALL'AMMINISTRATORE |
| `supabase/14_controlli_file.sql` | 105 | CONTROLLI SUI FILE CARICATI (requisiti §13 "Upload") |
| `supabase/15_password.sql` | 68 | PASSWORD: CAMBIO OBBLIGATORIO DOPO UNA PASSWORD TEMPORANEA |
| `supabase/16_recupero_password.sql` | 18 | RECUPERO PASSWORD CON EMAIL DEL PORTALE (Edge Function recupera-password) |
| `supabase/17_pratiche.sql` | 586 | PRATICHE: RIFINITURE (backlog 10, 11, 12, 13, 26, 27 — 18/10/2026) |
| `supabase/18_registro_crediti.sql` | 132 | REGISTRO DEI CREDITI (backlog 7 — 18/10/2026) |
| `supabase/schema_completo.sql` | 434 | PORTALE CARBON WASTEPRINT — Schema del database (Supabase / PostgreSQL) |

**Edge Functions (supabase/functions)**

| File | Righe | Cosa contiene |
|---|---|---|
| `supabase/functions/consultazione-pubblica/index.ts` | 303 | Edge Function: consultazione-pubblica |
| `supabase/functions/crea-utente/index.ts` | 95 | Edge Function: crea-utente |
| `supabase/functions/invia-email-notifica/index.ts` | 120 | Edge Function: invia-email-notifica |
| `supabase/functions/recupera-password/index.ts` | 118 | Edge Function: recupera-password |
| `supabase/functions/reimposta-password/index.ts` | 83 | Edge Function: reimposta-password |

**Test (test)**

| File | Righe | Cosa contiene |
|---|---|---|
| `test/crediti.test.mjs` | 122 | Verifica del motore di calcolo con un esempio calcolato a mano. |
| `test/csv.test.mjs` | 33 | File in stile Excel italiano: BOM, ";" e virgola decimale, virgolette, riga vuota finale. |
| `test/tracciato.test.mjs` | 85 | Test dell'import del tracciato dati CWP (src/lib/crediti/tracciato.js). |

**Strumenti (strumenti)**

| File | Righe | Cosa contiene |
|---|---|---|
| `strumenti/genera_documenti.cjs` | 473 | — |
| `strumenti/genera_esempi_tracciato.py` | 66 | Genera i file di prova del tracciato dati per i test automatici |
| `strumenti/genera_tracciato_dati.py` | 260 | Genera public/modelli/Tracciato_dati_CWP_v1.xlsx (tracciato dati standard CWP). |
| `strumenti/impagina_pdf.py` | 361 | — |
| `strumenti/inventario_codice.py` | 121 | genera l'elenco di tutti i file del codice (cartella, righe, descrizione presa dall'intestazione del file) e lo inserisce nel capitolo «Codice sorgente» di docs/REGISTRO_DEV_DEPLOY.md, tra i segnaposto INVENTARIO-INIZIO e… |
| `strumenti/revisioni_documenti.json` | 160 | — |
<!-- INVENTARIO-FINE -->
