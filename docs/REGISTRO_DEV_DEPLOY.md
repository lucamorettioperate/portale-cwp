# Registro sviluppo e deploy — Portale Carbon WastePrint

| | |
|---|---|
| **Ultimo aggiornamento** | 19 ottobre 2026 |
| **Versione del portale** | 0.29 (ultimo script database: `29_amministratori.sql`) |
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
| `30_elimina_utente.sql` | Cancellazione di un utente mai attivo: `utente_mai_attivo` (nessuna voce di audit come autore, nessun reclamo assegnato; uso interno), `admin_utenti_eliminabili()` per la pagina Utenti, `admin_elimina_utente(id)` (solo Admin, mai sé stessi né il principale; cancella da `auth.users`, a cascata profilo, associazioni e notifiche; voce «cancellazione profilo» nell'audit) | 19/10/2026 — provato sul banco locale (`t30b.sql`); **da eseguire in produzione** |

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
| `crea-utente` | L'Amministratore crea un utente con password temporanea e lo associa a tutte le sue organizzazioni (`admin_imposta_organizzazioni` con il token dell'Admin); se un passo fallisce l'account appena creato viene eliminato | Verifica che il chiamante sia Admin (`sono_admin`); password temporanea di almeno 10 caratteri con lettere e numeri; niente creazione di Admin; dal 19/10 email all'utente con indirizzo del portale, email di accesso e password temporanea (Resend), esito `email_inviata`/`motivo_email` restituito al portale | Dashboard Supabase (editor web); ripubblicata 18/10 (script 20); Verify JWT attivo; **versione 19/10 con l'email da ripubblicare** |
| `reimposta-password` | L'Amministratore assegna una password temporanea a un Cliente o Operatore; il flag obbliga al cambio al primo accesso; audit; dal 19/10 email all'utente con la nuova password temporanea (Resend), esito restituito al portale | Verifica `sono_admin`; esclusi amministratori e sé stessi | Dashboard Supabase (editor web), 18/10; Verify JWT attivo; **versione 19/10 con l'email da ripubblicare** |
| `consultazione-pubblica` | Pagine pubbliche del feedback pubblico (data di «oggi» in ora italiana dal 18/10; numero delle osservazioni dallo script 21; dalla sera del 18/10 anche i Rapporti di Monitoraggio, ripubblicata; azioni `programma` e `file` per la pagina pubblica /programma, script 24, ripubblicata la sera del 18/10, Verify JWT spento): elenco, dettaglio (documento, errata corrige, osservazioni ammesse), invio di un'osservazione con allegato facoltativo ed email di conferma, conferma dell'email (l'osservazione diventa *Ricevuto*) | Verify JWT **disattivato** di proposito (pubblico senza account): nessun dato personale restituito, 3 invii/ora per indirizzo e 100/ora per consultazione, campo trappola anti-robot, allegati max 10 MB con controllo del contenuto, token monouso 48 ore salvato come SHA-256 | Dashboard Supabase (editor web), 18/10 |
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
| `/consultazioni`, `/consultazioni/:id`, `/consultazioni/conferma` | Feedback pubblico (Progetti e Rapporti): elenco, documento e osservazioni, invio con conferma dell'email | **pubbliche**, senza login |
| `/programma` | Piattaforma pubblica del Programma (Guida 3.7): informazioni, enti, registri, metodologie, documenti e modulistica, Progetti con documenti pubblici, Rapporti e crediti emessi, reclami | **pubblica**, senza login |
| `/reclami` | Reclami e richieste di chiarimento: invio e stato (utenti), registrazione e gestione (staff) | tutti |
| `/crediti-emessi` | Crediti emessi: tutti i lotti con vendite, cancellazioni e totali | Operatore, Admin |
| `/formato-dati` | Formato dei dati per il calcolo crediti, download del tracciato Excel | **pubblica**, senza login |
| `/` | Cruscotto (staff) oppure Le mie pratiche (cliente) | tutti |
| `/pratiche` | Back-office: elenco e dettaglio pratiche (`?id=` apre una pratica) | Operatore, Admin |
| `/anagrafiche` | Organizzazioni (con delegati), Enti di Validazione e Registri, con le pratiche collegate | Operatore, Admin |
| `/documenti` | I tuoi documenti, modelli generali, manuale | Cliente |
| `/utenti` | Gestione utenti | Admin |
| `/audit` | Audit trail | Admin |
| `/crediti`, `/crediti/:id` | Calcolo crediti CWP | Admin |
| `/simulatore` | Simulatore di scenari: stima ex ante dei crediti di un Comune su 7, 10 o 21 anni | Operatore, Admin |
| `/impostazioni` | Informazioni del Programma e metodologie, durata delle fasi (Progetto e Rapporto), documenti richiesti per fase, modelli di documento (anche pubblici) | Admin |
| `/documentazione` | Documentazione: Manuale Utente (PDF; Word solo Admin), Manuale Amministratore e Registro (solo Admin) | tutti (contenuto per ruolo) |

**Struttura del codice** (in sintesi; descrizione completa file per file nel capitolo 14 «Codice sorgente»)
- `src/pages/` — pagine elencate sopra (+ `VerificaMfa.jsx`;
  `ConsultazioniPubbliche.jsx` contiene le tre pagine pubbliche).
- `src/components/` — `DettaglioPratica`, `Documenti`, `Integrazioni`,
  `Consultazione`, `Rapporti`, `Pagamenti`, `Notifiche`, `NuovoProgetto`,
  `Header`, `Messaggi`, `NoteFase`, `CreditiEmessi`, `stili.js` (stili condivisi),
  `impostazioni/{DurateFasi,DocumentiRichiesti,EntiValidazione,ModelliDocumento,Registri,InfoProgramma}`,
  `crediti/{ImportaTracciato,RegistroCrediti,TabellaDati}`.
- `src/lib/` — `dati.js` (accesso ai dati), `AuthContext.jsx` (sessione,
  ruolo, MFA), `file.js` (controlli sui file), `fascicolo.js` (export ZIP)
  e `fascicoloPdf.js` (riepilogo PDF del fascicolo),
  `csv.js`, `date.js`, `cwpProgram.js` (fasi, ruoli, colori, stati del
  Programma, tipologie), `tariffe.js` (Schema tariffario),
  `crediti/{parametri,calcolo,archivio,qualita}.js` (motore di calcolo e
  controlli della Gestione qualità dei dati).
- `public/loghi/` — loghi Carbon WastePrint, Fondazione Operate, RINA,
  Carbon Credit. `public/modelli/` — tracciato dati Excel.
- `test/` — test del motore crediti, del lettore CSV, dell'import del
  tracciato, delle date, dello Schema tariffario e della qualità dei dati
  (`npm test`); `test/dati/` file di esempio.
- `strumenti/genera_tracciato_dati.py` — rigenera il tracciato Excel;
  `strumenti/genera_esempi_tracciato.py` — file di esempio compilati.

---

## 7. Funzionalità per area (stato al 18/10/2026 sera)

| Area (requisiti) | Stato | Dettaglio |
|---|---|---|
| Accesso e ruoli (§3, §13) | Fatto | Email+password, tre ruoli, utenti multi-organizzazione, disattivazione; password temporanea da cambiare al primo accesso, cambio e recupero password, reimpostazione dall'Admin; MFA pronta ma spenta |
| Anagrafiche (§3) | Fatto | Organizzazioni (tipi dello Standard 4.4, fino a 2 delegati), Enti di Validazione e Registri censiti da Operatori e Admin, con le pratiche collegate; un solo account cliente attivo per Organizzazione (Guida 7.2) |
| Pratiche (§2) | Fatto | Progetti e Rapporti di Monitoraggio annuali con le stesse 7 fasi (Guida 6.2 e 6.3.1), ID automatico, stato nel Programma (Guida, Tabelle 3 e 4), data di registrazione, territorio con codici ISTAT (un solo Progetto per territorio), co-promotori, periodo di riferimento (10 o 21 Rapporti), popolazione e crediti previsti; stati attiva/sospesa/annullata/chiusa/ritirata con motivazione, ritiro e rientro; avviso dopo 2 anni senza Rapporti |
| Fasi (§4) | Fatto | Apertura con scadenza automatica, chiusura, modifica scadenza; durate per Progetto e Rapporto modificabili dall'Admin; verifica sull'accuratezza (+15 gg) e fino a 3 accertamenti (+10 gg) nelle fasi 2 e 6 (Guida 6.5.2); note di fase interne o condivise; documenti richiesti per fase preconfigurati dalla Guida (indicatore); il Comune carica solo nelle fasi aperte |
| Documenti (§5) | Fatto (manca antivirus) | Versioni mai sovrascritte, hash SHA-256, visibilità Cliente/Fondazione/Pubblico, per fase o generali; tipologie con i nomi ufficiali della Guida; contratto con l'ente e versione privata del Modulo mai pubblici; limite 50 MB, formati ammessi, controllo contenuto |
| Integrazioni (§4) | Fatto | Richiesta → risposta del Cliente con documento → chiusura; fase "in attesa di integrazione" |
| Feedback pubblico (§6, Guida 3.9) | Fatto (manca SPID/CIE/CNS) | Progetti (30 giorni) e Rapporti (20 giorni); pagina pubblica, documento pubblicato e bloccato, osservazioni numerate con email confermata e allegato, moderazione con motivazione facoltativa, firma «Partecipante» o nome a scelta dell'autore, risposte del Comune, errata corrige con ripartenza facoltativa del periodo; l'accesso con SPID/CIE/CNS richiesto dalla Guida 3.9 richiede l'adesione della Fondazione come fornitore di servizi |
| Pagamenti (§7) | Fatto | Voci con la voce dello Schema tariffario e proposta degli importi (iscrizione, registrazione, emissione, vendita), incassi, operatore registrato e mostrato allo staff; attività sospese fino al saldo delle voci scadute, iscrizione da saldare prima della fase 5; visibili al Comune in sola lettura |
| Back-office (§8) | Fatto | Cruscotto con scadenze/scaduti, ricerca, azioni con motivazione |
| Notifiche (§9) | Fatto | Interne + email (Resend); messaggi Comune-Fondazione nella pratica; manca verifica dominio |
| Audit (§10) | Fatto | Scritto dal database, immutabile, pagina di consultazione |
| Export fascicolo (§11) | Fatto | ZIP con riepilogo PDF, documenti, validazione, consultazioni con allegati ed errata corrige, note, messaggi, pagamenti e audit con i nomi |
| Conservazione (§12) | Fatto (parte tecnica) | Nessuna cancellazione; data di conservazione a 12 anni (Guida 6.2.1 e 6.5.1); la procedura di cancellazione a fine periodo la definirà la Fondazione |
| Piattaforma pubblica (Guida 3.7) | Fatto | Pagina /programma: informazioni del Programma, enti, registri, metodologie, documenti e modulistica, Progetti dal momento «in fase di validazione» con documenti pubblici, Rapporti e crediti |
| Crediti emessi (Guida 6.3.2-6.3.3, Standard 6) | Fatto | Lotti con ID univoci emessi dall'Admin dopo la registrazione del Rapporto (con il limite del calcolo ex post confermato), caricamento sul registro esterno, vendite comunicate dal registro, cancellazione tombale (attivo / ritirato), avviso dopo 10 giorni senza dichiarazione |
| Reclami (Politica di reclamo, Guida 8) | Fatto | Invio dal portale, registrazione dei reclami arrivati via PEC, gestore, conferma, risposta scritta, costi, note interne, notifiche |
| Calcolo crediti (Metodologia v1.2) | Fatto (scelte interpretative da confermare) | Motore formule 1-32, Tabelle 3-5, 8, 15, 16; import diretto del tracciato con aggregazione delle letture, blocco dei dati personali e controlli di coerenza; controlli della Gestione qualità dei dati (Tabella 3 dello Standard ±30% con motivazione obbligatoria, completezza, unicità, letture a buon fine, tempestività); calcoli confermati immutabili con numero progressivo interno; rapporto PDF. Funzione migliorativa: per la Metodologia il calcolo lo fa il promotore nel Rapporto e l'ente lo verifica |
| Amministrazione | Fatto | Utenti, audit, impostazioni: durata fasi, documenti richiesti, modelli di documento |
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

### 19 ottobre 2026
- **Utenti: pulsante «Elimina» e impaginazione** (richieste di Luca) —
  script `30_elimina_utente.sql`: si cancella solo chi non ha mai operato
  (audit trail), con conferma; pulsante «+ Nuovo utente» sulla riga del
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
- Simulatore: metodo di stima dei crediti da allineare con quello delle
  stime commerciali (Allegato A dei contratti: calcolo per utenza, solo
  utenze virtuose, secco e organico con tariffazione puntuale).

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
- ~~**7.** Registro dei crediti calcolati e confermati~~ — fatto il 18/10: numero progressivo dei calcoli (elenco interno) e, con lo script 24, emissione dei crediti con ID univoci, caricamento sul registro esterno, vendite e cancellazione tombale (Guida 6.3.2-6.3.3).
- **8.** Collaudo con dati reali di un Comune.
- **9.** Conferma delle scelte interpretative.
- **37.** **Simulatore di scenari** — richiesto da Luca il 19/10; **prima versione fatta il 19/10** (script 28 eseguito in produzione, pagina `/simulatore`, motore `simulatore.js`). Restano: stampa PDF impaginata, eventuale visione da parte del Comune, conferma del modello. Strumento
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
- **28.** Riservatezza della documentazione: il registro è nel repository pubblico e i file Word/PDF di Registro, Manuale Amministratore e Manuale Test (`public/documentazione/`) sono raggiungibili da chi conosce l'indirizzo (il portale li mostra solo agli Amministratori). Per renderli davvero riservati: archivio privato su Supabase con accesso solo Admin, o repository privato (oggi incompatibile con il piano gratuito di Vercel).

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
- **36.** Accesso degli stakeholders con SPID, CIE o CNS (Guida 3.9): adesione come fornitore di servizi (AgID o aggregatore), poi integrazione nella pagina del feedback pubblico.
- **21.** **Assistente virtuale (Claude)** integrato nel portale — richiesto da Luca il 18/10, confermato tra i punti aperti il 19/10. Funziona con i modelli Claude di Anthropic tramite API (lo sviluppo del portale si fa con Claude Code). Ambito da definire; usi possibili: assistente per gli utenti dei Comuni (come compilare, cosa manca nella pratica), supporto agli Operatori (controllo completezza dei documenti, bozze di richieste di integrazione e di risposte ai commenti), verifica del tracciato dati prima dell'import, spiegazione dei risultati del calcolo crediti. Richiede: chiave API Anthropic (segreto in Supabase), una Edge Function che faccia da tramite, regole su quali dati l'agente può leggere (privacy) e registrazione delle sue azioni nell'audit.

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
Inventario generato da `strumenti/inventario_codice.py`: 114 file, 27.613 righe in tutto.

**Avvio e instradamento**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/App.jsx` | 244 | associa ogni indirizzo alla sua pagina e decide chi può aprirla. Le pagine riservate passano dal componente Protetta, che nell'ordine chiede: sessione attiva, eventuale nuova password (link di recupero o password temporanea),… |
| `src/main.jsx` | 32 | monta l'applicazione nell'elemento #root di index.html e la avvolge nei contesti globali: StrictMode (controlli di React in sviluppo), BrowserRouter (indirizzi /pratiche, /crediti, …) e AuthProvider (sessione, ruolo, MFA).… |

**Pagine (src/pages)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/pages/Anagrafiche.jsx` | 206 | censimento di Organizzazioni ed Enti di Validazione (requisiti §3: l'Operatore «censisce Organizzazioni ed Enti di Validazione»). - Organizzazioni: elenco con ricerca, dati essenziali (tipo, codice fiscale, partita IVA, PEC,… |
| `src/pages/AreaCliente.jsx` | 138 | il Comune/azienda vede l'elenco dei propri Progetti (schede compatte con stato) e, sotto, il dettaglio della pratica selezionata: fasi, documenti, integrazioni, messaggi. Link al Manuale Utente in PDF. |
| `src/pages/Audit.jsx` | 143 | tabella degli eventi registrati (data, utente, operazione, pratica, passaggio di stato, motivazione), con ricerca testuale e pulsante per caricare eventi meno recenti (requisiti §10). |
| `src/pages/BackOffice.jsx` | 221 | a sinistra l'elenco dei Progetti (con ricerca oltre 4 voci), a destra il dettaglio della pratica scelta con le sue fasi, documenti, integrazioni, consultazione, pagamenti, rapporti. Pulsante «+ Nuovo progetto» per registrare un… |
| `src/pages/CalcoloCrediti.jsx` | 1461 | editor di un calcolo dei crediti di CO₂eq secondo la Metodologia CWP v1.2, a passi (menu a sinistra): import del tracciato dati, impostazioni, rifiuti del territorio, delibera tariffaria, fattori di emissione, Banca Dati Utenze,… |
| `src/pages/CambiaPassword.jsx` | 163 | scegliere una nuova password, con le regole di src/lib/password.js. - "obbligatorio": primo accesso con password temporanea (o reimpostata dall'Amministratore): finché non la cambia l'utente non entra; - "volontario": l'utente… |
| `src/pages/ConsultazioniPubbliche.jsx` | 331 | permettere a chiunque di leggere il Progetto (30 giorni) o il Rapporto di Monitoraggio (20 giorni) nel periodo di feedback pubblico (Guida al Programma 3.9 e 6.3.1) e inviare osservazioni, che Fondazione Operate modera e a cui… |
| `src/pages/Crediti.jsx` | 230 | sezione del calcolo dei crediti di CO₂eq (Metodologia Carbon WastePrint® v1.2). Due viste: - «Calcoli»: elenco di tutti i calcoli (titolo, pratica, anno e tipo, crediti netti, stato bozza/confermato) e modulo «+ Nuovo calcolo»… |
| `src/pages/CreditiEmessiPagina.jsx` | 68 | elenco di tutti i lotti di crediti emessi dai Rapporti di Monitoraggio (Guida al Programma 6.3.2 e 6.3.3; script 24), con il totale emessi / attivi / ritirati e, per lo staff, le azioni su ogni lotto (caricamento sul registro,… |
| `src/pages/Cruscotto.jsx` | 268 | (requisiti §8) riquadri di sintesi cliccabili (pratiche in corso, in scadenza, scadute, in attesa del Cliente, integrazioni da verificare, consultazioni attive) e tabella di tutte le pratiche, Progetti e Rapporti, con ricerca e… |
| `src/pages/Documentazione.jsx` | 144 | elenco dei documenti del portale da aprire in PDF o scaricare in Word, ciascuno con la revisione più recente e la sua data. - Manuale Utente: per tutti i ruoli (in PDF; il Word solo agli Amministratori). - Manuale… |
| `src/pages/FormatoDati.jsx` | 136 | spiega lo standard dei dati da inviare per il calcolo dei crediti e permette di scaricare il tracciato Excel. Il link si può mandare a Comuni e gestori anche senza credenziali. Contiene: elenco dei fogli del tracciato,… |
| `src/pages/GestioneUtenti.jsx` | 745 | elenco di tutti gli utenti (nome, email, organizzazioni, ruolo, stato) con, per ciascuno: modifica di ruolo e organizzazioni, reimpostazione della password temporanea, disattivazione/riattivazione. Pulsante «+ Nuovo utente» per… |
| `src/pages/Impostazioni.jsx` | 60 | parametri del Programma modificabili dagli Amministratori: - Durata delle fasi del Progetto e del Rapporto di Monitoraggio (script 13 e 21, componente DurateFasi); - Documenti richiesti per fase (script 21, componente… |
| `src/pages/Login.jsx` | 259 | accesso con email e password; «Password dimenticata?» per farsi mandare il collegamento di reimpostazione; link alle pagine pubbliche (formato dei dati, consultazioni pubbliche, Manuale Utente in PDF). Dopo l'accesso riuscito… |
| `src/pages/Profilo.jsx` | 66 | mostra i dati dell'account (nome, email di accesso, ruolo), il collegamento al cambio password («/password») e i documenti da scaricare per il proprio ruolo: Manuale Utente per tutti; Manuale Amministratore e Registro sviluppo e… |
| `src/pages/Programma.jsx` | 249 | la parte pubblica della piattaforma online richiesta dalla Guida al Programma (cap. 3.7) e dallo Standard CWP (cap. 2.3, 5 e 6): - informazioni del Programma: soggetto promotore del programma, PEC, email e sito ufficiale (Guida… |
| `src/pages/Reclami.jsx` | 250 | reclami e richieste di chiarimento (Politica di reclamo del Programma; Guida al Programma cap. 8; script 24). - Chiunque abbia un account invia un reclamo o una richiesta di chiarimento dal portale e ne segue lo stato e la… |
| `src/pages/Simulatore.jsx` | 998 | stima ex ante, non certificabile, dei crediti che un Comune potrebbe generare in 7, 10 o 21 anni (Registro, backlog punto 37). - Elenco degli scenari raggruppati per Comune, con confronto dei totali; «+ Nuovo scenario» (Comune… |
| `src/pages/TuoiDocumenti.jsx` | 175 | (requisiti §5) raccoglie i documenti GENERALI (non legati a una fase) di tutte le pratiche dell'organizzazione: contratto, allegati, documentazione amministrativa e altri documenti della Fondazione, raggruppati per tipologia,… |
| `src/pages/VerificaMfa.jsx` | 169 | (requisiti §13) - primo accesso: attivazione con QR code da inquadrare con un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy…), con chiave da inserire a mano in alternativa; - accessi successivi:… |

**Componenti (src/components)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/components/Badge.jsx` | 37 | etichetta colorata compatta per mostrare uno stato (pratica, fase, documento, pagamento, calcolo…). Solo grafica. |
| `src/components/Consultazione.jsx` | 435 | riquadro «Feedback pubblico» (il termine della Guida al Programma, cap. 3.9) di un Progetto o di un Rapporto di Monitoraggio (fase 3, requisiti §6; per i Rapporti Guida 6.3.1, script 23). Lo staff apre il feedback pubblicando un… |
| `src/components/CreditiEmessi.jsx` | 319 | crediti di carbonio emessi da un Rapporto di Monitoraggio registrato (Guida al Programma 6.3.2 e 6.3.3, Tabella 5; Standard 6.2; script 24): - emissione di un lotto con ID univoci (solo Amministratori), anche collegata a un… |
| `src/components/DettaglioPratica.jsx` | 912 | pagina di dettaglio di una pratica (Progetto o Rapporto di Monitoraggio) con le sue 7 fasi (Guida al Programma 6.2 e 6.3.1). |
| `src/components/Documenti.jsx` | 317 | gestione documentale di una pratica: elenco con versioni, caricamento di nuovi file e download. Lo staff sceglie anche tipologia e visibilità (Cliente, Pubblico) e può cambiarle dopo il caricamento. |
| `src/components/Header.jsx` | 164 | intestazione in cima a ogni pagina riservata. A sinistra i loghi (Carbon WastePrint, Fondazione Operate, RINA, Carbon Credit) con collegamento alla pagina iniziale; a destra, se l'utente ha fatto l'accesso: menu per ruolo,… |
| `src/components/Integrazioni.jsx` | 266 | richieste di integrazione di una fase (requisiti §4). Ciclo: l'Operatore richiede → il Cliente carica un documento e risponde → l'Operatore chiude la richiesta. Con la chiusura della fase la possibilità di integrare termina. La… |
| `src/components/Messaggi.jsx` | 129 | conversazione tra Comune e Fondazione Operate dentro una pratica (backlog 26). Mostra i messaggi in ordine di data, quelli dell'utente a destra, e permette di scriverne di nuovi. |
| `src/components/NoteFase.jsx` | 108 | note scritte sotto una delle fasi di una pratica (backlog 10). Lo staff legge tutte le note e ne aggiunge di nuove, interne (solo Fondazione) o condivise con il Comune; il Comune vede solo le condivise. |
| `src/components/Notifiche.jsx` | 177 | campanella delle notifiche interne (requisiti §9) nell'intestazione. Mostra il numero delle non lette, apre un elenco a tendina delle ultime 50 notifiche, segna come lette e porta alla pratica collegata. |
| `src/components/NuovoProgetto.jsx` | 291 | finestra (sovrapposta alla pagina) per creare un nuovo Progetto. Si sceglie un'organizzazione esistente o se ne crea una nuova, si indicano codice (facoltativo, è l'ID univoco del progetto), titolo, territorio (codici ISTAT dei… |
| `src/components/Pagamenti.jsx` | 298 | riquadro «Pagamenti» di una pratica (requisiti §7). Nessun incasso online: il back-office censisce il piano previsto (più voci con scadenze diverse) e registra a mano gli incassi. Mostra totali, incassato, da incassare e lo… |
| `src/components/Rapporti.jsx` | 127 | elenco dei Rapporti di Monitoraggio annuali di un Progetto (requisiti §2): uno per anno, in sequenza, fino a 10 con il periodo di riferimento di 10 anni o fino a 21 con 7 anni rinnovabili 3 volte (Standard 4.3.8, script 23).… |
| `src/components/crediti/ImportaTracciato.jsx` | 283 | passo «Importa il tracciato» del calcolo dei crediti (backlog 1-5). L'Amministratore sceglie il tracciato dati del Comune: - dai documenti della pratica del calcolo (file .xlsx o .zip caricati dal Comune), oppure dal proprio… |
| `src/components/crediti/RegistroCrediti.jsx` | 165 | registro dei crediti (backlog 7), vista «Registro» della pagina Calcolo crediti. Elenca i calcoli ex post confermati con il numero di registro assegnato dal database alla conferma (CWP-REG-AAAA-NNNN). Un calcolo corretto con una… |
| `src/components/crediti/TabellaDati.jsx` | 208 | tabella di dati modificabile in pagina per il calcolo dei crediti CWP (conferimenti, utenze, riuso…), con aggiunta ed eliminazione di righe, importazione da CSV (anche salvato da Excel in italiano) e scaricamento di un modello… |
| `src/components/impostazioni/DocumentiRichiesti.jsx` | 153 | elenco dei documenti richiesti in ogni fase (requisiti §4, «eventuali documenti richiesti»), per Progetto e Rapporto di Monitoraggio. Ogni voce è una tipologia di documento attesa in una fase; nella pratica la fase mostra… |
| `src/components/impostazioni/DurateFasi.jsx` | 214 | sezione «Durata delle fasi» delle Impostazioni, una per tipo di pratica: Progetto (7 fasi) e Rapporto di Monitoraggio (4 fasi, script 21). Tabella delle fasi con la durata in giorni modificabile (dalla fase 2 in poi; la fase 1 è… |
| `src/components/impostazioni/EntiValidazione.jsx` | 139 | anagrafica degli Enti di Validazione (backlog 11), sezione della pagina Anagrafiche. Elenco degli enti con i Progetti a cui sono assegnati (requisiti §3), inserimento di un nuovo ente, modifica e disattivazione. L'ente non… |
| `src/components/impostazioni/InfoProgramma.jsx` | 145 | informazioni del Programma pubblicate sulla pagina pubblica /programma (Guida al Programma 3.1 e 3.6): soggetto promotore del programma, PEC (anche per i reclami), email e sito ufficiale; e le metodologie approvate (Guida cap.… |
| `src/components/impostazioni/ModelliDocumento.jsx` | 184 | modelli di documento (backlog 12), sezione della pagina Impostazioni. L'Amministratore carica i modelli che i Comuni scaricano: un modello può valere per una fase di un tipo di pratica (Progetto o |
| `src/components/impostazioni/Registri.jsx` | 109 | elenco dei registri riconosciuti dal Programma (Guida al Programma 3.5, Standard CWP cap. 6), pubblicato sulla pagina pubblica /programma: piattaforme esterne su cui il promotore del progetto carica e vende i crediti. Requisiti… |
| `src/components/stili.js` | 85 | oggetti di stile in linea condivisi dai componenti delle pratiche e delle impostazioni (stessa grafica del resto del portale: carta, verde Fondazione, bordi sottili) e la funzione dataOra per mostrare data e ora in formato… |

**Librerie (src/lib)**

| File | Righe | Cosa contiene |
|---|---|---|
| `src/lib/AuthContext.jsx` | 189 | tiene in memoria la sessione Supabase Auth, il profilo applicativo (ruolo, organizzazione, flag password temporanea) e lo stato MFA. Espone le funzioni accedi, esci, richiediRecuperoPassword, cambiaPassword e caricaMfa. Ogni… |
| `src/lib/crediti/archivio.js` | 244 | crea, legge, aggiorna ed elimina i calcoli (testata e dati in calcolo_crediti) e la loro Banca Dati Utenze (righe di conferimento e di riuso), anche quando le righe sono centinaia di migliaia (invio e lettura a blocchi). Crea le… |
| `src/lib/crediti/calcolo.js` | 457 | funzioni pure (nessun accesso al database): ricevono i dati del calcolo e restituiscono risultati intermedi e finali, con il riferimento alla formula della Metodologia accanto a ogni passaggio. |
| `src/lib/crediti/parametri.js` | 95 | tabelle numeriche della Metodologia usate come valori iniziali di ogni calcolo: fattori di emissione per tipologia di rifiuto (Tab. 3, 4, 7), pesi specifici (Tab. 8), beni a riuso (Tab. 5), buffer (Tab. 15 e Cap. 7), giorni… |
| `src/lib/crediti/qualita.js` | 124 | indicatori di qualità dei dati di un calcolo dei crediti, oltre ai controlli di coerenza di tracciato.js: - soglia di scostamento ±30% (cap. 3.1.2) tra la produzione pro capite dei rifiuti del territorio e i valori medi del… |
| `src/lib/crediti/rapportoPdf.js` | 369 | genera nel browser, con jsPDF e jspdf-autotable, il rapporto di un calcolo: scheda, sintesi dei crediti, buffer, dati di ingresso, risultati per tipologia e per classe, avvisi, controlli di coerenza e scelte interpretative. Il… |
| `src/lib/crediti/scenari.js` | 60 | unico punto in cui il portale legge e scrive la tabella scenario_simulazione (supabase/28_simulatore.sql). |
| `src/lib/crediti/simulatore.js` | 591 | dati i rifiuti dell'anno base (per tipologia) e, per ogni anno del periodo, gli obiettivi di produzione totale e di secco residuo pro capite, ricalcola la percentuale di raccolta differenziata e stima i crediti anno per anno con… |
| `src/lib/crediti/tracciato.js` | 657 | legge il file del tracciato compilato dal Comune o dal gestore, blocca l'import se trova dati personali, converte i fogli nei dati del motore di calcolo (calcolo.js) e segnala le incoerenze. |
| `src/lib/csv.js` | 157 | leggere i CSV caricati nel calcolo crediti (tabelle dati e file del tracciato), convertirli in oggetti secondo uno schema di colonne, produrre CSV da scaricare (export, modelli vuoti, registro crediti). |
| `src/lib/cwpProgram.js` | 185 | costanti condivise da tutto il portale, allineate all'analisi funzionale: le 7 fasi del Progetto e del Rapporto, i 3 ruoli applicativi, gli stati di pratica e di fase (con i colori dei badge), la palette e le tipologie di… |
| `src/lib/date.js` | 68 | formattare le date del database (gg/mm/aaaa), contare i giorni alle scadenze e ottenere la data di oggi in formato ISO (anche la data italiana, indipendente dal fuso del computer). |
| `src/lib/dati.js` | 1045 | raccoglie in un solo posto tutte le letture e scritture del portale su tabelle, funzioni del database (RPC), archivi (Storage) ed Edge Functions, esclusi il calcolo crediti (src/lib/crediti/archivio.js) e l'autenticazione… |
| `src/lib/fascicolo.js` | 354 | ZIP con: riepilogo PDF (Riepilogo.pdf, src/lib/fascicoloPdf.js), dati della pratica con l'Ente di Validazione, fasi, tutti i documenti in tutte le versioni (cartella Validazione per il rapporto dell'Ente; per i Rapporti anche il… |
| `src/lib/fascicoloPdf.js` | 129 | un documento leggibile da stampare o archiviare insieme ai file del fascicolo: dati della pratica e dell'Ente di Validazione, fasi, elenco dei documenti (con l'impronta SHA-256), integrazioni, consultazioni pubbliche, pagamenti… |
| `src/lib/file.js` | 158 | prima di inviare un file all'archivio controlla formato ammesso, dimensione, contenuto reale (primi byte, "firma" del formato) e prepara un nome sicuro per il percorso nell'archivio. Traduce anche gli errori dello Storage di… |
| `src/lib/password.js` | 70 | controllo delle regole della password prima dell'invio, generazione della password temporanea assegnata dall'Amministratore, traduzione in italiano degli errori di Supabase Auth. |
| `src/lib/supabase.js` | 37 | crea l'unico client @supabase/supabase-js usato dal portale (database, Auth, Storage, Edge Functions). Legge URL e chiave dalle variabili d'ambiente (file .env in locale, mai pubblicato; in produzione le variabili del progetto… |
| `src/lib/tariffe.js` | 110 | calcolare le voci di pagamento proposte per una pratica dalle tariffe massime dello Schema tariffario (IVA esclusa). Sono proposte: lo staff le controlla, può cambiare l'importo e le salva come voci di pagamento (Pagamenti.jsx).… |

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
| `supabase/30_elimina_utente.sql` | 75 | un Amministratore può cancellare un utente che non ha mai operato nel portale, cioè che non compare come autore di nessuna voce dell'audit trail (nessun documento, messaggio, modifica, cambio della password…). Serve, ad esempio,… |
| `supabase/schema_completo.sql` | 434 | PORTALE CARBON WASTEPRINT — Schema del database (Supabase / PostgreSQL) |

**Edge Functions (supabase/functions)**

| File | Righe | Cosa contiene |
|---|---|---|
| `supabase/functions/consultazione-pubblica/index.ts` | 432 | servizio della pagina pubblica delle consultazioni (requisiti §6, decisioni B e D del 18/10/2026). Chiunque, senza account, può: - "elenco": vedere le consultazioni aperte; - "dettaglio": leggere documento, errata corrige e… |
| `supabase/functions/crea-utente/index.ts` | 263 | crea un nuovo utente con password temporanea e imposta ruolo + organizzazione. All'utente parte un'email con indirizzo del portale, email di accesso e password temporanea (Resend, funzione inviaEmailAccesso in fondo al file); se… |
| `supabase/functions/invia-email-notifica/index.ts` | 160 | invia per email ogni nuova notifica del portale (requisiti §9: "email + notifica interna"). |
| `supabase/functions/recupera-password/index.ts` | 155 | «Password dimenticata?» — genera il collegamento di recupero di Supabase Auth e spedisce l'email in italiano con Resend (stessa grafica delle notifiche), invece del modello email di Supabase. |
| `supabase/functions/reimposta-password/index.ts` | 218 | l'Amministratore assegna una nuova password temporanea a un utente (Cliente od Operatore) che l'ha dimenticata. Al primo accesso il portale obbliga l'utente a sceglierne una personale (script 15). |

**Test (test)**

| File | Righe | Cosa contiene |
|---|---|---|
| `test/crediti.test.mjs` | 144 | verifica del motore di calcolo con un esempio calcolato a mano (un piccolo Comune con 2 classi domestiche e 1 non domestica). Controlla le formule 1-17, 19-22 e 28-32 (non la 18: peso specifico a consuntivo), i buffer delle… |
| `test/csv.test.mjs` | 53 | verifica che i CSV salvati da Excel in italiano (BOM, separatore ";", virgola decimale, punto delle migliaia, testi tra virgolette con ";" dentro, righe vuote) siano letti correttamente; che intestazioni con maiuscole/accenti… |
| `test/date.test.mjs` | 31 | verificare le date in ora italiana usate per aprire le consultazioni (30 giorni) e per i nomi dei file: oggiItalia() deve dare sempre aaaa-mm-gg in fuso Europe/Rome, aggiungiGiorni() deve contare i giorni sul calendario (fine… |
| `test/qualita.test.mjs` | 43 | verificare il confronto con la Tabella 3 dello Standard CWP (soglia ±30%) e gli indicatori di completezza, unicità, letture a buon fine e tempestività. |
| `test/simulatore.test.mjs` | 225 | verificare il riepilogo dell'anno base (totale, pro capite, % differenziata, fattore del secco), i dati dal cluster SOSE e da un calcolo, gli anni del periodo (7, 10, 21), la traiettoria lineare e la stima dei crediti anno per… |
| `test/tariffe.test.mjs` | 44 | verificare gli importi proposti per le voci di pagamento con gli esempi dello Schema tariffario v1.2: fasce di popolazione, quote per credito previsto, scaglioni cumulativi di emissione e minimo di vendita. |
| `test/tracciato.test.mjs` | 110 | cinque prove sui file di esempio: lettura dell'Excel compilato, blocco dei dati personali (con valori oscurati nei messaggi), ZIP di CSV con singole letture (aggregazione ed esclusione delle letture fuori anno), controlli di… |

**Strumenti (strumenti)**

| File | Righe | Cosa contiene |
|---|---|---|
| `strumenti/genera_documenti.cjs` | 569 | genera in Word (.docx) e PDF i documenti del portale, con copertina e loghi, registro delle revisioni, sommario con numeri di pagina, intestazione e piè di pagina: |
| `strumenti/genera_esempi_tracciato.py` | 101 | genera i file di prova del tracciato dati per i test automatici (test/tracciato.test.mjs) e per il collaudo manuale (Manuale Test): - test/dati/tracciato_esempio.xlsx : tracciato compilato, Banca Dati con totali (foglio 5) -… |
| `strumenti/genera_tracciato_dati.py` | 312 | genera public/modelli/Tracciato_dati_CWP_v1.xlsx (tracciato dati standard CWP), il file vuoto che Comuni e gestori compilano per il calcolo dei crediti: fogli Istruzioni, 1_Anagrafica, 2_Rifiuti … 7_Riuso, Codici, con menu a… |
| `strumenti/impagina_pdf.py` | 429 | impagina in PDF (WeasyPrint) Manuale Utente, Manuale Amministratore, Manuale Test e Registro, a partire dagli stessi Markdown del Word. (Uso, impaginazione e requisiti sono descritti nella docstring qui sotto.) |
| `strumenti/inventario_codice.py` | 121 | genera l'elenco di tutti i file del codice (cartella, righe, descrizione presa dall'intestazione del file) e lo inserisce nel capitolo «Codice sorgente» di docs/REGISTRO_DEV_DEPLOY.md, tra i segnaposto INVENTARIO-INIZIO e… |
| `strumenti/revisioni_documenti.json` | 498 | — |
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
| Lettura e controlli del tracciato | `src/lib/crediti/tracciato.js` | — (nel browser) |
| Motore di calcolo (formule 1-32, Tabelle 15-16) | `src/lib/crediti/calcolo.js`, `parametri.js` | riepilogo salvato in `calcolo_crediti.risultato` |
| Salvataggio e versioni | `src/lib/crediti/archivio.js` | immutabilità e numero di registro: `calcolo_immutabile` (11, 18); coerenza del risultato: `calcolo_coerenza`, `calcolo_bdu_modificata`; nuova versione: `admin_nuova_versione_calcolo` (20) |
| Rapporto PDF | `src/lib/crediti/rapportoPdf.js` | archiviazione come `documento` della pratica |
| Prove | `test/crediti.test.mjs`, `test/tracciato.test.mjs`, `test/date.test.mjs` | — |

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

**Limiti noti**: l'import della Banca Dati Utenze cancella e reinserisce a
blocchi senza transazione (un errore a metà lascia dati incompleti, che
però non si possono confermare: ripetere l'import e «Calcola»); scelte interpretative da confermare (capitolo 11);
regole di emissione e annullamento dei crediti in attesa dello Standard
CWP (backlog 7).
