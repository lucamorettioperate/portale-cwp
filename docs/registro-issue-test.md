# Registro issue e test — Portale Carbon WastePrint

## Scopo e regole

Questo registro raccoglie **tutte le segnalazioni** sul portale (difetti, malfunzionamenti, richieste di correzione, riserve del collaudo) con data e ora, chi le ha fatte, la causa, l'azione correttiva, le prove eseguite e il rilascio. In fondo c'è il **registro dei test**: prove automatiche, prove del database e campagne di collaudo.

È riservato agli Amministratori e si scarica dalla pagina **Documentazione** del portale, come gli altri documenti.

**Regola (richiesta di Luca Moretti del 21/10/2026).** Il registro si aggiorna **a ogni variazione di ogni tipo**: nuova segnalazione, analisi, correzione, ritest, rilascio, cambio di stato, nuova prova. Insieme si aggiornano Registro sviluppo e deploy, manuali, presentazione e base di conoscenza, come per gli altri documenti.

**Da dove vengono data e ora.** Le date e le ore sono ricostruite dalle fonti di sviluppo:

- **Segnalazione:** ora del messaggio, della schermata o del rapporto ricevuto, quando disponibile. Se non è disponibile compare «ora non registrata»: le segnalazioni del 17-19 ottobre arrivavano in conversazione e per molte resta solo la data.
- **Correzione:** ora del commit nel repository GitHub (ora italiana).
- **Rilascio:** ora della pubblicazione su Vercel o dell'esecuzione dello script in produzione.

Dal 21/10/2026 ogni nuova voce riporta l'ora esatta della segnalazione.

**Stati.**

| Stato | Significato |
|---|---|
| APERTO | Segnalato, da analizzare o da correggere |
| IN CORSO | Correzione in preparazione |
| CORRETTO_DA_RITESTARE | Correzione in produzione, il collaudo deve ripetere la prova |
| CHIUSO | Correzione verificata (dallo sviluppo con Luca, o dal collaudo) |
| ATTESA_REGOLA | Serve una decisione metodologica della Fondazione: nessuna scelta arbitraria |
| NON_RIPRODOTTO | La segnalazione non si riproduce; restano versione e parametri della verifica |

**Priorità** (dal collaudo): P0 blocca la validità dei risultati o un prerequisito; P1 correzione funzionale o di tracciabilità; P2 chiarezza e leggibilità; P3 miglioria.

**Chi segnala:** Luca = Luca Moretti; Collaudo = Amministratori collaudatori (Andrea Valentini, Albina Ambrogio, Andrea Pavan, Gianluca Tapparini, Luca Belfiore); Revisione = rilettura del codice da parte dello sviluppo; Sviluppo = prova dello sviluppo o messaggio di errore di un servizio.

## Riepilogo al 21/10/2026 (ore 12:45)

| Stato | Numero | Voci |
|---|---|---|
| CHIUSO | 32 | ISS-001 … ISS-034, tranne ISS-012 e ISS-020 |
| CORRETTO_DA_RITESTARE | 14 | D01, D02, D03, D04, D05, D06, D07, R05, R07, R08, D05-R1, O01, ISS-035, ISS-036 |
| ATTESA_REGOLA | 6 | R01, R02, R03, R04, R06, riuso |
| APERTO | 2 voci, 1 causa | ISS-012 e D08 (email ai destinatari diversi dal titolare) |
| NON_RIPRODOTTO | 1 | ISS-020 |

ISS-012 e D08 hanno la stessa causa, segnalata in più momenti (17/10, 18/10, 21/10).

## Elenco delle segnalazioni

Ordine cronologico. Una data senza ora vuol dire «ora della segnalazione non registrata». Le ore delle correzioni sono quelle dei commit; «—» = nessun intervento sul codice. Tra parentesi la priorità.

