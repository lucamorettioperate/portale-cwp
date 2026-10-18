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

```
 Utenti (browser)
      │  HTTPS
      ▼
 ┌──────────────────────────┐        ┌─────────────────────────────────────────┐
 │ VERCEL                   │        │ SUPABASE (progetto "portale-cwp",        │
 │ portale-cwp.vercel.app   │ ─────▶ │ organizzazione Fondazione Operate)       │
 │ React + Vite (sito       │  API   │  • Postgres: tabelle, regole RLS,        │
 │ statico, nessun server)  │        │    trigger di audit, funzioni           │
 └──────────▲───────────────┘        │  • Auth: email+password, MFA (TOTP)      │
            │ deploy automatico      │  • Storage: bucket privato "documenti"   │
 ┌──────────┴───────────────┐        │  • Edge Functions: crea-utente,          │
 │ GITHUB                   │        │    invia-email-notifica                  │
 │ lucamorettioperate/      │        │  • pg_cron: scadenze (giornaliero),      │
 │ portale-cwp (branch main)│        │    nuovi tentativi email (15 min)        │
 └──────────────────────────┘        │  • pg_net: chiamata alla funzione email  │
                                     └───────────────┬─────────────────────────┘
                                                     │ API
                                                     ▼
                                     ┌──────────────────────────┐
                                     │ RESEND — invio email     │
                                     └──────────────────────────┘
```

In breve: **GitHub conserva** il codice, **Vercel mostra** il portale,
**Supabase ricorda** dati, utenti e documenti, **Resend spedisce** le email.

**Principi di sicurezza**
- Le regole di accesso stanno **nel database** (Row Level Security): il
  browser non può vedere né modificare ciò che il ruolo non consente,
  qualunque cosa faccia.
- Le azioni sensibili passano da **funzioni del database** che controllano
  ruolo, stato della pratica e motivazione.
- L'**audit** è scritto da trigger del database, è immutabile e non può
  essere scritto dal browser.
- Operatori e Amministratori hanno i poteri del back-office solo con
  sessione a due fattori (MFA), quando l'interruttore `mfa_obbligatoria` è
  acceso (oggi **spento**, per decisione di Luca).
- Il repository è pubblico ma non contiene dati né chiavi segrete.

---

## 3. Servizi e configurazione

| Servizio | Uso | Piano | Dove si configura | Segreti / variabili (solo nomi) |
|---|---|---|---|---|
| GitHub | Codice sorgente, storico | Free (repo pubblico) | github.com/lucamorettioperate/portale-cwp | — |
| Vercel | Pubblicazione del portale; deploy automatico a ogni push su `main` | Hobby (gratuito) | Dashboard Vercel → progetto portale-cwp | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Supabase | Database, autenticazione, archivio file, funzioni, cron | Free | supabase.com → organizzazione Fondazione Operate → progetto `ajxrnofgunynkynozmrn` | Edge Functions → Secrets: `RESEND_API_KEY` (impostata 17/10), `EMAIL_MITTENTE` (da impostare dopo verifica dominio), `PORTALE_URL` (facoltativo) |
| Resend | Invio email delle notifiche | Free (3.000 email/mese, 100/giorno) | resend.com (account di Luca) | Chiave API → in Supabase |

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

`schema_completo.sql` è la fotografia iniziale (01+02) ed è superata dagli
script successivi.

**Tabelle principali**: organizzazione, utente_organizzazione,
ente_validazione, profilo, pratica, fase, durata_fase, documento,
richiesta_integrazione, consultazione, commento, pagamento, notifica,
audit_event, impostazione, calcolo_crediti, calcolo_conferimento,
calcolo_riuso.

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
| `invia-email-notifica` | Spedisce per email una notifica interna (pulsante "Apri nel portale") tramite Resend | Verify JWT **disattivato** di proposito: usa solo l'id ricevuto e rilegge tutto dal database; ogni notifica parte una volta sola | Dashboard Supabase; prima pubblicazione 17/10, aggiornata 17/10 (pulsante per tema scuro) |

