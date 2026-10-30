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

## Riepilogo al 30/10/2026 (ore 16:00)

| Stato | Numero | Voci |
|---|---|---|
| CHIUSO | 34 | ISS-001 … ISS-034 tranne ISS-012 e ISS-020; ISS-036; ISS-041 |
| CORRETTO_DA_RITESTARE | 21 | D01, D02, D03, D04, D05, D06, D07, R05, R07, R08, D05-R1, O01, ISS-035, ISS-037, ISS-038, ISS-039, ISS-040, N01, N02, N03, N04 (ISS-039 e ISS-040 in produzione dal 23/10 alle 15:50; N01-N04 e ISS-038 in produzione dal 22/10 alle 14:30; N01-N04 con una domanda residua alla Fondazione) |
| ATTESA_REGOLA | 8 | R01, R02, R03, R04, R06, riuso, N05, N06 |
| APERTO | 2 voci, 1 causa | ISS-012 e D08 (email ai destinatari diversi dal titolare) |
| NON_RIPRODOTTO | 1 | ISS-020 |

ISS-012 e D08 hanno la stessa causa, segnalata in più momenti (17/10, 18/10, 21/10).

**Rilievi TEST_PORTALE_CWP (29/10, ricevuti il 30/10): T01-T31**, verificati il 30/10. Scelte di Luca: tutto tranne il Marketing. 21 corretti sul ramo `correzioni-rilievi-t` (script 48), non ancora in produzione: T01, T02, T03, T04, T05, T07, T08, T10, T11, T12, T14, T15, T17, T18, T19, T20, T22, T23, T25, T28, T29; ritest nel Manuale Test, prove 11.1-11.16. In attesa della Fondazione: T06, T09, T16, T21, T26, T27 (e le domande residue di T01, T04, T17); esterni: T13, T24; Marketing invariato: T30, T31. Prima della scelta: 16 confermati da correggere (T02, T03, T07, T08, T10, T11, T12, T15, T17, T18, T19, T20, T22, T25, T30, T31), 8 in attesa di regola (T01, T04, T06, T14 = N05, T16, T21 = N06, T27, T29), 3 migliorie (T05, T09, T26), T23 testo dell'avviso, T28 già presente in parte, 2 esterni (T13, T24). Risposte punto per punto nel documento di progetto `claude/test-portale-cwp-risposte.md`.

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
| ISS-036 | 21/10 12:07 (log della funzione); 12:23 richiesta di Luca «identifica e sistema» | **Notizie CO2** — Google News non interrogato: alla prima ricerca i canali Google rispondevano 503 e arrivavano solo notizie da due siti. Segnalato da: Sviluppo e Luca | CHIUSO (P2) | Causa (diagnosi delle 12:26): Google risponde 503 con la pagina «Sorry…» a ogni richiesta dai server di Supabase, con qualunque intestazione (blocco dei centri dati); Bing risponde 200. Correzioni: 12:10 (`5e88cf6`) canali Bing News e Verra; 12:29 (`3275547`) Google News attraverso il tramite in Google Apps Script (`ProxyGoogleNews.gs`, impostazione `url_proxy_google_news`), autorizzazione bloccata da Google alle 13:54 («Questa app è bloccata»); con l'OK di Luca tramite tolto e al suo posto 8 siti di notizie ambientali (13:57, `56596c9`). Verifiche: ricerca delle 12:18 con Bing (76 notizie lette, 41 nuove, 11 attinenti); diagnosi delle 14:12: 12 siti su 14 rispondono (Rinnovabili.it 403 e GreenReport 404 si saltano), Google sempre 503. Progetto Apps Script «Notizie CO2 – Google News» spostato nel cestino di Drive su richiesta di Luca |
| ISS-037 | 21/10 13:57 | **Backup** — Il backup automatico in Google Apps Script non si attiva: Google blocca l'autorizzazione («Questa app è bloccata… informazioni sensibili», protezione dell'account). Segnalato da: Luca | CORRETTO_DA_RITESTARE (P1) | 21/10 14:34 (`8297e05`): backup giornaliero alle 20:00 dal Mac in Google Drive per desktop › Cwp › backup › <data> (script 38, `backup_cwp_mac.sh`, `installa_backup_mac.sh`); backup manuale del 21/10 in Cwp › backup › 2026-10-21. Da verificare dopo l'installazione sul Mac |
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
| ISS-038 | 22/10 13:26 | **Telefono** — Navigazione da smartphone da ottimizzare (intestazione di 304 px su 844, simulatore più largo dello schermo, campi che fanno ingrandire l'iPhone). Segnalato da: Luca | CORRETTO_DA_RITESTARE (P2) | 22/10, in produzione alle 14:30: menu a pannello, schede al posto delle tabelle in Dashboard e Audit, elenco e dettaglio delle pratiche uno alla volta, campi a 16 px; prove 10.10g-10.10l |
| N01 | 21/10 (terza sessione, file ricevuto il 22/10 07:46) | **Simulatore** — Voci «una tantum» del Caso 1/2 ripetute in tutti gli anni; correttezza economica da verificare. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P2); durate ≠ 10 anni ATTESA_REGOLA | 22/10 08:04 (`18a4653`; in produzione il 22/10): rate annuali di un corrispettivo unico (contratti di consulenza e partecipazione); etichette e nota in pagina, PDF ed Excel; durate diverse da 10 anni segnalate come stima |
| N02 | 21/10 (terza sessione) | **Feedback pubblico** — Borgoval: fase 3 chiusa il 17/10 e consultazione chiusa il 18/10, prima del termine del 16/11. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1) | 22/10 08:04 (`18a4653`; in produzione il 22/10 alle 14:30, script 39): chiusura solo dal giorno dopo il termine e insieme alla fase 3; prima del termine solo per pratica annullata/ritirata/chiusa con motivazione; Borgoval non toccato |
| N03 | 21/10 (terza sessione) | **Pratiche** — Borgoval: fase 5 in corso con ente non assegnato. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P1); dati del contratto ATTESA_REGOLA | 22/10 08:04 (`18a4653`; in produzione il 22/10, script 39): fase 5 solo con un ente attivo assegnato; ente non rimovibile a fase 5 aperta; dato di Borgoval da decidere a parte |
| N04 | 21/10 (terza sessione) | **Dashboard** — Tutte le scadenze «—», contatori a zero. Segnalato da: Collaudo | CORRETTO_DA_RITESTARE (P2); calcolo per decorrenze della Tabella 3 ATTESA_REGOLA | 22/10 08:04 (`18a4653`; in produzione il 22/10): riquadro «Fase aperta senza scadenza»; causa delle date mancanti: fasi aperte il 17/10 con la scrittura diretta tolta il 18/10 (`fa5afac`); fase 1 senza scadenza per costruzione |
| N05 | 21/10 (terza sessione) | **Pratiche** — Codici progetto in formati diversi (`CWP-2026-0001`, `CWP-2026-003`, `cwp-026-005`). Segnalato da: Collaudo | ATTESA_REGOLA (P3) | 22/10 08:04 (`18a4653`; in produzione il 22/10): solo avviso non bloccante per i codici scritti a mano fuori formato; due codici scritti a mano (il generatore produce sempre 4 cifre maiuscole); nessuna rinomina |
| N06 | 21/10 (terza sessione) | **Metodologia** — Paniere del fattore dell'indifferenziato più ampio delle cinque frazioni nominate al cap. 5. Segnalato da: Collaudo | ATTESA_REGOLA (P1) | 22/10 08:04 (`18a4653`; in produzione il 22/10): solo trasparenza (quota, tonnellate, FE, frazioni oltre le cinque ed escluse) nei risultati e nel PDF; formula invariata |
| ISS-039 | 23/10 15:24 | **Pratiche** — Si poteva creare un Rapporto di Monitoraggio per un Progetto non ancora registrato (es. CWP-2026-003). Segnalato da: Luca | CORRETTO_DA_RITESTARE (P2) | 23/10, in produzione alle 15:50 (script 45, main `1188a51`): pulsante «+ Rapporto» solo con la fase 6 completata, controllo anche nel database. I Rapporti già creati (CWP-2026-0001-RM1, CWP-2026-003-RM1) non sono stati toccati |
| ISS-040 | 23/10 15:24 | **Marketing** — Elenco dei Comuni senza filtri vuoto («0 Comuni»), con il filtro per regione funzionava. Segnalato da: Luca | CORRETTO_DA_RITESTARE (P2) | 23/10, in produzione alle 15:50 (script 45): la regola di accesso ora si calcola una volta per lettura; tutti i Comuni in 44 ms invece di oltre il tempo massimo |
| ISS-041 | 26/10 10:23 | **Calcolo crediti** — Con più di 1.000 utenze nel passo 5a il motore ne usava solo le prime 1.000: l'API di Supabase restituisce al massimo 1.000 righe per richiesta e la lettura a blocchi di 5.000 si fermava al primo blocco «corto». Trovato nella prova di Borgoval (10.778 utenze: «708 / 1000» utenze, 119 crediti netti invece di 3.078). Segnalato da: Sviluppo | CHIUSO (P0) | 26/10, in produzione alle 10:25 (main `c8ab6c8`): blocchi di 1.000 e lettura finché arrivano righe. Verificato in produzione sul calcolo di prova di Borgoval: 10.778 utenze lette, risultato uguale al motore eseguito fuori dal portale (3.077,657 crediti netti). Nessun calcolo confermato era interessato (gli unici calcoli con utenze avevano 40 utenze) |
| T01 | 29/10 | **Dashboard** — 7 fasi nel portale, 6 nella Guida. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Togliere la fase 7 «Chiusura» o rinominarla «Registrazione del progetto» (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T02 | 29/10 | **Dashboard** — Fase 5 del Progetto «Validazione e verifica» invece di «Validazione del progetto». Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Rinominare (il Rapporto ha già «Verifica del rapporto») (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T03 | 29/10 | **Dashboard** — Stato della Guida visibile solo nella pratica. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Mostrarlo in Dashboard e nell'elenco delle pratiche (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T04 | 29/10 | **Dashboard / Simulatore** — Da dove viene il prezzo di 32 €?. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Valore proposto da Luca, non del Programma: chiamarlo «valore ipotetico» e farlo decidere alla Fondazione (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T05 | 29/10 | **Dashboard** — Ente, fatture a 30 giorni, vendite a 10 giorni. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Colonna Ente e riquadri «fatture scadute», «dichiarazioni di cancellazione in scadenza» (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T06 | 29/10 | **Anagrafiche** — Tipologie non ammesse come promotori; manca la delega di Comuni ed EGATO. Segnalato da: Collaudo (TEST_PORTALE_CWP) | ATTESA_REGOLA | Solo le 3 categorie per i promotori; campo «delegato alla gestione dei rifiuti» (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T07 | 29/10 | **Anagrafiche** — Data di approvazione degli enti di validazione. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Campo «Approvato il», come per i registri (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T08 | 29/10 | **Anagrafiche** — Codice fiscale e partita IVA non controllati. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Controllo del formato e della cifra di controllo; obbligatori prima della fattura (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T09 | 29/10 | **Anagrafiche** — Co-promotori solo come testo libero. Segnalato da: Collaudo (TEST_PORTALE_CWP) | MIGLIORIA | Sceglierli dalle organizzazioni in anagrafica (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T10 | 29/10 | **Simulatore** — Riferimento portato sempre al 65%, anche col cluster. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Seguire lo Standard: anno reale 64-66% o cluster senza ricalcolo (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T11 | 29/10 | **Simulatore** — Taratura dal risultato e confronto con l'Allegato A EsaCom. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Togliere la taratura e i riferimenti EsaCom dalle stime ufficiali (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T12 | 29/10 | **Pratiche** — Fasi chiuse senza i documenti richiesti. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Bloccare la chiusura delle fasi 2 e 6 senza i documenti richiesti (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T13 | 29/10 | **Pratiche** — Feedback senza SPID, CIE o CNS. Segnalato da: Collaudo (TEST_PORTALE_CWP) | ESTERNO (già nei punti aperti) | Serve l'adesione della Fondazione come fornitore di servizi (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T14 | 29/10 | **Pratiche** — Codici delle pratiche non uniformi. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Codice sempre automatico, senza campo manuale (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T15 | 29/10 | **Pratiche** — Codici ISTAT non obbligatori. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Obbligatori per chiudere la prima verifica documentale (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T16 | 29/10 | **Pratiche** — Due listini diversi (Schema tariffario e Caso 1/2). Segnalato da: Collaudo (TEST_PORTALE_CWP) | ATTESA_REGOLA | La Fondazione sceglie il listino ufficiale; poi un solo listino ovunque (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T17 | 29/10 | **Reclami** — Manca il «ricorso». Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Aggiungere il tipo «Ricorso» (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T18 | 29/10 | **Reclami** — Costi: data della comunicazione e costi non dovuti. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Due campi nuovi (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T19 | 29/10 | **Calcolo crediti** — «Anno di riferimento» ha un altro significato; manca l'anno ISPRA o il cluster. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | «Anno di monitoraggio» + campi «Anno di riferimento» e «Fonte» (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T20 | 29/10 | **Calcolo crediti** — Ex post su un anno futuro e su un Progetto non registrato. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Bloccare l'ex post su anni non conclusi e su Progetti non registrati (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T21 | 29/10 | **Calcolo crediti** — Paniere del fattore del secco. Segnalato da: Collaudo (TEST_PORTALE_CWP) | ATTESA_REGOLA (= N06) | Decisione della Fondazione (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T22 | 29/10 | **Calcolo crediti** — Buffer diverso dalle impostazioni. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Avviso «risultati non aggiornati» quando le impostazioni cambiano (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T23 | 29/10 | **Calcolo crediti** — Organico misurato oltre il totale del territorio. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Il confronto è con l'anno di riferimento: avviso da riformulare (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T24 | 29/10 | **Impostazioni** — Mancano gli 8 moduli. Segnalato da: Collaudo (TEST_PORTALE_CWP) | ESTERNO | Servono i file dalla Fondazione; il portale li pubblica subito (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T25 | 29/10 | **Impostazioni** — Delega di rappresentanza tra i documenti richiesti. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Aggiungerla alla fase 1 (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T26 | 29/10 | **Utenti** — Account e delegato non collegati. Segnalato da: Collaudo (TEST_PORTALE_CWP) | MIGLIORIA | Account creato solo per un delegato dell'organizzazione (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T27 | 29/10 | **Utenti** — L'ente di validazione non accede. Segnalato da: Collaudo (TEST_PORTALE_CWP) | ATTESA_REGOLA | Accesso dell'ente oppure file firmato digitalmente e caricato per suo conto (30/10: verificato; in attesa della Fondazione o di materiale esterno) |
| T28 | 29/10 | **Audit** — Manca l'esportazione. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Il fascicolo ha già `audit.csv`; aggiungere «Scarica CSV» nella pagina Audit (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T29 | 29/10 | **Documentazione** — Nomi e indirizzi nella Banca Dati Utenze. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CORRETTO_DA_RITESTARE (sul ramo `correzioni-rilievi-t`, non ancora in produzione) | Solo il codice utenza (pseudonimizzazione, azione A1 della DPIA) (30/10: corretto, script 48; prova 11.x del Manuale Test) |
| T30 | 29/10 | **Marketing** — Gestori privati che non possono essere promotori. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CONFERMATO | Campagne solo verso gestori pubblici, misti o della tariffa (30/10: lasciato invariato per scelta di Luca) |
| T31 | 29/10 | **Marketing** — Email di persone e caselle non generiche. Segnalato da: Collaudo (TEST_PORTALE_CWP) | CONFERMATO | Classificare le email ed escludere quelle personali dalle campagne (30/10: lasciato invariato per scelta di Luca) |

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

**N01-N06 — terza sessione di collaudo.** Le schede complete sono in `docs/collaudo/Rilievi_N01-N06_risposte.md`. Le correzioni sono in produzione dal 22/10/2026 alle 14:30 (script 39 eseguito con l'OK di Luca). Nessun dato storico è stato modificato; gli interventi sui dati (Borgoval, scadenze mancanti, codici) sono proposti a parte. Conseguenza per il collaudo: il percorso di prova non chiude più il feedback il giorno stesso (Manuale di test, nota dopo la prova 4.9d).

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
| `rilievi_n.test.mjs` | 13 | N01 (Caso 1 a 16.735 abitanti: 16.232,95 €/anno; 10 anni senza avviso, 7 e 12 anni stima), N04 (data assente, passata, oggi, +7, +8, pratiche non attive), N05 (formato dell'avviso), N06 (cinque frazioni + legno + metallo + RAEE a zero contro un calcolo indipendente, denominatore nullo) |
| `bancaDatiUtenze.test.mjs` | 6 | Banca Dati Utenze per utenza: file di prova con 20 + 20 utenze, righe sbagliate con foglio e riga, codice doppio, svuotamenti senza kg, virgola e categoria numerica, colonna mancante, controllo del modulo, riassunto degli eventi delle utenze nell'Audit |
| `utenzeNelCalcolo.test.mjs` | 7 | Utenze del passo 5a nel motore: categoria di simulazione come classe e kg misurati, stessi numeri dei conferimenti del tracciato a parità di dati, frazioni contate per utenza, utenze senza categoria o fuori delibera escluse (avviso) e segnalate come errore di coerenza, priorità del 5a sul 5b, kg negativi bloccanti |
| `valoreProgetti.test.mjs` | 4 | Valore dei Progetti per il cliente: Caso 1 a 16.735 abitanti (16.232,95 €/anno, 10 anni), Caso 2 più caro, 7 anni come stima, Progetti senza listino o popolazione contati a parte |
| `rilievi_t.test.mjs` | 4 | Rilievi TEST_PORTALE_CWP: codice fiscale e partita IVA (T08), nomi delle fasi (T01, T02), differenziata dell'anno di riferimento (T19), avviso dei conferimenti (T23) |

| `marketing.test.mjs` | 8 | Marketing: copie identiche tra portale e funzione del server, PEC riconosciute (stessa regola del database), ruoli dagli uffici, email della campagna con link e disiscrizione, controlli e valori noti della micro simulazione (16.735 ab., 10 anni, Caso 1: margine 491.910 €), Caso 2 più caro, durate 7/10/21 |

**Ultima esecuzione:** 23/10/2026 (ramo `marketing`), 20 serie superate.

### Prove del database (banco locale)

- `t48.sql` del 30/10/2026 (rilievi TEST_PORTALE_CWP, script 48), tutte come attese: codice fiscale e partita IVA (sbagliati rifiutati, vecchi dati non toccati finché non si modificano), fattura di iscrizione senza codice fiscale valido rifiutata, codice scritto a mano ignorato (CWP-AAAA-NNNN), fase 2 senza codici ISTAT rifiutata, fase 2 senza il Modulo di descrizione rifiutata (la delega «se applicabile» non conta) anche all'Operatore con motivazione, deroga dell'Amministratore registrata nell'audit, chiusura con il documento caricato, ricorso RIC-AAAA-NNN e costi non dovuti a 0, ex post sull'anno in corso e su Progetto non registrato rifiutati, ex ante libero, ex post su Progetto registrato accettato, calcolo di prova 2027 aggiornabile ma non confermabile, utenza senza nome e indirizzo, cruscotto con le nuove colonne, nomi delle fasi; script rieseguibile.
- `t47.sql` del 25/10/2026 (listino obbligatorio, script 47): nuovo Progetto senza listino rifiutato con «Scegli il listino…», con Caso 2 accettato; togliere il listino da un Progetto rifiutato, cambiarlo accettato; Rapporti senza listino ancora possibili. In produzione: 5 Progetti a Caso 1, 5 voci di audit con la motivazione.
- `t46.sql` del 25/10/2026 (lettore dei siti, script 46), tutte come attese: messa in coda senza doppioni, accensione e riepilogo; l'Amministratore non può prendere enti dalla coda (solo la funzione del server); `mkt_lettura_prendi` non dà due volte lo stesso ente e rimette in coda le letture interrotte da più di 10 minuti; «rileggi» rimette in coda i letti; Comune e anonimo senza accesso. Prova in produzione su 11 enti (8 letti, 3 siti non raggiungibili) con due regole corrette subito (email di un altro dominio, «Capitale Sociale» letto come nome).
- `t45.sql` del 23/10/2026 (script 45), tutte come attese:
  - Progetto senza fase 6 completata: nuovo Rapporto rifiutato con il messaggio «non è ancora registrato»; dopo la fase 6 completata il Rapporto nasce (CWP-…-RM1);
  - i Rapporti esistenti si aggiornano ancora (trigger solo sull'inserimento);
  - Marketing: Amministratore vede tutti gli 8.003 enti in 1,6 ms (prima 600 ms), Comune 0 e scrittura rifiutata, anonimo senza accesso; `t44.sql` invariato (7 rifiuti attesi).
- `t44.sql` del 23/10/2026 (Marketing, script 44, banco ricostruito con gli script 01-44): tutte come attese dopo una correzione:
  - PEC nel campo email generica rifiutata, accettata nel campo PEC;
  - preparazione degli invii: enti senza email e indirizzi disiscritti saltati, seconda preparazione senza doppioni, campagna inviata bloccata;
  - utente del Comune: nessun dato visibile, scrittura e riepilogo rifiutati; anonimo: nessun accesso;
  - **errore trovato e corretto prima del rilascio**: l'audit delle richieste di registrazione falliva perché `mkt_richiesta` aveva un id numerico (l'audit vuole uuid); id portato a uuid, audit di campagne e richieste presente;
  - `mkt_sembra_pec` riconosce pec.it, pecveneto.it, cert.provincia.it e non «pecora@».
- Primo aggiornamento delle banche dati in produzione (23/10/2026 12:20-12:50), due errori trovati e corretti:
  - IndicePA: righe doppie per lo stesso codice ISTAT (Unioni e Consorzi nella categoria L6) → una sola riga per Comune, quella dell'ente «Comune…»;
  - lettura unica degli uffici dei Comuni respinta da IndicePA («App offline») → blocchi di 400 Comuni; Albo una provincia per chiamata;
  - esito: 7.904 Comuni, 7.504 con dati IndicePA, 5.642 con email generica; 5.818 gestori in categoria 1 ordinaria.
Ogni script del database è provato su una copia locale di Postgres 16 con tutti gli script, prima dell'esecuzione in produzione. Le prove sono nei file `t8.sql` … `t35.sql`: permessi per ruolo, rifiuti attesi, immutabilità dell'audit, conferma dei calcoli, emissioni, avvisi di sicurezza, vincoli del collaudo.

Ultime prove:

- `t34.sql` rieseguito il 23/10/2026 su un banco costruito nello stesso ordine della produzione (34 dopo 35-43): avviso per il nuovo Amministratore, un solo avviso dopo 5 tentativi non riusciti, funzioni riservate negate ad anon, uscita con il motivo «inattività», funzioni degli utenti collegati invariate; 9 funzioni eseguibili senza accesso; `t41`-`t43` invariati.
- `t43.sql` del 23/10/2026 (valore dei progetti, script 43), tutte come attese: nuovo Progetto con Caso 2; listino non valido rifiutato con messaggio italiano (creazione e modifica); Progetto esistente da indicare → Caso 1 con motivazione nell'audit; Amministratore: scenario più recente per Comune e tutti i Progetti aperti; utente del Comune A: solo i suoi e nessuna modifica; anonimo negato; script rieseguibile.
- `t42.sql` del 23/10/2026 (valore dei crediti nella Dashboard, script 42), tutte come attese:
  - Amministratore: simulazione con un solo scenario per Comune (il più recente; il Comune non censito riconosciuto anche con il nome scritto diversamente), euro dai ricavi o al prezzo di riferimento, scenari a prezzo di riferimento contati; calcoli ex post confermati e validi (esclusi bozze, ex ante e versioni sostituite); lotti e vendite;
  - Operatore: stessi totali; non cambia il prezzo;
  - utente del Comune A: solo i dati del Comune A;
  - prezzo a 40 €: euro ricalcolati, voce di audit; prezzo negativo rifiutato;
  - anonimo: nessun accesso.
- `t41.sql` del 23/10/2026 (utenze del calcolo nel motore, script 41), tutte come attese:
  - conteggi: 3 utenze, 1 senza categoria, 1 con categoria fuori delibera (classi numeriche o con spazi riconosciute);
  - conferma rifiutata con utenze senza categoria o fuori delibera; dopo la correzione dal modulo i conteggi tornano a zero;
  - conferma rifiutata se il risultato ha usato un numero diverso di utenze (2 contro 3) o è di prima (senza il numero di utenze);
  - conferma accettata con tutte le utenze in delibera;
  - calcolo senza utenze né conferimenti: conferma rifiutata;
  - calcolo con i soli conferimenti del tracciato e risultato di prima: confermato come prima;
  - anonimo: nessun accesso ai conteggi.
- `t40.sql` del 22/10/2026 (Banca Dati Utenze, script 40):
  - caricamento valido di 2 utenze domestiche e 1 non domestica; categoria di simulazione proposta uguale alla tariffaria;
  - modulo: nuova utenza, modifica (audit con i campi cambiati), codice doppio e campi mancanti con messaggi in italiano, cancellazione;
  - rifiutati: senza indifferenziato, kg negativo, frazione sconosciuta, svuotamenti decimali, componenti su non domestica, codice doppio;
  - nessuna lettura diretta; elenco e ricerca con voce di audit; lettura per il calcolo senza nomi e indirizzi;
  - Operatore consulta ma non carica né svuota; Comune e anonimo nulla;
  - una sola voce di audit per caricamento (con il numero di utenze);
  - il caricamento azzera il risultato della bozza; la nuova versione copia le utenze; calcolo confermato immutabile;
  - lo script si riesegue senza errori.
- `t39.sql` del 22/10/2026 (rilievi N02 e N03, script 39), tutte come attese:
  - fase 3 senza feedback: chiusura rifiutata;
  - apertura del feedback: 30 giorni, fase 3 aperta con scadenza allineata;
  - giorno di apertura e ultimo giorno: chiusura rifiutata;
  - termine passato: chiusura ordinaria con fase 3 completata;
  - nuovo feedback a fase 3 completata: rifiutato;
  - errata corrige: scadenza riallineata;
  - progetto ritirato: chiusura solo motivata, motivazione nell'audit;
  - Comune: rifiutato; fuso orario indifferente;
  - fase 5: rifiutata senza ente o con un ente disattivato, aperta con un ente attivo (+75 giorni); ente non rimovibile a fase aperta, sostituibile;
  - lo script si riesegue senza errori.
- `t35.sql` del 20/10/2026: 11 rifiuti attesi, conferma ordinaria possibile e rieseguibilità con dati vecchi;
- `backup_completo()` (script 38) del 21/10/2026: 38 tabelle, 3 utenti, 2 file nell'elenco; il JSON ripristinato in un database nuovo con `genera_sql_ripristino.mjs` dà righe identiche; negata al ruolo authenticated;
- `t37.sql` del 21/10/2026 (pallino verde delle Notizie CO2): 2 notizie nuove mai visitata, 0 dopo la visita, 1 dopo una nuova notizia, scrittura diretta negata, Operatore 0;
- `t36.sql` del 21/10/2026 (News): limite di una ricerca ogni 100 minuti (10 con l'Amministratore), doppioni rifiutati, l'Amministratore legge e nasconde, Operatore, Cliente e anonimo non vedono nulla, scrittura diretta e avvio della ricerca negati dal portale.

**Prova di ripristino da backup (21/10/2026 11:15).**
- **Procedura:** il banco, popolato con le prove, è stato esportato come un backup automatico (35 tabelle e 3 utenti). Il database è stato ricostruito con gli script 01-35 ed è stato eseguito `ripristino_dati.sql` generato da `strumenti/backup/genera_sql_ripristino.mjs`.
- **Esito:**
  - dati identici al backup;
  - 1 riga segnalata come «RIGA NON RIPRISTINATA»: era un dato di prova negativo inserito di proposito per lo script 35;
  - contatori riallineati: un nuovo calcolo e un nuovo evento di audit si creano senza conflitti;
  - seconda esecuzione fermata dal controllo «database già pieno», senza nessuna modifica.

Da ripetere ogni tre mesi su un progetto Supabase di prova.

**Prova di carico del calcolo dei crediti: Borgoval (26/10/2026 10:25).**
- **Dati:** scenario del simulatore e calcolo 2027 del Progetto CWP-2026-0001 generati da `strumenti/borgoval_prova.mjs` (script `borgoval_prova.sql`, eseguito in produzione su richiesta di Luca): dati ISPRA 2024 di Casalmaggiore riportati a 26.382 abitanti, 9.000 utenze domestiche e 1.778 non domestiche inventate, kg e svuotamenti di secco e organico.
- **Esito:**
  - al primo «Calcola» il motore usava 1.000 utenze su 10.778 (ISS-041, corretto e in produzione alle 10:25);
  - dopo la correzione 10.778 utenze lette in pochi secondi; crediti netti 3.077,657 tCO₂eq, identici al motore eseguito fuori dal portale con gli stessi dati;
  - scenario del simulatore: margine positivo in tutti i 10 anni, totale 1.644.190 €, uguale al calcolo fuori dal portale.

### Campagne di collaudo

| Campagna | Date | Chi | Esito |
|---|---|---|---|
| V02 | 19/10 sera | Collaudatori | Prime osservazioni di D01-D06 sul portale (scenario «COLLAUDO AL V02», bozza C) |
| V03 / rapporto V01 | 20/10, ricevuto alle 16:40 | Collaudatori | 97 casi: 40 superati, 12 falliti, 15 parziali, 7 con riserva, 23 bloccati; 15 rilievi (D01-D07, R01-R08) più il riuso |
| V05 (integrazione) | 20-21/10, ricevuta il 21/10 alle 10:42 | Collaudatori, con i profili creati da Luca | Separazione dei dati A/B e dinieghi superati (A00-A10, B01-B16, OP01-OP15); nuovi rilievi D08, D05-R1, O01 |
| Terza sessione (nuovi rilievi V01) | 21/10, in sola lettura; file ricevuto da Luca il 22/10 alle 07:46 | Luca Belfiore / AltraLeonia | Sei rilievi N01-N06 (da una mail di Rocío e da lettura di portale, audit e sorgente), senza scritture sul portale |

**Prossimi ritest richiesti al collaudo:** D01-D07, R05, R07 (Manuale di test 7.17-7.22, 8b.5-8b.5e, 8b.9b), D05-R1, O01 (10.5, 10.5b) e ISS-035 (8b.7, 8b.7b). In produzione dal 22/10: N01 (8b.7d, 8b.7f), N02 (4.1, 4.9-4.9d), N03 (5.0, 5.1c), N04 (10.10f), N05 (1.2d), N06 (7.24).

## Storico delle revisioni di questo registro

| Data e ora | Variazione |
|---|---|
| 21/10/2026 10:55 | Prima emissione: ricostruite 34 segnalazioni dal 17/10 e i rilievi dei collaudi V01 e V05, con le azioni correttive e il registro dei test |
| 21/10/2026 11:20 | R08 corretto e da ritestare; prova di ripristino da backup nel registro dei test |
| 21/10/2026 11:40 | Nuova serie di prove dell'assistente (14 serie) |
| 21/10/2026 11:45 | ISS-035: PDF ed Excel della simulazione con tutti i dati e i grafici |
| 21/10/2026 11:57 | Nuove prove dell'osservatorio News (`notizie.test.mjs`, `t36.sql`); 15 serie |
| 21/10/2026 12:25 | ISS-036: canali News da Google a Bing; prova Bing in `notizie.test.mjs` (8) |
| 21/10/2026 12:35 | ISS-036: causa individuata (blocco di Google verso i server di Supabase), tramite per Google News; sezione rinominata «Notizie CO2» |
| 21/10/2026 12:46 | Prova `t37.sql` (pallino verde delle Notizie CO2) |
| 21/10/2026 14:05 | ISS-036: tramite per Google News bloccato da Google; sostituito da 8 siti di notizie ambientali |
| 21/10/2026 14:15 | ISS-036 chiuso: Bing e 12 siti verificati |
| 21/10/2026 14:45 | ISS-037: backup dal Mac al posto di Apps Script; prova di `backup_completo()` |
| 22/10/2026 08:15 | Rilievi N01-N06 della terza sessione: N01-N04 corretti sul ramo e da ritestare, N05 e N06 in attesa di regola; prove `rilievi_n.test.mjs` (16 serie) e `t39.sql` |
| 22/10/2026 13:40 | ISS-038: navigazione da smartphone |
| 22/10/2026 14:50 | Rilascio in produzione di N01-N04, ISS-038 e script 38-39 |
| 22/10/2026 16:50 | Prova `t40.sql` (Banca Dati Utenze) |
| 23/10/2026 10:30 | Utenze del passo 5a nel motore: prove `utenzeNelCalcolo.test.mjs` (18 serie) e `t41.sql` |
| 23/10/2026 11:00 | Valore dei crediti nella Dashboard: prova `t42.sql`; 18 serie |
| 23/10/2026 11:45 | Valore dei progetti (Caso 1 / Caso 2): prove `valoreProgetti.test.mjs` e `t43.sql`; 19 serie |
| 23/10/2026 12:10 | Colori dello stato delle fasi: verifica a schermo (computer e telefono); 19 serie |
| 23/10/2026 12:20 | Script 34 in produzione dopo la prova `t34.sql` nell'ordine della produzione |
| 23/10/2026 12:05 | Prova `t44.sql` (Marketing, script 44) con l'errore dell'id di `mkt_richiesta` trovato e corretto; nuova serie `marketing.test.mjs` (20 serie) |
| 23/10/2026 12:50 | Rilascio del Marketing: due errori dell'importazione da IndicePA trovati al primo aggiornamento in produzione (righe doppie per Comune, lettura degli uffici troppo grande) e corretti; banche dati caricate |
| 23/10/2026 16:00 | ISS-039 (Rapporto su Progetto non registrato) e ISS-040 (elenco dei Comuni vuoto) corretti e in produzione con lo script 45; prova `t45.sql` |
| 25/10/2026 12:05 | Lettore dei siti (script 46, versione gratuita): prova `t46.sql`, prova in produzione su 11 enti, serie `marketing.test.mjs` estesa (15 prove) |
| 25/10/2026 12:20 | Listino obbligatorio (script 47) e Progetti esistenti a Caso 1; prova `t47.sql` |
| 26/10/2026 08:10 | Revisione generale: riepilogo aggiornato al 26/10; nessuna nuova segnalazione aperta dopo ISS-040 |
| 26/10/2026 10:30 | ISS-041 (calcolo con più di 1.000 utenze) trovato con la prova di Borgoval, corretto, in produzione e verificato; prova di Borgoval nel registro dei test |
| 30/10/2026 16:00 | Rilievi TEST_PORTALE_CWP T01-T31 registrati e verificati (risposte nel documento di progetto), nessuna correzione ancora fatta |
| 30/10/2026 18:00 | Correzioni dei rilievi T (21 punti) sul ramo `correzioni-rilievi-t` con lo script 48; prova `t48.sql`, serie `rilievi_t.test.mjs`; ritest 11.1-11.16 nel Manuale Test |