| ID | Segnalata | Problema | Stato | Correzione |
|---|---|---|---|---|
| ISS-001 | 17/10 mattina | **Pubblicazione** — Vercel non pubblicava il portale («Hobby teams do not support collaboration»). Segnalato da: Sviluppo | CHIUSO (P0) | 17/10 10:19 e 10:26 (`ed14012`, `8408dd2`): repository reso pubblico |
| ISS-002 | 17/10 | **Navigazione** — Indirizzi diretti (es. /pratiche) davano errore 404 su Vercel. Segnalato da: Sviluppo | CHIUSO (P1) | 17/10 13:43 (`58f97df`): instradamento delle pagine in `vercel.json` |
| ISS-003 | 17/10 primo pomeriggio | **Utenti** — Script 06 (utente con più organizzazioni) incompleto: regole di visibilità sbagliate. Segnalato da: Sviluppo | CHIUSO (P1) | 17/10 13:54 e 14:03 (`512df3e`, `35d5b3f`): funzione `app_org_mia` |
| ISS-004 | 17/10 | **Sicurezza** — Un utente poteva modificare il proprio ruolo dal profilo. Segnalato da: Revisione | CHIUSO (P0) | 17/10 15:24 (`324a1bf`): script 10, dal profilo si cambia solo il nome |
| ISS-005 | 17/10 pomeriggio | **Email** — La procedura guidata dei Database Webhook di Supabase selezionava la tabella sbagliata. Segnalato da: Sviluppo | CHIUSO (P2) | 17/10 16:08 (`48e78e0`): procedura annullata, invio realizzato con SQL (script 12) |
| ISS-006 | 17/10 18:14 | **Email** — Nell'email di notifica il pulsante era invisibile con il tema scuro. Segnalato da: Luca | CHIUSO (P2) | 17/10 18:16 (`027efe1`): pulsante leggibile e link di riserva; seconda email verificata |
| ISS-007 | 18/10 mattina | **Accesso** — Site URL di Supabase Auth ancora `localhost:3000`: i link di recupero password non funzionavano. Segnalato da: Sviluppo | CHIUSO (P1) | 18/10 13:19 (`16867bf`): Site URL e Redirect URL del portale, impostati con l'OK di Luca |
| ISS-008 | 18/10 | **Email** — Il servizio email predefinito di Supabase Auth consegna solo ai membri del progetto. Segnalato da: Sviluppo | CHIUSO (P1) | 18/10 13:49 (`6d894d9`): SMTP con Resend |
| ISS-009 | 18/10 13:57 | **Email** — L'email di recupero password arrivava in inglese («Reset your password») anche con il modello italiano salvato. Segnalato da: Luca | CHIUSO (P2) | 18/10 14:04 (`21306fb`): funzione `recupera-password`, email in italiano; Luca ha confermato la ricezione alle 14:04 (schermata delle 14:06) |
| ISS-010 | 18/10 | **Documenti** — Luca cercava i manuali in PDF nel proprio profilo e non li trovava. Segnalato da: Luca | CHIUSO (P3) | 18/10 13:56 (`e261a8c`): pagina «Il mio profilo» con i documenti |
| ISS-011 | 18/10 | **Documenti** — Il referente del Comune non trovava il manuale in «I tuoi documenti». Segnalato da: Luca | CHIUSO (P3) | 18/10 14:24 (`94a4c17`): riquadro «Manuale del portale» |
| ISS-012 | 17/10, poi 18/10 14:50 (schermata) | **Email** — Le email verso indirizzi diversi dal titolare dell'account Resend non vengono consegnate (email di conferma del feedback pubblico: «Non è stato possibile inviare l'email di conferma…»). Segnalato da: Sviluppo, Luca | APERTO (P1) | Configurazione, non codice: dominio verificato su Resend e segreto `EMAIL_MITTENTE` (azione di Luca). Vedi anche D08 |
| ISS-013 | 18/10 | **Feedback pubblico** — Il Comune poteva leggere il testo delle osservazioni non ancora ammesse. Segnalato da: Revisione | CHIUSO (P0) | 18/10 16:27 (`1587574`): script 19 |
| ISS-014 | 18/10 | **Pagamenti** — Importi con il punto delle migliaia («1.234,50») rifiutati o letti male. Segnalato da: Revisione | CHIUSO (P1) | 18/10 16:27 (`1587574`) |
| ISS-015 | 18/10 | **Pratiche** — Avviso «fase chiusa» mostrato due volte al Comune. Segnalato da: Revisione | CHIUSO (P3) | 18/10 16:27 (`1587574`) |
| ISS-016 | 18/10 | **Sicurezza** — Un Amministratore poteva cambiare il ruolo di un altro Amministratore chiamando direttamente il database. Segnalato da: Revisione | CHIUSO (P0) | 18/10 16:28 (`eeb76d3`): script 19 |
| ISS-017 | 18/10 | **Calcolo crediti** — Si potevano salvare dati nuovi e confermare il risultato calcolato su quelli vecchi. Segnalato da: Revisione | CHIUSO (P0) | 18/10 16:51 (`0258fcc`): script 20, il risultato si azzera quando cambiano dati o Banca Dati |
| ISS-018 | 18/10 | **Date** — Tra mezzanotte e le 2 il database considerava «oggi» il giorno prima (ora UTC). Segnalato da: Revisione | CHIUSO (P1) | 18/10 16:51 (`0258fcc`): database in ora italiana |
| ISS-019 | 18/10 | **Sicurezza** — Con password temporanea il blocco dei dati era solo nell'interfaccia. Segnalato da: Revisione | CHIUSO (P1) | 18/10 16:51 (`0258fcc`): blocco anche nel database |
| ISS-020 | 18/10 | **Rapporti** — Possibile superamento del limite di 10 Rapporti di Monitoraggio. Segnalato da: Revisione | NON_RIPRODOTTO | Verificato il 18/10: il limite era già garantito dal database |
| ISS-021 | 18/10 sera | **Manuali** — Il buffer era descritto male nei manuali (il codice era giusto). Segnalato da: Sviluppo | CHIUSO (P2) | 18/10 20:52 (`0048629`) |
| ISS-022 | 19/10 mattina | **Simulatore** — Scenario «BOVISIO 21 ANNI» con rifiuti circa 180 volte più piccoli del reale, senza avviso. Segnalato da: Luca | CHIUSO (P2) | 19/10 11:21 (`b1ba989`): avviso per produzione pro capite fuori scala |
| ISS-023 | 19/10 | **Simulatore** — Il metallo, senza fattore di emissione, produceva crediti fittizi. Segnalato da: Sviluppo | CHIUSO (P1) | 19/10 11:22 (`9e4bee6`) |
| ISS-024 | 19/10 | **Simulatore** — Asse del grafico sbagliato quando tutti i margini sono negativi. Segnalato da: Sviluppo | CHIUSO (P3) | 19/10 12:25 (`5deba8b`) |
| ISS-025 | 19/10 pomeriggio | **Simulatore** — Stima di circa 0,04 crediti per abitante contro 0,19-0,23 dell'Allegato A EsaCom. Segnalato da: Luca | CHIUSO (P1) | 19/10 16:58 (`a6d1a7f`): differenza di metodo; aggiunto il metodo «per utenza» (riserve R01 e R02 aperte) |
| ISS-026 | 19/10 | **Notifiche** — La tendina della campanella usciva dallo schermo quando il menu andava a capo. Segnalato da: Luca | CHIUSO (P2) | 19/10 16:45 (`f1dd36e`) |
| ISS-027 | 19/10 | **Utenti** — Alla creazione di un utente non partiva nessuna email con le credenziali. Segnalato da: Luca | CHIUSO (P1) | 19/10 16:05 (`1409b50`): email delle credenziali (consegna limitata da ISS-012) |
| ISS-028 | 19/10 sera | **Assistente** — Codice della funzione `assistente` incollato a metà nell'editor di Supabase (72 righe su 180); i file `.ts` inviati in chat sembravano vuoti. Segnalato da: Sviluppo | CHIUSO (P1) | 19/10: codice caricato dal repository; copia `.txt` per incollare a mano |
| ISS-029 | 19/10 sera | **Assistente** — Anthropic: «API key is not scoped to a workspace». Segnalato da: Sviluppo | CHIUSO (P1) | 19/10: nuova chiave legata a un solo spazio di lavoro, inserita da Luca |
| ISS-030 | 19/10 sera | **Assistente** — Anthropic: «credit balance is too low». Segnalato da: Sviluppo | CHIUSO (P1) | 19/10: Luca ha acquistato 100 $ di crediti nella Console |
| ISS-031 | 19/10 sera | **Assistente** — Nelle risposte il corsivo compariva con gli asterischi. Segnalato da: Luca | CHIUSO (P3) | 19/10 18:32 (`eff85c8`) |
| ISS-032 | 20/10 | **Simulatore** — Sul telefono la pagina del simulatore scorreva di lato. Segnalato da: Sviluppo | CHIUSO (P2) | 20/10 14:07 (`9f0043e`) |
| ISS-033 | 20/10 14:52 | **Funzioni** — Pubblicazione della funzione non riuscita: «Unterminated regexp literal» (codice incollato a mano rovinato). Segnalato da: Luca | CHIUSO (P1) | 20/10 14:59 (`2f5fe1c`): codice caricato dal repository, tre funzioni ripubblicate con Verify JWT |
| ISS-034 | 20/10 pomeriggio | **Menu** — La voce «Audit» si accendeva anche sulla pagina Audit User. Segnalato da: Sviluppo | CHIUSO (P3) | 20/10 15:13 (`be97c16`) |
| ISS-036 | 21/10 12:07 (log della funzione); 12:23 richiesta di Luca «identifica e sistema» | **Notizie CO2** — Google News non interrogato: alla prima ricerca i canali Google rispondevano 503 e arrivavano solo notizie da due siti. Segnalato da: Sviluppo e Luca | CORRETTO_DA_RITESTARE (P2) | Causa (diagnosi delle 12:26): Google risponde 503 con la pagina «Sorry…» a ogni richiesta dai server di Supabase, con qualunque intestazione (blocco dei centri dati); Bing risponde 200. Correzioni: 12:10 (`5e88cf6`) canali Bing News e Verra; 12:29 (`3275547`) Google News attraverso il tramite in Google Apps Script (`ProxyGoogleNews.gs`, impostazione `url_proxy_google_news`), da installare. Da verificare con la prima ricerca dopo l'installazione |
| ISS-035 | 21/10 circa 11:30 | **Simulatore** — Il PDF scaricato da una simulazione non riportava tutti i dati della pagina né i grafici («inserisci tutti i dati completi della simulazione con costo e grafici»). Segnalato da: Luca | CORRETTO_DA_RITESTARE (P2) | 21/10 11:43 (`e6ed26c`): PDF con grafici e sezioni 1-5 complete, Excel con il foglio «Dati inseriti»; verificato su due scenari di prova (10 anni Caso 1; 21 anni per utenza senza economia) |
| D07 | 20/10 16:40 (rapporto V01; prima prova 19-20/10) | **Calcolo crediti** — Il CSV diretto della Banca Dati accettava pesi negativi e salvava crediti gonfiati. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P0) | 20/10 17:05 (`66d253e`); in produzione circa alle 17:15 con lo script 35 |
| D01 | 20/10 16:40 (prima prova V02 del 19/10) | **Simulatore** — Produzione e secco negativi accettati, differenziata oltre il 100%, scenario salvabile. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P0) | 20/10 17:05 (`66d253e`); in produzione circa alle 17:15 |
| D02 | 20/10 16:40 (prima prova V02 del 19/10) | **Simulatore / calcolo** — Buffer manuale 90% applicato e salvato oltre il massimo dell'80%. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P0) | 20/10 17:05 (`66d253e`); in produzione circa alle 17:15 |
| D04 | 20/10 16:40 | **Date** — Date inesistenti (31/02/2025) trasformate in date reali. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1) | 20/10 17:05 (`66d253e`) |
| D03 | 20/10 16:40 (osservato il 19/10) | **Simulatore** — Prezzo annuo 0 sostituito dal prezzo generale. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1) | 20/10 17:05 (`66d253e`) |
| D05 | 20/10 16:40 (osservato il 19/10, 21:21-21:26) | **Audit** — L'Audit non diceva quale scenario era stato modificato né cosa. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1) | 20/10 17:05 (`66d253e`) |
| D06 | 20/10 16:40 | **Esportazioni** — Una cella CSV che inizia con «=» restava una formula. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1) | 20/10 17:05 (`66d253e`) |
| R01 | 20/10 16:40 | **Metodologia** — Stesse opzioni: buffer 20% nel calcolatore e 30% nel simulatore. Segnalato da: Collaudo | ATTESA_REGOLA (P0) | — (domanda alla Fondazione) |
| R02 | 20/10 16:40 | **Metodologia** — La distribuzione normale delle utenze ammette quote oltre il 100%. Segnalato da: Collaudo | ATTESA_REGOLA (P1) | — |
| R03 | 20/10 16:40 | **Metodologia** — Crediti economici interi (292) contro i crediti tecnici (292,8). Segnalato da: Collaudo | ATTESA_REGOLA (P1) | — |
| R04 | 20/10 16:40 | **Simulatore** — Pareggio esatto non distinto dal mancato rientro. Segnalato da: Collaudo | ATTESA_REGOLA (P2) | 20/10 17:05: chiarito solo il messaggio |
| R05 | 20/10 16:40 | **Calcolo crediti** — «Conferma definitivamente» disponibile senza Banca Dati Utenze. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P0) | 20/10 17:05 (`66d253e`) e script 35; elenco dei prerequisiti da confermare |
| R06 | 20/10 16:40 | **Pratiche** — Fase completata con un documento obbligatorio mancante. Segnalato da: Collaudo | ATTESA_REGOLA (P0) | — (oggi promemoria non bloccante per scelta) |
| R07 | 20/10 16:40 | **Esportazioni** — Nel CSV di riepilogo P%UD era 1 invece di 100. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P2) | 20/10 17:05 (`66d253e`) |
| R08 | 20/10 16:40 | **PDF** — Spaziatura irregolare e glifi sovrapposti nei PDF (lettore poppler). Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P2) | 21/10 11:05 (`4920d2a`): carattere Liberation Sans (stesse larghezze di Helvetica, licenza OFL) incorporato in rapporto crediti, simulatore e riepilogo del fascicolo; verificato con pdffonts (solo carattere incorporato in uso) e a schermo |
| Riuso | 20/10 16:40 | **Metodologia** — Segno dell'effetto del riuso (formule 26 e 29). Segnalato da: Collaudo | ATTESA_REGOLA | — |
| D08 | 21/10 10:42 (rapporto V05; creazione A del 20/10) | **Email** — Email delle credenziali non inviata («Email non inviata», Resend 403). Segnalato da: Collaudo | APERTO (P1) | Stessa causa di ISS-012 |
| D05-R1 | 21/10 10:42 (osservato il 21/10 sugli eventi delle 09:20:41 e 09:21:21) | **Audit** — Nel dettaglio dell'Audit i testi lunghi restavano tagliati anche aprendo «1 modifica». Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P2) | 21/10 10:48 (`39c9bc8`); in produzione alle 10:50, verificato dal vivo alle 10:51 |
| O01 | 21/10 10:42 (osservato il 20/10 su B disattivato) | **Accesso** — Account disattivato: elenchi vuoti invece di un messaggio esplicito. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P3) | 21/10 10:48 (`39c9bc8`); in produzione alle 10:50 |

