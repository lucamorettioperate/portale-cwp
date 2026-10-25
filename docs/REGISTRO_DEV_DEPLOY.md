# Registro sviluppo e deploy — Portale Carbon WastePrint

| | |
|---|---|
| **Ultimo aggiornamento** | 23 ottobre 2026 |
| **Versione del portale** | 0.47 (ultimo script database: `47_listino_obbligatorio.sql`; tutti gli script 01-47 eseguiti) |
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
>    che gli utenti vedono o fanno;
> 4. (richiesta di Luca del 19/10) si **controlla sempre il risultato a
>    schermo** prima di pubblicare: immagine della pagina su computer e su
>    telefono (pagina di prova con dati finti o portale vero).
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
- **Dati personali**: i commentatori esterni sono noti solo allo staff; il
  tracciato dati (passo 5b) deve contenere solo codici anonimi (import
  bloccato altrimenti); la Banca Dati Utenze per utenza (passo 5a, script
  40, dal 22/10) contiene nome e indirizzo per scelta di Luca: nessuna
  lettura diretta, consultazione solo dello staff con voce di audit, motore
  senza nomi, Comune escluso; servono DPIA e accordo art. 28 con i Comuni.
  Il rapporto PDF non contiene il dettaglio per utenza.
- **Segreti** solo in Supabase (Edge Functions → Secrets) e Vercel
  (variabili d'ambiente); il repository è pubblico ma non contiene chiavi.

### 2.4 Come viaggia una richiesta: esempi passo per passo

**Accesso.** Il browser invia email e password a Supabase Auth
(`AuthContext.jsx`) → riceve la sessione → il portale legge il profilo
(ruolo, organizzazioni, `password_temporanea`) → se la password è
temporanea apre `CambiaPassword`, se serve l'MFA `VerificaMfa`, altrimenti
il menu del ruolo (`Header.jsx`). Con la password temporanea anche il
database non riconosce ruolo e organizzazioni (script 20): finché non la
cambia, l'utente non vede né scrive dati, qualunque cosa faccia il browser.

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
`calcolo_riuso` (script 11); dal 22/10 le utenze dell'anno si caricano nel
passo «5a» (`UtenzeCalcolo.jsx`, tabella `calcolo_utenza`, script 40) e dal
23/10 il motore usa quelle (script 41) → «Calcola» esegue il motore
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
| Claude Console (Anthropic) | Assistente virtuale: chiamate a Claude dalla funzione `assistente` | A consumo: crediti mensili del piano Max di Luca (200 $, collegati il 19/10, primo accredito in elaborazione) e 100 $ acquistati il 19/10 | platform.claude.com → «Luca's Individual Org» (account di Luca); collegamento crediti in claude.ai → Impostazioni → Fatturazione → API credits | `ANTHROPIC_API_KEY` (legata a un solo spazio di lavoro) → Secrets di Supabase; facoltativi `ASSISTENTE_MODELLO`, `ASSISTENTE_LIMITE_GIORNO` |
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
| `16_recupero_password.sql` | Tabella `recupero_password_richiesta` (ultima richiesta di recupero per indirizzo, nessuna policy: la usa solo la funzione `recupera-password`) | 18/10/2026 |
| `17_pratiche.sql` | Pagamenti leggibili dal Comune; note di fase (`nota_fase`); anagrafica Enti di Validazione (solo Admin) e `staff_imposta_ente_validazione`; modelli di documento (`modello_documento`, archivio `modelli`); messaggi (`messaggio`); consultazione pubblica: dati dell'autore sul commento, `commento_in_attesa`, archivio `allegati-consultazione`, errata corrige (`consultazione_errata`, `staff_errata_corrige`), `staff_autori_commenti`; inserimento diretto dei commenti dal portale tolto; audit e notifiche per le nuove tabelle | 18/10/2026 |
| `18_registro_crediti.sql` | Numero di registro `CWP-REG-AAAA-NNNN` assegnato alla conferma dei calcoli ex post (contatore per anno `contatore_registro`, funzione `cwp_numero_registro`, `calcolo_immutabile` aggiornata, numero vietato su inserimento e bozze); funzione `admin_registro_crediti` (stato valido / sostituito) | 18/10/2026 |
| `19_correzioni_revisione_codice.sql` | Il Comune legge solo le osservazioni ammesse della consultazione (policy `commento_select`); un Amministratore non può cambiare il ruolo di un altro Amministratore né il proprio (`admin_aggiorna_utente`) | 18/10/2026 |
| `20_rinforzi_integrita.sql` | Data italiana nel database (`timezone = Europe/Rome`); `staff_crea_pratica` (pratica e 7 fasi insieme); `admin_aggiorna_utente_completo` (ruolo e organizzazioni insieme); calcolo crediti: trigger `trg_calcolo_coerenza` (risultato azzerato se cambiano i dati, controllo delle righe della Banca Dati alla conferma) e `trg_*_bdu_*` (risultato azzerato se cambia la Banca Dati), `admin_nuova_versione_calcolo`; password temporanea: `app_ruolo`, `app_organizzazione`, `app_org_mia` non riconoscono chi deve ancora cambiarla | 18/10/2026 |
| `21_completamento_funzionale.sql` | Rapporti con 4 fasi (`durata_fase.tipo_pratica`, `cwp_numero_fasi`, `cwp_durata_fase(tipo, numero)`, `staff_apri_fase` e `admin_imposta_durata_fase` per tipo, `staff_crea_pratica` con 7 o 4 fasi, `modello_documento.tipo_pratica`); tabella `documento_richiesto`; Organizzazioni ed Enti scrivibili dallo staff (niente cancellazioni); consultazione: `staff_apri_consultazione`, `staff_chiudi_consultazione`, documento bloccato (`trg_documento_bloccato`), `commento.numero`; conservazione: nessuna cancellazione o modifica diretta di pratiche, fasi, integrazioni, consultazioni, pagamenti, file; `pratica.conservare_fino_al`; il Comune carica solo nelle fasi aperte (`fase_aperta`, policy `doc_insert`); notifiche di apertura della fase 1 e di osservazione ammessa; audit dei documenti richiesti | 18/10/2026 |
| `22_stato_ritirata.sql` | Nuovo stato `ritirata` della pratica (ritiro del Progetto, Guida 6.4.1); da eseguire da solo prima del 23 | 18/10/2026 |
| `23_allineamento_guida.sql` | Allineamento alla Guida al Programma: Rapporto a 7 fasi (10/20/15/60/10 gg, migrazione dei Rapporti a 4 fasi), «Feedback pubblico» anche per i Rapporti (`cwp_giorni_feedback`), responsabili delle fasi con i nomi della Guida; conservazione 12 anni; periodo di riferimento (`periodo_riferimento`, `cwp_massimo_rapporti`: 10 o 21 Rapporti) e `rapporto_coerente` (nessun Rapporto per Progetti ritirati o annullati); un solo account cliente attivo per Organizzazione (`trg_account_unico`) e fino a 2 delegati (`organizzazione.delegati`); stato nel Programma (`cwp_stato_programma`) e data di registrazione (`trg_fase_registrazione`); ritiro e rientro in `staff_cambia_stato_pratica`; territorio (`codici_istat`, un solo Progetto per territorio, `trg_pratica_territorio`), co-promotori, popolazione e crediti previsti, `staff_aggiorna_dati_pratica`; avviso dopo 2 anni senza Rapporti (in `genera_notifiche_scadenze`); documenti richiesti dalla Guida e documenti riservati mai pubblici (`trg_documento_riservato`); voce dello Schema tariffario sul pagamento e sospensione fino al saldo in `staff_apri_fase`; verifica sull'accuratezza e accertamenti (`staff_estendi_verifica`); notifiche ridefinite | 18/10/2026 |
| `24_programma_pubblico_crediti_reclami.sql` | Informazioni del Programma (`info_programma`, `admin_imposta_info_programma`); tabelle `registro_scambio` e `metodologia`; modelli pubblici (`modello_documento.pubblico`, `categoria`); crediti emessi: `credito_lotto`, `credito_vendita`, `admin_emetti_crediti`, `staff_carica_su_registro`, `staff_registra_vendita`, `staff_registra_cancellazione`, `cwp_riepilogo_lotto`, avviso giornaliero `genera_avvisi_crediti` (pg_cron `cwp_avvisi_crediti`); reclami: tabella `reclamo` con codice automatico, `invia_reclamo`, `miei_reclami`, notifiche; dati pubblici `pubblico_programma` e `pubblico_percorso_file` (solo chiave di servizio) | 18/10/2026 (sera, verificato) |
| `25_documenti_programma.sql` | Gli otto documenti ufficiali del Programma v1.2 (Guida, Definizioni, Normativa, Standard, Metodologia, Politica di reclamo, Schema tariffario, Gestione qualità dei dati), caricati nella radice dell'archivio `modelli`, registrati come modelli pubblici «Documento del Programma»; PDF della Metodologia collegato alla metodologia approvata | 18/10/2026 (sera, verificato sulla pagina /programma) |
| `26_pec_programma.sql` | PEC del Programma `operate@pec.it` (comunicata da Luca), mostrata sulla pagina pubblica nelle informazioni del Programma e per i reclami; modificabile poi da Impostazioni | 19/10/2026 (verificato sulla pagina /programma) |
| `27_soggetto_promotore.sql` | Soggetto promotore del programma: Fondazione Operate, in esclusiva da Wastelab (gestione commerciale e tecnologica), testo sulla pagina pubblica | 19/10/2026 (verificato) |
| `28_simulatore.sql` | Simulatore di scenari: tabella `scenario_simulazione` (Comune, nome, durata 7/10/21, primo anno, dati in jsonb, riepilogo), RLS solo staff (`scenario_staff`), data di modifica dal database, audit | 19/10/2026 — provato sul banco locale (`t28.sql`); eseguito in produzione da Luca il 19/10 (testo senza commenti, stesso contenuto) |
| `29_amministratori.sql` | Più Amministratori: `admin_aggiorna_utente` accetta il ruolo `admin` e cambia il ruolo di un altro Admin (mai il proprio); colonna `profilo.amministratore_principale` (indice unico) assegnata a luca.moretti@operate.it; trigger `trg_profilo_principale` (dal portale non si cambia ruolo o stato del principale, non se ne cancella il profilo, non si sposta il segno) e `trg_account_principale` su `auth.users` (l'account non si cancella nemmeno dal pannello); `admin_imposta_attivo` con messaggio dedicato; `amministratore_principale_id()` per la pagina Utenti | 19/10/2026 — provato sul banco locale (`t29.sql`: 12 controlli); eseguito in produzione da Luca il 19/10 (verificato: riga «Principale» nella pagina Utenti) |
| `31_assistente.sql` | Assistente virtuale: tabella `assistente_uso` (utente, giorno in ora italiana, domande, token in entrata e in uscita; nessun testo), RLS «solo le proprie righe»; `assistente_registra_uso` e `assistente_domande_oggi` solo per la funzione del server (esecuzione tolta agli utenti); `assistente_riepilogo_uso()` per mese, solo Amministratori | 19/10/2026 — provato sul banco locale; **eseguito in produzione** da Luca il 19/10 |
| `30_elimina_utente.sql` | Cancellazione di un utente mai attivo: `utente_mai_attivo` (nessuna voce di audit come autore e nessuna riga che lo indichi come autore o responsabile in qualunque tabella con chiave esterna verso `auth.users` o `profilo` non a cascata: documenti, messaggi, note, pagamenti, calcoli, scenari, reclami…; uso interno), `admin_utenti_eliminabili()` per la pagina Utenti, `admin_elimina_utente(id)` (solo Admin, mai sé stessi né il principale; cancella da `auth.users`, a cascata profilo, associazioni e notifiche; voce «cancellazione profilo» nell'audit) | 19/10/2026 — provato sul banco locale (`t30b.sql`); eseguito in produzione da Luca il 19/10 (pulsante «Elimina» verificato sul portale); controllo esteso alle colonne «autore» lo stesso giorno, rieseguito in produzione il 20/10 |
| `32_utenti_online.sql` | Utenti online (backlog 38): tabella `presenza` (una riga per utente: ultima segnalazione, inizio del collegamento, pagina aperta; nessun IP, nessuno storico; RLS senza regole), `segnala_presenza(pagina)` e `presenza_uscita()` per ognuno solo per sé, `utenti_online()` (visti nelle ultime 24 ore, online se l'ultima segnalazione ha meno di 2 minuti) solo per l'Amministratore principale | 20/10/2026 — provato sul banco locale; **eseguito in produzione il 20/10** |
| `33_audit_trail_user.sql` | Audit User (backlog 40): tabella `registro_accessi` (accesso, uscita, accesso non riuscito; utente, email, ora; immutabile, RLS senza regole, nessun IP); `registra_accesso`, `registra_uscita` (cancella anche la presenza), `registra_accesso_fallito` (anon, limite 10 per email ogni 15 minuti e 300 all'ora); `registra_download` (scrive «download documento» nell'audit solo se l'utente vede il documento); lettura solo per l'Amministratore principale: `app_e_principale`, `audit_utenti_stato`, `audit_registro_accessi`, `audit_operazioni_utente` | 20/10/2026 — provato sul banco locale (`t33.sql`); **eseguito in produzione il 20/10** e provato dal vivo |
| `34_sicurezza_avvisi.sql` | Sicurezza (backlog 14, 30): avvisi all'Amministratore principale (`cwp_avviso_sicurezza`, evento «sicurezza»): 5 accessi non riusciti in 15 minuti per email, 30 in un'ora in tutto, nuovo Amministratore (trigger `trg_profilo_avviso_admin`); `registra_uscita(p_motivo)` con l'uscita per inattività; rinforzi del Security Advisor: `search_path` fisso su tutte le funzioni, funzioni SECURITY DEFINER non eseguibili da anon (tranne `registra_accesso_fallito` e quelle usate nelle regole RLS) | 20/10/2026 — provato sul banco locale (`t34.sql`, regressioni `t33.sql`); **eseguito in produzione il 23/10/2026 alle 12:20** su incarico di Luca, dopo gli script 35-43 (prova sul banco nello stesso ordine: stesse 9 funzioni eseguibili senza accesso, `t41`-`t43` invariati) |
| `47_listino_obbligatorio.sql` | Listino obbligatorio (25/10/2026, richiesta di Luca delle 12:07; **eseguito in produzione il 25/10/2026 alle 12:15**): i Progetti senza listino passano a Caso 1 con motivazione nell'audit; trigger `trg_pratica_listino` (messaggio «Scegli il listino…») e vincolo `chk_progetto_listino` (ogni Progetto ha Caso 1 o Caso 2; i Rapporti no). Prova `t47.sql` |
| `46_lettura_siti.sql` | Lettore dei siti di Comuni e gestori (25/10/2026, richiesta di Luca; versione gratuita scelta da Luca; **eseguito in produzione il 25/10/2026 alle 11:45**): tabella `mkt_lettura` (coda: stato, tentativi, pagine lette, esito, errore), impostazioni `mkt_lettura_attiva`, `mkt_lettura_segreto` (codice casuale per il lavoro pianificato, non leggibile dal portale) e `url_marketing`; `admin_mkt_lettura_accoda`, `admin_mkt_lettura_attiva`, `admin_mkt_lettura_riepilogo`, `mkt_lettura_prendi` (solo chiave di servizio, `skip locked`, riprende le letture interrotte), `richiedi_lettura_siti` e lavoro pianificato `cwp_lettura_siti` ogni 30 secondi. Prova `t46.sql` |
| `45_rapporto_registrato_marketing_rls.sql` | Segnalazioni di Luca del 23/10 alle 15:24 (**eseguito in produzione il 23/10/2026 alle 15:50**): `rapporto_coerente` rifiuta un nuovo Rapporto di Monitoraggio se il Progetto non è registrato (fase 6 completata o `data_registrazione`); il trigger resta solo sull'inserimento (i Rapporti già creati non si toccano). Regole RLS delle 6 tabelle `mkt_*` con `(select app_is_admin())`, calcolata una volta per lettura (l'elenco di tutti i Comuni superava il tempo massimo); indice `idx_mkt_ente_tipo_denominazione`. Prova `t45.sql` |
| `44_marketing.sql` | Marketing (23/10/2026, richiesta di Luca; **eseguito in produzione il 23/10/2026 alle 12:12**): tabelle `mkt_ente` (Comuni e gestori: chiave `istat:` / `albo:`, regione, provincia, abitanti, PEC, email generica con controllo «non PEC», sito, natura, numero e categorie dell'Albo, attività di raccolta e tariffa, fonti), `mkt_referente` (sindaco, tributi, ambiente, finanziario, tecnico, direttori, amministratore), `mkt_campagna`, `mkt_invio` (un invio per ente con codice casuale, stato, visita, simulazione, richiesta), `mkt_disiscrizione`, `mkt_richiesta` (richieste di registrazione dalla pagina /scopri; id uuid per l'audit); RLS solo Amministratori, nessun accesso anonimo; audit di campagne e richieste; `mkt_sembra_pec`, `admin_mkt_prepara_invii` (salta enti senza email e indirizzi disiscritti), `admin_mkt_riepilogo`. Prova `t44.sql` |
| `43_valore_progetti.sql` | Valore dei progetti per il cliente (23/10/2026, richiesta di Luca; **eseguito in produzione il 23/10/2026 alle 11:50**): `pratica.caso_listino` ('caso1' / 'caso2', solo Progetti, null = da indicare); `staff_crea_pratica` e `staff_aggiorna_dati_pratica` salvano il caso (messaggio italiano per valori non ammessi); `scenario_simulazione.costo_cliente_totale` (salvato dal simulatore con il Caso 1 o 2); `cruscotto_valore_progetti()` (ultimo scenario per Comune ed elenco dei Progetti aperti con caso, popolazione e periodo; staff tutto, Comuni i propri). Prova `t43.sql` |
| `42_valore_crediti.sql` | Valore complessivo dei crediti nella Dashboard (23/10/2026, richiesta di Luca; **eseguito in produzione il 23/10/2026 alle 11:10**): colonna `scenario_simulazione.ricavi_totali` (salvata dal simulatore); impostazione `prezzo_credito_riferimento` (32 €) e `admin_imposta_prezzo_riferimento` (solo Admin, 0-10.000 €, audit); `cruscotto_valore_crediti()` (JSON: simulazione con l'ultimo scenario per Comune, calcoli ex post confermati e validi, lotti emessi, vendite; staff tutto, utenti dei Comuni solo le proprie organizzazioni; anon negato). Prova `t42.sql` |
| `41_utenze_nel_calcolo.sql` | Utenze del passo 5a nel motore di calcolo (23/10/2026, richiesta di Luca; **eseguito in produzione il 23/10/2026 alle 10:14**): `cwp_utenze_controllo(calcolo, dati)` (security definer, solo numeri: utenze, senza categoria di simulazione, con categoria assente dalle classi della delibera); nuova `calcolo_coerenza` (alla conferma confronta anche `risultato.righe.utenze` con le utenze salvate; i risultati di prima valgono 0 utenze); nuova `calcolo_prerequisiti_conferma` (servono utenze del 5a o conferimenti del 5b; con le utenze nessuna senza categoria o con categoria fuori delibera). Prova `t41.sql` |
| `40_utenze_calcolo.sql` | Banca Dati Utenze per utenza (22/10/2026, richiesta di Luca; **eseguito in produzione il 22/10/2026 alle 17:30**): tabella `calcolo_utenza` (codice unico nel calcolo, tipo UD/UnD, nominativo, indirizzo, componenti solo UD, mq, categoria tariffaria e categoria di simulazione (proposta uguale alla tariffaria dal trigger `trg_utenza_categoria`), produzione totale, `frazioni` JSON con kg e svuotamenti, indifferenziato obbligatorio; controlli `cwp_tipologie_rifiuto()` e `cwp_frazioni_errore()`); nessuna regola di lettura: consultazione con `staff_elenco_utenze` (staff, voce di audit «consultazione utenze»), lettura per il motore con `admin_utenze_calcolo` (Admin, senza nomi e indirizzi), `admin_svuota_utenze` (Admin, audit «cancellazione utenze»); modulo con `admin_salva_utenza` (nuova o modifica, messaggi in italiano, audit «inserimento/modifica utenza» con i nomi dei campi cambiati) e `admin_elimina_utenza`; `admin_conta_utenze`; inserimento solo Admin con una voce di audit per caricamento; immutabile a calcolo confermato, azzera il risultato della bozza, copiata da `admin_nuova_versione_calcolo` (ora security definer). Prova `t40.sql` |
| `39_rilievi_n02_n03.sql` | Rilievi N02 e N03 della terza sessione di collaudo (22/10/2026, **eseguito in produzione il 22/10/2026 alle 14:27** con l'OK di Luca): `cwp_oggi()` (data in ora italiana); colonne `consultazione.chiusa_il`, `chiusura_tipo` («ordinaria» o «pratica_non_attiva»), `motivazione_chiusura`; `staff_chiudi_consultazione(p_consultazione, p_motivazione)` (sostituisce la firma a un parametro): chiusura ordinaria solo dal giorno dopo `data_chiusura` e completamento della fase 3, prima del termine solo per pratica annullata/ritirata/chiusa con motivazione; `staff_chiudi_fase`: fase 3 rifiutata senza feedback o con il feedback nel periodo, a termine passato chiude anche il feedback; `staff_apri_consultazione`: rifiutata con la fase 3 completata, apre la fase 3 se non iniziata; trigger `trg_consultazione_scadenza_fase3` (scadenza della fase 3 = termine del feedback, anche dopo l'errata corrige); `staff_apri_fase`: fase 5 solo con un ente attivo assegnato; `staff_imposta_ente_validazione`: l'ente non si toglie con la fase 5 aperta. Nessun dato storico modificato. Prova `t39.sql` |
| `38_backup.sql` | Backup (21/10/2026): funzione `backup_completo()` (security definer, solo service_role) che restituisce in un JSON tutte le tabelle public, gli utenti dell'autenticazione senza password, l'elenco dei file degli archivi e i lavori pg_cron; stesso formato del backup manuale, ripristinabile con `genera_sql_ripristino.mjs database_completo.json` | 21/10/2026 — provato sul banco locale (38 tabelle, 3 utenti, 2 file; ripristino in un database nuovo con righe identiche; negata al ruolo authenticated) |
| `37_notizie_viste.sql` | Pallino verde delle Notizie CO2 (21/10/2026, richiesta di Luca): tabella `notizie_visita` (ultima apertura della sezione per Amministratore, RLS sulla propria riga, scrittura solo dalle funzioni), `notizie_nuove()` (notizie attinenti e non nascoste trovate dopo l'ultima visita; 0 a chi non è Admin), `notizie_segna_viste()` | 21/10/2026 — provato sul banco locale (`t37.sql`: 2 nuove mai visitata, 0 dopo la visita, 1 dopo una nuova, scrittura diretta negata, Operatore 0 e nessuna riga); **eseguito in produzione il 21/10 alle 12:45** su incarico di Luca (tabella presente) |
| `36_notizie.sql` | Osservatorio News (21/10/2026, richiesta di Luca): tabelle `notizia` (url e titolo normalizzato unici, attinente, categoria, rilevanza, sintesi, prezzi, motivo, nascosta) e `notizie_esecuzione` (registro delle ricerche), lettura solo per gli Amministratori (RLS `app_is_admin`), scrittura solo dalla funzione del server; `notizie_puo_partire` (limite 100/10 minuti, una alla volta), `notizia_nascondi` (Admin), impostazione `url_notizie`, `richiedi_aggiornamento_notizie` (pg_net) e lavoro pg_cron `cwp_notizie` ogni 2 ore al minuto 7 | 21/10/2026 — provato sul banco locale (`t36.sql`: limiti di frequenza, doppioni rifiutati, Admin legge e nasconde, Operatore/Cliente/anonimo non vedono nulla, scrittura diretta e avvio negati); **eseguito in produzione il 21/10 alle 12:02** su incarico di Luca (2 tabelle, impostazione e lavoro `cwp_notizie` presenti) |
| `35_controlli_collaudo.sql` | Collaudo V01 (20/10/2026): vincoli `NOT VALID` (valgono per i nuovi dati, quelli salvati restano com'erano) — `calcolo_conferimento_non_negativi` e `calcolo_riuso_non_negativi` (D07: niente svuotamenti, volumi, pesi, pezzi negativi; N. utenze > 0), `calcolo_crediti_valori_ammessi` (D02: buffer 0-80%, crediti non negativi); trigger `trg_calcolo_prerequisiti` (R05: niente conferma senza Banca Dati Utenze o con risultato bloccato); `cwp_numero_json` e trigger `trg_scenario_valida` sugli scenari (D01/D02/D03: popolazione e produzione > 0, secco e rifiuti ≥ 0, buffer 0-80%, valori economici ≥ 0); in fondo un conteggio in sola lettura dei dati già salvati che non rispettano le nuove regole | 20/10/2026 — provato sul banco locale (`t35.sql`: rifiuti attesi, conferma ordinaria ancora possibile, rieseguibile con dati vecchi non validi); **eseguito in produzione il 20/10** su incarico di Luca (conteggio finale: 0 dati salvati fuori regola; 3 vincoli e 2 trigger presenti) |

`schema_completo.sql` è la fotografia iniziale (01+02) ed è superata dagli
script successivi.

**Tabelle principali**: organizzazione, utente_organizzazione,
ente_validazione, profilo, pratica, fase, durata_fase, documento,
richiesta_integrazione, consultazione, commento, pagamento, notifica,
audit_event, impostazione, calcolo_crediti, calcolo_conferimento,
calcolo_riuso, recupero_password_richiesta, nota_fase, messaggio,
modello_documento, consultazione_errata, commento_in_attesa,
documento_richiesto; dallo script 24 registro_scambio, metodologia,
credito_lotto, credito_vendita, reclamo.

**Conservazione (script 21 e 23)**: nessuna regola consente di cancellare
pratiche, fasi, documenti, integrazioni, consultazioni, osservazioni,
pagamenti, organizzazioni, enti o file dei documenti (si cancella solo un
file rimasto orfano); pratiche e fasi si modificano solo con le funzioni
che chiedono la motivazione. Alla chiusura o all'annullamento la pratica
riceve `conservare_fino_al` = oggi + 12 anni (Guida al Programma 6.2.1 e
6.5.1; erano 10 fino allo script 23, le date già fissate sono state
spostate di 2 anni). Lo stesso vale per un Progetto ritirato.

**Archivi (Storage)**: `documenti` (file delle pratiche, 50 MB),
`modelli` (modelli di documento, lettura per chi ha l'accesso),
`allegati-consultazione` (allegati alle osservazioni, 10 MB, scritto solo
dalla funzione `consultazione-pubblica`).

**Funzioni del database usate dal portale** (selezione):
`staff_apri_fase`, `staff_chiudi_fase`, `staff_modifica_scadenza`,
`staff_cambia_stato_pratica`, `staff_crea_pratica`, `staff_apri_consultazione`,
`staff_chiudi_consultazione`, `staff_richiedi_integrazione`,
`staff_chiudi_integrazione`, `cliente_rispondi_integrazione`,
`rispondi_commento`, `staff_cruscotto`, `admin_elenco_utenti`,
`admin_aggiorna_utente_completo`, `admin_imposta_organizzazioni`,
`admin_nuova_versione_calcolo`, `admin_registro_crediti`,
`admin_imposta_attivo`, `admin_imposta_durata_fase`, `mio_stato_mfa`,
`sono_admin`, `richiedi_email_notifica`; dallo script 23
`staff_aggiorna_dati_pratica`, `staff_estendi_verifica`,
`cwp_stato_programma`; dallo script 24 `info_programma`,
`admin_imposta_info_programma`, `admin_emetti_crediti`,
`staff_carica_su_registro`, `staff_registra_vendita`,
`staff_registra_cancellazione`, `invia_reclamo`, `miei_reclami`
(`pubblico_programma` e `pubblico_percorso_file` solo dalla funzione
`consultazione-pubblica`).

**Lavori pianificati (pg_cron)**

| Nome | Quando | Cosa fa |
|---|---|---|
| `cwp_notifiche_scadenze` | ogni giorno alle 05:00 UTC (07:00 in Italia con l'ora legale, 06:00 con l'ora solare) | Notifiche per fasi in scadenza e scadute |
| `cwp_riprova_email` | ogni 15 minuti | Rispedisce le email delle ultime 6 ore non ancora inviate |
| `cwp_avvisi_crediti` (script 24) | ogni giorno alle 06:15 UTC | Avvisa lo staff delle vendite di crediti senza dichiarazione di cancellazione dopo 10 giorni |

Il lavoro `cwp_notifiche_scadenze` dal 18/10 (script 23) avvisa anche dei
Progetti registrati da almeno 2 anni senza Rapporti (Guida 6.4.1).

**Fuso orario**: dal 18/10 (script 20) il database lavora in ora italiana
(`Europe/Rome`, impostazione del database): «oggi» per scadenze di fasi,
consultazioni e pagamenti è la data italiana. Il portale
(`oggiItalia` in `src/lib/date.js`) e la funzione `consultazione-pubblica`
usano la stessa data. Gli orari di pg_cron restano in UTC.

**Impostazioni** (tabella `impostazione`, modificabile solo dal SQL Editor):
`mfa_obbligatoria` (`false`), `url_email_notifiche` (indirizzo della
funzione email), `conservazione_12_anni` (traccia dello spostamento delle
date, script 23). Dallo script 24 `programma_soggetto_promotore`,
`programma_pec`, `programma_email`, `programma_sito`, che l'Amministratore
modifica dalla pagina Impostazioni.

**Interruttore di emergenza MFA**: se un amministratore perde l'app di
autenticazione, dal SQL Editor:
`update impostazione set valore = 'false' where chiave = 'mfa_obbligatoria';`

---

## 5. Edge Functions (Supabase)

| Funzione | Cosa fa | Protezione | Pubblicazione |
|---|---|---|---|
| `crea-utente` | L'Amministratore crea un utente con password temporanea e lo associa a tutte le sue organizzazioni (`admin_imposta_organizzazioni` con il token dell'Admin); se un passo fallisce l'account appena creato viene eliminato | Verifica che il chiamante sia Admin (`sono_admin`); password temporanea di almeno 10 caratteri con lettere e numeri; niente creazione di Admin; dal 19/10 email all'utente con indirizzo del portale, email di accesso e password temporanea (Resend), esito `email_inviata`/`motivo_email` restituito al portale | Dashboard Supabase (editor web); ripubblicata 18/10 (script 20); Verify JWT attivo; versione 19/10 con l'email **ripubblicata il 20/10** |
| `assistente` | Assistente virtuale (Claude, Anthropic Messages API): risponde dalla base di conoscenza `public/assistente/kb-amministratore.md` (Admin) o `kb-comune.md` (utenti degli enti), letta dal portale e tenuta in memoria 10 minuti; base di conoscenza nella cache dei prompt per 1 ora; modello predefinito `claude-haiku-5-5` (`ASSISTENTE_MODELLO`); conta domande e token con `assistente_registra_uso` | Ruolo letto dal server (solo admin e cliente, profilo attivo, senza password temporanea); limite di domande al giorno (`ASSISTENTE_LIMITE_GIORNO`, predefinito 40); massimo 12 messaggi da 2.000 caratteri; chiave `ANTHROPIC_API_KEY` solo nei segreti; nessun testo salvato; non legge le pratiche | **Pubblicata il 19/10** (dashboard Supabase, Verify JWT attivo); chiave `ANTHROPIC_API_KEY` legata a un solo spazio di lavoro inserita da Luca; provata dal vivo; versione 20/10 con i messaggi d'errore in italiano **ripubblicata il 20/10**; seconda fase (Operatori, riepilogo della pratica aperta) **ripubblicata il 21/10** |
| `reimposta-password` | L'Amministratore assegna una password temporanea a un Cliente o Operatore; il flag obbliga al cambio al primo accesso; audit; dal 19/10 email all'utente con la nuova password temporanea (Resend), esito restituito al portale | Verifica `sono_admin`; esclusi amministratori e sé stessi | Dashboard Supabase (editor web), 18/10; Verify JWT attivo; versione 19/10 con l'email **ripubblicata il 20/10** |
| `consultazione-pubblica` | Pagine pubbliche del feedback pubblico (data di «oggi» in ora italiana dal 18/10; numero delle osservazioni dallo script 21; dalla sera del 18/10 anche i Rapporti di Monitoraggio, ripubblicata; azioni `programma` e `file` per la pagina pubblica /programma, script 24, ripubblicata la sera del 18/10, Verify JWT spento): elenco, dettaglio (documento, errata corrige, osservazioni ammesse), invio di un'osservazione con allegato facoltativo ed email di conferma, conferma dell'email (l'osservazione diventa *Ricevuto*) | Verify JWT **disattivato** di proposito (pubblico senza account): nessun dato personale restituito, 3 invii/ora per indirizzo e 100/ora per consultazione, campo trappola anti-robot, allegati max 10 MB con controllo del contenuto, token monouso 48 ore salvato come SHA-256 | Dashboard Supabase (editor web), 18/10 |
| `recupera-password` | «Password dimenticata?»: genera il collegamento di recupero (`auth.admin.generateLink`) e spedisce con Resend l'email in italiano «Portale Carbon WastePrint (CWP) — Richiesta di reimpostazione della password», al posto del modello email di Supabase | Verify JWT **disattivato** di proposito (la chiama chi non ha fatto l'accesso): risponde sempre `ok` senza rivelare se l'indirizzo esiste; niente email agli utenti disattivati; massimo una richiesta ogni 2 minuti per indirizzo; il collegamento porta solo al portale | Dashboard Supabase (editor web), 18/10 |
| `notizie` | Osservatorio News (21/10/2026): legge 24 canali RSS, 4 alla volta: 12 ricerche Bing News in italiano e inglese, Carbon Herald, CarbonCredits.com, Ecosystem Marketplace, Verra e 8 siti di notizie ambientali (Rinnovabili.it, QualEnergia, GreenReport, ESGnews, LifeGate, Climate Home News, edie, BusinessGreen; per questi pre-filtro con parole più strette, `PAROLE_STRETTE`; dal 22/10 Rinnovabili.it, che rifiuta i server con 403, e GreenReport, il cui feed non esiste più, si leggono con una ricerca Bing News limitata al sito). Google News non si usa: risponde 503 (pagina «Sorry…») a ogni richiesta dai server di Supabase e il tramite in Google Apps Script è stato bloccato dall'account Google («Questa app è bloccata»). Con `{"diagnosi": true}` prova i canali e restituisce gli esiti HTTP (nessuna scrittura, niente Claude), toglie doppioni e notizie già viste o più vecchie di 10 giorni, pre-filtro sulle parole chiave, valutazione di Claude a gruppi di 25 (massimo 100 per ricerca; attinente, categoria, rilevanza 1-5, titolo e sintesi in italiano, prezzi citati, motivo), salva in `notizia` e chiude `notizie_esecuzione`; modello `claude-haiku-5-5` (`NOTIZIE_MODELLO`); funzioni pure copiate identiche da `src/lib/notizie.js` | Verify JWT **disattivato** di proposito (la chiama pg_cron senza token): nessun dato ricevuto viene salvato; `notizie_puo_partire` (script 36) ammette una ricerca ogni 100 minuti senza token di Amministratore, ogni 10 minuti con il token (`app_is_admin`, MFA compresa); scrive con la chiave di servizio | **Pubblicata il 21/10** (dashboard Supabase, Verify JWT disattivato), ripubblicata alle 12:10 con Bing News |
| `marketing` | Sezione Marketing (23/10/2026, script 44). Azioni degli Amministratori: `importa_comuni` (elenco ISTAT da `public/marketing/dati/comuni_istat.json`, poi IndicePA: PEC, email generica, sito, sindaco; uffici di tributi, ambiente, finanziario e tecnico a blocchi), `importa_albo` (iscritti all'Albo Gestori Ambientali per sezione regionale, solo categoria 1 ordinaria; PEC ed email dei gestori pubblici da IndicePA), `prova_campagna`, `invia_campagna` (a blocchi di 50, solo email generiche, intestazione List-Unsubscribe). Azioni pubbliche della pagina /scopri: `visita`, `simulata`, `disiscrivi`, `richiesta` (campo trappola, 3 richieste all'ora per email e 30 in tutto, notifica ed email a tutti gli Amministratori) | Verify JWT **disattivato** di proposito (pagina pubblica): le azioni riservate controllano da sole token e ruolo Amministratore | Pubblicata il 23/10/2026 alle 12:15 (OK di Luca), Verify JWT disattivato; aggiornata alle 12:25 e 12:35 (correzioni dell'importazione). Segreti: `RESEND_API_KEY` già presente, `EMAIL_MITTENTE` e `PORTALE_URL` facoltativi. Dal 25/10 anche l'azione `leggi_siti` (lettore dei siti, regole fisse, nessun servizio a pagamento), chiamata ogni 30 secondi dal lavoro pianificato con il codice segreto quando la lettura è accesa; ripubblicata alle 11:45 e 11:52 |
| `invia-email-notifica` | Spedisce per email una notifica interna (pulsante "Apri nel portale") tramite Resend | Verify JWT **disattivato** di proposito: usa solo l'id ricevuto e rilegge tutto dal database; ogni notifica parte una volta sola | Dashboard Supabase; prima pubblicazione 17/10, aggiornata 17/10 (pulsante per tema scuro) |

Sorgenti in `supabase/functions/<nome>/index.ts`. Si pubblicano dalla
dashboard (Edge Functions → funzione → Code → *Deploy updates*). Dopo ogni
pubblicazione verificare che l'impostazione *Verify JWT* sia quella attesa.

---

## 6. Portale (frontend)

React 18 + Vite 5, React Router 6, `@supabase/supabase-js`, `jspdf` e `jspdf-autotable` (rapporto di calcolo, PDF del simulatore), `jszip` (lettura del tracciato, export
fascicolo, file Excel del simulatore). Nessun server proprio: tutto passa da Supabase.

**Pagine**

| Indirizzo | Pagina | Chi |
|---|---|---|
| `/login` | Accesso, «Password dimenticata?» | tutti |
| `/reimposta-password` | Nuova password dal link dell'email di recupero | **pubblica** (sessione di recupero) |
| `/profilo` | Il mio profilo: account, cambio password, manuali e documentazione per ruolo | tutti |
| `/password` | Cambio password volontario | tutti |
| `/consultazioni`, `/consultazioni/:id`, `/consultazioni/conferma` | Feedback pubblico (Progetti e Rapporti): elenco, documento e osservazioni, invio con conferma dell'email | **pubbliche**, senza login |
| `/programma` | Piattaforma pubblica del Programma (Guida 3.7): informazioni, enti, registri, metodologie, documenti e modulistica, Progetti con documenti pubblici, Rapporti e crediti emessi, reclami | **pubblica**, senza login |
| `/reclami` | Reclami e richieste di chiarimento: invio e stato (utenti), registrazione e gestione (staff) | tutti |
| `/crediti-emessi` | Crediti emessi: tutti i lotti con vendite, cancellazioni e totali | Operatore, Admin |
| `/scopri`, `/scopri/disiscrizione` | Pagina «Approfondisci» delle campagne: presentazione, micro simulazione di costi e ricavi (7, 10 o 21 anni, Caso 1 o 2), fascicolo PDF, richiesta di registrazione; pagina per non ricevere altre comunicazioni | **pubbliche**, senza login (codice casuale dell'invio nel collegamento) |
| `/marketing` | Marketing: Comuni, Gestori, Campagne, Richieste, Importazioni | Admin |
| `/formato-dati` | Formato dei dati per il calcolo crediti, download del tracciato Excel | **pubblica**, senza login |
| `/` | Dashboard (staff) oppure Le mie pratiche (cliente) | tutti |
| `/pratiche` | Back-office: elenco e dettaglio pratiche (`?id=` apre una pratica) | Operatore, Admin |
| `/anagrafiche` | Organizzazioni (con delegati), Enti di Validazione e Registri, con le pratiche collegate | Operatore, Admin |
| `/documenti` | I tuoi documenti, modelli generali, manuale | Cliente |
| `/utenti` | Gestione utenti | Admin |
| `/audit` | Audit trail | Admin |
| `/notizie-co2` | **Notizie CO2** (prima «News», `/news` porta qui): osservatorio sui crediti di carbonio volontari (notizie cercate ogni 2 ore e filtrate da Claude, prezzi citati, filtri, «Aggiorna ora», registro delle ricerche; script 36, funzione `notizie`) | Admin |
| `/audit-utenti` | **Audit User**: utenti e stato online, registro degli accessi, operazioni per utente (script 33) | solo Amministratore principale |
| `/crediti`, `/crediti/:id` | Calcolo crediti CWP | Admin |
| `/simulatore` | Simulatore di scenari: stima ex ante dei crediti di un Comune su 7, 10 o 21 anni | Operatore, Admin |
| `/impostazioni` | Informazioni del Programma e metodologie, durata delle fasi (Progetto e Rapporto), documenti richiesti per fase, modelli di documento (anche pubblici) | Admin |
| `/documentazione` | Documentazione (Admin: manuali, Registro, Istruzioni di ripristino, Registro issue e test, presentazione, documenti ufficiali del Programma); «Manuali» per gli enti, «Manuale» per gli Operatori | tutti (contenuto per ruolo) |

**Menu per ruolo** (`vociMenu` in `src/components/Header.jsx`; ordini scelti da Luca il 20/10/2026)

| Ruolo | Voci, nell'ordine |
|---|---|
| Amministratore principale | Dashboard, Anagrafiche, Simulatore, Pratiche, Reclami, Calcolo crediti, Crediti emessi, Impostazioni, Utenti, Audit, **Audit User**, Documentazione, **Notizie CO2** (dal 21/10), **Marketing** (dal 23/10), *Marketplaces* (grigia, non cliccabile) |
| Amministratore | come sopra, senza Audit User |
| Operatore | Dashboard, Pratiche, Anagrafiche, Simulatore, Crediti emessi, Reclami, Manuale |
| Utente dell'ente (cliente) | Le mie pratiche, I tuoi documenti, Reclami, Formato dati, Il Programma CWP, Manuali, *Marketplaces* (grigia, non cliccabile) |

Sul telefono (fino a 760 px, dal 22/10/2026) le stesse voci stanno nel pannello che si apre con **☰ Menu**, insieme a Il mio profilo ed Esci (hook `src/lib/useTelefono.js`, classi `header-*` di `global.css`).

Nell'intestazione, inoltre: «● n online» (solo Amministratore principale), campanella delle notifiche, ruolo, profilo ed Esci; in basso a destra «✦ Assistente» (Amministratori ed enti).

**Struttura del codice** (in sintesi; descrizione completa file per file nel capitolo 14 «Codice sorgente»)
- `src/pages/` — pagine elencate sopra (+ `VerificaMfa.jsx`;
  `ConsultazioniPubbliche.jsx` contiene le tre pagine pubbliche).
- `src/components/` — `DettaglioPratica`, `Documenti`, `Integrazioni`,
  `Consultazione`, `Rapporti`, `Pagamenti`, `Notifiche`, `NuovoProgetto`,
  `Header`, `Messaggi`, `NoteFase`, `CreditiEmessi`, `BarraFasi` (LED delle
  7 fasi), `Ordinamento` (tabelle ordinabili), `AssistenteVirtuale`,
  `UtentiOnline` (presenza, «n online», hook `usePrincipale`), `Badge`,
  `stili.js` (stili condivisi),
  `impostazioni/{DurateFasi,DocumentiRichiesti,EntiValidazione,ModelliDocumento,Registri,InfoProgramma}`,
  `crediti/{ImportaTracciato,RegistroCrediti,TabellaDati,UtenzeCalcolo}`,
  `ValoreCrediti` (valore dei crediti in Dashboard e Le mie pratiche),
  `impostazioni/PrezzoRiferimento`,
  `marketing/{ElencoEnti,Campagne,Richieste,Importazioni}` (sezione Marketing).
- `src/lib/` — `dati.js` (accesso ai dati), `AuthContext.jsx` (sessione,
  ruolo, MFA), `file.js` (controlli sui file), `fascicolo.js` (export ZIP)
  e `fascicoloPdf.js` (riepilogo PDF del fascicolo),
  `csv.js`, `date.js`, `cwpProgram.js` (fasi, ruoli, colori, stati del
  Programma, tipologie), `tariffe.js` (Schema tariffario),
  `crediti/{parametri,calcolo,archivio,qualita}.js` (motore di calcolo e
  controlli della Gestione qualità dei dati), `crediti/{bancaDatiUtenze,utenzeCalcolo}.js`
  (Banca Dati Utenze per utenza), `crediti/rapportoPdf.js`,
  `crediti/{simulatore,simulatoreExport,simulatorePdf,scenari}.js`
  (simulatore, Excel e PDF), `ordinamento.js`, `presenza.js` (testi di
  Utenti online e Audit User), `marketing.js` (email della campagna, regole
  di IndicePA, micro simulazione) e `marketingDati.js` (dati del Marketing).
- `public/marketing/` — grafiche delle campagne, fascicolo informativo PDF
  (`strumenti/genera_fascicolo_marketing.mjs`), elenco ISTAT dei Comuni.
- `public/loghi/` — loghi Carbon WastePrint, Fondazione Operate, RINA,
  Carbon Credit. `public/modelli/` — tracciato dati Excel.
- `test/` — test del motore crediti, del lettore CSV, dell'import del
  tracciato, delle date, dello Schema tariffario, della qualità dei dati,
  del simulatore e del suo export, dell'ordinamento e dei testi della
  presenza, dei collaudi, dell'assistente, delle notizie, dei rilievi N,
  della Banca Dati Utenze e delle utenze nel calcolo e del Marketing (`npm test`, 20 file);
  `test/dati/` file di esempio.
- `strumenti/genera_tracciato_dati.py` — rigenera il tracciato Excel;
  `strumenti/genera_esempi_tracciato.py` — file di esempio compilati.

---

## 7. Funzionalità per area (stato al 23/10/2026)

| Area (requisiti) | Stato | Dettaglio |
|---|---|---|
| Accesso e ruoli (§3, §13) | Fatto | Email+password, tre ruoli, utenti multi-organizzazione, disattivazione; password temporanea da cambiare al primo accesso, cambio e recupero password, reimpostazione dall'Admin; MFA pronta ma spenta |
| Anagrafiche (§3) | Fatto | Organizzazioni (tipi dello Standard 4.4, fino a 2 delegati), Enti di Validazione e Registri censiti da Operatori e Admin, con le pratiche collegate; un solo account cliente attivo per Organizzazione (Guida 7.2) |
| Pratiche (§2) | Fatto | Progetti e Rapporti di Monitoraggio annuali con le stesse 7 fasi (Guida 6.2 e 6.3.1), ID automatico, stato nel Programma (Guida, Tabelle 3 e 4), data di registrazione, territorio con codici ISTAT (un solo Progetto per territorio), co-promotori, periodo di riferimento (10 o 21 Rapporti), popolazione e crediti previsti; stati attiva/sospesa/annullata/chiusa/ritirata con motivazione, ritiro e rientro; avviso dopo 2 anni senza Rapporti |
| Fasi (§4) | Fatto | Apertura con scadenza automatica, chiusura, modifica scadenza; durate per Progetto e Rapporto modificabili dall'Admin; verifica sull'accuratezza (+15 gg) e fino a 3 accertamenti (+10 gg) nelle fasi 2 e 6 (Guida 6.5.2); note di fase interne o condivise; documenti richiesti per fase preconfigurati dalla Guida (indicatore); il Comune carica solo nelle fasi aperte. Dal 22/10 (script 39): la fase 3 è il feedback pubblico e si chiude con esso, solo dopo il termine; la fase 5 si apre solo con un ente di validazione e verifica attivo assegnato. |
| Documenti (§5) | Fatto (manca antivirus) | Versioni mai sovrascritte, hash SHA-256, visibilità Cliente/Fondazione/Pubblico, per fase o generali; tipologie con i nomi ufficiali della Guida; contratto con l'ente e versione privata del Modulo mai pubblici; limite 50 MB, formati ammessi, controllo contenuto |
| Integrazioni (§4) | Fatto | Richiesta → risposta del Cliente con documento → chiusura; fase "in attesa di integrazione" |
| Feedback pubblico (§6, Guida 3.9) | Fatto (manca SPID/CIE/CNS) | Progetti (30 giorni) e Rapporti (20 giorni); pagina pubblica, documento pubblicato e bloccato, osservazioni numerate con email confermata e allegato, moderazione con motivazione facoltativa, firma «Partecipante» o nome a scelta dell'autore, risposte del Comune, errata corrige con ripartenza facoltativa del periodo; l'accesso con SPID/CIE/CNS richiesto dalla Guida 3.9 richiede l'adesione della Fondazione come fornitore di servizi |
| Pagamenti (§7) | Fatto | Voci con la voce dello Schema tariffario e proposta degli importi (iscrizione, registrazione, emissione, vendita), incassi, operatore registrato e mostrato allo staff; attività sospese fino al saldo delle voci scadute, iscrizione da saldare prima della fase 5; visibili al Comune in sola lettura |
| Back-office (§8) | Fatto | Cruscotto con scadenze/scaduti e, dal 22/10, fasi aperte senza scadenza; dal 23/10 valore dei crediti in simulazione e in fase esecutiva (crediti ed euro) e valore dei progetti per il cliente (Caso 1 / Caso 2), anche per i Comuni, solo i propri; ricerca, azioni con motivazione |
| Uso da telefono | Fatto (22/10) | Menu a pannello, schede al posto delle tabelle in Dashboard e Audit, elenco e dettaglio delle pratiche uno alla volta, campi a 16 px, assistente a schermo intero; tabelle larghe che scorrono nel loro riquadro |
| Notifiche (§9) | Fatto | Interne + email (Resend); messaggi Comune-Fondazione nella pratica; manca verifica dominio |
| Audit (§10) | Fatto | Scritto dal database, immutabile, pagina di consultazione; dal 20/10 anche lo scaricamento dei documenti e la sezione Audit User (accessi e operazioni per utente, solo Amministratore principale) |
| Export fascicolo (§11) | Fatto | ZIP con riepilogo PDF, documenti, validazione, consultazioni con allegati ed errata corrige, note, messaggi, pagamenti e audit con i nomi |
| Conservazione (§12) | Fatto (parte tecnica) | Nessuna cancellazione; data di conservazione a 12 anni (Guida 6.2.1 e 6.5.1); la procedura di cancellazione a fine periodo la definirà la Fondazione |
| Piattaforma pubblica (Guida 3.7) | Fatto | Pagina /programma: informazioni del Programma, enti, registri, metodologie, documenti e modulistica, Progetti dal momento «in fase di validazione» con documenti pubblici, Rapporti e crediti |
| Crediti emessi (Guida 6.3.2-6.3.3, Standard 6) | Fatto | Lotti con ID univoci emessi dall'Admin dopo la registrazione del Rapporto (con il limite del calcolo ex post confermato), caricamento sul registro esterno, vendite comunicate dal registro, cancellazione tombale (attivo / ritirato), avviso dopo 10 giorni senza dichiarazione |
| Reclami (Politica di reclamo, Guida 8) | Fatto | Invio dal portale, registrazione dei reclami arrivati via PEC, gestore, conferma, risposta scritta, costi, note interne, notifiche |
| Calcolo crediti (Metodologia v1.2) | Fatto (scelte interpretative da confermare) | Motore formule 1-32, Tabelle 3-5, 8, 15, 16; import diretto del tracciato con aggregazione delle letture, blocco dei dati personali e controlli di coerenza; Banca Dati Utenze per utenza (passo 5a: file dell'anno, moduli, categoria tariffaria e di simulazione) usata dal motore dal 23/10/2026; controlli della Gestione qualità dei dati (Tabella 3 dello Standard ±30% con motivazione obbligatoria, completezza, unicità, letture a buon fine, tempestività); calcoli confermati immutabili con numero progressivo interno; rapporto PDF. Funzione migliorativa: per la Metodologia il calcolo lo fa il promotore nel Rapporto e l'ente lo verifica |
| Amministrazione | Fatto | Utenti (più Amministratori, principale protetto, cancellazione dei mai attivi), audit, Audit User, utenti online, impostazioni: durata fasi, documenti richiesti, modelli di documento; simulatore con PDF ed Excel; assistente virtuale |
| Marketing (richiesta del 23/10) | Fatto (in produzione dal 23/10) | Banche dati di tutti i Comuni (ISTAT + IndicePA) e dei gestori dell'Albo in categoria 1 con PEC, email generica e referenti; campagne email con grafica verso i destinatari scelti (solo email generiche, mai PEC), pagina pubblica /scopri con micro simulazione, fascicolo PDF e richiesta di registrazione a tutti gli Amministratori. Banche dati caricate il 23/10: 7.904 Comuni (5.642 con email generica, 7.504 con PEC e referenti) e 5.818 gestori in categoria 1. Mancano: dominio email verificato, verifica legale delle email promozionali, verifica sui siti delle attività e dei referenti dei gestori |
| Sicurezza (§13) | Parziale | RLS, audit, controlli file, registro degli accessi e dei tentativi non riusciti, avvisi di sicurezza all'Amministratore principale, uscita per inattività, intestazioni del sito (20/10); verifica OWASP in corso (22/10); mancano antivirus, ambiente di prova, verifica in due passaggi attiva |

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
  (`docs/manuale-test.md`, sintetico, per i collaudatori). **Dal 19/10
  anche la Presentazione di riepilogo** (richiesta di Luca): si aggiornano
  i testi in `strumenti/presentazione/genera_presentazione.cjs` (e le
  schermate in `strumenti/presentazione/immagini/` se cambiano le pagine),
  si aggiunge la revisione «presentazione» in `revisioni_documenti.json` e
  si esegue `npm install --no-save pptxgenjs sharp react-icons` poi
  `node strumenti/presentazione/genera_presentazione.cjs`: produce
  `public/documentazione/Presentazione_Portale_CWP.pptx` e, con
  LibreOffice, il PDF, scaricabili dagli Amministratori nella pagina
  Documentazione. Data, revisione, versioni, script, funzioni e righe di
  codice si aggiornano da soli; i contenuti (novità, esempi, scelte) a
  mano.
- **Dal 21/10 anche il Registro issue e test** (richiesta di Luca:
  `docs/registro-issue-test.md`, chiave `issue`): ogni segnalazione con
  data e ora, chi l'ha fatta, causa, azione correttiva, prove e rilascio;
  si aggiorna **a ogni variazione di ogni tipo** (nuova segnalazione,
  correzione, ritest, rilascio, cambio di stato, nuova prova) e si
  rigenera con `node strumenti/genera_documenti.cjs issue`. Scaricabile
  dagli Amministratori nella pagina Documentazione.
- **Dal 19/10 anche la base di conoscenza dell'assistente virtuale:** dopo
  aver aggiornato manuali o tariffe (`docs/conoscenza/tariffe.md`) si
  esegue `node strumenti/genera_base_conoscenza.cjs`, che rigenera
  `public/assistente/kb-comune.md` e `kb-amministratore.md`.
- Il codice si commenta in italiano mentre si scrive: in testa a ogni file
  lo scopo e il capitolo del registro di riferimento; sopra ogni funzione
  cosa fa; nel corpo le regole di sicurezza e i passaggi non ovvi (punto 31).

**Segreti**: li inserisce solo Luca (Edge Functions → Secrets). Le chiavi non
si scrivono mai in chat, nel codice o nel registro.

**Copie di sicurezza e ripristino**: procedure complete in `docs/ripristino.md`
(Istruzioni di ripristino, Word e PDF in `public/documentazione/`). Contiene
la mappa di dove stanno codice e dati, il calendario delle copie (archivio di
backup, ramo `snapshot-<data>` su GitHub, copia manuale di database e file con
la Supabase CLI) e il ripristino di GitHub, Vercel, Supabase (pausa, dati
cancellati, ricostruzione da zero con gli script 01-27), Resend e progetto
Claude. Si aggiorna quando cambiano servizi, script, funzioni o chiavi.

---

## 9. Cronologia sviluppo e deploy

Voci più recenti in alto. Commit = identificativo nel repository GitHub.

### 25 ottobre 2026
- **Abitanti dei 3 Progetti** (indicati da Luca alle 13:19), inseriti alle
  13:20 nel SQL Editor con la motivazione nell'audit «Popolazione residente
  indicata da Luca Moretti il 25/10/2026»: CWP-2026-0001 26.382,
  CWP-2026-003 6.811, cwp-026-005 11.414. Con il Caso 1 il valore per il
  cliente in 10 anni è 232.161,60 €, 76.964,30 € e 119.847,00 €; con i due
  Progetti di collaudo il «Valore dei progetti» della Dashboard arriva a
  464.472,90 €.
- **Listino obbligatorio** (richiesta di Luca delle 12:07: «per i dati
  esistenti imposta a tutti caso 1, poi rendi obbligatoria la selezione
  del campo per i nuovi inserimenti»). Script 47 in produzione alle 12:15:
  i 5 Progetti (CWP-2026-0001, CWP-2026-003, cwp-026-005, COLLAUDO-V03-A e
  -B) a Caso 1, ognuno con la voce di audit «Listino Caso 1 per i Progetti
  esistenti, indicato da Luca Moretti il 25/10/2026». Il nuovo Progetto
  aveva già il listino obbligatorio nel modulo; ora anche il database lo
  impone e nei dati della pratica non c'è più la voce «da indicare». Tre
  Progetti non hanno ancora gli abitanti (CWP-2026-0001, CWP-2026-003,
  cwp-026-005): il loro valore per il cliente comparirà quando lo staff li
  inserisce. Prova `t47.sql`.
- **Lettore dei siti di Comuni e gestori** (richiesta di Luca delle 11:27:
  «devi cercare nei singoli siti internet di ogni gestore e comune»).
  Prima versione con Claude per leggere nomi e uffici (stima 40-60 $ una
  tantum); **Luca ha scelto la versione gratuita** (11:39): regole fisse
  nel codice, nessun servizio a pagamento. Ramo `lettore-siti`, main
  `5be70e1` e `cb5c315`.
  - `src/lib/marketingLettura.js` (copiato identico nella funzione
    `marketing`): testo dall'HTML, collegamenti utili (contatti, uffici,
    amministrazione trasparente, organigramma), robots.txt, `estraiDati`
    (email generica sul dominio dell'ente, PEC, telefono; Comuni: uffici
    tributi e ambiente con email, telefono e responsabile dopo
    «Responsabile:», «Dirigente:»…; gestori: presidente, amministratore,
    direttori, raccolta, tariffa, Comuni citati) e `controlloEsito` (solo
    dati presenti nel testo, PEC separate, fonte = pagina letta).
  - Script 46 eseguito alle 11:45 (lavoro `cwp_lettura_siti` ogni 30
    secondi, lettura spenta all'inizio); funzione pubblicata; pagina
    Importazioni con la sezione «Lettura dei siti».
  - Prova su 11 enti: 8 letti (Lecco: protocollo, PEC, numero verde, email
    TARI e ambiente; Desio: email tributi ed ecologia; CEM e G.ECO:
    amministratori), 3 siti non raggiungibili. Due errori corretti subito
    (email del gestore presa come email del Comune; «Capitale Sociale»
    letto come nome) e dati sbagliati cancellati. Limite noto: i nomi dei
    responsabili dei Comuni si trovano di rado con regole fisse.
  - 11:59, OK di Luca: in coda tutti gli enti con sito (7.658), lettura
    accesa: circa 6 enti al minuto, un giorno circa per finire.
- **Gestori verificati a mano, secondo lotto**: Lombardia, le 10 imprese
  rimaste delle classi A-B e le 88 di classe C (ricerca sul web con fonti;
  scartati i dati incerti: un direttore del 2023, email su domini di altre
  società, un sito con partita IVA diversa). Caricati 98 gestori: in
  Lombardia tutte le 166 imprese delle classi A-C sono verificate (39 con
  raccolta per Comuni, 10 con gestione della tariffa).

### 23 ottobre 2026
- **Due segnalazioni di Luca (15:24), corrette e in produzione** (OK di
  Luca delle 15:47; ramo `correzioni-rapporto-marketing`, main `1188a51`).
  - *Rapporto di Monitoraggio su un Progetto non registrato* (ISS-039): il
    pulsante «+ Rapporto anno N» compare solo con la fase 6 completata
    (`progettoRegistrato` in `dati.js`, riga di spiegazione in
    `Rapporti.jsx`); il database rifiuta comunque l'inserimento (script
    45). In produzione esistono già due Rapporti creati prima della
    registrazione del Progetto: CWP-2026-0001-RM1 e CWP-2026-003-RM1
    (dati di collaudo): non toccati, la decisione è di Luca.
  - *Marketing: «0 Comuni» senza filtri* (ISS-040): la lettura di tutti i
    7.904 Comuni superava il tempo massimo perché la regola RLS valutava
    `app_is_admin()` riga per riga. Script 45: regola calcolata una volta
    per lettura. Verifica in produzione come Amministratore (transazione
    annullata): conteggio di tutti i Comuni 44 ms, prima pagina 3 ms.
  - Prove: `t45.sql` (Rapporto rifiutato senza fase 6, accettato dopo;
    Amministratore vede tutto, Comune e anonimo niente), `t44.sql`
    invariato, `npm test` 20 serie; schermata dei Rapporti su computer e
    telefono.
- **Marketing: verifica dei gestori sui loro siti, primo lotto** (richiesta
  di Luca delle 14:22). Priorità per classe di iscrizione alla categoria 1
  (A ≥ 500.000 abitanti … F < 5.000): in Italia A 267, B 356, C 554, D 567,
  E 918, F 3.156. Primo lotto: Lombardia, classi A e B (78 imprese),
  ricerca su fonti pubbliche (sito dell'impresa, Amministrazione
  trasparente, carte dei servizi dei Comuni, bandi TED, notizie) con la
  fonte di ogni dato; scartati i dati incerti (impresa forse diversa da
  quella iscritta, email della capogruppo, sito di gruppo, un nome di
  direttore letto da un documento illeggibile).
  - Caricate alle 15:15 nel SQL Editor 68 imprese (10 non ricercate per il
    limite di 200 ricerche web per turno): 22 con raccolta per Comuni, 7 con
    gestione della tariffa, 22 nuove email generiche, 24 referenti
    (amministratori, direttori generali e tecnici) con fonte.
  - Strumento `strumenti/marketing_arricchimento_sql.py` (risultati JSON →
    SQL: aggiorna solo i campi trovati, mai PEC nell'email generica,
    `verificato_il`, fonti e note con le URL); provato sul banco.
  - Da completare: le 10 imprese lombarde rimaste e, a lotti di circa 70,
    le classi A-C delle altre regioni (circa 1.100 imprese).
- **Marketing in produzione** (OK di Luca delle 12:08).
  - 12:12 script `44_marketing.sql` eseguito (avviso del SQL Editor «tabelle
    senza RLS» confermato con «Run without RLS»: lo script attiva da sé
    la RLS sulle 6 tabelle, verifica finale «tabelle_marketing_con_rls 6»).
  - 12:15 funzione `marketing` pubblicata, Verify JWT disattivato; main
    pubblicato (`41c5883`), Vercel ok.
  - Primo aggiornamento dei Comuni: ISTAT ok, IndicePA in errore «ON
    CONFLICT DO UPDATE command cannot affect row a second time»: nella
    categoria L6 ci sono anche Unioni e Consorzi con il codice ISTAT del
    Comune sede (8.046 righe, 7.891 codici di Comuni). Correzione: una sola
    riga per Comune, quella dell'ente «Comune…» (`712b4ab`).
  - La lettura unica degli uffici mandava IndicePA in errore («App
    offline»): ora a blocchi di 400 Comuni; l'Albo si legge una provincia
    per chiamata (tempi della funzione) e se IndicePA non risponde i
    gestori restano salvati (`5ba8eab`). Funzione ripubblicata.
  - Risultato: **7.904 Comuni** (7.504 con PEC e legale rappresentante da
    IndicePA, 5.642 con email generica; referenti: tecnico 5.079,
    finanziario 3.218, tributi 1.969, ambiente 1.397) e **5.818 gestori**
    in categoria 1 ordinaria (145 con PEC e 34 con email generica da
    IndicePA, i pubblici). Pagina pubblica /scopri, fascicolo e grafiche
    raggiungibili dal vivo.
- **Sezione Marketing** (richiesta di Luca del 23/10; scelte di Luca:
  gestori = tutta la categoria 1 dell'Albo; nessun invio «a tutti», per
  ogni campagna si scelgono Comuni e gestori). Ramo `marketing`, commit
  `f8d3593` e seguenti. Dettaglio nel capitolo 16 «Marketing».
  - Script `44_marketing.sql` (prova `t44.sql` sul banco ricostruito con
    gli script 01-44: PEC rifiutata nel campo email, enti senza email e
    indirizzi disiscritti saltati, niente doppioni, campagna inviata
    bloccata, Comuni e anonimi senza accesso, audit di campagne e
    richieste). La prova ha trovato un errore: l'audit vuole un id uuid,
    `mkt_richiesta` lo aveva numerico; corretto prima del rilascio.
  - Funzione del server `marketing` (importazioni, invio, azioni della
    pagina pubblica); pagina `/marketing` (Comuni, Gestori, Campagne,
    Richieste, Importazioni) e pagina pubblica `/scopri` con micro
    simulazione (motore del simulatore), fascicolo PDF
    (`public/marketing/Fascicolo_Carbon_WastePrint.pdf`, 6 pagine) e
    richiesta di registrazione; due grafiche per l'intestazione delle
    email.
  - Prove `test/marketing.test.mjs` (8): copie identiche tra portale e
    funzione, regole PEC uguali al database, email della campagna,
    controlli e valori noti della micro simulazione (16.735 abitanti, 8.000
    t, 2.400 t di secco, 10 anni, Caso 1: 20.445 crediti, ricavi 654.240 €,
    costi 162.330 €, margine 491.910 €).
  - Verificato a schermo su computer e telefono con dati finti (nessuno
    scorrimento orizzontale; corretti la tabella delle Importazioni e il
    grafico sul telefono).
  - Rilascio in produzione: voce «Marketing in produzione» qui sopra.
    Prima degli invii reali: dominio email verificato su Resend e
    verifica legale delle email promozionali.
- **Script 34 in produzione** (OK di Luca delle 11:12). Prima, prova sul
  banco nello stesso ordine della produzione (script 01-33 e 35-43, poi
  34): 95 funzioni SECURITY DEFINER eseguibili senza accesso ridotte alle 9
  necessarie (regole di accesso e `registra_accesso_fallito`), script
  rieseguibile, prove `t34`, `t41`, `t42`, `t43` come attese. In produzione
  alle 12:20 (avviso «operazioni distruttive» confermato: riguarda solo
  `drop trigger/function if exists`); verifica finale: le stesse 9
  funzioni. Portale provato dal vivo: Dashboard, Audit User, Calcolo
  crediti e pagina pubblica /programma funzionano. Attivi gli avvisi
  all'Amministratore principale (5 accessi non riusciti in 15 minuti per
  email, 30 in un'ora, nuovo Amministratore) e il motivo «inattività»
  nell'uscita.
- **Colori dello stato delle fasi** (richiesta di Luca delle 11:00): in
  `STATI_FASE` (`src/lib/cwpProgram.js`) scritta verde per Completata,
  arancio per In corso e In attesa di integrazione, rossa per Non
  iniziata; valgono per il badge della fase nella pratica e per la colonna
  «Fase corrente» della Dashboard. Verificato a schermo su computer e
  telefono. Ramo `colori-stato-fasi`, nessuno script.
- **Valore dei progetti (quanto paga il cliente) e listino Caso 1 / Caso 2**
  (richiesta di Luca delle 10:47). Ramo `valore-progetti-casi`.
  - Script `43_valore_progetti.sql` (prova `t43.sql`): caso del listino sul
    Progetto, creazione e modifica dei dati con il caso, costo del cliente
    degli scenari, `cruscotto_valore_progetti`.
  - `valoreProgettoCaso` e `valoreProgetti` in `simulatore.js` (somma annua
    di `costiPerCaso` × anni del periodo; 7 anni = stima), prove
    `test/valoreProgetti.test.mjs` (4; Caso 1 a 16.735 ab. = 16.232,95
    €/anno come nel rilievo N01).
  - Nuovo progetto: listino obbligatorio con il valore del progetto;
    dati della pratica: riga «Listino» e «Valore del progetto per il
    cliente», listino modificabile; Dashboard e «Le mie pratiche»: terzo
    riquadro «Valore dei progetti (quanto paga il cliente)»; Simulatore:
    salva quanto paga il cliente con il Caso 1 o 2.
  - Verificato a schermo su computer e telefono con dati finti.
  - In produzione alle 11:50-12:00: script 43 eseguito («colonna caso 1,
    colonna costo 1, progetti da indicare 5»), main pubblicato (`5d0f014`).
    Dashboard dal vivo: riquadro «Valore dei progetti» a 0 €, perché i 5
    Progetti esistenti (anche di collaudo) hanno il listino «da indicare»:
    lo sceglie lo staff nei dati di ogni pratica (nessuna modifica
    automatica dei dati).
- **Revisione generale dei documenti** (richiesta di Luca delle 10:45):
  intestazione del Registro, dati personali, «Da fare subito» (script 34
  verificato non eseguito in produzione), struttura del codice, tabelle,
  manuali; nuova slide «Novità del 22 e 23 ottobre» nella presentazione.
- **Dashboard: valore complessivo dei crediti** (richiesta di Luca delle
  10:21: crediti in simulazione e in fase esecutiva; Amministratori tutto,
  utenti solo i loro; unità scelta da Luca: crediti ed euro; per le altre
  scelte nessuna preferenza, adottate le proposte). Ramo
  `valore-crediti-dashboard`.
  - Script `42_valore_crediti.sql` (prova `t42.sql`): `ricavi_totali`
    degli scenari, prezzo di riferimento (32 €), `cruscotto_valore_crediti`.
  - Simulazione: l'ultimo scenario aggiornato per ogni Comune, crediti
    netti del periodo, euro = ricavi dello scenario (o crediti × prezzo di
    riferimento per gli scenari salvati prima o senza valore del credito,
    contati a parte). Fase esecutiva: calcoli ex post confermati e validi,
    lotti emessi, vendite con il valore comunicato.
  - Componente `ValoreCrediti.jsx` nella Dashboard (staff) e in «Le mie
    pratiche» (Comuni, solo i propri dati); `PrezzoRiferimento.jsx` in
    Impostazioni; il Simulatore salva i ricavi del periodo.
  - Verificato a schermo su computer e telefono con dati finti.
  - In produzione alle 11:10-11:20: script 42 eseguito («colonna 1,
    prezzo 32, funzioni 2»), main pubblicato (`2b4aa35`). Dashboard dal
    vivo: in simulazione 3 Comuni, 11.245,8 crediti, € 359.866 (tutti e 3
    gli scenari valorizzati a 32 €, perché salvati prima di oggi); in fase
    esecutiva nessun calcolo ex post confermato valido, nessun lotto.
- **Utenze del passo 5a nel motore di calcolo** (richiesta di Luca delle
  9:39, «procediamo»). Ramo `utenze-nel-calcolo`.
  - `calcolo.js`: `utenzeInConferimenti` (una riga per frazione con i kg
    misurati; classe = categoria di simulazione); `calcolaCrediti` usa le
    utenze se ci sono (`dati.utenze`), altrimenti i conferimenti del 5b;
    kg misurati sommati in `conferimentiInPeso`; EA(i) ed EP(i) sulle sole
    frazioni indicate per l'utenza; utenze senza categoria o con categoria
    fuori delibera escluse con avviso; nel risultato `fonte` e
    `utenze.escluse`.
  - `tracciato.js`: `controllaCoerenza` con `origine` «utenze» (errori per
    categoria mancante o fuori delibera; i kg a 0 non sono righe vuote).
  - Pagina: lettura delle utenze senza nomi (`leggiUtenzeCalcolo`, a
    blocchi di 5.000), controlli di coerenza anche nel passo 5a, riquadro nel
    5b, riga «Banca Dati Utenze» nei Risultati, voci nel CSV di riepilogo e
    paragrafo nel rapporto PDF; `righe.utenze` nel risultato salvato.
  - Script `41_utenze_nel_calcolo.sql` (prova `t41.sql`, 9 casi).
  - Prove `test/utenzeNelCalcolo.test.mjs` (7); 18 serie superate.
    Verificato a schermo su computer e telefono con dati finti.
  - In produzione alle 10:14-10:20 (OK di Luca delle 10:13): script 41
    eseguito nel SQL Editor («Success»), main pubblicato (`cc28542`).
    «Calcola» sul calcolo di prova (non confermato): letture delle 40
    utenze riuscita; tutte escluse perché il calcolo di prova non ha ancora
    rifiuti del territorio né delibera (3 senza categoria, 37 con categoria
    fuori delibera), come previsto dai controlli.

### 22 ottobre 2026
- **Banca Dati Utenze per utenza (prima parte)**, richiesta di Luca delle
  15:06 e 16:21-16:22: ogni calcolo carica obbligatoriamente l'elenco
  completo delle utenze dell'anno (domestiche e non domestiche); nome e
  indirizzo salvati e visibili allo staff. Ramo `banca-dati-utenze`.
  - Script `40_utenze_calcolo.sql`, provato con `t40.sql`, eseguito in
    produzione alle 17:30; portale pubblicato con il passo 5a.
  - Modello `public/modelli/Banca_dati_utenze_CWP_v1.xlsx` (generato da
    `strumenti/genera_banca_dati_utenze.py`): Istruzioni con la spiegazione
    di ogni colonna, Utenze_domestiche e Utenze_non_domestiche (30 colonne:
    anagrafica, produzione totale, 12 frazioni in kg, 12 svuotamenti),
    Categorie DPR 158/1999 di riferimento.
  - Documenti: spiegazione dei campi in crediti-cwp.md, manuale
    amministratore e manuale utente.
  - Seconda parte (richiesta delle 16:58): categoria tariffaria (nel file,
    anche per le domestiche) e categoria di simulazione (proposta uguale);
    passo «5a. Utenze del calcolo» (`UtenzeCalcolo.jsx`) con riquadri,
    caricamento del file con anteprima, schede domestiche e non domestiche,
    ricerca, pagine e modulo di ogni utenza; `bancaDatiUtenze.js` (lettura
    e controlli, `test/bancaDatiUtenze.test.mjs`, 5 prove),
    `utenzeCalcolo.js` (database); `leggiFileFogli` in `tracciato.js`;
    file di prova con 20 + 20 utenze inventate
    (`strumenti/genera_utenze_casuali.py`). Verificato a schermo su
    computer e telefono con dati finti.
  - In produzione alle 17:30-17:45: script 40 eseguito, portale
    pubblicato; creato il calcolo di prova «PROVA Banca Dati Utenze - dati
    casuali (non confermare)» su CWP-2026-003 (Comune di del col) e
    caricato dal portale il file di prova (20 + 20 utenze, 4 senza
    categoria); provato il modulo su PROVA-UD-008 (categoria tariffaria 2,
    simulazione proposta 2). Nell'Audit gli eventi delle utenze mostrano
    codice, numeri e campi cambiati (`riassuntoUtenze` in
    `auditDettaglio.js`).
  - Collegamento al motore di calcolo: fatto il 23/10/2026 (script 41).
- **Rilascio in produzione (14:25-14:50, OK di Luca delle 13:25).** Script
  38 (verifica: 38 tabelle) e 39 (6 funzioni aggiornate) eseguiti nel SQL
  Editor; main portato a `b296195` (rilievi N01-N06 e navigazione da
  smartphone), pubblicazione Vercel riuscita; funzione `notizie`
  ripubblicata (Verify JWT disattivato). Diagnosi dei canali: 14 siti su
  14 rispondono. Rinnovabili.it via Bing 11 notizie, GreenReport 1 (le
  ricerche Bing con «site:» funzionano solo senza filtro della settimana
  e senza altre parole: `e607fa1`). Verifica dal vivo della Dashboard:
  riquadro «Fase aperta senza scadenza» = 4.
- **Navigazione da smartphone** (richiesta di Luca delle 13:26). Ramo
  `ottimizzazione-smartphone`, costruito sopra `correzioni-rilievi-n01-n06`.
  - `Header.jsx`: fino a 760 px intestazione bassa (90 px invece di 304)
    con loghi più piccoli, campanella e pulsante «☰ Menu»; pannello con
    voci alte 46 px, profilo ed Esci; si chiude cambiando pagina o con Esc.
  - Hook `src/lib/useTelefono.js` (stessa soglia delle regole CSS).
  - `global.css`: campi a 16 px (niente ingrandimento su iPhone), margini
    di 14 px, pulsanti alti almeno 40 px, spazio in fondo per l'assistente;
    classe `tabella-schede` (Dashboard e Audit diventano schede con
    etichette, «Ordina per» sopra).
  - `BackOffice.jsx` e `AreaCliente.jsx`: elenco e dettaglio uno alla volta
    con «← Tutte le pratiche».
  - Assistente: sul telefono solo ✦, aperto a schermo intero.
  - `Simulatore.jsx`: la tabella degli scenari faceva scorrere tutta la
    pagina di lato (515 px su 390); ora scorre dentro il riquadro.
  - Verifica con il portale montato su dati finti: 19 pagine a 390 px,
    nessuna più larga dello schermo; pagine da computer invariate.
- **Rilievi N01-N06 della terza sessione di collaudo** (file
  `CWP_NUOVI_RILIEVI_A_MORETTI_V01_20261021`, risposte in
  `docs/collaudo/Rilievi_N01-N06_risposte.md`). Ramo separato
  `correzioni-rilievi-n01-n06`, commit `18a4653` e seguenti: **non in
  produzione**, script 39 non eseguito (servono l'OK di Luca e il mandato
  del collaudo). Prove solo su copie isolate.
  - N01: voci una tantum dei Casi 1/2 = rata di un corrispettivo pagato in
    10 rate (contratti); etichette e nota in pagina, PDF ed Excel; durate
    diverse da 10 anni segnalate come stima (`durataFuoriListino`).
  - N02 e N03: script 39 (feedback pubblico legato alla fase 3, chiusura
    solo dopo il termine; ente obbligatorio per aprire la fase 5);
    `Consultazione.jsx` e `DettaglioPratica.jsx`.
  - N04: riquadro «Fase aperta senza scadenza» nella Dashboard, regole in
    `src/lib/scadenze.js`.
  - N05: avviso per i codici scritti a mano fuori formato
    (`NuovoProgetto.jsx`).
  - N06: `fattoreIndifferenziato` restituisce quantità, `fuoriPaniere` ed
    `escluse`, mostrati nei risultati e nel rapporto PDF (formula
    invariata).
  - Nuova serie `test/rilievi_n.test.mjs` (13 prove); `t39.sql` sul banco.
  - Lettura in sola lettura del database reale (date delle fasi aperte) per
    la diagnosi di N04.

### 21 ottobre 2026
- **Backup giornaliero alle 20:00 dal Mac** (richiesta di Luca, dopo che
  Google ha bloccato anche il progetto Apps Script «Backup CWP»): script
  `38_backup.sql` (funzione `backup_completo()`), `strumenti/backup/
  backup_cwp_mac.sh` (database, file degli archivi, codice da GitHub,
  istruzioni, LEGGIMI ed esito, notifica del Mac) e
  `installa_backup_mac.sh` (cartella Cwp di Google Drive per desktop, chiave
  nel Portachiavi, lavoro launchd alle 20:00, backup di prova). Provato in
  locale con un server finto (database, 2 file con spazi nel nome, codice
  da GitHub). `genera_sql_ripristino.mjs` accetta anche un solo file
  `database_completo.json`. Tolto `BackupCWP.gs`. Primo backup manuale dal
  browser in Cwp › backup › 2026-10-21 (38 tabelle, 10 utenti, 14 file).
- **Pallino verde delle Notizie CO2** (richiesta di Luca): script
  `37_notizie_viste.sql`; `Header.jsx` legge `notizie_nuove()` all'apertura,
  a ogni cambio di pagina e ogni 2 minuti e mostra il pallino in alto a
  destra della voce; la pagina `News.jsx` chiama `notizie_segna_viste()` e
  spegne il pallino (evento `cwp-notizie-viste`). Verificato a schermo;
  script 37 eseguito in produzione alle 12:45.
- **Pratiche: barra a LED delle fasi negli elenchi e nel dettaglio**
  (richiesta di Luca) — in ogni riquadro dell'elenco delle pratiche
  (`BackOffice.jsx`, `AreaCliente.jsx`) e in alto a destra nella pratica
  aperta (`DettaglioPratica.jsx`) il componente `BarraFasi` della
  Dashboard; `elencaProgetti` legge anche lo stato delle fasi.
- **Loghi RINA e Carbon Credit della stessa misura** (intestazione e pagina
  di accesso): nel file di RINA il cerchio è l'88% dell'altezza, nel Carbon
  Credit il 96%, quindi RINA è un po' più alto (classe `logo-rina`); nella
  pagina di accesso piccoli, sulla stessa riga del logo CWP, allineati in
  basso e a destra.
- **«News» diventa «Notizie CO2»** (richiesta di Luca): voce di menu,
  titolo, indirizzo `/notizie-co2` (il vecchio `/news` porta lì), manuali.
- **ISS-036, Google News nelle Notizie CO2:** con la nuova modalità
  «diagnosi» della funzione `notizie` (chiamata dal SQL Editor con
  `net.http_post`) si è visto che Google risponde 503 con la pagina
  «Sorry…» a ogni richiesta dai server di Supabase, anche con intestazioni
  da browser e senza parametri (blocco dei centri dati); Bing News risponde
  200. Soluzione: i canali Google passano da un piccolo tramite in Google
  Apps Script nell'account di Luca (`strumenti/notizie/ProxyGoogleNews.gs`,
  legge solo `news.google.com/rss`), indirizzo nell'impostazione
  `url_proxy_google_news`; restano anche i canali Bing e i siti.
  Alle 13:54 l'autorizzazione del tramite è stata bloccata da Google
  («Questa app è bloccata… informazioni sensibili», protezione
  dell'account): con l'OK di Luca il tramite è stato tolto e al posto di
  Google News sono entrati 8 siti di notizie ambientali, con pre-filtro più
  stretto (`PAROLE_STRETTE`). Attenzione: lo stesso blocco potrebbe
  fermare l'attivazione del backup automatico in Google Apps Script
  (confermato da Luca alle 13:57: anche «Backup CWP» è bloccato; il
  progetto «Notizie CO2 – Google News» è stato spostato nel cestino di
  Drive su sua richiesta).
- **News: osservatorio sui crediti di carbonio volontari** (richiesta di
  Luca: sezione solo per gli Amministratori, ricerca ogni 2 ore, solo
  notizie attinenti ai crediti volontari: mercato, marketplace, prezzi
  scambiati o venduti, standard e registri, regole, progetti). Script
  `36_notizie.sql`, funzione del server `notizie` (Verify JWT disattivato,
  limite di frequenza nel database), modulo `src/lib/notizie.js` (canali,
  lettura RSS, chiave dei titoli, pre-filtro, lettura della risposta di
  Claude; copia identica nella funzione), pagina `src/pages/News.jsx`
  (voce «News» nel menu dell'Amministratore, rotta `/news`), funzioni in
  `dati.js`. Filtro: Claude Haiku con istruzioni che escludono il solo EU
  ETS, i certificati del GSE e le garanzie d'origine. Prove
  `test/notizie.test.mjs` (7) e `t36.sql`; pagina verificata a schermo su
  computer e telefono con dati di prova. **Attivazione (OK di Luca):**
  script 36 eseguito in produzione alle 12:02; funzione `notizie`
  pubblicata (Verify JWT disattivato); ripubblicata anche `assistente`
  (seconda fase, commit 5a220eb). Prima ricerca automatica delle 12:07: 23
  notizie lette, 20 nuove, 11 attinenti (4.850 token in entrata); i canali
  Google News rispondevano 503 ai server di Supabase, quindi sostituiti con
  Bing News e aggiunto il sito di Verra, 4 canali alla volta (commit
  5e88cf6, funzione ripubblicata).
- **Pagina di accesso:** accanto al logo Carbon WastePrint, in piccolo, i
  loghi RINA (Certification Digital Partner) e Carbon Credit, come
  nell'intestazione (richiesta di Luca; `src/pages/Login.jsx`); verificata
  online.
- **Simulatore: PDF ed Excel con tutti i dati** (ISS-035, richiesta di Luca:
  «nel report inserisci tutti i dati completi della simulazione con costo e
  grafici, in pratica cosa hai nella forma») — `contenutoSimulazione`
  (`simulatoreExport.js`) riprende ogni sezione della pagina: impostazioni
  e buffer del Capitolo 7 (`bufferMetodologia`), scenario di riferimento con
  i rifiuti di tutte le tipologie e il riepilogo, situazione attuale,
  obiettivi anno per anno, risultati con le colonne della pagina e la riga
  del totale, spiegazione «da dove vengono i crediti», parametri economici
  inseriti, costi del Caso 1 o 2 con il totale annuo. Nel PDF
  (`simulatorePdf.js`) quattro grafici vettoriali disegnati con jsPDF
  (crediti netti, differenziata con soglia 65%, margine netto, margine
  cumulato), tabelle corte che non si spezzano tra due pagine. Nell'Excel il
  nuovo foglio «Dati inseriti». Prove `test/simulatoreExport.test.mjs` (7);
  PDF verificati a schermo su due scenari di prova (commit e6ed26c).
- **Assistente, seconda fase** (backlog 21) — aperto agli **Operatori** con
  una base di conoscenza propria (`kb-operatore.md`: Manuale Utente +
  Manuale Amministratore senza i capitoli riservati agli Amministratori,
  elenco `CAPITOLI_SOLO_ADMIN` in `strumenti/genera_base_conoscenza.cjs`) e
  **riepilogo della pratica aperta**: dalla pagina di una pratica il portale
  manda l'id e la funzione `assistente` legge stato, fasi e scadenze,
  documenti richiesti mancanti, integrazioni, pagamenti e feedback pubblico
  con i permessi di chi chiede (`riassuntoPratica` in
  `src/lib/contestoPratica.js`, copia identica nella funzione); prove
  `test/assistente.test.mjs` (4). Funzione ripubblicata il 21/10 verso le 12:05 (OK di Luca, Verify JWT attivo).
- **Backup automatico su Google Drive** (richiesta di Luca: due volte al
  giorno, alle 13 e alle 21, una cartella per backup nella cartella «Cwp»
  del suo Drive). Programma Google Apps Script `strumenti/backup/BackupCWP.gs`
  (account Google di Luca, orari Europe/Rome): codice da GitHub (ZIP e
  commit), tutte le tabelle via API REST con la chiave service_role (nelle
  proprietà dello script, inserita da Luca), utenti dell'autenticazione
  senza password, file dei tre archivi, configurazione di Supabase, Vercel
  e Resend senza segreti, LEGGIMI e PDF delle istruzioni, esito ed email
  se qualcosa non riesce. Ripristino: `strumenti/backup/genera_sql_ripristino.mjs`
  (SQL con `session_replication_role = replica`, controllo «database già
  pieno», righe non valide segnalate, contatori riallineati) e
  `strumenti/backup/carica_file_ripristino.mjs`; prova completa sul banco
  locale (dati identici). Scelta tecnica: l'ambiente di sviluppo non
  raggiunge Supabase né Google Drive per file grandi, quindi il backup gira
  in Google con l'account di Luca. Nel Drive il documento «Backup CWP —
  installazione». **Da fare (Luca):** installazione, circa 10 minuti
  (Istruzioni di ripristino, capitolo «Backup automatico su Google Drive»).
- **R08, carattere incorporato nei PDF** (commit 4920d2a) — Liberation Sans
  (licenza OFL, stesse larghezze di Helvetica) incorporato in rapporto
  crediti, simulatore e riepilogo del fascicolo (`src/lib/caratteriPdf.js`,
  `public/caratteri/`); verificato con pdffonts e a schermo.
- **Registro issue e test** (richiesta di Luca) — nuovo documento
  `docs/registro-issue-test.md` (Word e PDF, solo Amministratori, pagina
  Documentazione): 34 segnalazioni dal 17/10 ricostruite da conversazioni,
  schermate, rapporti di collaudo e commit (ora della correzione dal
  commit; ora della segnalazione quando disponibile), i rilievi dei collaudi
  V01 e V05 e il registro dei test. Regola: si aggiorna a ogni variazione.
- **Integrazione V05 del collaudo** (profili Cliente A/B e Operatore creati
  da Luca e provati dai collaudatori: separazione dei dati e dinieghi
  superati nei percorsi verificati) — ramo `correzioni-collaudo-v05`,
  **rilasciato in produzione il 21/10 alle 10:50 circa** (commit 39c9bc8, OK
  di Luca; nessuno script). Verifica dal vivo: le due modifiche delle Note
  di B del 21/10 mostrano «Aggiunto» e «Tolto» con la riga temporanea.
  D05-R1: nel dettaglio dell'Audit i testi oltre 80 caratteri restavano
  accorciati anche aprendo «1 modifica»; ora «Testo completo» mostra Prima e
  Dopo interi e la parte tolta/aggiunta (`auditDettaglio.js`:
  `valoreCompleto`, `valoreLungo`, `differenzaTesto`,
  `testoRicercaEvento`; `OggettoEModifiche.jsx`), il nome delle
  organizzazioni compare nell'oggetto, la ricerca legge anche i valori
  cambiati e il CSV di Audit User riporta i valori interi. O01: pagina
  «Account disattivato» (`AccountDisattivato.jsx`, in `Protetta` di
  `App.jsx`) al posto degli elenchi vuoti. Prove
  `test/collaudo_v05.test.mjs` (4). D08 (email ai nuovi utenti non
  consegnate: Resend in prova consegna solo al titolare) resta un'azione di
  Luca: dominio verificato su Resend e segreto `EMAIL_MITTENTE`. Risposte
  nel documento `docs/collaudo/Collaudo_V05_risposte.md`.

### 20 ottobre 2026
- **Correzioni del collaudo V01** (rapporto «Carbon WastePrint — criticità e
  consegna all'agente di correzione» dei collaudatori A. Valentini, A.
  Ambrogio, A. Pavan, G. Tapparini, L. Belfiore; prove fatte sul commit
  2526602, riprodotte tutte sul 640111a) — ramo `correzioni-collaudo-v01`,
  **rilasciato in produzione il 20/10 alle 17:15 circa** (commit e0c91a9,
  OK di Luca «parti con il rilascio»; script 35 eseguito, nessun dato
  salvato fuori regola). Verifica dal vivo: la pagina Audit mostra ora
  nome e modifiche anche degli eventi di prova del 19/10 (21:21-21:26). D07: import CSV diretto della Banca Dati
  «tutto o niente» con rifiuto dei negativi (`csvInOggetti` con `min`),
  controllo `valoriNonAmmessiBdu` in salvataggio (`archivio.js`), coerenza
  (`tracciato.js`) e motore (`calcolaCrediti` → `errori`, `bloccato`, crediti
  a zero; la pagina non salva e toglie il risultato salvato). D04: date
  rigorose (`tracciato.data`, `coefficientePrimoAnno`, `date.js`
  `dataIsoEsiste`). D02: buffer manuale fuori 0-80% = errore nel
  calcolatore e nel simulatore (prima tagliato a 80 o a 100). D01:
  `erroriScenario` (popolazione, produzione, secco, rifiuti, buffer) blocca
  risultati e Salva nel simulatore e in `scenari.js`. D03: zero esplicito
  distinto dal vuoto nei prezzi (`simulaEconomia`, `erroriEconomia`). D05:
  colonna «Oggetto e modifiche» in Audit e Audit User (`auditDettaglio.js`,
  `OggettoEModifiche.jsx`), senza toccare gli eventi registrati. D06:
  `testoSicuroCsv` in `scriviCsv`, nei CSV del fascicolo e del simulatore
  (l'Excel del simulatore usa celle di testo e non era esposto). R05:
  «Conferma definitivamente» disattivato con errori di coerenza; R04:
  messaggio del pareggio esatto; R07: P%UD in percentuale nel CSV. Script
  `35_controlli_collaudo.sql`. Prove `test/collaudo_v01.test.mjs` (27
  prove; casi ordinari S 292,8 e C 0,2928 invariati); cambiata
  un'aspettativa di `test/simulatore.test.mjs` (secco oltre il totale: da
  avviso a errore, motivato da D01). Risposte per ID nel documento del
  collaudo (`docs/collaudo/Collaudo_V01_risposte.md`).
- **Utenti online** (backlog 38, richiesta di Luca del 19/10) — script
  `32_utenti_online.sql` (tabella `presenza`, funzioni `segnala_presenza`,
  `presenza_uscita`, `utenti_online`), componente `UtentiOnline.jsx`
  (segnale di presenza per tutti gli utenti nell'intestazione; pulsante
  «● n online» e pannello solo per l'Amministratore principale),
  `src/lib/presenza.js` con le prove `test/presenza.test.mjs`; «Esci»
  cancella la presenza. Provato sul banco locale (rifiuto per gli altri
  Admin, tabella non leggibile, uscita, scadenza dopo 2 minuti) e a
  schermo su computer e telefono. Lo script va eseguito in produzione.
- **Messaggi d'errore dell'assistente in italiano** (backlog 39) — la
  funzione `assistente` traduce gli errori di Anthropic in frasi semplici
  (non disponibile / troppe domande / sovraccarico); agli Amministratori
  aggiunge la causa (credito esaurito, chiave non valida o non legata a uno
  spazio di lavoro, modello non trovato); il dettaglio tecnico resta nei
  log. Funzione ripubblicata il 20/10.
- **Simulatore: PDF impaginato ed export Excel** (backlog 37) — pulsanti
  «Scarica PDF» (A4 orizzontale: loghi, scheda, avvertenza, sintesi,
  anni, economia, costi del Caso 1 o 2, note, avvisi, numeri di pagina) ed
  «Esporta Excel» (fogli Sintesi, Anni, Economia, Costi, numeri veri);
  moduli `simulatoreExport.js` e `simulatorePdf.js` caricati solo quando
  servono; prove `test/simulatoreExport.test.mjs`. Corretto anche lo
  scorrimento laterale della pagina del simulatore sul telefono (i
  pulsanti ora vanno a capo). Il pulsante «Stampa» del browser è sostituito
  dal PDF.
- Documenti: Manuale Utente 2.8 (capitolo «Collegamento al portale»),
  Manuale Amministratore 3.8, Manuale Test 3.4, Registro 4.4, Istruzioni di
  ripristino 1.2, Presentazione 2.4.
- **Funzioni ripubblicate** (con l'autorizzazione di Luca): `assistente`
  (errori in italiano), `crea-utente` e `reimposta-password` (email con le
  credenziali). Il testo incollato a mano si era rovinato (barra iniziale
  persa e righe in più: «Unterminated regexp literal»); il codice è stato
  caricato nell'editor direttamente dal repository. Verify JWT attivo su
  tutte e tre. Registro 4.5.
- **Audit User** (backlog 40, richiesta di Luca) — sezione
  `/audit-utenti` solo per l'Amministratore principale: scheda «Utenti e
  stato online» (tutti gli utenti, online o no, pagina aperta, ultimo
  accesso, accessi e tentativi non riusciti in 30 giorni, ultima
  operazione), «Accessi» (entrate, uscite con Esci, tentativi non riusciti,
  filtri per utente, periodo ed evento) e «Operazioni» (audit trail per
  utente con pratica e documento); ordinamento ed export CSV. Script
  `33_audit_trail_user.sql` (registro immutabile, nessun IP, funzioni di
  lettura riservate); il portale registra accesso, uscita e tentativo non
  riuscito (`AuthContext.jsx`) e lo scaricamento dei documenti
  (`urlDocumento`). Voce di menu e collegamento dal pannello «n online».
  Provato sul banco locale (rifiuti per gli altri Admin, limite dei
  tentativi, immutabilità, download solo dei documenti visibili) e a
  schermo su computer e telefono. Corretto anche l'evidenziazione del
  menu (/audit non si accende su /audit-utenti). Registro 4.6, Manuale
  Utente 2.9, Manuale Amministratore 3.9, Manuale Test 3.5, Ripristino 1.3,
  Presentazione 2.5.
- **Script 30 (rieseguito), 32 e 33 eseguiti in produzione** su incarico di
  Luca, con il codice caricato nel SQL Editor direttamente dal repository
  (avviso «operazioni distruttive» di Supabase confermato: riguarda solo
  `drop trigger if exists`, `drop function if exists` e il testo della
  funzione di cancellazione, nessun dato toccato). Provato dal vivo: «1
  online», sezione Audit User con 7 utenti e le operazioni reali.
  Registro 4.7.
- **Menu degli Amministratori riordinato** (richiesta di Luca): Dashboard,
  Anagrafiche, Simulatore, Pratiche, Reclami, Calcolo crediti, Crediti
  emessi, Impostazioni, Utenti, Audit, Audit User (solo Amministratore
  principale), Documentazione. La sezione «Audit trail user» si chiama ora
  **Audit User** (stesso indirizzo /audit-utenti). Registro 4.8, Manuale
  Amministratore 4.0, Manuale Test 3.6, Presentazione 2.6.
- **Voce «Marketplaces»** (richiesta di Luca) in fondo al menu di
  Amministratori e utenti degli enti: in grigio, non cliccabile, con il
  suggerimento «In arrivo» (sezione futura, ancora da definire). Manuale
  Utente 3.0.
- **Menu degli utenti degli enti riordinato** (richiesta di Luca): Le mie
  pratiche, I tuoi documenti, Reclami, Formato dati, **Il Programma CWP**,
  **Manuali**, Marketplaces (grigia); la pagina Documentazione per gli enti
  si intitola «Manuali». Aggiornati tutti i documenti: capitolo 6 (pagine,
  menu per ruolo, struttura del codice) e 7 (stato per area) di questo
  registro, inventario del codice, Manuale Utente 3.1, Manuale
  Amministratore 4.1, Manuale Test 3.7, Istruzioni di ripristino 1.4,
  Presentazione 2.7, base di conoscenza dell'assistente. Registro 4.9.
- **Sicurezza** (richiesta di Luca «parti con la sicurezza», backlog 14 e
  30): librerie aggiornate (React Router 7.18, Vite 7.3: `npm audit` 0
  vulnerabilità) e verificate dal vivo; nessuna chiave nel codice né nella
  storia del repository; intestazioni di sicurezza in `vercel.json` (CSP
  prima in prova e poi obbligatoria, dopo la prova delle pagine compilate
  con PDF, Excel e assistente senza blocchi); uscita automatica per
  inattività (`UscitaInattivita.jsx`, `src/lib/inattivita.js`, prove
  `test/inattivita.test.mjs`, avviso sulla pagina di accesso); script
  `34_sicurezza_avvisi.sql` (avvisi all'Amministratore principale,
  uscita con motivo, rinforzi del Security Advisor) provato sul banco
  locale. Registro 5.0, Manuale Utente 3.2, Manuale Amministratore 4.2
  (capitolo «Sicurezza»), Manuale Test 3.8, Ripristino 1.5,
  Presentazione 2.8.

### 19 ottobre 2026
- **Assistente virtuale attivato** — Luca ha eseguito lo script 31,
  pubblicato la funzione `assistente` (Verify JWT attivo), creato nella
  Claude Console una chiave legata a un solo spazio di lavoro e acquistato
  100 $ di crediti; collegati anche i crediti mensili del piano Max (200 $,
  primo accredito ancora in elaborazione). Provato dal vivo come
  Amministratore: risposte corrette sulla creazione degli utenti e sui costi
  del Caso 1 per 20.000 abitanti (17.600 €, 0,88 €/ab). Corretto il
  componente `AssistenteVirtuale.jsx`: il corsivo `*testo*` delle risposte
  ora si vede formattato invece che con gli asterischi. Aggiornati Manuale
  Amministratore 3.6, Manuale Test 3.2, Istruzioni di ripristino 1.1,
  Registro 4.2 e Presentazione 2.2.
  Poi, su richiesta di Luca, il messaggio d'attesa è diventato «Un attimo…»
  (prima «Sto cercando nei manuali…») e il backlog ha in testa il riepilogo
  «Da fare subito» con le azioni aperte (punti 38 e 39 nuovi). Manuale
  Utente 2.7, Manuale Amministratore 3.7, Manuale Test 3.3, Registro 4.3,
  Presentazione 2.3.
- **Assistente virtuale, prima versione** (richiesta di Luca: aiuto ad
  Amministratori ed enti su una base di conoscenza del portale) — funzione
  del server `assistente` con Claude Haiku 5.5 e cache dei prompt; base di
  conoscenza generata da `strumenti/genera_base_conoscenza.cjs` (Manuale
  Utente e tariffe per gli enti; più Manuale Amministratore e note sul
  calcolo per gli Admin; riepilogo tariffe in
  `docs/conoscenza/tariffe.md`); script `31_assistente.sql` per il
  limite giornaliero e il conteggio dei token; pulsante «✦ Assistente» in
  basso a destra (componente `AssistenteVirtuale.jsx` nell'intestazione).
  Verificato a schermo con risposta simulata (computer e telefono) e sul
  banco locale; non provato con Claude perché la chiave la inserisce Luca.
  Costi: l'uso API è a parte rispetto ai piani claude.ai, ma con un piano
  Max o Team si possono usare i crediti API mensili collegando
  un'organizzazione della Console.
- **Documenti ufficiali del Programma nella Documentazione** (richiesta di
  Luca) — sezione «Documenti ufficiali del Programma Carbon WastePrint®»
  per gli Amministratori con gli 8 documenti v1.2 (modelli di categoria
  «programma», indirizzi firmati: Apri PDF / Scarica).
- **Barra a LED più fine e più corta** (richiesta di Luca) — luci da 7 px,
  barra lunga circa la metà.
- **Presentazione di riepilogo nel portale** (richiesta di Luca: è un
  recap, va sempre aggiornata e messa a disposizione degli Amministratori)
  — generatore nel repository (`strumenti/presentazione/`), uscita in
  `public/documentazione/` (PowerPoint e PDF), voce «Presentazione di
  riepilogo» nella pagina Documentazione con «Scarica PowerPoint».
  Revisione 2.0 (14 slide): nuova slide «Novità del 19 ottobre»
  (Dashboard a LED, ordinamento, utenti, email con le credenziali,
  campanella, simulatore per utenza, decisione ACN); Analisi funzionale,
  architettura, ruoli, punti aperti, simulatore (esempio Bovisio con i due
  metodi) e scelte da prendere aggiornati. Controllata a schermo e con il
  validatore dei file PowerPoint.
- **Ordinamento di tutte le tabelle e degli elenchi** (richiesta di Luca) —
  componente `src/components/Ordinamento.jsx` (hook `useOrdinamento`,
  intestazioni `ThOrdinabile` con ▲/▼/↕ e aria-sort, menu «Ordina per»
  `SceltaOrdinamento`) e logica in `src/lib/ordinamento.js` (numeri,
  date, booleani, testi in ordine naturale italiano, vuoti in fondo,
  ordinamento stabile; 4 prove in `test/ordinamento.test.mjs`). Applicato
  a: Dashboard, Audit, Calcolo crediti (elenco e tabelle dei risultati),
  Registro crediti, Simulatore (scenari, risultati, costi, economia),
  Pratiche, Utenti, Organizzazioni, Enti di Validazione, Registri,
  Reclami (staff e Comune), Crediti emessi, Area Cliente, I tuoi
  documenti, documenti, pagamenti e Rapporti della pratica. Restano in
  ordine fisso le tabelle di inserimento (obiettivi anno per anno, rifiuti
  dell'anno base, durate delle fasi, dati del tracciato), le conversazioni
  (messaggi, note, osservazioni) e la tabella descrittiva del Formato dati.
  Controllato a schermo (pagina di prova).
- **Simulatore: metodo per utenza come nell'Allegato A EsaCom** (richiesta
  di Luca di ricontrollare il calcolo sui documenti EsaCom) — analisi in
  `docs/crediti-cwp.md`: la differenza (0,04 contro 0,19-0,23 crediti per
  abitante all'anno) è di metodo. Nuovo metodo «Per utenza: solo utenze
  virtuose» (formula 32 con buffer) accanto al «Bilancio del Comune»;
  rifiuti misurati (Tabella 16), utenze monitorate (Tabella 15), tariffa
  puntuale, buffer guidato del Capitolo 7, variabilità tra utenze con
  taratura; riquadro «Per abitante all'anno»; colonna di confronto;
  metodo nel CSV. Bovisio-Masciago: 0,204 crediti per abitante all'anno.
  Controllato: il calcolo dei costi (voci una tantum ammortizzate in 10
  anni) è corretto. 18 prove automatiche; controllato a schermo.
- **Dashboard con barra a LED delle 7 fasi** (richiesta di Luca) — la voce
  di menu «Cruscotto» diventa «Dashboard»; nuova colonna «Avanzamento» con
  il componente `src/components/BarraFasi.jsx`: 7 luci, accese (ambra) le
  fasi completate, spente quelle da fare, la settima verde, contorno sulla
  fase in corso, conteggio «n/7»; dati dalla tabella `fase`
  (`leggiFasiPratiche` in `dati.js`). Controllata a schermo a 1280 e 390 px
  con una pagina di prova a dati finti.
- **Campanella delle notifiche: tendina sempre visibile** (segnalazione di
  Luca) — la tendina si apriva verso sinistra partendo dalla campanella e,
  con il menu andato a capo (campanella sul bordo sinistro), usciva dallo
  schermo. Ora la posizione si calcola dalla campanella e resta dentro la
  finestra, con 16 px di margine, anche ridimensionando o scorrendo
  (`src/components/Notifiche.jsx`). Controllata a schermo a 1400, 814 e
  390 px (pagina di prova) e sul portale.
- **Utenti: pulsante «Elimina» e impaginazione** (richieste di Luca) —
  script `30_elimina_utente.sql`: si cancella solo chi non ha mai operato
  (audit trail e nessuna riga come autore in nessuna tabella), con conferma; pulsante «+ Nuovo utente» sulla riga del
  titolo (prima era schiacciato accanto alla descrizione); azioni delle
  righe che vanno a capo sul telefono. Controllato a schermo a 820 e 390
  px con una pagina di prova a dati finti; script provato sul banco locale.
- **Email con le credenziali al nuovo utente** (verifica richiesta da Luca:
  prima non partiva nessuna email, l'Admin comunicava la password a mano) —
  `crea-utente` e `reimposta-password` spediscono con Resend l'email
  «Il tuo accesso al Portale CWP» / «Nuova password temporanea» con
  indirizzo del portale, email di accesso, password temporanea, pulsante
  «Accedi al portale» e l'avviso che al primo accesso va scelta una password
  personale; la pagina Utenti mostra se l'email è partita o il motivo del
  rifiuto. Provata con invio simulato (risposta 403 di Resend gestita).
  Limite: senza dominio verificato arriva solo al titolare Resend.
- **Più Amministratori e Amministratore principale protetto** (richiesta di
  Luca) — script `29_amministratori.sql` e pagina Utenti: un Amministratore
  crea o nomina altri Amministratori (nuovo utente creato come operatore
  dalla funzione `crea-utente` e promosso subito, così la funzione non va
  ripubblicata), li declassa o li disattiva; nessuno cambia il proprio
  ruolo; luca.moretti@operate.it è l'Amministratore principale, con segno
  «Principale» e nessun pulsante, protetto dal database anche contro la
  cancellazione dell'account. Provato sul banco locale (`t29.sql`).
- **Simulatore: costi Caso 1 e Caso 2** — tabelle «Costi per il Soggetto
  Promotore» del 28/07/2026 (Caso 1 progetto volontario, Caso 2 progetto
  obbligatorio da bando): sei attività con minimo, costi per abitante a
  5.000, 20.000 e oltre 100.000 abitanti, interpolazione e arrotondamento
  per eccesso, massimo; la pagina chiede quale caso simulare; il Caso 1
  riproduce i contratti tipo EsaCom; 14 prove automatiche.
- **Simulatore: simulazione economica** (richieste di Luca) — valore del
  credito digitato anno per anno (proposto 32 €, applicabile a tutti gli
  anni con una variazione annua); costi a carico del Comune o del gestore con tre listini: contratti
  tipo della Fondazione (bozze EsaCom del 15/10/2026: partecipazione al
  Programma e consulenza, voci fisse e per abitante, modificabili), Schema
  tariffario v1.2, solo costi indicati; ente di validazione e verifica e
  altri costi; ricavi, costi, margine, cumulato, anno di rientro, costo e
  ricavo per abitante; grafico con i valori negativi; export CSV; 13 prove.
  Da allineare: il simulatore stima circa 0,04 crediti per abitante
  all'anno (Bovisio), l'Allegato A del contratto EsaCom 0,19-0,23.
- **Simulatore: riferimento alla soglia del 65%** (richiesta di Luca) — lo
  scenario di riferimento si porta sempre al 65% di differenziata (stessa
  produzione, secco al 35%) e i risultati si calcolano per differenza dalla
  soglia (colonna «punti oltre il 65%»); avviso per produzione pro capite
  fuori scala. Verificato lo scenario «BOVISIO 21 ANNI»: rifiuti inseriti
  in quantità circa 180 volte più piccole del reale (2,5 kg/ab).
- **Simulatore: verifica di conformità al modello CWP** — scenario di
  riferimento secondo lo Standard 4.8.1 (anno con differenziata 64-66%
  oppure Tabella 3 del cluster × popolazione ISPRA 2022) con avvisi di
  addizionalità (4.9.1) e di qualità dei dati (±30%, 3.1.2); situazione
  attuale facoltativa come punto di partenza degli obiettivi; tabella di
  conformità in `docs/crediti-cwp.md`; 10 prove automatiche.
- **Simulatore di scenari, prima versione** (backlog 37) — script
  `28_simulatore.sql` (tabella `scenario_simulazione`, solo staff, audit;
  provato sul banco locale), pagina `/simulatore` nel menu di Operatori e
  Amministratori, motore `src/lib/crediti/simulatore.js` con 9 prove
  automatiche. Durata da menu 7/10/21 anni, più scenari per Comune, anno
  base (a mano, cluster SOSE o calcolo esistente), obiettivi annui con
  traiettoria lineare, % di differenziata e crediti anno per anno, grafici,
  confronto, CSV e stampa. Script 28 eseguito in produzione da Luca nel
  SQL Editor (in questa sessione i clic nel browser erano bloccati da un
  controllo di sicurezza).
- **Nuovo modulo in backlog: simulatore di scenari** (punto 37), richiesto
  da Luca: durata 7, 10 o 21 anni, più scenari per Comune, dati dell'anno
  base, obiettivi annui di produzione totale e pro capite e di secco
  residuo, ricalcolo della % di differenziata e stima dei crediti anno per
  anno. Assistente virtuale (punto 21) messo in evidenza tra i punti aperti.
  Aggiornati Registro, manuali, note sul calcolo, analisi requisiti e
  presentazione.
- **Copie di sicurezza e istruzioni di ripristino** — archivio di backup
  completo (codice con storia completa, manuali, presentazione, documenti
  ufficiali, documenti e memoria del progetto Claude, artefatti in PDF,
  materiale ricevuto), ramo `snapshot-2026-10-19` su GitHub con la versione
  della presentazione, nuovo documento «Istruzioni di ripristino»
  (`docs/ripristino.md`, rev. 1.0) scaricabile dalla pagina Documentazione.
- **Soggetto promotore del programma** — script `27_soggetto_promotore.sql`
  eseguito in produzione: la pagina /programma indica Fondazione Operate,
  gestore in esclusiva per conferimento di Wastelab (decisione del 19/10).
  Presentazione aggiornata: slide «Architettura e infrastruttura» e «Chi fa
  cosa nel portale», collegamenti al portale nelle slide di analisi
  funzionale, tolta la scelta sull'incarico del soggetto promotore.
- **PEC del Programma** — script `26_pec_programma.sql` eseguito in
  produzione alle 7:00: `operate@pec.it` compare sulla pagina pubblica
  /programma (informazioni del Programma e reclami).

### 18 ottobre 2026
- **Pagina pubblica popolata (sera)** — caricati dalla dashboard (Storage →
  `modelli`) gli otto PDF ufficiali del Programma e registrati con lo script
  `25_documenti_programma.sql`; script 24 rieseguito per l'ordine dei
  documenti come nella Guida. Verificati elenco e download dalla pagina
  /programma. Restano da inserire, perché servono dati della Fondazione: enti
  di validazione e verifica e registri riconosciuti,
  modulistica (i moduli non sono ancora disponibili).
- **Allineamento ai documenti ufficiali del Programma (punto 35, sera)** —
  tre rilasci. (1) Script `22_stato_ritirata.sql` e
  `23_allineamento_guida.sql` provati sul banco locale (migrazione di un
  Rapporto a 4 fasi, prove di ogni regola), eseguiti e verificati in
  produzione; funzione `consultazione-pubblica` ripubblicata (feedback anche
  per i Rapporti, Verify JWT rimasto spento); portale su main (commit
  16f4b95). (2) Script `24_programma_pubblico_crediti_reclami.sql` provato
  sul banco locale (emissione, registro, vendite, cancellazione, avvisi,
  reclami, dati pubblici, permessi negati ad anon); portale e funzione nel
  ramo `programma-pubblico`: eseguito e verificato in produzione alle 22:30
  (tabelle, funzioni, permessi negati ad anon, lavoro pg_cron), funzione
  ripubblicata, ramo portato su main. (3) Controlli della
  Gestione qualità dei dati nel calcolo crediti (`src/lib/crediti/qualita.js`,
  Tabella 3 dello Standard ±30% con motivazione obbligatoria, completezza,
  unicità, letture a buon fine, tempestività; anche nel rapporto PDF). Nuove
  prove `test/tariffe.test.mjs` e `test/qualita.test.mjs`. Manuali e
  presentazione aggiornati.
- **Rilettura dei documenti ufficiali del Programma** (Guida, Definizioni,
  Normativa, Standard, Metodologia, Politica di reclamo, Schema tariffario,
  Gestione della qualità dei dati, v1.2) in vista della presentazione del
  19/10: differenze con il portale nel capitolo «Decisioni», voce
  «Aperte». Corretta nel Manuale Amministratore e nel Manuale Test la
  descrizione del buffer (somma di più voci, al massimo 80%; il codice era
  già corretto).
- **Completamento funzionale dal confronto con i requisiti (punto 34)** —
  script `21_completamento_funzionale.sql` (provato sul banco locale,
  eseguito e verificato in produzione), funzione `consultazione-pubblica`
  ripubblicata, portale. Novità: Rapporti di Monitoraggio con 4 fasi e
  durate proprie; documenti richiesti per fase con indicatore presente /
  manca (il Comune sceglie la tipologia quando carica); pagina
  **Anagrafiche** per Operatori e Admin (Organizzazioni con dati fiscali e
  pratiche, Enti di Validazione con le pratiche assegnate); consultazione
  aperta e chiusa da funzioni del database, documento pubblicato e
  bloccato fino alla chiusura, osservazioni numerate, motivazione della
  non pubblicazione scritta dal moderatore, notifica al Comune per le
  osservazioni ammesse; conservazione per 10 anni (nessuna cancellazione,
  data di conservazione sulle pratiche chiuse o annullate); il Comune
  carica solo nelle fasi aperte; operatore mostrato nei pagamenti;
  notifica di apertura della fase 1; fascicolo con riepilogo PDF, cartella
  Validazione, contratto del Progetto nei Rapporti, tutte le consultazioni
  con errata corrige e allegati, note di fase, messaggi, nomi nello storico.
  Le Impostazioni sono state divise in componenti (`DurateFasi`,
  `DocumentiRichiesti`).
- **Rinforzi di integrità (punto 33)** — script `20_rinforzi_integrita.sql`
  (provato sul banco locale, eseguito e verificato in produzione), portale e
  Edge Functions `crea-utente` e `consultazione-pubblica` ripubblicate.
  Cosa cambia: (1) il database ragiona in ora italiana, come il portale e
  la pagina pubblica della consultazione (prima, tra mezzanotte e le 2,
  «oggi» era ancora il giorno prima); (2) una nuova pratica nasce con le 7
  fasi in un'unica operazione; (3) ruolo e organizzazioni di un utente si
  salvano insieme; la creazione di un utente imposta tutte le
  organizzazioni e, se qualcosa fallisce, l'account non resta a metà; la
  password temporanea scritta a mano deve avere 10 caratteri con lettere e
  numeri; (4) calcolo dei crediti: **corretto un difetto** per cui si
  potevano salvare dati nuovi e confermare il risultato calcolato su quelli
  vecchi; ora ogni modifica dei dati o della Banca Dati Utenze azzera il
  risultato salvato, la conferma richiede che le righe salvate siano
  quelle usate nel calcolo e la nuova versione si crea nel database in
  un'unica operazione; (5) chi ha una password temporanea non vede né
  scrive dati finché non la cambia (prima lo imponeva solo l'interfaccia).
  Rimossi i componenti del prototipo non usati. Decisione di Luca: l'audit
  resta leggibile da tutto lo staff. Il limite di 10 Rapporti
  era già garantito dal database (segnalazione del 18/10 errata).
  Effetto pratico: i calcoli in bozza calcolati prima di oggi vanno
  ricalcolati («Calcola») prima della conferma.
- **Codice commentato: punto 31 completato** — commentati anche le
  librerie (`src/lib`, compresi i moduli del calcolo crediti), l'avvio del
  portale (`main.jsx`, `App.jsx`), le cinque Edge Functions, le prove
  automatiche e gli strumenti di generazione dei documenti. Verifica: il
  portale compilato è identico byte per byte a quello di prima, le prove
  automatiche passano, gli script Python si compilano. Le Edge Functions
  pubblicate non vanno ridistribuite (cambiano solo i commenti). Corretti
  due commenti sbagliati: l'email di notifica parte dal trigger
  `trg_notifica_email` e dal job `cwp_riprova_email` (non da un webhook).
  Nuovi rinforzi aggiunti al punto 33.
- **Codice commentato e correzioni dalla revisione (punto 31)** — tutti i
  file del portale, delle Edge Functions, dei test e degli strumenti hanno
  ora intestazione e commenti in italiano; verifica: il portale compilato è
  identico byte per byte a quello senza commenti. La revisione ha fatto
  emergere e correggere: osservazioni non ancora ammesse leggibili dal
  Comune (solo il testo, senza autore) → script
  `19_correzioni_revisione_codice.sql` (provato in locale, eseguito e
  verificato in produzione); importi dei pagamenti con il punto delle
  migliaia («1.234,50») rifiutati o letti male → corretto; avviso «fase
  chiusa» mostrato due volte al Comune → corretto; un Amministratore poteva
  cambiare il ruolo di un altro Amministratore chiamando direttamente il
  database → bloccato (script 19). Aggiunto il capitolo 15 «Calcolo
  crediti». Segnalati per dopo
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
| Backup automatico | Dal 21/10/2026 sul Mac di Luca: lavoro launchd `it.operate.cwp-backup` alle 20:00 (`strumenti/backup/backup_cwp_mac.sh`, installato con `installa_backup_mac.sh`), chiave service_role nel Portachiavi, scrittura in Google Drive per desktop › Cwp › backup › <data>; database con la funzione `backup_completo()` (script 38). Il programma in Google Apps Script (`BackupCWP.gs`) è stato tolto: Google blocca i programmi personali sull'account di Luca | Mac di Luca |
| Registro issue e test in Word/PDF | `docs/registro-issue-test.md` → `public/documentazione/Registro_Issue_Test_Portale_CWP.docx` e `.pdf`, scaricabile da `/documentazione` (Admin) + Progetto: `claude/registro-issue-test.md` | Segnalazioni con data e ora, azioni correttive, prove e collaudi; aggiornato a ogni variazione (dal 21/10) |
| Manuale Amministratore in Word/PDF | `docs/manuale-amministratore.md` → `public/documentazione/Manuale_Amministratore_Portale_CWP.docx` e `.pdf`, scaricabile da `/documentazione` (Admin) | Versione impaginata e riservata del manuale per la Fondazione |
| Manuale Amministratore online | Claude Doc: https://claude.ai/code/artifact/cc36ab09-61e6-4dad-aaf0-4082ea0a46da (creato 18/10) | Prima stesura online, **superata** dal 18/10 (avviso in testa): fa fede il Word/PDF generato da `docs/manuale-amministratore.md` |
| Tracciato dati CWP v1.0 | `public/modelli/Tracciato_dati_CWP_v1.xlsx`, online su `/formato-dati` | Modello unico dei dati per il calcolo crediti |
| Note sul calcolo crediti | `docs/crediti-cwp.md` | Corrispondenza con le formule, scelte interpretative |
| Notifiche email | `docs/email-notifiche.md` | Funzionamento e configurazione Resend |
| Controlli sui file | `docs/controlli-file.md` | Regole di caricamento, opzioni antivirus |
| Crediti volontari dalla raccolta differenziata: valore e criticità | https://claude.ai/artifact/CLvQ82y6UwHznZBUujHy9J (15/10) | Analisi di contesto correlata al Programma |
| Documenti di riferimento | allegati in chat del 17/10 | *Requisiti della piattaforma* (15/09/2026), *Metodologia CWP v1.2* |
| Istruzioni di ripristino in Word/PDF | `docs/ripristino.md` → `public/documentazione/Istruzioni_Ripristino_Portale_CWP.docx` e `.pdf`, scaricabile da `/documentazione` (Admin) | Copie di sicurezza e ripristino di GitHub, Vercel, Supabase, Resend e progetto Claude |
| Archivio di backup completo | File `Portale_CWP_backup_completo_<data>.zip` consegnato a Luca (prima copia 19/10/2026) e ramo GitHub `snapshot-2026-10-19` | Codice con storia completa, manuali, presentazione, documenti ufficiali, progetto Claude, artefatti in PDF |

---

## 11. Decisioni

**Prese**
- 17/10 — Stack: GitHub + Vercel + Supabase; login email+password; MFA per
  lo staff prevista.
- 17/10 — Repository pubblico (solo codice) per il piano gratuito Vercel.
- 17/10 — Sezione calcolo crediti riservata agli Amministratori (fuori dal
  perimetro della piattaforma secondo i requisiti, aggiunta su richiesta).
- 17/10 — MFA: in attesa, interruttore spento.
- 18/10 — Una sola utenza per Organizzazione: non vincolante. **Superata la sera del 18/10**: un solo account cliente attivo (Guida 7.2).
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
- 18/10 — Rapporti di Monitoraggio: percorso di 4 fasi senza consultazione (Caricamento del rapporto, Verifica documentale, Validazione e verifica, Chiusura); si creano in qualsiasi momento mentre il Progetto è attivo. **Superata la sera del 18/10** (vedi sotto): 7 fasi come la Guida.
- 18/10 — La pratica la chiude sempre lo staff a mano (la chiusura della fase finale non la chiude).
- 18/10 — Documenti richiesti per fase: elenco configurabile dall'Admin, solo indicatore (non blocca la chiusura della fase).
- 18/10 — Audit: resta leggibile dal database da tutto lo staff (serve alla cronologia nel fascicolo esportato dagli Operatori); la pagina Audit resta solo per gli Amministratori.

- 18/10 sera — **Allineamento ai documenti ufficiali del Programma** (Guida,
  Standard, Schema tariffario, Politica di reclamo, Gestione qualità dei
  dati, v1.2), decisione di Luca dopo la rilettura dei documenti (script
  22-24): Rapporto con le stesse 7 fasi del Progetto e feedback pubblico di
  20 giorni; termine «feedback pubblico»; conservazione 12 anni; un solo
  account cliente attivo per Organizzazione con fino a 2 delegati; periodo
  di riferimento 10 anni o 7 rinnovabili (10 o 21 Rapporti); stati del
  Programma e ID; ritiro e rientro; un solo progetto per territorio (codici
  ISTAT); avviso dopo 2 anni senza Rapporti; tipologie e documenti
  richiesti della Guida, contratto e versione privata mai pubblici; voci e
  importi dello Schema tariffario con sospensione fino al saldo; verifica
  sull'accuratezza e accertamenti; piattaforma pubblica /programma; crediti
  emessi con ID, registro esterno, vendite e cancellazione; reclami;
  controlli della Gestione qualità dei dati nel calcolo.

- 19/10 — **Soggetto promotore del programma: Fondazione Operate.** Lo Studio
  Associato Wastelab, proprietario del Programma, ha conferito in esclusiva a
  Fondazione Operate, con accordi legali e commerciali, la gestione della
  parte commerciale e della parte tecnologica (portale CWP). Pubblicato sulla
  pagina /programma (script 27).
- 19/10 — **Più Amministratori, uno principale.** Gli Amministratori hanno
  tutti accesso completo e possono nominarne altri dal portale (supera la
  regola del 17/10 «nomina solo da Supabase»). L'Amministratore principale,
  luca.moretti@operate.it, non si modifica, non si disattiva e non si
  cancella (script 29).
- 19/10 — **Qualificazione ACN non necessaria** (valutazione di Luca): il
  portale serve alla qualificazione del modello CWP, il Comune vi riversa
  dati e non acquista un servizio cloud; le quote dei contratti riguardano
  partecipazione al Programma e consulenza, non l'uso del portale. Restano
  GDPR, dati in UE e i punti di sicurezza del backlog. Da confermare con un
  parere legale breve.

**Aperte**
- Scelte interpretative del calcolo crediti (soprattutto il segno del riuso,
  formule 26 e 29).
- Antivirus: ClamAV su server proprio o servizio a pagamento.
- Accesso degli stakeholders al feedback pubblico con SPID, CIE o CNS
  (Guida 3.9): serve l'adesione della Fondazione come fornitore di servizi
  (direttamente con AgID o tramite un aggregatore accreditato) e il relativo
  contratto. Intanto resta l'email confermata (decisione D).
- Rapporti prima della registrazione del Progetto: lo Standard 4.5 li
  prevede dopo lo stato «progetto registrato»; il portale continua a
  permetterne la creazione mentre il Progetto è attivo (decisione del
  18/10), l'emissione dei crediti richiede comunque il Rapporto registrato.
- Simulatore di scenari (punto 37): modello di stima semplificato da
  confermare (con le formule della Metodologia i crediti nascono solo dai
  rifiuti evitati, non dall'aumento della differenziata a parità di
  totale) e visibilità degli scenari (oggi solo staff, scelta provvisoria
  del 19/10).
- Assistente virtuale (punto 21): ambito, dati che può leggere, costi d'uso.
- ~~Simulatore: metodo di stima dei crediti da allineare con quello delle
  stime commerciali~~ — fatto il 19/10: metodo «per utenza, solo utenze
  virtuose» nel simulatore. Restano da confermare con chi ha preparato
  l'Allegato A: la variabilità tra utenze (ipotesi 30%), la lettura del
  dimezzamento del buffer con la tariffa puntuale e i 6,08 € per abitante
  di costo (le tabelle danno 5,36: forse l'ente di validazione e verifica).

---

## 12. Backlog per chiudere lo sviluppo

Numerazione stabile: un punto mantiene il suo numero anche quando è
completato (va barrato qui e annotato in Cronologia).

**Da fare subito (stato al 23/10/2026)** — riepilogo delle azioni
aperte; il dettaglio è nei punti numerati qui sotto.

*Azioni di Luca (Claude non le può fare: chiavi, pubblicazioni, account)*
- **Marketing** (in produzione dal 23/10): prima delle campagne reali verificare il dominio email su Resend
  (`EMAIL_MITTENTE`) e far controllare a un legale le email promozionali
  agli enti (art. 130 Codice privacy, informativa art. 14 GDPR).
- **Installare il backup giornaliero dal Mac** (Google Drive per desktop e
  installatore `strumenti/backup/installa_backup_mac.sh`, con la chiave
  service_role inserita da Luca; Istruzioni di ripristino, capitolo
  «Backup»). Il backup in Google Apps Script è stato tolto (bloccato da
  Google).
- ~~Eseguire lo script `34_sicurezza_avvisi.sql`~~ — fatto il 23/10 alle 12:20 su incarico di Luca.
- DPIA e accordo sul trattamento (art. 28 GDPR) con i Comuni prima di caricare utenze reali nella Banca Dati Utenze per utenza.
- Inoltrare alla Fondazione le domande in ATTESA_REGOLA (R01-R04, R06, riuso, N05, N06, frazioni vuote nel calcolo per utenza) e decidere gli interventi sui dati proposti (fase 5 senza ente, fasi senza scadenza, codici).
- Attivare gli avvisi automatici di GitHub (Settings → Code security → Dependabot alerts) e decidere sul CAPTCHA delle pagine pubbliche.
- ~~Eseguire gli script 32 e 33 e rieseguire lo script 30~~ — fatto il
  20/10 (su incarico di Luca, codice caricato dal repository).
- ~~Ripubblicare le funzioni `assistente`, `crea-utente` e
  `reimposta-password`~~ — fatto il 20/10 (codice caricato nell'editor di
  Supabase direttamente dal repository, Verify JWT attivo su tutte e tre).
- Verificare il dominio email su Resend (punto 17): finché manca, le email
  arrivano solo al titolare dell'account.
- Decidere se spostare la fatturazione dell'assistente su un'organizzazione
  della Claude Console intestata alla Fondazione (oggi è «Luca's Individual
  Org»; ricevute a nome di Luca) — punto 21.

*Collaudo in corso*
- Gli Amministratori Andrea Valentini, Albina Ambrogio, Andrea Pavan,
  Gianluca Tapparini e Luca Belfiore stanno provando portale, calcolo
  crediti e simulatore (punto 19): le loro segnalazioni si correggono man
  mano; i dati di prova restano fino alla chiusura del collaudo.
- Primo rapporto (V01 del 20/10): D01-D07 corretti e **rilasciati in
  produzione il 20/10** (commit e0c91a9, script 35 eseguito; da ritestare); R01, R02, R03, R06, R08 e il
  segno del riuso aspettano una regola della Fondazione; risposte nel
  documento `docs/collaudo/Collaudo_V01_risposte.md`. **Per Luca:** creare i tre utenti
  di prova «COLLAUDO V03 Cliente A / Cliente B / Operatore» (password per
  canale separato, MFA non disattivata).
- Integrazione V05 (21/10): profili creati da Luca e provati (separazione
  A/B e dinieghi superati). D05-R1 (testi lunghi nell'Audit) e O01
  (messaggio «Account disattivato») corretti e in produzione dal 21/10; D08 (email ai nuovi utenti) richiede il
  dominio verificato su Resend (punto 17).

*Sviluppo (Claude)*
- ~~Utenti online (punto 38)~~, ~~messaggi d'errore dell'assistente in
  italiano (punto 39)~~ e ~~PDF ed Excel del simulatore (punto 37)~~ —
  fatti il 20/10 e attivi in produzione.
- ~~Assistente: Operatori e aiuto sulla singola pratica (punto 21)~~ — fatto il 21/10.
- Simulatore: conferma del modello ed eventuale visione da parte del Comune
  (punto 37).
- ~~Banca Dati Utenze per utenza e collegamento al motore~~ — fatti il
  22-23/10 (script 40-41); ~~valore dei crediti nella Dashboard~~ — fatto
  il 23/10 (script 42).
- Sicurezza (punti 14-18 e 30, verifica OWASP in corso) e passaggio ai piani a pagamento (punto 29).
- Collaudo con dati reali e conferma delle scelte interpretative (punti 8,
  9 e 19).

**Calcolo crediti (back-office)**

- ~~**1.** Import diretto del tracciato dati (Excel/ZIP) nel calcolo~~ — fatto il 18/10.
- ~~**2.** Aggregazione automatica delle singole letture (foglio 6_Letture)~~ — fatto il 18/10.
- ~~**3.** Controllo privacy all'import~~ — fatto il 18/10 (blocco dell'import).
- ~~**4.** Scelta del file direttamente dalla pratica del Comune~~ — fatto il 18/10.
- ~~**5.** Controlli di coerenza (classi, totali, valori anomali)~~ — fatto il 18/10.
- ~~**6.** Rapporto di calcolo in PDF~~ — fatto il 18/10.
- ~~**7.** Registro dei crediti calcolati e confermati~~ — fatto il 18/10: numero progressivo dei calcoli (elenco interno) e, con lo script 24, emissione dei crediti con ID univoci, caricamento sul registro esterno, vendite e cancellazione tombale (Guida 6.3.2-6.3.3).
- **8.** Collaudo con dati reali di un Comune.
- **9.** Conferma delle scelte interpretative (anche con l'aiuto dei collaudatori del punto 19).
- **37.** **Simulatore di scenari** — richiesto da Luca il 19/10; **prima versione fatta il 19/10** (script 28 eseguito in produzione, pagina `/simulatore`, motore `simulatore.js`). Il 20/10 aggiunti PDF impaginato ed export Excel. Restano: eventuale visione da parte del Comune, conferma del modello. Strumento
  previsionale (ex ante, non certificabile) per stimare quanti crediti un
  Comune potrebbe generare:
    - **Scenari**: per ogni Comune più scenari con nome e note (per esempio
      «prudente», «obiettivo», «ambizioso»), duplicabili e confrontabili.
    - **Durata**: menu a tendina **7, 10 o 21 anni** (Standard 4.3.8: 10 anni,
      oppure 7 rinnovabili fino a 21) e anno di partenza.
    - **Dati dell'anno base**: popolazione residente, produzione totale dei
      rifiuti urbani (t) e pro capite (kg/ab), percentuale di raccolta
      differenziata, ripartizione per frazione (Catasto ISPRA), cluster SOSE e
      parametri del calcolo (fattori di emissione, buffer previsto); si
      possono riprendere dal tracciato dati o da un calcolo esistente.
    - **Obiettivi per anno**: per ogni anno del periodo, produzione totale
      prevista (t) e pro capite, e **secco residuo pro capite** (kg/ab)
      obiettivo; facoltativa la popolazione prevista.
    - **Ricalcolo per anno**: secco totale = secco pro capite × popolazione;
      differenziata = totale − secco; **% di differenziata** = differenziata /
      totale; la differenziata si ripartisce tra le frazioni con le
      proporzioni dell'anno base (modificabili).
    - **Crediti simulati per anno**: emissioni dello scenario di riferimento
      meno emissioni dello scenario simulato, con i fattori di emissione della
      Metodologia; crediti lordi, buffer, crediti netti; totale del periodo.
    - **Uscite**: tabella anno per anno, grafico, confronto tra scenari,
      stampa in PDF ed export in Excel.
    - **Da decidere**: il modello di stima semplificato (a livello di Comune,
      senza Banca Dati Utenze) va confermato dalla Fondazione; chi vede gli
      scenari (solo Fondazione o anche il Comune interessato).
    - **Tecnica prevista**: tabelle `scenario_simulazione` e `scenario_anno`
      (nuovo script), pagina «Simulatore» nell'area Crediti, motore
      `src/lib/crediti/simulatore.js` che riusa i parametri di `parametri.js`,
      prove automatiche, audit di creazione e modifica.

**Pratiche**

- ~~**10.** Note di fase~~ — fatto il 18/10 (script 17).
- ~~**11.** Schermata Enti di Validazione~~ — fatto il 18/10 (Impostazioni).
- ~~**12.** Template di documenti scaricabili dai Comuni~~ — fatto il 18/10 (Impostazioni → Modelli).
- ~~**13.** Consultazione: errata corrige, allegati ai commenti, identificazione dei commentatori esterni~~ — fatto il 18/10 (pagina pubblica, funzione `consultazione-pubblica`).

**Sicurezza**

- **14.** Registro di sicurezza (accessi, tentativi falliti, cambi di permessi). Il 20/10 fatti registro degli accessi e dei tentativi non riusciti (script 33, sezione «Audit User»); i cambi di permessi erano già nell'audit (tabelle profilo e utente_organizzazione). Restano gli avvisi automatici su accessi anomali.
- **15.** Attivazione della verifica in due passaggi (MFA).
- **16.** Antivirus sui file caricati (a fine progetto).
- **17.** Verifica del dominio email su Resend.
- **18.** Ambiente di prova, backup e procedura di ripristino.

**Chiusura**

- **19.** Collaudo completo e pulizia dei dati di test (comprese le notifiche "Email di prova"). **Collaudo in corso** (comunicato da Luca il 20/10): i test di funzionamento del portale, del calcolo crediti e del simulatore li stanno facendo gli Amministratori nominati da Luca: Andrea Valentini, Albina Ambrogio, Andrea Pavan, Gianluca Tapparini e Luca Belfiore. Le loro pratiche e i loro scenari di prova (per esempio «COLLAUDO V03», «TEST AL») non vanno cancellati finché il collaudo non è chiuso; le loro operazioni si seguono in Audit User.
- ~~**20.** Decisioni A e B della Fondazione~~ — prese il 18/10 (capitolo Decisioni).

**Rifiniture emerse dalla stesura del Manuale Utente (18/10)**

- ~~**22.** Recupero e cambio password per gli utenti~~ — fatto il 18/10 (resta la configurazione di Site URL, Redirect URLs e SMTP in Supabase per l'email di recupero).
- ~~**23.** Dopo l'accesso da un link email, riportare l'utente alla pratica del link~~ — fatto il 18/10.
- ~~**24.** Pratica non attiva: spiegare perché i pulsanti di risposta alle integrazioni non compaiono e nascondere "+ Carica"~~ — fatto il 18/10.
- ~~**25.** Date della consultazione in formato gg/mm/aaaa~~ — fatto il 18/10.
- ~~**26.** Canale di messaggi tra Comune e Fondazione nella pratica~~ — fatto il 18/10 (sezione Messaggi).
- ~~**27.** Mostrare ai Comuni le voci di pagamento~~ — fatto il 18/10 (sola lettura).
- **28.** Riservatezza della documentazione: il registro è nel repository pubblico e i file Word/PDF di Registro, Manuale Amministratore e Manuale Test (`public/documentazione/`) sono raggiungibili da chi conosce l'indirizzo (il portale li mostra solo agli Amministratori). Per renderli davvero riservati: archivio privato su Supabase con accesso solo Admin, o repository privato (oggi incompatibile con il piano gratuito di Vercel).

**Infrastruttura**

- **29.** Passaggio a piani a pagamento di **Vercel** e **Supabase** (decisione del 18/10). Dopo l'attivazione: rendere privato il repository GitHub e ricollegarlo a Vercel (risolve in buona parte il punto 28); verificare i backup automatici di Supabase e scrivere la procedura di ripristino (punto 18); valutare l'ambiente di prova separato (punto 18); decidere se alzare il limite di 50 MB per file; aggiornare i §2-3 di questo registro con piani, costi e intestatario dei contratti.

**Sicurezza informatica (cyber security) — richiesta di Luca del 18/10**

- **30.** Protezione dagli attacchi informatici, in un piano unico che riprende anche i punti 14-18. Da fare:
    - **Verifica di sicurezza** del portale secondo le linee OWASP (accessi, permessi, caricamento file, iniezioni) e controllo automatico delle regole del database con il *Security Advisor* di Supabase (20/10: 0 errori; i 209 avvisi riguardano funzioni senza percorso di ricerca fisso ed eseguibili senza accesso, risolti dallo script 34; resta l'estensione pg_net nello schema public, che non si può spostare senza rifare le email automatiche); a fine sviluppo, test di intrusione (penetration test) affidato a terzi.
    - ~~**Intestazioni di sicurezza** del sito~~ — fatto il 20/10 (`vercel.json`: Content-Security-Policy, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; CSP provata con le pagine compilate prima di renderla obbligatoria).
    - **Protezione degli accessi**: limiti ai tentativi di login e di recupero password, CAPTCHA sulle pagine pubbliche, verifica in due passaggi per lo staff (punto 15), regole sulle password, ~~scadenza delle sessioni inattive~~ (fatto il 20/10: 30 minuti staff, 60 enti, `UscitaInattivita.jsx`). I limiti ai tentativi di accesso sono quelli di Supabase Auth; il portale registra i tentativi e avvisa (script 33-34); un blocco vero dell'account dopo N tentativi richiede gli «Auth Hooks» di Supabase dei piani superiori. CAPTCHA: serve un account Cloudflare Turnstile o hCaptcha (decisione e chiavi di Luca).
    - **Dipendenze e segreti**: controllo periodico delle librerie vulnerabili (npm audit, avvisi automatici di GitHub), scansione dei segreti nel repository, rotazione delle chiavi. ~~`npm audit`~~: il 20/10 aggiornati React Router 7.18 e Vite 7.3, **0 vulnerabilità**; scansione dei segreti nel codice e in tutta la storia del repository: nessuna chiave trovata. Restano gli avvisi automatici di GitHub (Dependabot, da attivare nelle impostazioni del repository) e la rotazione periodica delle chiavi.
    - **Monitoraggio e allarmi**: ~~registro di sicurezza (punto 14) e avvisi su accessi anomali~~ (fatti il 20/10, script 33-34); restano gli avvisi su errori e indisponibilità del portale (servizio di monitoraggio esterno).
    - **Continuità**: backup verificati e prova di ripristino (punti 18 e 29), antivirus sui file (punto 16).
    - **Organizzazione e privacy**: procedura di risposta agli incidenti, valutazione d'impatto sulla protezione dei dati (DPIA) e registro dei trattamenti per i dati delle utenze, nomina dei fornitori (Vercel, Supabase, Resend) come responsabili del trattamento.

**Codice e documentazione — richieste di Luca del 18/10**

- ~~**31.** Codice sorgente commentato per sviluppatori umani~~ — fatto il 18/10: ogni file (portale, script SQL, Edge Functions, prove, strumenti) ha in testa lo scopo e il collegamento al capitolo del registro, e commenti in italiano su funzioni, regole di sicurezza e passaggi non ovvi. **Regola permanente:** vale anche per tutto il codice nuovo o modificato.
- **32.** Manuale Test (test-user): guida sintetica per i collaudatori, riservata agli Amministratori, da aggiornare a ogni rilascio insieme a registro, Manuale Utente e Manuale Amministratore.

- ~~**33.** Pulizia e rinforzi emersi dalla revisione del codice del 18/10~~ — fatto il 18/10 (script 20):
    - ~~creazione del Progetto e delle sue 7 fasi in un'unica funzione del database~~ — fatto (`staff_crea_pratica`);
    - ~~import della Banca Dati Utenze~~ — resta a blocchi (una sola chiamata non regge centinaia di migliaia di righe), ma un salvataggio a metà non si può più confermare: fatto;
    - ~~password temporanee: allineare `crea-utente` alla regola dei 10 caratteri con lettere e numeri~~ — fatto;
    - ~~obbligo di cambio della password temporanea imposto anche dal database~~ — fatto;
    - ~~modifica di un utente, nuova versione di un calcolo, creazione di un utente non atomiche~~ — fatto;
    - ~~data della consultazione in ora italiana~~ — fatto (tutto il database in ora italiana);
    - ~~limite di 10 Rapporti di Monitoraggio nel database~~ — era già garantito (vincolo e indice dello script 01);
    - ~~componenti del prototipo, stile `avviso`, `datiEsempio.js`, `etichetta()` non usati~~ — eliminati;
    - ~~audit leggibile da tutto lo staff~~ — decisione di Luca del 18/10: resta così (capitolo Decisioni).

**Completamento funzionale — confronto con i requisiti del 15/09 (18/10)**

- ~~**34.** Parti dei requisiti mancanti o incomplete~~ — fatto il 18/10 (script 21): Rapporti con percorso proprio, documenti richiesti per fase, censimento di Organizzazioni ed Enti da parte degli Operatori con i Progetti associati, blocco del documento in consultazione, numero e motivazione delle osservazioni, conservazione per 10 anni, caricamenti solo nelle fasi aperte, fascicolo completo con riepilogo PDF. Restano fuori, per scelta o perché dipendono da altri: la regola «una sola utenza per Organizzazione» (non vincolante, decisione del 18/10), la procedura di cancellazione a fine conservazione (la definirà la Fondazione), le regole del registro dei crediti (punto 7).

**Da rifinire**

- ~~**35.** Allineamento ai documenti ufficiali del Programma~~ — fatto la sera del 18/10 (script 22-24, portale, funzione `consultazione-pubblica`): vedi Decisioni e Cronologia. Resta SPID/CIE/CNS (punto 36).
- **41.** **Marketplaces** — voce di menu predisposta il 20/10 (grigia, non cliccabile) per Amministratori e utenti degli enti; contenuto della sezione da definire con Luca.
- **36.** Accesso degli stakeholders con SPID, CIE o CNS (Guida 3.9): adesione come fornitore di servizi (AgID o aggregatore), poi integrazione nella pagina del feedback pubblico.
- ~~**38.** **Utenti online**~~ — richiesto da Luca il 19/10, fatto il 20/10 (script 32, componente `UtentiOnline.jsx`): l'Amministratore principale vede quanti e quali utenti sono collegati, con pagina aperta e durata, e chi è stato visto nelle ultime 24 ore. Script 32 eseguito in produzione il 20/10.
- ~~**40.** **Audit User**~~ — richiesto da Luca il 20/10, fatto lo stesso giorno (script 33, pagina `/audit-utenti`): sezione solo per l'Amministratore principale con utenti e stato online, registro degli accessi (entrate, uscite, tentativi non riusciti) e operazioni dell'audit trail per utente, compreso lo scaricamento dei documenti; CSV. Script 33 eseguito in produzione il 20/10.
- ~~**39.** **Messaggi d'errore dell'assistente in italiano semplice**~~ — fatto il 20/10 (funzione `assistente` ripubblicata lo stesso giorno). Proposto il 19/10: oggi, se Anthropic rifiuta una richiesta (per esempio credito finito), l'utente vede il messaggio tecnico in inglese. Da sostituire con frasi semplici («L'assistente è momentaneamente non disponibile, riprova più tardi»), lasciando il dettaglio tecnico nei log della funzione. Richiede di ripubblicare la funzione `assistente`. Confermato da Luca il 20/10.
- **21.** **Assistente virtuale (Claude)** integrato nel portale — richiesto da Luca il 18/10, confermato tra i punti aperti il 19/10. **Prima versione fatta il 19/10** (Amministratori ed enti, risposte dalla base di conoscenza su portale e tariffe: script 31, funzione `assistente`, componente `AssistenteVirtuale`); **attivo dal 19/10** (chiave e crediti della Claude Console di Luca; da decidere se spostare la fatturazione su un'organizzazione della Fondazione). Durante l'attesa della risposta la finestra mostra «Un attimo…» (richiesta di Luca del 19/10). Restano i passi successivi descritti qui sotto (Operatori, aiuto sulla singola pratica). Funziona con i modelli Claude di Anthropic tramite API (lo sviluppo del portale si fa con Claude Code). Ambito da definire; usi possibili: assistente per gli utenti dei Comuni (come compilare, cosa manca nella pratica), supporto agli Operatori (controllo completezza dei documenti, bozze di richieste di integrazione e di risposte ai commenti), verifica del tracciato dati prima dell'import, spiegazione dei risultati del calcolo crediti. Richiede: chiave API Anthropic (segreto in Supabase), una Edge Function che faccia da tramite, regole su quali dati l'agente può leggere (privacy) e registrazione delle sue azioni nell'audit.

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
| Il codice della funzione `assistente` incollato nell'editor di Supabase si era interrotto a metà (72 righe su 180) e il deploy dava errore; inoltre i file `.ts` inviati in chat sembravano vuoti (alcuni programmi li scambiano per video) | Codice caricato nell'editor direttamente dal repository e nome corretto (`assistente`); per incollare a mano si usa la copia `.txt` |
| Anthropic rifiutava le richieste: «API key is not scoped to a workspace» | La chiave era valida per tutti gli spazi di lavoro e richiede l'intestazione `anthropic-workspace-id`; creata una nuova chiave legata a un solo spazio di lavoro e sostituito il segreto (senza cambiare il codice) |
| Anthropic rispondeva «credit balance is too low» dopo il collegamento dei crediti del piano Max | Il primo accredito mensile era ancora in elaborazione; Luca ha acquistato 100 $ di crediti nella Console (Fatturazione) |
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
| `staff_apri_fase`, `staff_chiudi_fase` | 08, 23, 39 | staff | Apertura (scadenza dalla durata della fase; fase 5 solo con un ente attivo) e chiusura delle fasi (fase 3 solo a feedback concluso) |
| `staff_apri_consultazione`, `staff_chiudi_consultazione` | 21, 23, 39 | staff | Apertura del feedback pubblico (apre anche la fase 3) e chiusura (solo dopo il termine, insieme alla fase 3; prima solo per pratica annullata, ritirata o chiusa, con motivazione) |
| `staff_modifica_scadenza` | 08 | staff | Nuova scadenza con motivazione |
| `staff_cambia_stato_pratica` | 08 | staff | Attiva / sospesa / annullata / chiusa con motivazione |
| `staff_richiedi_integrazione`, `staff_chiudi_integrazione` | 08 | staff | Ciclo delle integrazioni |
| `cliente_rispondi_integrazione` | 08 | Comune | Risposta con documento |
| `rispondi_commento` | 07 | Comune | Risposta a un'osservazione ammessa |
| `staff_autori_commenti` | 17 | staff | Nome ed email degli autori delle osservazioni |
| `staff_errata_corrige` | 17 | staff | Errata corrige, eventuale ripartenza dei 30 giorni |
| `staff_imposta_ente_validazione` | 17, 39 | staff | Ente di Validazione della pratica (non si toglie con la fase 5 aperta) |
| `cruscotto_valore_progetti` | 43 | tutti con accesso (staff: tutto; Comuni: i propri) | Dati per il valore dei progetti (Caso 1 / Caso 2) in Dashboard e Le mie pratiche |
| `staff_crea_pratica`, `staff_aggiorna_dati_pratica` | 20, 23, 43 | staff | Creazione del Progetto con le 7 fasi e modifica dei dati, dal 23/10 anche il listino Caso 1 / Caso 2 |
| `cruscotto_valore_crediti` | 42 | tutti con accesso (staff: tutto; Comuni: i propri) | Valore dei crediti in simulazione e in fase esecutiva, in crediti ed euro |
| `admin_imposta_prezzo_riferimento` | 42 | admin | Prezzo di riferimento del credito (Impostazioni), con audit |
| `cwp_utenze_controllo` | 41 | uso interno (trigger della conferma) | Numero di utenze del calcolo, senza categoria di simulazione e con categoria fuori delibera |
| `staff_elenco_utenze`, `admin_utenze_calcolo`, `admin_svuota_utenze` | 40 | staff / admin | Banca Dati Utenze del calcolo: consultazione registrata nell'audit, lettura per il motore senza dati personali, svuotamento prima di un nuovo caricamento |
| `admin_elenco_utenti`, `admin_aggiorna_utente`, `admin_imposta_organizzazioni`, `admin_imposta_attivo` | 05, 06, 10 | admin | Gestione utenti |
| `admin_imposta_durata_fase` | 13 | admin | Durata delle fasi con motivazione |
| `admin_registro_crediti` | 18 | admin | Registro dei crediti (valido / sostituito) |
| `mio_stato_mfa`, `sono_admin` | 10 | tutti | Stato della verifica in due passaggi, controllo Admin per le Edge Functions |
| `password_cambiata` | 15 | tutti | Toglie l'obbligo di cambio password e scrive l'audit |
| `segnala_presenza`, `presenza_uscita` | 32 | tutti | Presenza per «Utenti online» (all'apertura delle pagine, una volta al minuto, all'uscita) |
| `utenti_online`, `amministratore_principale_id` | 32, 29 | Amministratore principale | Elenco degli utenti online e visti nelle ultime 24 ore; id dell'Amministratore principale |
| `registra_accesso`, `registra_uscita`, `registra_accesso_fallito`, `registra_download` | 33 | tutti (il fallito anche senza accesso) | Registro degli accessi e «download documento» nell'audit |
| `audit_utenti_stato`, `audit_registro_accessi`, `audit_operazioni_utente` | 33 | Amministratore principale | Sezione «Audit User» |

### 14.5 Tabelle e archivi

| Tabella | Script | Contenuto |
|---|---|---|
| `organizzazione`, `utente_organizzazione`, `profilo` | 01, 06 | Comuni ed enti, utenti, associazioni utente-organizzazione |
| `pratica`, `fase`, `durata_fase` | 01, 13, 43 | Progetti e Rapporti (dal 23/10 con il listino Caso 1 / Caso 2), 7 fasi, durate |
| `documento` | 01 (07, 14) | Documenti con versioni, visibilità, impronta |
| `richiesta_integrazione` | 01 (08) | Integrazioni |
| `nota_fase`, `messaggio` | 17 | Note di fase, messaggi Comune-Fondazione |
| `consultazione`, `commento`, `commento_in_attesa`, `consultazione_errata` | 01, 17 | Consultazione pubblica |
| `pagamento` | 01 (09, 17) | Voci di pagamento e incassi |
| `ente_validazione`, `modello_documento` | 01, 17 | Anagrafica enti, modelli per i Comuni |
| `notifica` | 09 | Notifiche interne (e stato dell'email) |
| `audit_event` | 01 (07) | Registro delle operazioni, immutabile |
| `impostazione` | 10 | Interruttori (MFA, indirizzo della funzione email) |
| `calcolo_crediti`, `calcolo_conferimento`, `calcolo_riuso`, `contatore_registro` | 11, 18 | Calcoli dei crediti, Banca Dati Utenze del tracciato (passo 5b), numerazione del registro |
| `calcolo_utenza` | 40 | Banca Dati Utenze per utenza (passo 5a): una riga per utenza con categorie e kg per frazione; usata dal motore dallo script 41 |
| `scenario_simulazione` | 28, 42, 43 | Scenari del simulatore (dal 23/10 anche i ricavi del periodo e quanto paga il cliente) |
| `credito_lotto`, `credito_vendita` | 24 | Crediti emessi e vendite comunicate dal registro |
| `recupero_password_richiesta` | 16 | Limite alle richieste di recupero password |
| `assistente_uso` | 31 | Domande e token dell'assistente per utente e giorno (nessun testo) |
| `presenza` | 32 | Ultima presenza di ogni utente nel portale (Utenti online) |
| `registro_accessi` | 33 | Accessi, uscite e tentativi non riusciti (immutabile) |

Archivi (Storage, tutti privati): `documenti` (file delle pratiche,
cartella = id della pratica), `modelli` (modelli per i Comuni),
`allegati-consultazione` (allegati alle osservazioni, scritti solo dalla
funzione `consultazione-pubblica`).

### 14.6 Librerie esterne (package.json)

| Libreria | Versione | Uso |
|---|---|---|
| `react`, `react-dom` | 18.3 | Interfaccia |
| `react-router-dom` | 7.18 | Indirizzi delle pagine (aggiornato da 6 il 20/10 per un avviso di sicurezza) |
| `@supabase/supabase-js` | 2.45 | Collegamento a Supabase (dati, accesso, archivi, funzioni) |
| `jszip` | 3.10 | Lettura del tracciato Excel/ZIP, export del fascicolo |
| `jspdf`, `jspdf-autotable` | 4.2 / 5.0 | Rapporto di calcolo e PDF del simulatore |
| `vite`, `@vitejs/plugin-react` | 7.3 / 4.7 | Compilazione e server di sviluppo (Vite aggiornato da 5 il 20/10) |

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
Inventario generato da `strumenti/inventario_codice.py`: 186 file, 44.518 righe in tutto.

**Avvio e instradamento**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/App.jsx` | 282 | associa ogni indirizzo alla sua pagina e decide chi può aprirla. Le pagine riservate passano dal componente Protetta, che nell'ordine chiede: sessione attiva, eventuale nuova password (link di recupero o password temporanea),… |
| `src/main.jsx` | 32 | monta l'applicazione nell'elemento #root di index.html e la avvolge nei contesti globali: StrictMode (controlli di React in sviluppo), BrowserRouter (indirizzi /pratiche, /crediti, …) e AuthProvider (sessione, ruolo, MFA).… |

**Pagine (src/pages)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/pages/Anagrafiche.jsx` | 214 | censimento di Organizzazioni ed Enti di Validazione (requisiti §3: l'Operatore «censisce Organizzazioni ed Enti di Validazione»). - Organizzazioni: elenco con ricerca, dati essenziali (tipo, codice fiscale, partita IVA, PEC,… |
| `src/pages/AreaCliente.jsx` | 173 | il Comune/azienda vede l'elenco dei propri Progetti (schede compatte con stato) e, sotto, il dettaglio della pratica selezionata: fasi, documenti, integrazioni, messaggi. Link al Manuale Utente in PDF. Sul telefono (fino a 760… |
| `src/pages/Audit.jsx` | 175 | tabella degli eventi registrati (data, utente, operazione, pratica, passaggio di stato, motivazione), con ricerca testuale e pulsante per caricare eventi meno recenti (requisiti §10). Ogni colonna si ordina con un clic… |
| `src/pages/AuditUtenti.jsx` | 477 | Nomi leggibili degli eventi di accesso. |
| `src/pages/BackOffice.jsx` | 263 | a sinistra l'elenco dei Progetti (con ricerca oltre 4 voci), a destra il dettaglio della pratica scelta con le sue fasi, documenti, integrazioni, consultazione, pagamenti, rapporti. Pulsante «+ Nuovo progetto» per registrare un… |
| `src/pages/CalcoloCrediti.jsx` | 1617 | editor di un calcolo dei crediti di CO₂eq secondo la Metodologia CWP v1.2, a passi (menu a sinistra): import del tracciato dati, impostazioni, rifiuti del territorio, delibera tariffaria, fattori di emissione, Banca Dati Utenze,… |
| `src/pages/CambiaPassword.jsx` | 163 | scegliere una nuova password, con le regole di src/lib/password.js. - "obbligatorio": primo accesso con password temporanea (o reimpostata dall'Amministratore): finché non la cambia l'utente non entra; - "volontario": l'utente… |
| `src/pages/ConsultazioniPubbliche.jsx` | 331 | permettere a chiunque di leggere il Progetto (30 giorni) o il Rapporto di Monitoraggio (20 giorni) nel periodo di feedback pubblico (Guida al Programma 3.9 e 6.3.1) e inviare osservazioni, che Fondazione Operate modera e a cui… |
| `src/pages/Crediti.jsx` | 240 | sezione del calcolo dei crediti di CO₂eq (Metodologia Carbon WastePrint® v1.2). Due viste: - «Calcoli»: elenco di tutti i calcoli (titolo, pratica, anno e tipo, crediti netti, stato bozza/confermato) e modulo «+ Nuovo calcolo»… |
| `src/pages/CreditiEmessiPagina.jsx` | 83 | elenco di tutti i lotti di crediti emessi dai Rapporti di Monitoraggio (Guida al Programma 6.3.2 e 6.3.3; script 24), con il totale emessi / attivi / ritirati e, per lo staff, le azioni su ogni lotto (caricamento sul registro,… |
| `src/pages/Cruscotto.jsx` | 310 | (requisiti §8) riquadri di sintesi cliccabili (pratiche in corso, in scadenza, scadute, fase aperta senza scadenza — rilievo N04: una data mancante non conta come «in regola» —, in attesa del Cliente, integrazioni da verificare,… |
| `src/pages/Documentazione.jsx` | 219 | elenco dei documenti del portale da aprire in PDF o scaricare in Word, ciascuno con la revisione più recente e la sua data. - Manuale Utente: per tutti i ruoli (in PDF; il Word solo agli Amministratori). - Manuale… |
| `src/pages/FormatoDati.jsx` | 136 | spiega lo standard dei dati da inviare per il calcolo dei crediti e permette di scaricare il tracciato Excel. Il link si può mandare a Comuni e gestori anche senza credenziali. Contiene: elenco dei fogli del tracciato,… |
| `src/pages/GestioneUtenti.jsx` | 763 | elenco di tutti gli utenti (nome, email, organizzazioni, ruolo, stato) con, per ciascuno: modifica di ruolo e organizzazioni, reimpostazione della password temporanea, disattivazione/riattivazione. Pulsante «+ Nuovo utente» per… |
| `src/pages/Impostazioni.jsx` | 64 | parametri del Programma modificabili dagli Amministratori: - Durata delle fasi del Progetto e del Rapporto di Monitoraggio (script 13 e 21, componente DurateFasi); - Documenti richiesti per fase (script 21, componente… |
| `src/pages/Login.jsx` | 275 | accesso con email e password; «Password dimenticata?» per farsi mandare il collegamento di reimpostazione; link alle pagine pubbliche (formato dei dati, consultazioni pubbliche, Manuale Utente in PDF). Dopo l'accesso riuscito… |
| `src/pages/Marketing.jsx` | 77 | Regioni italiane (nomi ISTAT, come nella banca dati). |
| `src/pages/News.jsx` | 365 | Data breve in ora italiana: «oggi 14:07», «ieri», «18/10». |
| `src/pages/Profilo.jsx` | 66 | mostra i dati dell'account (nome, email di accesso, ruolo), il collegamento al cambio password («/password») e i documenti da scaricare per il proprio ruolo: Manuale Utente per tutti; Manuale Amministratore e Registro sviluppo e… |
| `src/pages/Programma.jsx` | 249 | la parte pubblica della piattaforma online richiesta dalla Guida al Programma (cap. 3.7) e dallo Standard CWP (cap. 2.3, 5 e 6): - informazioni del Programma: soggetto promotore del programma, PEC, email e sito ufficiale (Guida… |
| `src/pages/Reclami.jsx` | 271 | reclami e richieste di chiarimento (Politica di reclamo del Programma; Guida al Programma cap. 8; script 24). - Chiunque abbia un account invia un reclamo o una richiesta di chiarimento dal portale e ne segue lo stato e la… |
| `src/pages/Scopri.jsx` | 340 | — |
| `src/pages/Simulatore.jsx` | 1213 | stima ex ante, non certificabile, dei crediti che un Comune potrebbe generare in 7, 10 o 21 anni (Registro, backlog punto 37). - Elenco degli scenari raggruppati per Comune, con confronto dei totali; «+ Nuovo scenario» (Comune… |
| `src/pages/TuoiDocumenti.jsx` | 185 | (requisiti §5) raccoglie i documenti GENERALI (non legati a una fase) di tutte le pratiche dell'organizzazione: contratto, allegati, documentazione amministrativa e altri documenti della Fondazione, raggruppati per tipologia,… |
| `src/pages/VerificaMfa.jsx` | 169 | (requisiti §13) - primo accesso: attivazione con QR code da inquadrare con un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy…), con chiave da inserire a mano in alternativa; - accessi successivi:… |

**Componenti (src/components)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/components/AccountDisattivato.jsx` | 39 | Nessuna prop: legge email ed esci() da useAuth(). |
| `src/components/AssistenteVirtuale.jsx` | 218 | pulsante «Assistente» in basso a destra che apre una finestra di conversazione. Le domande vanno alla funzione del server «assistente» (supabase/functions/assistente), che risponde con Claude usando solo la base di conoscenza… |
| `src/components/Badge.jsx` | 37 | etichetta colorata compatta per mostrare uno stato (pratica, fase, documento, pagamento, calcolo…). Solo grafica. |
| `src/components/BarraFasi.jsx` | 74 | barra orizzontale di 7 «luci», una per fase (richiesta di Luca del 19/10/2026). Le fasi completate sono accese, quelle ancora da fare spente. Le luci accese delle fasi 1-6 sono ambra; la settima (Chiusura) è verde. La fase in… |
| `src/components/Consultazione.jsx` | 474 | riquadro «Feedback pubblico» (il termine della Guida al Programma, cap. 3.9) di un Progetto o di un Rapporto di Monitoraggio (fase 3, requisiti §6; per i Rapporti Guida 6.3.1, script 23). Lo staff apre il feedback pubblicando un… |
| `src/components/CreditiEmessi.jsx` | 319 | crediti di carbonio emessi da un Rapporto di Monitoraggio registrato (Guida al Programma 6.3.2 e 6.3.3, Tabella 5; Standard 6.2; script 24): - emissione di un lotto con ID univoci (solo Amministratori), anche collegata a un… |
| `src/components/DettaglioPratica.jsx` | 943 | pagina di dettaglio di una pratica (Progetto o Rapporto di Monitoraggio) con le sue 7 fasi (Guida al Programma 6.2 e 6.3.1). |
| `src/components/Documenti.jsx` | 325 | gestione documentale di una pratica: elenco con versioni, caricamento di nuovi file e download. Lo staff sceglie anche tipologia e visibilità (Cliente, Pubblico) e può cambiarle dopo il caricamento. |
| `src/components/Header.jsx` | 294 | intestazione in cima a ogni pagina riservata. A sinistra i loghi (Carbon WastePrint, Fondazione Operate, RINA, Carbon Credit) con collegamento alla pagina iniziale; a destra, se l'utente ha fatto l'accesso: menu per ruolo,… |
| `src/components/Integrazioni.jsx` | 266 | richieste di integrazione di una fase (requisiti §4). Ciclo: l'Operatore richiede → il Cliente carica un documento e risponde → l'Operatore chiude la richiesta. Con la chiusura della fase la possibilità di integrare termina. La… |
| `src/components/Messaggi.jsx` | 129 | conversazione tra Comune e Fondazione Operate dentro una pratica (backlog 26). Mostra i messaggi in ordine di data, quelli dell'utente a destra, e permette di scriverne di nuovi. |
| `src/components/NoteFase.jsx` | 108 | note scritte sotto una delle fasi di una pratica (backlog 10). Lo staff legge tutte le note e ne aggiunge di nuove, interne (solo Fondazione) o condivise con il Comune; il Comune vede solo le condivise. |
| `src/components/Notifiche.jsx` | 205 | campanella delle notifiche interne (requisiti §9) nell'intestazione. Mostra il numero delle non lette, apre un elenco a tendina delle ultime 50 notifiche, segna come lette e porta alla pratica collegata. |
| `src/components/NuovoProgetto.jsx` | 330 | finestra (sovrapposta alla pagina) per creare un nuovo Progetto. Si sceglie un'organizzazione esistente o se ne crea una nuova, si indicano codice (facoltativo, è l'ID univoco del progetto), titolo, territorio (codici ISTAT dei… |
| `src/components/OggettoEModifiche.jsx` | 87 | Oggetto dell'evento e, se è una modifica, l'elenco dei campi cambiati |
| `src/components/Ordinamento.jsx` | 110 | richiesta di Luca del 19/10/2026: ogni informazione tabellare del portale si deve poter ordinare per ciascun campo. Tre elementi: - useOrdinamento(righe, colonne, iniziale): restituisce le righe ordinate e lo stato (colonna e… |
| `src/components/Pagamenti.jsx` | 306 | riquadro «Pagamenti» di una pratica (requisiti §7). Nessun incasso online: il back-office censisce il piano previsto (più voci con scadenze diverse) e registra a mano gli incassi. Mostra totali, incassato, da incassare e lo… |
| `src/components/Rapporti.jsx` | 143 | elenco dei Rapporti di Monitoraggio annuali di un Progetto (requisiti §2): uno per anno, in sequenza, fino a 10 con il periodo di riferimento di 10 anni o fino a 21 con 7 anni rinnovabili 3 volte (Standard 4.3.8, script 23).… |
| `src/components/UscitaInattivita.jsx` | 123 | Ora dell'ultima attività (la più recente tra questa scheda e le altre). |
| `src/components/UtentiOnline.jsx` | 204 | Ora italiana (hh:mm) di un istante; con il giorno se non è oggi. |
| `src/components/ValoreCrediti.jsx` | 125 | mostrare il valore complessivo dei crediti, in crediti (tCO₂eq) e in euro: - in simulazione: per ogni Comune lo scenario del simulatore aggiornato più di recente, su tutto il periodo simulato; euro = ricavi dello scenario (o… |
| `src/components/crediti/ImportaTracciato.jsx` | 283 | passo «Importa il tracciato» del calcolo dei crediti (backlog 1-5). L'Amministratore sceglie il tracciato dati del Comune: - dai documenti della pratica del calcolo (file .xlsx o .zip caricati dal Comune), oppure dal proprio… |
| `src/components/crediti/RegistroCrediti.jsx` | 178 | registro dei crediti (backlog 7), vista «Registro» della pagina Calcolo crediti. Elenca i calcoli ex post confermati con il numero di registro assegnato dal database alla conferma (CWP-REG-AAAA-NNNN). Un calcolo corretto con una… |
| `src/components/crediti/TabellaDati.jsx` | 208 | tabella di dati modificabile in pagina per il calcolo dei crediti CWP (conferimenti, utenze, riuso…), con aggiunta ed eliminazione di righe, importazione da CSV (anche salvato da Excel in italiano) e scaricamento di un modello… |
| `src/components/crediti/UtenzeCalcolo.jsx` | 417 | passo «5a. Utenze del calcolo» del calcolo dei crediti: gestione della Banca Dati Utenze per utenza (richieste di Luca Moretti del 22/10/2026). Due tabelle, utenze domestiche e non domestiche, ciascuna con ricerca, pagine da 50,… |
| `src/components/impostazioni/DocumentiRichiesti.jsx` | 153 | elenco dei documenti richiesti in ogni fase (requisiti §4, «eventuali documenti richiesti»), per Progetto e Rapporto di Monitoraggio. Ogni voce è una tipologia di documento attesa in una fase; nella pratica la fase mostra… |
| `src/components/impostazioni/DurateFasi.jsx` | 214 | sezione «Durata delle fasi» delle Impostazioni, una per tipo di pratica: Progetto (7 fasi) e Rapporto di Monitoraggio (4 fasi, script 21). Tabella delle fasi con la durata in giorni modificabile (dalla fase 2 in poi; la fase 1 è… |
| `src/components/impostazioni/EntiValidazione.jsx` | 147 | anagrafica degli Enti di Validazione (backlog 11), sezione della pagina Anagrafiche. Elenco degli enti con i Progetti a cui sono assegnati (requisiti §3), inserimento di un nuovo ente, modifica e disattivazione. L'ente non… |
| `src/components/impostazioni/InfoProgramma.jsx` | 145 | informazioni del Programma pubblicate sulla pagina pubblica /programma (Guida al Programma 3.1 e 3.6): soggetto promotore del programma, PEC (anche per i reclami), email e sito ufficiale; e le metodologie approvate (Guida cap.… |
| `src/components/impostazioni/ModelliDocumento.jsx` | 184 | modelli di documento (backlog 12), sezione della pagina Impostazioni. L'Amministratore carica i modelli che i Comuni scaricano: un modello può valere per una fase di un tipo di pratica (Progetto o |
| `src/components/impostazioni/PrezzoRiferimento.jsx` | 57 | il prezzo in euro con cui la Dashboard dà un valore ai crediti calcolati ed emessi (riquadro «Crediti in fase esecutiva») e agli scenari del simulatore salvati senza valore del credito. Iniziale 32 €, come il valore proposto dal… |
| `src/components/impostazioni/Registri.jsx` | 117 | elenco dei registri riconosciuti dal Programma (Guida al Programma 3.5, Standard CWP cap. 6), pubblicato sulla pagina pubblica /programma: piattaforme esterne su cui il promotore del progetto carica e vende i crediti. Requisiti… |
| `src/components/marketing/Campagne.jsx` | 288 | — |
| `src/components/marketing/ElencoEnti.jsx` | 287 | Ricarica a ogni cambio di filtri o pagina (con un piccolo ritardo per il testo). |
| `src/components/marketing/Importazioni.jsx` | 232 | Sezioni regionali dell'Albo (id usati dall'elenco pubblico degli iscritti). |
| `src/components/marketing/Richieste.jsx` | 77 | — |
| `src/components/stili.js` | 85 | oggetti di stile in linea condivisi dai componenti delle pratiche e delle impostazioni (stessa grafica del resto del portale: carta, verde Fondazione, bordi sottili) e la funzione dataOra per mostrare data e ora in formato… |

**Librerie (src/lib)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/lib/AuthContext.jsx` | 221 | tiene in memoria la sessione Supabase Auth, il profilo applicativo (ruolo, organizzazione, flag password temporanea) e lo stato MFA. Espone le funzioni accedi, esci, richiediRecuperoPassword, cambiaPassword e caricaMfa. Ogni… |
| `src/lib/auditDettaglio.js` | 201 | rendere riconoscibile, nelle pagine Audit e Audit User, QUALE oggetto è stato modificato e COSA è cambiato. Il database registra già tutto (trigger audit_registra, script 07/21): l'id dell'oggetto e, per le modifiche, ogni campo… |
| `src/lib/caratteriPdf.js` | 75 | i PDF del portale usavano i caratteri standard «Helvetica» NON incorporati: ogni lettore li sostituiva con un carattere locale e, se le larghezze erano diverse, la spaziatura diventava irregolare e i glifi si sovrapponevano… |
| `src/lib/contestoPratica.js` | 82 | trasformare i dati di UNA pratica (letti dalla funzione del server «assistente» con i permessi di chi fa la domanda) in un breve testo che l'assistente usa per rispondere a domande come «a che punto è la mia pratica?», «cosa… |
| `src/lib/crediti/archivio.js` | 258 | crea, legge, aggiorna ed elimina i calcoli (testata e dati in calcolo_crediti) e la loro Banca Dati Utenze (righe di conferimento e di riuso), anche quando le righe sono centinaia di migliaia (invio e lettura a blocchi). Crea le… |
| `src/lib/crediti/bancaDatiUtenze.js` | 213 | legge il file «Banca dati utenze CWP» (modello public/modelli/Banca_dati_utenze_CWP_v1.xlsx, generato da strumenti/genera_banca_dati_utenze.py), controlla ogni riga e la trasforma nella riga della tabella calcolo_utenza (script… |
| `src/lib/crediti/calcolo.js` | 642 | funzioni pure (nessun accesso al database): ricevono i dati del calcolo e restituiscono risultati intermedi e finali, con il riferimento alla formula della Metodologia accanto a ogni passaggio. |
| `src/lib/crediti/parametri.js` | 95 | tabelle numeriche della Metodologia usate come valori iniziali di ogni calcolo: fattori di emissione per tipologia di rifiuto (Tab. 3, 4, 7), pesi specifici (Tab. 8), beni a riuso (Tab. 5), buffer (Tab. 15 e Cap. 7), giorni… |
| `src/lib/crediti/qualita.js` | 124 | indicatori di qualità dei dati di un calcolo dei crediti, oltre ai controlli di coerenza di tracciato.js: - soglia di scostamento ±30% (cap. 3.1.2) tra la produzione pro capite dei rifiuti del territorio e i valori medi del… |
| `src/lib/crediti/rapportoPdf.js` | 384 | genera nel browser, con jsPDF e jspdf-autotable, il rapporto di un calcolo: scheda, sintesi dei crediti, buffer, dati di ingresso, risultati per tipologia e per classe, avvisi, controlli di coerenza e scelte interpretative. Il… |
| `src/lib/crediti/scenari.js` | 75 | unico punto in cui il portale legge e scrive la tabella scenario_simulazione (supabase/28_simulatore.sql). |
| `src/lib/crediti/simulatore.js` | 940 | dati i rifiuti dell'anno base (per tipologia) e, per ogni anno del periodo, gli obiettivi di produzione totale e di secco residuo pro capite, ricalcola la percentuale di raccolta differenziata e stima i crediti anno per anno con… |
| `src/lib/crediti/simulatoreExport.js` | 494 | Campo vuoto (non indicato) e numero da testo con la virgola decimale. |
| `src/lib/crediti/simulatorePdf.js` | 444 | Colori RGB, uguali alla palette del portale e al rapporto di calcolo. |
| `src/lib/crediti/tracciato.js` | 708 | legge il file del tracciato compilato dal Comune o dal gestore, blocca l'import se trova dati personali, converte i fogli nei dati del motore di calcolo (calcolo.js) e segnala le incoerenze. |
| `src/lib/crediti/utenzeCalcolo.js` | 91 | elenco a pagine con ricerca, conteggi, modulo di una singola utenza (nuova o modificata), cancellazione e caricamento dell'elenco completo dell'anno (sostituisce quello precedente). |
| `src/lib/csv.js` | 184 | leggere i CSV caricati nel calcolo crediti (tabelle dati e file del tracciato), convertirli in oggetti secondo uno schema di colonne, produrre CSV da scaricare (export, modelli vuoti, registro crediti). |
| `src/lib/cwpProgram.js` | 190 | costanti condivise da tutto il portale, allineate all'analisi funzionale: le 7 fasi del Progetto e del Rapporto, i 3 ruoli applicativi, gli stati di pratica e di fase (con i colori dei badge), la palette e le tipologie di… |
| `src/lib/date.js` | 81 | formattare le date del database (gg/mm/aaaa), contare i giorni alle scadenze e ottenere la data di oggi in formato ISO (anche la data italiana, indipendente dal fuso del computer). |
| `src/lib/dati.js` | 1229 | raccoglie in un solo posto tutte le letture e scritture del portale su tabelle, funzioni del database (RPC), archivi (Storage) ed Edge Functions, esclusi il calcolo crediti (src/lib/crediti/archivio.js) e l'autenticazione… |
| `src/lib/fascicolo.js` | 357 | ZIP con: riepilogo PDF (Riepilogo.pdf, src/lib/fascicoloPdf.js), dati della pratica con l'Ente di Validazione, fasi, tutti i documenti in tutte le versioni (cartella Validazione per il rapporto dell'Ente; per i Rapporti anche il… |
| `src/lib/fascicoloPdf.js` | 137 | un documento leggibile da stampare o archiviare insieme ai file del fascicolo: dati della pratica e dell'Ente di Validazione, fasi, elenco dei documenti (con l'impronta SHA-256), integrazioni, consultazioni pubbliche, pagamenti… |
| `src/lib/file.js` | 158 | prima di inviare un file all'archivio controlla formato ammesso, dimensione, contenuto reale (primi byte, "firma" del formato) e prepara un nome sicuro per il percorso nell'archivio. Traduce anche gli errori dello Storage di… |
| `src/lib/inattivita.js` | 20 | un solo posto per i tempi usati da src/components/ UscitaInattivita.jsx (richiesta di Luca del 20/10/2026, sicurezza). - Operatori e Amministratori: 30 minuti senza attività; - utenti degli enti: 60 minuti; - l'avviso «Sei… |
| `src/lib/marketing.js` | 219 | - htmlCampagna / testoCampagna: l'email di una campagna (grafica in testa, testo, riquadro «risorse per 7, 10 o 21 anni», pulsante «Approfondisci» verso la landing page, informativa e disiscrizione). La STESSA funzione è copiata… |
| `src/lib/marketingDati.js` | 171 | Applica i filtri dell'elenco a una lettura di mkt_ente. Filtri: tipo, |
| `src/lib/marketingLettura.js` | 317 | INIZIO-LETTURA-SITI |
| `src/lib/notizie.js` | 225 | funzioni pure usate dalla funzione del server «notizie» (supabase/functions/notizie) e dalla pagina /news: - CANALI: dove si cercano le notizie (Bing News in italiano e in inglese con ricerche mirate, quattro siti specializzati… |
| `src/lib/ordinamento.js` | 37 | logica pura (senza React) usata dal componente src/components/Ordinamento.jsx. Numeri come numeri, booleani (falso prima di vero), date ISO e testi in ordine alfabetico italiano senza distinguere maiuscole e con i numeri nel… |
| `src/lib/password.js` | 70 | controllo delle regole della password prima dell'invio, generazione della password temporanea assegnata dall'Amministratore, traduzione in italiano degli errori di Supabase Auth. |
| `src/lib/presenza.js` | 52 | trasformare i dati della presenza (script 32) in testi leggibili: nome della pagina aperta e da quanto tempo un utente è collegato. |
| `src/lib/scadenze.js` | 34 | Una pratica è "in scadenza" se la fase aperta scade entro questi giorni. |
| `src/lib/supabase.js` | 37 | crea l'unico client @supabase/supabase-js usato dal portale (database, Auth, Storage, Edge Functions). Legge URL e chiave dalle variabili d'ambiente (file .env in locale, mai pubblicato; in produzione le variabili del progetto… |
| `src/lib/tariffe.js` | 110 | calcolare le voci di pagamento proposte per una pratica dalle tariffe massime dello Schema tariffario (IVA esclusa). Sono proposte: lo staff le controlla, può cambiare l'importo e le salva come voci di pagamento (Pagamenti.jsx).… |
| `src/lib/useTelefono.js` | 24 | — |

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
| `supabase/19_correzioni_revisione_codice.sql` | 47 | CORREZIONI EMERSE DALLA REVISIONE DEL CODICE (punto 31, 18/10/2026) |
| `supabase/20_rinforzi_integrita.sql` | 300 | RINFORZI DI INTEGRITÀ (backlog 33, 18/10/2026) |
| `supabase/21_completamento_funzionale.sql` | 679 | COMPLETAMENTO FUNZIONALE (confronto con i requisiti, 18/10/2026) |
| `supabase/22_stato_ritirata.sql` | 14 | STATO «RITIRATA» DELLA PRATICA (Guida al Programma, cap. 6.4.1) |
| `supabase/23_allineamento_guida.sql` | 857 | ALLINEAMENTO AI DOCUMENTI UFFICIALI DEL PROGRAMMA (18/10/2026) |
| `supabase/24_programma_pubblico_crediti_reclami.sql` | 571 | PIATTAFORMA PUBBLICA, CREDITI EMESSI E RECLAMI (18/10/2026) |
| `supabase/25_documenti_programma.sql` | 35 | DOCUMENTI UFFICIALI DEL PROGRAMMA SULLA PAGINA PUBBLICA (18/10/2026) |
| `supabase/26_pec_programma.sql` | 19 | PEC DEL PROGRAMMA (19/10/2026) |
| `supabase/27_soggetto_promotore.sql` | 28 | SOGGETTO PROMOTORE DEL PROGRAMMA (19/10/2026) |
| `supabase/28_simulatore.sql` | 75 | salva gli scenari del simulatore dei crediti (Registro, backlog punto 37). Uno scenario è una stima ex ante, non certificabile, di quanti crediti un Comune potrebbe generare in 7, 10 o 21 anni (Standard 4.3.8), a partire dai… |
| `supabase/29_amministratori.sql` | 168 | 1. Gli Amministratori possono nominare altri Amministratori dalla pagina «Gestione utenti» (prima la nomina si faceva solo da Supabase). Un Amministratore ha accesso completo a tutti i dati, come quello principale. 2.… |
| `supabase/30_elimina_utente.sql` | 104 | un Amministratore può cancellare un utente che non ha mai operato nel portale, cioè che non compare come autore di nessuna voce dell'audit trail (nessun documento, messaggio, modifica, cambio della password…). Serve, ad esempio,… |
| `supabase/31_assistente.sql` | 81 | la funzione del server «assistente» (Claude di Anthropic) registra quante domande fa ogni utente al giorno e i token usati, per applicare un limite giornaliero e controllare la spesa. Nessun testo delle domande o delle risposte… |
| `supabase/32_utenti_online.sql` | 112 | l'Amministratore principale (script 29) vede quanti e quali utenti sono collegati al portale in questo momento, in quale pagina sono e da quanto, più gli accessi delle ultime 24 ore. |
| `supabase/33_audit_trail_user.sql` | 268 | 33 — AUDIT USER (solo Amministratore principale; sezione chiamata |
| `supabase/34_sicurezza_avvisi.sql` | 203 | 34 — SICUREZZA: AVVISI, USCITA PER INATTIVITÀ, RINFORZI DEL DATABASE |
| `supabase/35_controlli_collaudo.sql` | 216 | ripetere nel database i controlli aggiunti nel portale dopo il primo rapporto di collaudo (Andrea Valentini, Albina Ambrogio, Andrea Pavan, Gianluca Tapparini, Luca Belfiore). Anche se il portale avesse un errore, il database… |
| `supabase/36_notizie.sql` | 169 | 36 — NEWS: OSSERVATORIO SUI CREDITI DI CARBONIO VOLONTARI |
| `supabase/37_notizie_viste.sql` | 58 | 37 — NOTIZIE CO2: PALLINO VERDE DELLE NOTIZIE NUOVE |
| `supabase/38_backup.sql` | 73 | 38 — BACKUP: TUTTO IL DATABASE IN UNA SOLA CHIAMATA |
| `supabase/39_rilievi_n02_n03.sql` | 289 | correzioni dei rilievi N02 e N03 (terza sessione di collaudo, CWP_NUOVI_RILIEVI_A_MORETTI_V01_20261021, risposte in docs/collaudo/Rilievi_N01-N06_risposte.md). |
| `supabase/40_utenze_calcolo.sql` | 426 | 40 — UTENZE DEL CALCOLO DEI CREDITI (UNA RIGA PER UTENZA) |
| `supabase/41_utenze_nel_calcolo.sql` | 165 | 41 — UTENZE DEL CALCOLO NEL MOTORE: CONTROLLI DI CONFERMA |
| `supabase/42_valore_crediti.sql` | 148 | 42 — DASHBOARD: VALORE COMPLESSIVO DEI CREDITI |
| `supabase/43_valore_progetti.sql` | 169 | 43 — VALORE DEI PROGETTI: LISTINO CASO 1 / CASO 2 |
| `supabase/44_marketing.sql` | 266 | 44 — MARKETING: BANCHE DATI DI COMUNI E GESTORI, CAMPAGNE, RICHIESTE |
| `supabase/45_rapporto_registrato_marketing_rls.sql` | 85 | 45 — RAPPORTI SOLO PER PROGETTI REGISTRATI; MARKETING PIÙ VELOCE |
| `supabase/46_lettura_siti.sql` | 175 | 46 — MARKETING: LETTORE DEI SITI DI COMUNI E GESTORI |
| `supabase/47_listino_obbligatorio.sql` | 50 | 47 — LISTINO OBBLIGATORIO PER I PROGETTI |
| `supabase/schema_completo.sql` | 434 | PORTALE CARBON WASTEPRINT — Schema del database (Supabase / PostgreSQL) |

**Edge Functions (supabase/functions)**

| File | Righe | Cosa contiene |
|---|---|---|
| `supabase/functions/assistente/index.ts` | 332 | assistente virtuale del portale basato su Claude (Anthropic). Risponde alle domande sul funzionamento del portale e del Programma usando SOLO una base di conoscenza: manuali e tariffe (file public/assistente/kb-*.md, generati da… |
| `supabase/functions/consultazione-pubblica/index.ts` | 432 | servizio della pagina pubblica delle consultazioni (requisiti §6, decisioni B e D del 18/10/2026). Chiunque, senza account, può: - "elenco": vedere le consultazioni aperte; - "dettaglio": leggere documento, errata corrige e… |
| `supabase/functions/crea-utente/index.ts` | 263 | crea un nuovo utente con password temporanea e imposta ruolo + organizzazione. All'utente parte un'email con indirizzo del portale, email di accesso e password temporanea (Resend, funzione inviaEmailAccesso in fondo al file); se… |
| `supabase/functions/invia-email-notifica/index.ts` | 160 | invia per email ogni nuova notifica del portale (requisiti §9: "email + notifica interna"). |
| `supabase/functions/marketing/index.ts` | 975 | marketing — funzione del server dello strumento di marketing |
| `supabase/functions/notizie/index.ts` | 487 | osservatorio News per gli Amministratori (richiesta di Luca Moretti del 21/10/2026). Ogni 2 ore cerca notizie sul mondo dei crediti di carbonio volontari (mercato volontario, marketplace e borse, prezzi dei crediti scambiati o… |
| `supabase/functions/recupera-password/index.ts` | 155 | «Password dimenticata?» — genera il collegamento di recupero di Supabase Auth e spedisce l'email in italiano con Resend (stessa grafica delle notifiche), invece del modello email di Supabase. |
| `supabase/functions/reimposta-password/index.ts` | 218 | l'Amministratore assegna una nuova password temporanea a un utente (Cliente od Operatore) che l'ha dimenticata. Al primo accesso il portale obbliga l'utente a sceglierne una personale (script 15). |

**Test (test)**

| File | Righe | Cosa contiene |
|---|---|---|
| `test/assistente.test.mjs` | 76 | — |
| `test/bancaDatiUtenze.test.mjs` | 113 | Riga con kg di indifferenziato e organico e svuotamenti dell'indifferenziato. |
| `test/collaudo_v01.test.mjs` | 301 | una prova per ogni difetto corretto (D01-D07) con i valori esatti del rapporto, i casi limite chiesti nella «Verifica dopo la correzione» e i casi ordinari S e C, che devono restare identici (netto 292,8 tCO₂eq/anno; 0,2928… |
| `test/collaudo_v05.test.mjs` | 65 | Le due note reali del collaudo (OP09): testo originale e testo con la riga temporanea. |
| `test/crediti.test.mjs` | 144 | verifica del motore di calcolo con un esempio calcolato a mano (un piccolo Comune con 2 classi domestiche e 1 non domestica). Controlla le formule 1-17, 19-22 e 28-32 (non la 18: peso specifico a consuntivo), i buffer delle… |
| `test/csv.test.mjs` | 53 | verifica che i CSV salvati da Excel in italiano (BOM, separatore ";", virgola decimale, punto delle migliaia, testi tra virgolette con ";" dentro, righe vuote) siano letti correttamente; che intestazioni con maiuscole/accenti… |
| `test/date.test.mjs` | 31 | verificare le date in ora italiana usate per aprire le consultazioni (30 giorni) e per i nomi dei file: oggiItalia() deve dare sempre aaaa-mm-gg in fuso Europe/Rome, aggiungiGiorni() deve contare i giorni sul calendario (fine… |
| `test/inattivita.test.mjs` | 24 | — |
| `test/marketing.test.mjs` | 219 | — |
| `test/notizie.test.mjs` | 96 | verificare che - un feed di Google News, uno di Bing News e uno di un sito (WordPress) si leggano con titolo senza testata, indirizzo, fonte, data ed estratto senza HTML; - la stessa notizia da due ricerche dia la stessa chiave;… |
| `test/ordinamento.test.mjs` | 36 | — |
| `test/presenza.test.mjs` | 33 | — |
| `test/qualita.test.mjs` | 43 | verificare il confronto con la Tabella 3 dello Standard CWP (soglia ±30%) e gli indicatori di completezza, unicità, letture a buon fine e tempestività. |
| `test/rilievi_n.test.mjs` | 134 | ---------------------------------------------------------------- N01 |
| `test/simulatore.test.mjs` | 273 | verificare il riepilogo dell'anno base (totale, pro capite, % differenziata, fattore del secco), i dati dal cluster SOSE e da un calcolo, gli anni del periodo (7, 10, 21), la traiettoria lineare e la stima dei crediti anno per… |
| `test/simulatoreExport.test.mjs` | 94 | verificare che le tabelle preparate per PDF ed Excel riprendano i risultati del simulatore (sintesi, anni, economia, costi del Caso 1), che il file .xlsx sia un archivio valido con i fogli attesi e numeri veri nelle celle, e che… |
| `test/tariffe.test.mjs` | 44 | verificare gli importi proposti per le voci di pagamento con gli esempi dello Schema tariffario v1.2: fasce di popolazione, quote per credito previsto, scaglioni cumulativi di emissione e minimo di vendita. |
| `test/tracciato.test.mjs` | 110 | cinque prove sui file di esempio: lettura dell'Excel compilato, blocco dei dati personali (con valori oscurati nei messaggi), ZIP di CSV con singole letture (aggregazione ed esclusione delle letture fuori anno), controlli di… |
| `test/utenzeNelCalcolo.test.mjs` | 137 | Stesso piccolo Comune di crediti.test.mjs. |
| `test/valoreProgetti.test.mjs` | 61 | Valore noto del rilievo N01: 16.232,95 €/anno. |

**Strumenti (strumenti)**

| File | Righe | Cosa contiene |
|---|---|---|
| `strumenti/genera_banca_dati_utenze.py` | 259 | genera public/modelli/Banca_dati_utenze_CWP_v1.xlsx, il file che il Comune o il gestore compila OGNI ANNO con l'elenco COMPLETO delle utenze (richiesta di Luca Moretti del 22/10/2026: il calcolo dei crediti è per utenza e le… |
| `strumenti/genera_base_conoscenza.cjs` | 88 | unisce i testi dei manuali e delle tariffe in due file che la funzione del server «assistente» (supabase/functions/assistente) legge e passa a Claude come contesto: - public/assistente/kb-comune.md: per gli utenti degli enti… |
| `strumenti/genera_documenti.cjs` | 583 | genera in Word (.docx) e PDF i documenti del portale, con copertina e loghi, registro delle revisioni, sommario con numeri di pagina, intestazione e piè di pagina: |
| `strumenti/genera_esempi_tracciato.py` | 101 | genera i file di prova del tracciato dati per i test automatici (test/tracciato.test.mjs) e per il collaudo manuale (Manuale Test): - test/dati/tracciato_esempio.xlsx : tracciato compilato, Banca Dati con totali (foglio 5) -… |
| `strumenti/genera_tracciato_dati.py` | 312 | genera public/modelli/Tracciato_dati_CWP_v1.xlsx (tracciato dati standard CWP), il file vuoto che Comuni e gestori compilano per il calcolo dei crediti: fogli Istruzioni, 1_Anagrafica, 2_Rifiuti … 7_Riuso, Codici, con menu a… |
| `strumenti/genera_utenze_casuali.py` | 104 | riempie il modello public/modelli/Banca_dati_utenze_CWP_v1.xlsx con 20 utenze domestiche e 20 non domestiche inventate (richiesta di Luca |
| `strumenti/impagina_pdf.py` | 442 | impagina in PDF (WeasyPrint) Manuale Utente, Manuale Amministratore, Manuale Test e Registro, a partire dagli stessi Markdown del Word. (Uso, impaginazione e requisiti sono descritti nella docstring qui sotto.) |
| `strumenti/inventario_codice.py` | 121 | genera l'elenco di tutti i file del codice (cartella, righe, descrizione presa dall'intestazione del file) e lo inserisce nel capitolo «Codice sorgente» di docs/REGISTRO_DEV_DEPLOY.md, tra i segnaposto INVENTARIO-INIZIO e… |
| `strumenti/marketing_arricchimento_sql.py` | 107 | — |
| `strumenti/presentazione/genera_presentazione.cjs` | 641 | produce la presentazione di riepilogo del portale (metodologia, funzioni, novità, architettura, ruoli, punti aperti, simulatore, piani a pagamento, scelte da prendere). Per regola di Luca (19/10/2026) si aggiorna a ogni rilascio… |
| `strumenti/revisioni_documenti.json` | 1702 | — |
<!-- INVENTARIO-FINE -->

---

## 15. Calcolo crediti

Riferimento unico per la parte di calcolo dei crediti CWP (sezione
**Crediti CWP**, solo Amministratori). Le note metodologiche formula per
formula sono in `docs/crediti-cwp.md`; l'uso passo per passo nel Manuale
Amministratore.

| Parte | File | Database |
|---|---|---|
| Elenco calcoli e registro | `src/pages/Crediti.jsx`, `src/components/crediti/RegistroCrediti.jsx` | `calcolo_crediti`, `admin_registro_crediti` (18) |
| Editor del calcolo (7 passi + import) | `src/pages/CalcoloCrediti.jsx`, `src/components/crediti/TabellaDati.jsx`, `ImportaTracciato.jsx` | `calcolo_crediti.dati`, `calcolo_conferimento`, `calcolo_riuso` (11) |
| Utenze del calcolo (passo 5a), usate dal motore dal 23/10/2026 | `src/components/crediti/UtenzeCalcolo.jsx`, `src/lib/crediti/bancaDatiUtenze.js`, `utenzeCalcolo.js` (`leggiUtenzeCalcolo`), `utenzeInConferimenti` in `calcolo.js` | `calcolo_utenza` e funzioni (40); controlli di conferma `cwp_utenze_controllo` (41) |
| Lettura e controlli del tracciato | `src/lib/crediti/tracciato.js` | — (nel browser) |
| Motore di calcolo (formule 1-32, Tabelle 15-16) | `src/lib/crediti/calcolo.js`, `parametri.js` | riepilogo salvato in `calcolo_crediti.risultato` |
| Salvataggio e versioni | `src/lib/crediti/archivio.js` | immutabilità e numero di registro: `calcolo_immutabile` (11, 18); coerenza del risultato: `calcolo_coerenza`, `calcolo_bdu_modificata`; nuova versione: `admin_nuova_versione_calcolo` (20) |
| Rapporto PDF | `src/lib/crediti/rapportoPdf.js` | archiviazione come `documento` della pratica |
| Prove | `test/crediti.test.mjs`, `test/tracciato.test.mjs`, `test/date.test.mjs`, `test/bancaDatiUtenze.test.mjs`, `test/utenzeNelCalcolo.test.mjs` | `t40.sql`, `t41.sql` sul banco locale |

**Simulatore di scenari (backlog punto 37, prima versione 19/10)**: stima
ex ante e non certificabile dei crediti di un Comune su 7, 10 o 21 anni.

| Parte | File | Database |
|---|---|---|
| Pagina (elenco per Comune, editor in 4 parti, grafici, CSV, stampa) | `src/pages/Simulatore.jsx` | — |
| Motore (anno base, anni del periodo, traiettoria, simulazione) | `src/lib/crediti/simulatore.js` (usa `parametri.js`, `calcolo.js`, `qualita.js`) | — (nel browser) |
| Salvataggio | `src/lib/crediti/scenari.js` | `scenario_simulazione` (28), policy `scenario_staff`, audit |
| Prove | `test/simulatore.test.mjs` | `t28.sql` sul banco locale |

Modello e conseguenze (i crediti nascono dai rifiuti evitati; più
differenziata a parità di totale non genera crediti) in
`docs/crediti-cwp.md`.

**Flusso**: creazione (bozza) → import del tracciato o inserimento a mano
→ «Calcola» (motore nel browser, riepilogo salvato senza il dettaglio per
utenza) → conferma (immutabile, numero `CWP-REG-AAAA-NNNN` per gli ex
post) → rapporto PDF e archiviazione → registro. Una correzione è sempre
una **nuova versione** (`versione_di`), che alla conferma sostituisce la
precedente nel registro.

**Coerenza del risultato (script 20)**: il risultato salvato vale solo per
i dati con cui è stato calcolato. Se cambiano dati, anno, tipo, data di
avvio o le righe della Banca Dati Utenze senza un nuovo «Calcola», il
database azzera il risultato (e i crediti) della bozza. «Calcola» scrive in
`risultato.righe` quante righe di conferimento e di riuso ha usato; alla
conferma il database le confronta con quelle salvate e rifiuta la conferma
se non coincidono. I calcoli in bozza calcolati prima del 18/10 vanno
ricalcolati prima della conferma.

**Utenze del passo 5a nel motore (23/10/2026, script 41)**: con utenze nel
5a il motore usa quelle (classe = categoria di simulazione, kg misurati,
frazioni contate utenza per utenza) e ignora i conferimenti del 5b (il
riuso resta del 5b); senza utenze tutto come prima. Utenze senza categoria o
con categoria fuori delibera restano fuori dal calcolo e bloccano la
conferma (controlli di coerenza nel browser e `calcolo_prerequisiti_conferma`
nel database). `risultato.righe.utenze` registra quante utenze ha usato
«Calcola» e la conferma la confronta con quelle salvate. Dettagli in
`docs/crediti-cwp.md`.

**Limiti noti**: l'import della Banca Dati Utenze cancella e reinserisce a
blocchi senza transazione (un errore a metà lascia dati incompleti, che
però non si possono confermare: ripetere l'import e «Calcola»); scelte interpretative da confermare (capitolo 11);
regole di emissione e annullamento dei crediti in attesa dello Standard
CWP (backlog 7).

---

## 16. Marketing

Sezione **Marketing** (`/marketing`, solo Amministratori), richiesta di Luca
Moretti del 23/10/2026: banche dati di Comuni e gestori, campagne email e
pagina pubblica «Approfondisci» con micro simulazione.

| Parte | File | Database / servizi |
|---|---|---|
| Pagina e schede | `src/pages/Marketing.jsx`, `src/components/marketing/{ElencoEnti,Campagne,Richieste,Importazioni}.jsx` | `mkt_*` (44) |
| Dati | `src/lib/marketingDati.js` | `admin_mkt_prepara_invii`, `admin_mkt_riepilogo` (44) |
| Email, regole, micro simulazione | `src/lib/marketing.js` (blocchi `INIZIO-EMAIL-CAMPAGNA` e `INIZIO-REGOLE-IPA` copiati identici nella funzione) | — |
| Funzione del server | `supabase/functions/marketing/index.ts` | Resend, IndicePA, Albo Gestori Ambientali |
| Pagina pubblica | `src/pages/Scopri.jsx` (`/scopri`, `/scopri/disiscrizione`) | funzione `marketing` (azioni pubbliche) |
| Materiali | `public/marketing/` (grafiche, fascicolo PDF, `dati/comuni_istat.json`), `strumenti/genera_fascicolo_marketing.mjs` | — |
| Prove | `test/marketing.test.mjs`, `t44.sql` sul banco | — |

**Fonti dei dati**
- *Comuni*: elenco ISTAT (7.904 Comuni con regione, provincia e abitanti,
  copiato da matteocontrini/comuni-json nel file
  `public/marketing/dati/comuni_istat.json`); **IndicePA** (open data
  dell'Indice dei domicili digitali della PA, categoria L6 «Comuni e loro
  Consorzi e Associazioni»): PEC, email generica, sito, sindaco; dalle unità
  organizzative i responsabili degli uffici tributi, ambiente, finanziario e
  tecnico (regole in `ruoloUfficio`).
- *Importazione a blocchi* (dal 23/10, per i tempi della funzione e per
  IndicePA che con letture grandi risponde «App offline»): uffici a
  blocchi di 400 Comuni, Albo una provincia per chiamata; un errore di
  IndicePA sui gestori non blocca il salvataggio delle imprese.
- *Verifica dei gestori sui siti* (dal 23/10): a lotti, per classe di
  iscrizione (prima A-C); risultati in JSON con la fonte di ogni dato,
  trasformati in SQL da `strumenti/marketing_arricchimento_sql.py` ed
  eseguiti nel SQL Editor. Ogni impresa verificata ha `verificato_il`, le
  fonti e una nota con le evidenze (Comuni serviti, tariffa).
- *Gestori*: elenco pubblico degli iscritti all'**Albo Nazionale Gestori
  Ambientali**, sezione per sezione, filtrato sulla categoria «1o»
  (raccolta e trasporto di rifiuti urbani, ordinaria). L'elenco pubblico
  non dà email né referenti: per i gestori pubblici PEC, email e sito
  arrivano da IndicePA (codice fiscale); per le imprese private attività
  (raccolta, gestione della tariffa), PEC, email e direttori/amministratori
  si verificano sui siti e si registrano nella scheda (fonte annotata).
  INI-PEC non si usa (CAPTCHA).

**Regole delle campagne**
- Destinatari scelti per ogni campagna (tipo, regioni, abitanti, natura,
  attività); nessun invio automatico a tutti.
- Solo **email generiche**: le PEC non sono mai usate (controllo nel
  database `mkt_email_non_pec` e nella funzione).
- Ogni email ha l'informativa (titolare, fonte pubblica dell'indirizzo) e
  il collegamento «Non desidero ricevere altre comunicazioni»
  (`mkt_disiscrizione`, escluso da tutte le campagne successive), anche
  nell'intestazione List-Unsubscribe.
- Invio a blocchi di 50 con pausa; piano gratuito di Resend: 100 email al
  giorno; finché il dominio non è verificato le email arrivano solo al
  titolare dell'account (prova «Invia una prova a me»).

**Lettore dei siti (dal 25/10, script 46)**
- Coda `mkt_lettura`; il lavoro `cwp_lettura_siti` ogni 30 secondi chiama
  `leggi_siti` (4 enti alla volta) solo se `mkt_lettura_attiva` = 'si'.
- Per ogni ente: robots.txt, home page, fino a 5 pagine utili e 2 di
  secondo livello, una ogni 0,7 secondi; regole fisse (`estraiDati`) e
  controllo (`controlloEsito`); riempie solo i campi vuoti di `mkt_ente`,
  referenti con chiave `sito:<ruolo>:<cognome|ufficio>` e fonte.
- Nessun servizio a pagamento (scelta di Luca del 25/10/2026): le colonne
  `token_in`/`token_out` restano a zero.
- Pagina Importazioni → «Lettura dei siti»: coda, letti, errori, Avvia /
  Ferma, «Leggi ora 1 ente», ultimi errori.

**Pagina «Approfondisci» (/scopri)**
- Il collegamento dell'email porta il codice casuale dell'invio: la pagina
  legge solo nome e abitanti dell'ente e registra visita, simulazione e
  richiesta (statistiche della campagna).
- Micro simulazione: abitanti, rifiuti totali e secco residuo (t/anno),
  durata 7/10/21 anni, Caso 1 o 2 → stessa `simula` / `simulaEconomia` del
  simulatore (metodo «per utenza», buffer della Metodologia, prezzo 32 €,
  listino del caso; secco −30% e totale −5% pro capite entro l'ultimo
  anno). Ipotesi sempre visibili.
- Richiesta di registrazione: salvata in `mkt_richiesta`, notifica ed email
  a tutti gli Amministratori attivi (`cwp_notifica`, evento
  `richiesta_registrazione`); campo trappola contro i robot e limiti di
  invio.
- Fascicolo informativo: `node strumenti/genera_fascicolo_marketing.mjs`
  (WeasyPrint); da rigenerare se cambiano prezzo, listini o regole.