Sorgenti in `supabase/functions/<nome>/index.ts`. Si pubblicano dalla
dashboard (Edge Functions → funzione → Code → *Deploy updates*). Dopo ogni
pubblicazione verificare che l'impostazione *Verify JWT* sia quella attesa.

---

## 6. Portale (frontend)

React 18 + Vite 5, React Router 6, `@supabase/supabase-js`, `jszip` (export
fascicolo). Nessun server proprio: tutto passa da Supabase.

**Pagine**

| Indirizzo | Pagina | Chi |
|---|---|---|
| `/login` | Accesso | tutti |
| `/formato-dati` | Formato dei dati per il calcolo crediti, download del tracciato Excel | **pubblica**, senza login |
| `/` | Cruscotto (staff) oppure Le mie pratiche (cliente) | tutti |
| `/pratiche` | Back-office: elenco e dettaglio pratiche (`?id=` apre una pratica) | Operatore, Admin |
| `/documenti` | I tuoi documenti | Cliente |
| `/utenti` | Gestione utenti | Admin |
| `/audit` | Audit trail | Admin |
| `/crediti`, `/crediti/:id` | Calcolo crediti CWP | Admin |
| `/impostazioni` | Durata delle fasi | Admin |

**Struttura del codice**
- `src/pages/` — pagine elencate sopra (+ `VerificaMfa.jsx`).
- `src/components/` — `DettaglioPratica`, `Documenti`, `Integrazioni`,
  `Consultazione`, `Rapporti`, `Pagamenti`, `Notifiche`, `NuovoProgetto`,
  `Header`, `crediti/TabellaDati`; (`Timeline`, `AzioniRuolo`, `ProjectCard`,
  `Stat` sono resti del prototipo, non più usati).
- `src/lib/` — `dati.js` (accesso ai dati), `AuthContext.jsx` (sessione,
  ruolo, MFA), `file.js` (controlli sui file), `fascicolo.js` (export ZIP),
  `csv.js`, `date.js`, `cwpProgram.js` (fasi, ruoli, colori),
  `crediti/{parametri,calcolo,archivio}.js` (motore di calcolo).
- `public/loghi/` — loghi Carbon WastePrint, Fondazione Operate, RINA,
  Carbon Credit. `public/modelli/` — tracciato dati Excel.
- `test/` — test del motore crediti e del lettore CSV (`npm test`).
- `strumenti/genera_tracciato_dati.py` — rigenera il tracciato Excel.

---

## 7. Funzionalità per area (stato al 18/10/2026)

| Area (requisiti) | Stato | Dettaglio |
|---|---|---|
| Accesso e ruoli (§3, §13) | Fatto | Email+password, tre ruoli, utenti multi-organizzazione, disattivazione; MFA pronta ma spenta |
| Pratiche (§2) | Fatto | Progetti e Rapporti di Monitoraggio annuali, codice automatico, stati attiva/sospesa/annullata/chiusa con motivazione |
| Fasi (§4) | Fatto (manca note di fase) | 7 fasi, apertura con scadenza automatica, chiusura, modifica scadenza; durata modificabile dall'Admin |
| Documenti (§5) | Fatto (manca antivirus) | Versioni mai sovrascritte, hash SHA-256, visibilità Cliente/Fondazione/Pubblico, per fase o generali; limite 50 MB, formati ammessi, controllo contenuto |
| Integrazioni (§4) | Fatto | Richiesta → risposta del Cliente con documento → chiusura; fase "in attesa di integrazione" |
| Consultazione pubblica (§6) | Parziale | 30 giorni, commenti anonimi moderati, risposte; mancano errata corrige, allegati ai commenti, identificazione commentatori esterni |
| Pagamenti (§7) | Fatto | Voci, incassi, operatore registrato |
| Back-office (§8) | Fatto | Cruscotto con scadenze/scaduti, ricerca, azioni con motivazione |
| Notifiche (§9) | Fatto | Interne + email (Resend); manca verifica dominio |
| Audit (§10) | Fatto | Scritto dal database, immutabile, pagina di consultazione |
| Export fascicolo (§11) | Fatto | ZIP con documenti e riepiloghi |
| Calcolo crediti (Metodologia v1.2) | Parziale | Motore formule 1-32, Tabelle 3-5, 8, 15, 16; sei passi di acquisizione; calcoli confermati immutabili; tracciato dati standard pubblicato; mancano import diretto del tracciato, aggregazione letture, rapporto PDF, registro crediti |
| Amministrazione | Parziale | Utenti, audit, impostazioni (durata fasi); mancano template documenti e schermata Enti di Validazione |
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