## Schede delle segnalazioni del collaudo

Le schede complete (riproduzione, causa, file modificati, prove, domande alla Fondazione) sono nei documenti del collaudo con le risposte dello sviluppo: **Collaudo V01** (`docs/collaudo/Collaudo_V01_risposte.md`) e **Integrazione V05** (`docs/collaudo/Collaudo_V05_risposte.md`). Qui la sintesi delle azioni correttive.

**D07 — pesi negativi nella Banca Dati.**
- **Causa:** il controllo dei negativi c'era solo nel lettore del tracciato completo, non nell'import CSV diretto.
- **Azione:** import «tutto o niente»; controllo dei negativi nell'import, nel salvataggio, nei controlli di coerenza e nel motore (calcolo bloccato, crediti a zero, risultato non salvato); vincoli nel database (script 35).
- **Prove:** `test/collaudo_v01.test.mjs` (D07, caso C 0,2928 e variante 0,24888) e `t35.sql`.

**D01 / D02 / D03 — simulatore.**
- **D01 e D02:** controllo `erroriScenario`. Popolazione e produzione devono essere maggiori di 0, secco e rifiuti non negativi, secco non oltre la produzione, buffer tra 0 e 80. Con dati impossibili nessun risultato e Salva disattivato. Lo stesso controllo è nel salvataggio e nel database.
- **D03:** lo zero è un valore vero (ricavi 0), il vuoto eredita il prezzo generale.
- **Prove:** D01, D02, D03 e caso S (292,8 l'anno, 2.928 in dieci anni).

**D04 — date.** Date controllate sul calendario nel tracciato, nel primo anno del calcolo e nella visualizzazione; il 29/02 vale solo negli anni bisestili.

**D05 e D05-R1 — Audit.**
- **Prima correzione (D05):** colonna «Oggetto e modifiche» con nome e codice dell'oggetto e campi cambiati «da → a».
- **Seconda correzione (D05-R1):** «Testo completo» mostra Prima e Dopo interi e la parte Tolto / Aggiunto. Inoltre la denominazione delle organizzazioni nell'oggetto, la ricerca sui valori cambiati e i valori interi nel CSV.
- Gli eventi registrati non sono stati riscritti.

**D06 — formule nei CSV.** I testi che iniziano con `=`, `+`, `-` o `@` prendono un apostrofo davanti, in tutti e tre i generatori CSV. I numeri restano invariati.

**R05 — conferma.** «Conferma definitivamente» è disattivato quando i controlli di coerenza segnalano errori. Il database rifiuta la conferma senza Banca Dati Utenze o con un risultato bloccato.

**O01 — account disattivato.** Pagina «Account disattivato» con l'invito a scrivere alla Fondazione e il pulsante Esci.

**R08 — PDF.** Causa probabile: i PDF usavano Helvetica non incorporata, che ogni lettore sostituisce con un carattere locale di larghezze diverse. Ora i tre generatori incorporano Liberation Sans (`src/lib/caratteriPdf.js`, file in `public/caratteri/` con la licenza OFL). Ha le stesse larghezze, quindi l'impaginazione non cambia. Se il carattere non si scarica si torna a Helvetica. Verifica: PDF di prova dei tre tipi con `pdffonts`, che risulta «incorporato: sì», ed esame a schermo. Da ritestare con il caso 7.23 su più lettori.

**ISS-012 / D08 — email.** In modalità di prova Resend consegna solo al titolare dell'account. Per chiudere servono tre passi:
1. Luca verifica un dominio della Fondazione su Resend (record DNS).
2. Luca imposta il segreto `EMAIL_MITTENTE` in Supabase.
3. Prova con una casella di prova controllata.

## Registro dei test

### Prove automatiche (npm test)

Si eseguono con `npm test` prima di ogni rilascio; l'ultimo esito è sempre «tutte superate».

| Serie | Prove | Cosa controlla |
|---|---|---|
| `crediti.test.mjs` | esempio calcolato a mano | Formule della Metodologia, buffer delle Tabelle 15-16, riuso |
| `csv.test.mjs` | verifiche multiple | Lettura e scrittura dei CSV in italiano |
| `tracciato.test.mjs` | 5 | Lettura del tracciato Excel/ZIP, letture, dati personali, coerenza |
| `date.test.mjs` | 3 | Date in ora italiana, fine mese, anni bisestili |
| `tariffe.test.mjs` | 4 | Schema tariffario |
| `qualita.test.mjs` | 2 | Controlli della Gestione qualità dei dati |
| `simulatore.test.mjs` | 18 | Motore del simulatore e parte economica |
| `ordinamento.test.mjs` | 4 | Ordinamento delle tabelle |
| `presenza.test.mjs` | 3 | Utenti online |
| `simulatoreExport.test.mjs` | 7 | Contenuti di PDF ed Excel del simulatore, con tutti i dati inseriti, il totale dei risultati e i grafici (ISS-035) |
| `inattivita.test.mjs` | 3 | Uscita per inattività |
| `collaudo_v01.test.mjs` | 27 | D01-D07, R04, R05, casi ordinari S e C, R01/R02 fissati |
| `collaudo_v05.test.mjs` | 4 | D05-R1: testi lunghi, aggiunta/rimozione, 80/81 caratteri, ricerca |
| `assistente.test.mjs` | 4 | Riepilogo della pratica per l'assistente, copia identica nella funzione del server, base di conoscenza degli Operatori |
| `notizie.test.mjs` | 8 | Osservatorio News: lettura dei feed RSS (Google News, Bing News e siti), chiave dei titoli, pre-filtro, lettura della risposta di Claude, categorie uguali allo script 36, copia identica nella funzione del server |

**Ultima esecuzione:** 21/10/2026 11:55, 15 serie superate.

### Prove del database (banco locale)

Ogni script del database è provato su una copia locale di Postgres 16 con tutti gli script, prima dell'esecuzione in produzione. Le prove sono nei file `t8.sql` … `t35.sql`: permessi per ruolo, rifiuti attesi, immutabilità dell'audit, conferma dei calcoli, emissioni, avvisi di sicurezza, vincoli del collaudo.

Ultime prove:

- `t35.sql` del 20/10/2026: 11 rifiuti attesi, conferma ordinaria possibile e rieseguibilità con dati vecchi;
- `t36.sql` del 21/10/2026 (News): limite di una ricerca ogni 100 minuti (10 con l'Amministratore), doppioni rifiutati, l'Amministratore legge e nasconde, Operatore, Cliente e anonimo non vedono nulla, scrittura diretta e avvio della ricerca negati dal portale.

**Prova di ripristino da backup (21/10/2026 11:15).**
- **Procedura:** il banco, popolato con le prove, è stato esportato come un backup automatico (35 tabelle e 3 utenti). Il database è stato ricostruito con gli script 01-35 ed è stato eseguito `ripristino_dati.sql` generato da `strumenti/backup/genera_sql_ripristino.mjs`.
- **Esito:**
  - dati identici al backup;
  - 1 riga segnalata come «RIGA NON RIPRISTINATA»: era un dato di prova negativo inserito di proposito per lo script 35;
  - contatori riallineati: un nuovo calcolo e un nuovo evento di audit si creano senza conflitti;
  - seconda esecuzione fermata dal controllo «database già pieno», senza nessuna modifica.

Da ripetere ogni tre mesi su un progetto Supabase di prova.

### Campagne di collaudo

| Campagna | Date | Chi | Esito |
|---|---|---|---|
| V02 | 19/10 sera | Collaudatori | Prime osservazioni di D01-D06 sul portale (scenario «COLLAUDO AL V02», bozza C) |
| V03 / rapporto V01 | 20/10, ricevuto alle 16:40 | Collaudatori | 97 casi: 40 superati, 12 falliti, 15 parziali, 7 con riserva, 23 bloccati; 15 rilievi (D01-D07, R01-R08) più il riuso |
| V05 (integrazione) | 20-21/10, ricevuta il 21/10 alle 10:42 | Collaudatori, con i profili creati da Luca | Separazione dei dati A/B e dinieghi superati (A00-A10, B01-B16, OP01-OP15); nuovi rilievi D08, D05-R1, O01 |

**Prossimi ritest richiesti al collaudo:** D01-D07, R05, R07 (Manuale di test 7.17-7.22, 8b.5-8b.5e, 8b.9b), D05-R1, O01 (10.5, 10.5b) e ISS-035 (8b.7, 8b.7b).

## Storico delle revisioni di questo registro

| Data e ora | Variazione |
|---|---|
| 21/10/2026 10:55 | Prima emissione: ricostruite 34 segnalazioni dal 17/10 e i rilievi dei collaudi V01 e V05, con le azioni correttive e il registro dei test |
| 21/10/2026 11:20 | R08 corretto e da ritestare; prova di ripristino da backup nel registro dei test |
| 21/10/2026 11:40 | Nuova serie di prove dell'assistente (14 serie) |
| 21/10/2026 11:45 | ISS-035: PDF ed Excel della simulazione con tutti i dati e i grafici |
| 21/10/2026 11:57 | Nuove prove dell'osservatorio News (`notizie.test.mjs`, `t36.sql`); 15 serie |
| 21/10/2026 12:25 | ISS-036: canali News da Google a Bing; prova Bing in `notizie.test.mjs` (8) |
| 21/10/2026 12:45 | ISS-036: causa individuata (blocco di Google verso i server di Supabase), tramite per Google News; sezione rinominata «Notizie CO2» |