**Segreti**: li inserisce solo Luca (Edge Functions → Secrets). Le chiavi non
si scrivono mai in chat, nel codice o nel registro.

---

## 9. Cronologia sviluppo e deploy

Voci più recenti in alto. Commit = identificativo nel repository GitHub.

### 18 ottobre 2026
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
| Manuale Utente (Comuni) | Claude Doc: https://claude.ai/code/artifact/e2dd2bd5-8042-4744-8d5a-54d34dc50153 (creato 18/10) | Uso del portale per i Clienti, passo per passo |
| Manuale Amministratore | Claude Doc: https://claude.ai/code/artifact/cc36ab09-61e6-4dad-aaf0-4082ea0a46da (creato 18/10) | Back-office, utenti, impostazioni, calcolo crediti, manutenzione |
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

**Aperte**
- A. Una nuova versione di documento durante una fase fa ripartire il
  termine?
- B. Errata corrige in consultazione: i 30 giorni ripartono?
- D. Identificazione dei commentatori esterni.
- Scelte interpretative del calcolo crediti (soprattutto il segno del riuso,
  formule 26 e 29).
- Antivirus: ClamAV su server proprio o servizio a pagamento.

---

## 12. Backlog per chiudere lo sviluppo

**Calcolo crediti (back-office)**
1. Import diretto del tracciato dati (Excel/ZIP) nel calcolo.
2. Aggregazione automatica delle singole letture (foglio 6_Letture).
3. Controllo privacy all'import (colonne con dati personali).
4. Scelta del file direttamente dalla pratica del Comune.
5. Controlli di coerenza (classi, totali, valori anomali).
6. Rapporto di calcolo in PDF.
7. Registro dei crediti calcolati e confermati (forma da *Guida al
   Programma* e *Standard CWP*).
8. Collaudo con dati reali di un Comune.
9. Conferma delle scelte interpretative.

**Pratiche**: 10. note di fase · 11. schermata Enti di Validazione ·
12. template documenti · 13. consultazione (errata corrige, allegati,
commentatori esterni).

**Sicurezza**: 14. registro di sicurezza · 15. attivazione MFA ·
16. antivirus (fine progetto) · 17. verifica dominio email ·
18. ambiente di prova, backup e procedura di ripristino.

**Chiusura**: 19. collaudo completo e pulizia dati di test (comprese le
notifiche "Email di prova") · 20. decisioni A e B.

**Rifiniture emerse dalla stesura del Manuale Utente (18/10)**:
22. **Recupero e cambio password** per gli utenti (oggi assenti: la
password la riassegna la Fondazione) — priorità alta;
23. dopo l'accesso da un link email, riportare l'utente alla pratica del
link (oggi va alla pagina iniziale);
24. pratica non attiva: spiegare perché i pulsanti di risposta alle
integrazioni non compaiono e nascondere "+ Carica";
25. date della consultazione in formato gg/mm/aaaa (oggi aaaa-mm-gg);
26. canale di messaggi tra Comune e Fondazione nella pratica (oggi solo la
nota delle integrazioni);
27. valutare se mostrare ai Comuni le voci di pagamento (oggi solo staff).

**Da rifinire**: 21. **Agente AI (Claude) integrato nel portale** —
richiesto da Luca il 18/10. Ambito da definire; usi possibili: assistente
per gli utenti dei Comuni (come compilare, cosa manca nella pratica),
supporto agli Operatori (controllo completezza dei documenti, bozze di
richieste di integrazione e di risposte ai commenti), verifica del tracciato
dati prima dell'import, spiegazione dei risultati del calcolo crediti.
Richiede: chiave API Anthropic (segreto in Supabase), una Edge Function che
faccia da tramite, regole su quali dati l'agente può leggere (privacy) e
registrazione delle sue azioni nell'audit.

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
