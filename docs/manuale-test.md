<!--
  Manuale Test — testo sorgente (guida per chi collauda il portale).
  Da questo file si generano Word e PDF:  node strumenti/genera_documenti.cjs test
  Revisioni in strumenti/revisioni_documenti.json ("test").
  REGOLA: si aggiorna a ogni rilascio, insieme a Registro sviluppo e deploy,
  Manuale Utente e Manuale Amministratore. Deve restare sintetico.
  Documento riservato agli Amministratori: si scarica solo dall'area Documentazione.
-->

## A chi serve questa guida

Questa guida è per chi **collauda il portale** senza conoscere il Programma Carbon WastePrint®. In poche pagine spiega il metodo CWP, che cosa fa il portale e propone un **percorso di prova** che segue una pratica dall'adesione del Comune fino al calcolo e all'emissione dei crediti.

**Vi servono:**

- Tre utenze di prova, fornite da Fondazione Operate: un **Amministratore**, un **Operatore** e un **Cliente** (il referente di un Comune di prova). Ogni utenza va usata in una finestra diversa del browser, oppure in una finestra «in incognito».
- Il portale: [portale-cwp.vercel.app](https://portale-cwp.vercel.app).
- Per i dettagli di ogni schermata: il *Manuale Utente* (lato Comune) e il *Manuale Amministratore* (lato Fondazione).

**Come annotare l'esito.** Per ogni prova del capitolo «Percorso di prova» segnate **OK** o **KO**. Per ogni KO annotate: data e ora, utenza usata, codice della pratica, passo, risultato atteso, risultato ottenuto e una schermata.

## Il metodo CWP in breve

Il **Programma Carbon WastePrint®** di Fondazione Operate trasforma in **crediti di carbonio** la riduzione delle emissioni ottenuta da un Comune con una migliore gestione dei rifiuti urbani.

Il calcolo si basa su un confronto tra due valori:

| Grandezza | Che cos'è | Da dove viene |
| --- | --- | --- |
| Emissioni **attese** | Quanta CO₂ equivalente produrrebbero i rifiuti del territorio senza il progetto | Produzione di rifiuti del Comune (Catasto ISPRA) e classi di utenza della delibera TARI |
| Emissioni **di progetto** | Quanta CO₂ equivalente producono davvero le utenze | Conferimenti misurati per ogni utenza (svuotamenti, pesi, centri di raccolta, riuso) |
| **Crediti** | La riduzione: emissioni attese meno emissioni di progetto, in tonnellate di CO₂eq | Calcolo secondo la *Metodologia CWP v1.2* |
| **Buffer** | Una quota dei crediti trattenuta a garanzia: somma di più voci (utenze monitorate, rifiuti misurati, solo utenze virtuose), al massimo 80%, più bassa se il Comune misura bene i conferimenti e dimezzata con la tariffa puntuale | Analisi del rischio della Metodologia |

**Chi partecipa.**

- Il **Comune** (o ente, o soggetto gestore) è il **promotore del progetto**: aderisce, fornisce documenti e dati. Nel portale è il ruolo *Cliente*, con **un solo account** per Organizzazione (quello del rappresentante autorizzato).
- **Fondazione Operate** gestisce il Programma (**promotore del programma**): gli **Operatori** seguono le pratiche, gli **Amministratori** amministrano il portale, calcolano ed emettono i crediti.
- L'**Ente di validazione e verifica** (es. RINA) verifica in modo indipendente; non usa il portale: i suoi rapporti vengono caricati dalla Fondazione.
- Il **Registro** è la piattaforma esterna su cui i crediti emessi vengono caricati, venduti e cancellati.
- Il **pubblico** può presentare osservazioni durante il **feedback pubblico** e consultare la pagina pubblica del Programma.

**Il percorso di un Progetto e di un Rapporto** è diviso nelle stesse 7 fasi, con durate indicative (modificabili dall'Amministratore):

| Fase | Progetto | Rapporto | Responsabile | Cosa succede |
| --- | --- | --- | --- | --- |
| 1. Adesione (Rapporto: Registrazione del rapporto) | avvio | avvio | Promotore del progetto | Il Comune aderisce o presenta il Rapporto; la Fondazione apre la pratica |
| 2. Prima verifica documentale | 10 gg | 10 gg | Promotore del programma | La Fondazione controlla i documenti e chiede integrazioni |
| 3. Feedback pubblico | 30 gg | 20 gg | Promotore del programma | Il documento è pubblicato e chiunque può fare osservazioni |
| 4. Risposta ai commenti | 20 gg | 15 gg | Promotore del progetto | Il Comune risponde alle osservazioni ammesse |
| 5. Validazione e verifica (Rapporto: Verifica del rapporto) | 75 gg | 60 gg | Ente di validazione e verifica | L'ente verifica il Progetto o il Rapporto |
| 6. Seconda verifica documentale | 15 gg | 10 gg | Promotore del programma | Controllo finale: alla chiusura il Progetto è **registrato** (per il Rapporto: crediti registrati) |
| 7. Chiusura | — | — | Promotore del programma | Fine del percorso |

Nelle fasi 2 e 6 la Fondazione può avviare una **verifica sull'accuratezza** (+15 giorni) e poi fino a 3 **accertamenti** (+10 giorni ciascuno). Nell'intestazione della pratica lo **stato nel Programma** segue le fasi: «richiesta di registrazione» → «in fase di validazione» (fase 2 completata) → «in fase di verifica documentale» (fase 5 completata) → «progetto registrato» (fase 6 completata).

Dopo la registrazione il Progetto produce ogni anno un **Rapporto di Monitoraggio**: fino a 10 con il periodo di riferimento «10 anni (una volta)», fino a 21 con «7 anni rinnovabili 3 volte». Ogni Rapporto è una pratica con le sue 7 fasi; per ogni anno si calcolano i crediti e, dopo la registrazione del Rapporto, si **emettono** e si caricano sul registro. Un Progetto può essere **ritirato** dal Programma e poi **rientrare**. Le pratiche si conservano per **12 anni**.

## Il ruolo del portale

Il portale è lo strumento unico con cui Comune e Fondazione seguono la pratica. Le funzioni oggi disponibili:

| Area | Cosa fa il portale | Chi la usa |
| --- | --- | --- |
| Accesso | Email e password, password temporanea da cambiare al primo accesso, recupero della password, profilo | tutti |
| Pratiche | Progetti e Rapporti di Monitoraggio, ID automatico (CWP-AAAA-NNNN), stati attiva / sospesa / annullata / chiusa / ritirato (solo Progetti, con rientro), stato nel Programma; dati del Progetto (territorio con codici ISTAT, un solo Progetto per territorio, co-promotori, periodo di riferimento, popolazione, crediti previsti, data di registrazione); conservazione per 12 anni, nulla si cancella | Fondazione; il Comune consulta |
| Fasi | 7 fasi per Progetto e Rapporto; apertura, scadenza calcolata, chiusura, modifica della scadenza con motivazione; verifica sull'accuratezza e accertamenti nelle fasi 2 e 6; note di fase interne o condivise; modelli da scaricare e documenti richiesti per fase (preimpostati dalla Guida al Programma) | Fondazione; il Comune consulta |
| Anagrafiche | Organizzazioni (con fino a 2 delegati), Enti di Validazione e Registri, con le pratiche collegate | Fondazione |
| Messaggi | Conversazione tra Comune e Fondazione dentro ogni pratica | tutti |
| Documenti | Caricamento con versioni (mai sovrascritte), tipologie ufficiali, visibilità, controllo di formato e contenuto, impronta di integrità; il contratto con l'ente e la versione privata del Modulo di descrizione non possono essere pubblici | tutti |
| Integrazioni | Richiesta della Fondazione → risposta del Comune con documento → chiusura | tutti |
| Feedback pubblico | Pagina pubblica per 30 giorni (Progetto) o 20 (Rapporto); documento bloccato; osservazioni numerate con email confermata e allegato; moderazione con motivazione; risposte del Comune; errata corrige | tutti, anche senza accesso |
| Pagamenti | Voci previste con la voce dello Schema tariffario, proposta degli importi dallo Schema tariffario, incassi registrati a mano (nessun pagamento online); con una voce scaduta non si aprono nuove fasi, la fase 5 richiede la tariffa di iscrizione saldata | Fondazione; il Comune consulta |
| Notifiche | Campanella nel portale ed email per ogni evento importante; avvisi di scadenza | tutti |
| Dashboard | Tutte le pratiche con barra a LED delle 7 fasi, fase, scadenza e cose da fare, filtri e ricerca | Fondazione |
| Export | Fascicolo completo della pratica in un file ZIP con riepilogo PDF | tutti |
| Audit | Registro non modificabile di ogni operazione, con motivazione | Amministratore |
| Utenti e impostazioni | Creazione utenti (un solo account cliente attivo per Organizzazione), associazione ai Comuni, reimpostazione password, durata delle fasi, documenti richiesti, modelli di documento (anche pubblici), informazioni del Programma, metodologie approvate | Amministratore |
| Calcolo crediti | Import del tracciato dati del Comune con controllo dei dati personali e della coerenza, calcolo secondo la Metodologia, qualità dei dati (confronto con la Tabella 3 dello Standard e indicatori), rapporto PDF, conferma con numero di registro, registro dei calcoli, nuove versioni | Amministratore |
| Crediti emessi | Lotti di crediti con ID univoci dopo la registrazione del Rapporto, caricamento sul registro, vendite, cancellazione (crediti ritirati) | Fondazione (emissione: Amministratore); il Comune consulta |
| Reclami | Reclami e richieste di chiarimento con codice, stato e risposta scritta; registrazione di quelli arrivati via PEC o email | tutti |
| Il Programma | Pagina pubblica con informazioni del Programma, enti, registri, metodologie, documenti e modulistica, Progetti con documenti pubblici, Rapporti e crediti | tutti, anche senza accesso |
| Formato dati | Pagina pubblica con il tracciato Excel standard per i dati dei Comuni | tutti, anche senza accesso |
| Documentazione | Manuali e registro tecnico da scaricare | tutti (per ruolo) |

## Percorso di prova

Seguite le prove nell'ordine: ognuna prepara la successiva. Tra parentesi l'utenza da usare: **[A]** Amministratore, **[O]** Operatore, **[C]** Cliente. Il codice ISTAT **999001** è inventato: usatelo solo per le prove.

### 1. Preparazione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 1.1 | [A] Impostazioni: cambiate la durata della fase 2 del Progetto da 10 a 12 giorni con una motivazione | La durata complessiva si aggiorna; la modifica compare in Audit |
| 1.2 | [A] Pratiche → + Nuovo progetto, con una **nuova** organizzazione «Comune di Prova»; Territorio **999001**, periodo «10 anni (una volta)», popolazione **12000**, crediti previsti nel periodo **5000** | Nasce la pratica con 7 fasi; la fase 1 è In corso, responsabile «Promotore del progetto»; nell'intestazione «ID progetto: CWP-AAAA-NNNN» e «Nel Programma: richiesta di registrazione»; sotto, i dati inseriti (popolazione 12.000, crediti 5.000) |
| 1.2a | [A] + Nuovo progetto con l'organizzazione **esistente** «Comune di Prova» e territorio «12345» | Rifiutato: «Codice ISTAT non valido: ogni Comune ha un codice di 6 cifre…» |
| 1.2b | [A] Ripetete con territorio **999001** | Rifiutato: «Il territorio con codice ISTAT 999001 è già nel Progetto CWP-… (un solo progetto per territorio…)»; nessuna nuova pratica |
| 1.2c | [O] Anagrafiche → Organizzazioni: Modifica «Comune di Prova»: tipo «Ente locale (T.U.E.L.)», codice fiscale, PEC, Delegato 1 e Delegato 2 | Dati salvati; sotto l'organizzazione compare la pratica creata |
| 1.3 | [A] Utenti → + Nuovo utente, ruolo Cliente, associato a «Comune di Prova» | L'utente compare in elenco; la finestra dice se l'email con le credenziali è partita (finché il dominio non è verificato su Resend arriva solo all'indirizzo del titolare Resend, per gli altri «⚠ Email non inviata»); annotate la password temporanea |
| 1.3d | [A] Create un utente con un'email di prova, poi premete **Elimina** nella sua riga → Elimina definitivamente | L'utente sparisce dall'elenco; in Audit la voce «cancellazione profilo». Sul referente del Comune, che ha già operato, il pulsante Elimina non compare |
| 1.3c | [C] Aprite l'email «Il tuo accesso al Portale CWP» (se arrivata) e premete Accedi al portale | Si apre la pagina di accesso; con email e password temporanea dell'email il portale chiede subito la password personale |
| 1.3a | [A] Utenti → + Nuovo utente, ruolo **Amministratore** (compare il promemoria sull'accesso completo) → Crea; poi entrate con il nuovo account | Il nuovo utente ha il segno Admin e vede tutto il menu dell'Amministratore |
| 1.3a2 | [A] Nella riga di luca.moretti@operate.it | Segno «Principale», nessun pulsante Modifica, Reimposta password o Disattiva |
| 1.3a3 | [A] Con Modifica riportate il nuovo Amministratore a Operatore, poi Disattiva e Riattiva | Ruolo cambiato; disattivazione e riattivazione riuscite; voci nell'audit |
| 1.3b | [A] Create un **secondo** utente Cliente associato a «Comune di Prova» | Rifiutato: «L'Organizzazione «Comune di Prova» ha già un account attivo… Disattiva quello attuale prima di attivarne un altro» |
| 1.4 | [C] Accedete con la password temporanea | Il portale chiede subito una nuova password (min. 10 caratteri, lettere e numeri) |
| 1.5 | [C] Aprite Il mio profilo e il Manuale | Dati dell'account; manuale scaricabile in PDF |
| 1.6 | [O] Anagrafiche → Enti di Validazione: + Nuovo ente «RINA (prova)» | L'ente compare in elenco (anche un Operatore può crearlo) |
| 1.6b | [O] Anagrafiche → Registri: + Nuovo registro «Registro (prova)», attivo | Il registro compare in elenco (serve alla prova 8.2) |
| 1.7 | [A] Impostazioni → Modelli di documento: un modello per «Progetto · Fase 1» e uno Generale, spuntando «pubblico» sul secondo con sezione «Modulistica» | Pubblicati; il Comune vede il primo nella fase 1 e il secondo in I tuoi documenti |
| 1.8 | [A] Impostazioni → Documenti richiesti per fase: controllate le voci già presenti, poi aggiungete Progetto, Fase 2, «Altra (scrivila)…» «Delibera tariffaria» | Ci sono già le voci della Guida (es. Progetto · Fase 1 «Modulo di descrizione del progetto», Fase 3 «Contratto con l'ente di validazione e verifica»); la nuova voce compare in elenco |
| 1.9 | [A] Impostazioni → Il Programma (pagina pubblica) e Metodologie approvate | Soggetto promotore del programma, email e sito già compilati; c'è la «Metodologia Carbon WastePrint®» v1.2 del 04/09/2025 |

### 2. Fase 1 — Adesione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 2.1 | [O] Nella pratica, Documenti generali → + Carica un PDF con tipologia «Documentazione amministrativa» (es. il contratto di adesione), visibile al Cliente | Documento v1; il Comune riceve la notifica e lo vede in I tuoi documenti |
| 2.1b | [C] Nella fase 1 caricate un PDF scegliendo «Modulo di descrizione del progetto» | Il documento richiesto passa da «○ manca» a «✓ presente» |
| 2.2 | [O] Caricate di nuovo lo stesso file del 2.1 (stesso nome) | Nasce la v2; la v1 resta consultabile |
| 2.3 | [O] Caricate un documento togliendo «Visibile al Cliente» | Il Comune non lo vede |
| 2.4 | [O] Pagamenti → Proponi dallo Schema tariffario | Due proposte: quota alla richiesta di iscrizione **3.000 €** e saldo ad avvenuta registrazione **4.750 €** (quota per popolazione 4.000 € + 0,15 € × 5.000 crediti previsti) |
| 2.4a | [O] Lasciate spuntata solo la quota di iscrizione e premete Aggiungi le voci scelte. **Non** registrate l'incasso | Voce «Registrazione progetto – quota alla richiesta di iscrizione», 3.000 €, Da pagare, scadenza tra 30 giorni; il Comune riceve «Nuova voce di pagamento» |
| 2.4b | [O] + Voce di pagamento «Prova scadenza», voce Altro, 10 €, scadenza **ieri**, non pagata | Voce Scaduto e, in rosso: «C'è una voce scaduta non pagata: fino al saldo le attività successive sono sospese» |
| 2.5 | [C] Aprite la pratica: sezione Pagamenti | Le voci e l'avviso rosso sono visibili in sola lettura, senza pulsanti |
| 2.6 | [O] Nella fase 1 + Aggiungi nota: una interna e una «Visibile al Comune» | Il Comune vede solo la seconda e riceve la notifica |
| 2.7 | [C] Messaggi: scrivete una domanda; [O] rispondete | Ognuno riceve la notifica del messaggio dell'altro |
| 2.8 | [O] Intestazione della pratica: Ente di validazione e verifica → Assegna «RINA (prova)» | Il Comune vede il nome dell'ente |
| 2.9 | [O] Chiudi fase 1 | Fase Completata; notifica al Comune |

### 3. Fase 2 — Prima verifica documentale

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 3.1 | [O] Apri fase 2 (la voce «Prova scadenza» è ancora scaduta) | Rifiutato: «Attività sospese fino al saldo: c'è una fattura scaduta non pagata…» |
| 3.1b | [O] Su «Prova scadenza» Registra incasso, poi Apri fase 2 | L'avviso rosso sparisce; la fase si apre con scadenza = oggi + 12 giorni (prova 1.1); notifica al Comune |
| 3.2 | [C] Nella fase 2 guardate «Documenti richiesti», poi caricate un file scegliendo «Delibera tariffaria» | Prima «○ manca», dopo «✓ presente»; lo staff riceve la notifica «Il Cliente ha caricato un documento» |
| 3.3 | [C] Provate a caricare un file .exe, un file vuoto, un .txt rinominato in .pdf | Tutti rifiutati con un messaggio chiaro |
| 3.4 | [O] Richiedi integrazione («manca la delibera TARI») | Fase In attesa di integrazione; notifica al Comune; nella Dashboard «In attesa del Cliente» |
| 3.5 | [C] Rispondete all'integrazione caricando un file | Richiesta «Risposta ricevuta»; notifica allo staff |
| 3.6 | [O] Accetta e chiudi, poi Chiudi fase 2 | La fase torna In corso dopo la chiusura dell'integrazione, poi Completata; nell'intestazione «Nel Programma: in fase di validazione» |
| 3.7 | [C] Riaprite la fase 2 completata | Il pulsante + Carica non c'è più (si carica solo nelle fasi aperte) |
| 3.8 | Senza accesso, dalla pagina di accesso aprite «il Programma» (/programma), sezione Progetti | Compare il Progetto con ID, «Comune di Prova», stato «in fase di validazione»; aprendolo: territorio 999001 e periodo di riferimento (prima della chiusura della fase 2 non c'era) |

### 4. Fasi 3 e 4 — Feedback pubblico

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 4.1 | [O] Apri fase 3; nel riquadro Feedback pubblico scegliete il «Modulo di descrizione del progetto» e Apri il feedback pubblico | Feedback Attivo per 30 giorni; il documento diventa Pubblico; il Comune riceve «Aperto il periodo di feedback pubblico»; link alla pagina pubblica |
| 4.1b | [O] Sul documento in feedback provate a togliere la spunta Pubblico | Rifiutato: «Il documento è pubblicato in una consultazione attiva…» |
| 4.1c | [O] Nella fase 3 + Carica con tipologia «Contratto con l'ente di validazione e verifica» | La casella Pubblico è disattivata; nell'elenco il documento ha «Pubblico (non ammesso)»; la voce richiesta diventa «✓ presente» |
| 4.2 | Senza accesso, aprite «feedback pubblico» dalla pagina di accesso e il Progetto | Pagina «Feedback pubblico»: si leggono documento e osservazioni pubblicate |
| 4.3 | Inviate un'osservazione con nome, email (quella del titolare del servizio email, vedi limiti) e un PDF allegato | Messaggio «Controlla la tua email»; arriva l'email di conferma |
| 4.4 | Premete il pulsante dell'email; riprovate lo stesso collegamento | Prima volta: «osservazione ricevuta», notifica allo staff; seconda volta: collegamento già utilizzato |
| 4.5 | Provate a inviare 4 osservazioni in un'ora con lo stesso indirizzo; un allegato .exe | La quarta e l'allegato sono rifiutati con un messaggio chiaro |
| 4.6 | [O] Pubblica un'osservazione; su un'altra Non pubblicare scrivendo una motivazione | Ogni osservazione ha il suo numero («Osservazione n. 1»); lo staff vede nome, email, allegato e la motivazione; il Comune riceve «Nuova osservazione a cui rispondere»; il Comune e la pagina pubblica vedono solo quella pubblicata, firmata «Partecipante» |
| 4.7 | [O] + Pubblica errata corrige spuntando «Fai ripartire i 30 giorni», prima senza e poi con motivazione | Senza motivazione: errore; con motivazione: nuova chiusura a 30 giorni, visibile anche sulla pagina pubblica; notifica al Comune |
| 4.8 | [C] Rispondete all'osservazione pubblicata | Stato Risposto; la risposta compare anche sulla pagina pubblica |
| 4.9 | [O] Chiudi il feedback pubblico, chiudi la fase 3, apri e chiudi la fase 4 | Feedback Chiuso; fasi Completate |

### 5. Fasi 5, 6 e 7 — Validazione, registrazione e chiusura

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 5.1 | [O] Apri fase 5 (la tariffa di iscrizione non è pagata) | Rifiutato: «La tariffa di iscrizione va saldata prima della fase di validazione o verifica…» |
| 5.1b | [O] Pagamenti: Registra incasso della quota di iscrizione, poi Apri fase 5 | La fase si apre |
| 5.2 | [O] Nella fase 5 caricate un PDF con tipologia «Rapporto di validazione», spuntando Pubblico | Documento nella fase 5; la voce richiesta diventa «✓ presente» |
| 5.3 | [O] Modifica scadenza della fase 5 senza motivazione, poi con motivazione | Senza motivazione: errore; con motivazione: nuova scadenza, motivazione in Audit |
| 5.4 | [O] Chiudete la fase 5 e aprite la fase 6 | «Nel Programma: in fase di verifica documentale»; fase 6 con scadenza = oggi + 15 giorni |
| 5.5 | [O] Fase 6: Verifica sull'accuratezza (+15 gg), prima senza e poi con motivazione | Senza motivazione: errore; con motivazione: scadenza spostata di 15 giorni, nella fase «Verifica sull'accuratezza avviata»; il Comune riceve la notifica con la nuova scadenza; il pulsante diventa «Ulteriore accertamento (+10 gg)» |
| 5.6 | [O] Ulteriore accertamento (+10 gg), con motivazione, per 3 volte | Ogni volta +10 giorni e notifica al Comune; nella fase «accertamenti: 3 di 3»; dopo il terzo il pulsante non c'è più |
| 5.7 | [O] Chiudete le fasi 6 e 7 | Tutte Completate; «Nel Programma: progetto registrato»; nei dati compare «Registrato il» con la data di chiusura della fase 6 |
| 5.8 | [O] e [C] Esporta fascicolo / Scarica documentazione | ZIP con Riepilogo.pdf, documenti, cartella Validazione (rapporto dell'Ente), Consultazione con osservazioni numerate e allegati, note e messaggi; pagamenti e audit (con i nomi) solo nell'export dello staff |
| 5.9 | Senza accesso, /programma: aprite il Progetto | Stato «progetto registrato» e data di registrazione; si scaricano il Modulo di descrizione e il Rapporto di validazione; il contratto con l'ente **non** compare |

### 6. Stato della pratica e Rapporto di Monitoraggio

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 6.1 | [O] Sospendi (anche per controllo di qualità) con motivazione | Notifica al Comune con la motivazione |
| 6.2 | [C] Aprite la pratica sospesa | Avviso «La pratica è sospesa…»; nessun pulsante + Carica; i Messaggi funzionano |
| 6.3 | [O] Riattiva la pratica; nella sezione Rapporti di Monitoraggio premete + Rapporto anno 1 | Nasce la pratica CWP-…-RM1 con 7 fasi (Registrazione del rapporto in corso, Prima verifica documentale, Feedback pubblico, Risposta ai commenti, Verifica del rapporto, Seconda verifica documentale, Chiusura); «Nel Programma: richiesta di registrazione del rapporto»; nel Progetto «Rapporti di Monitoraggio (1/10)»; nel Rapporto il riquadro Crediti emessi dice che i crediti si emettono dopo la registrazione |
| 6.4 | [O] Nel Rapporto, fase 1: caricate un PDF «Modulo di descrizione del rapporto di monitoraggio», chiudete la fase 1 e aprite la fase 2 | Scadenza = oggi + 10 giorni (durata del Rapporto in Impostazioni) |
| 6.5 | [O] Chiudete la fase 2, aprite la fase 3; nel riquadro Feedback pubblico scegliete il Modulo del rapporto e Apri il feedback pubblico | Il riquadro indica un feedback pubblico di **20 giorni**; chiusura = oggi + 20; sulla pagina pubblica compare «Rapporto di Monitoraggio anno 1» |
| 6.6 | [O] Chiudete il feedback pubblico e le fasi 3 e 4; aprite e chiudete le fasi 5 e 6 | «Nel Programma: rapporto registrato e crediti registrati»; nei dati «Crediti registrati il»; ora il riquadro Crediti emessi è pronto (sezione 8). Chiudete anche la fase 7 |
| 6.7 | [O] Tornate al Progetto: Ritira il progetto, con motivazione (estremi della lettera dei promotori) | Stato Ritirato; «Nel Programma: progetto ritirato»; il Comune riceve «Progetto ritirato dal Programma»; nell'intestazione «Da conservare fino al» |
| 6.8 | [O] Nel Progetto ritirato cercate + Rapporto anno 2; controllate i pulsanti di stato | Il pulsante + Rapporto non compare (nessun nuovo Rapporto per un Progetto ritirato); l'unico cambio di stato possibile è «Rientro nel Programma» |
| 6.9 | Senza accesso, /programma | Il Progetto resta visibile, con stato «progetto ritirato» |
| 6.10 | [O] Rientro nel Programma, con motivazione | Stato Attiva; il Comune riceve «Progetto rientrato nel Programma»; ricompare + Rapporto anno 2; la data di conservazione sparisce |
| 6.11 | [O] Chiudete la pratica (Chiudi pratica, con motivazione), poi Riattiva | Da chiusa: stato Chiusa e «Da conservare fino al» con la data tra **12 anni**; riattivando la data sparisce |

### 7. Calcolo dei crediti (solo Amministratore)

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 7.1 | Senza accesso, aprite la pagina Formato dati e scaricate il tracciato Excel | Il file si scarica; il foglio Istruzioni spiega ogni colonna |
| 7.2 | [C] Nella pratica RM1 caricate il file di esempio «Tracciato_esempio_compilato.xlsx» (Documentazione → file di esempio) | Documento caricato |
| 7.3 | [A] Calcolo crediti → + Nuovo calcolo sul Rapporto RM1, ex post, anno **2025** | Calcolo in Bozza; si apre il passo «Importa il tracciato» |
| 7.4 | [A] Dai documenti della pratica → Leggi questo file | Anteprima: 4 rifiuti, 2+1 classi, 4 righe e 3 utenze, 1 riuso; nessuna incoerenza |
| 7.5 | [A] Importa nel calcolo; controllate i passi 2, 3 e 5 | Dati compilati e salvati; «Ultimo import» con il nome del file |
| 7.6 | [A] Dal computer, importate «Tracciato_esempio_dati_personali.xlsx» | Import bloccato: elenco con foglio, riga e tipo di dato personale |
| 7.7 | [A] Dal computer, importate «Tracciato_esempio_letture.zip» | Letture sommate (U0001: 18 svuotamenti); avviso di una lettura fuori anno esclusa |
| 7.8 | [A] Passo 3: cambiate il nome di una classe; aprite il passo 5 | Controllo di coerenza «Classi … assenti nella delibera»; ripristinate il nome |
| 7.9 | [A] Passo 6: «Ricava dai dati importati» | Il buffer si compila dai dati |
| 7.10 | [A] Passo 7: Calcola | Crediti lordi, buffer, crediti netti (o debito), dettaglio per utenza; controlli di coerenza e riquadro «Da verificare» |
| 7.11 | [A] Scaricate riepilogo e dettaglio (CSV) e Scarica il rapporto (PDF) | I CSV si aprono con Excel; il PDF ha la scritta BOZZA su ogni pagina |
| 7.12 | [A] Passo 2: cambiate una quantità e premete Salva; poi rimettete il valore giusto, salvate e premete Calcola | Dopo il primo Salva il risultato si azzera e «Conferma calcolo» scompare; ricompare solo dopo Calcola |
| 7.12b | [A] Passo 7, riquadro «Qualità dei dati»: popolazione **10**, un cluster SOSE qualsiasi; Salva, Calcola, poi Conferma calcolo | Tabella kg/ab/anno contro la Tabella 3 con gli scostamenti oltre il 30% in rosso; compare «Motivazione degli scostamenti… (obbligatoria per confermare)»; indicatori di completezza, unicità, letture valide e tempestività; nella conferma «Conferma definitivamente» è **disattivato**, con l'avviso degli scostamenti |
| 7.12c | [A] Annulla; scrivete la motivazione, Salva e Calcola | Dopo il Salva «Conferma calcolo» scompare fino al nuovo Calcola; poi «Conferma definitivamente» è attivo |
| 7.13 | [A] Conferma calcolo → Conferma definitivamente | Calcolo Confermato con numero di registro CWP-REG-…; in sola lettura; il passo «Importa il tracciato» non permette più l'import |
| 7.14 | [A] Scarica il rapporto (PDF), poi Archivia il rapporto nella pratica | PDF senza BOZZA, con numero di registro e impronta, e nella sezione 6 indicatori, confronto e motivazione; nella pratica compare il documento «Rapporto di calcolo dei crediti», non visibile al Comune |
| 7.15 | [A] Calcolo crediti → Registro dei crediti | Il calcolo compare come Valido; totali per ente e anno; CSV scaricabile |
| 7.16 | [A] Nuova versione, poi Calcola e conferma la nuova versione | Nasce una bozza «(rev.)»; alla conferma riceve un nuovo numero e nel registro la riga precedente diventa «Sostituito da …» |

**File di esempio.** I tre file usati sopra si scaricano da `portale-cwp.vercel.app/documentazione/esempi/` (Tracciato_esempio_compilato.xlsx, Tracciato_esempio_letture.zip, Tracciato_esempio_dati_personali.xlsx) e contengono solo dati inventati, con anno 2025. Per prove proprie usate sempre codici anonimi (U0001, U0002…), mai dati reali di persone.

### 8. Crediti emessi

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 8.1 | [A] Nel Rapporto RM1 (fase 6 completata, prova 6.6) → Crediti emessi → + Emetti crediti: scegliete il calcolo confermato e una quantità enorme (es. 1000000) | Rifiutato: «Il calcolo … ammette N crediti netti: già emessi 0, richiesti 1000000» |
| 8.1b | [A] Senza calcolo collegato, quantità **100**, lasciando spuntata la voce di pagamento → Emetti | Lotto CWP-…-RM1-L1: 100 crediti, «ID da …-L1-000001 a …-L1-000100», «da caricare sul registro»; in Pagamenti la voce «Emissione dei crediti …» da 100 €; il Comune riceve «Crediti emessi: 100 (…)» |
| 8.2 | [O] Sul lotto: Carica sul registro → «Registro (prova)» | Badge «attivi 100»; accanto al lotto il nome del registro e la data |
| 8.3 | [O] Caricate nel Rapporto un PDF «Comunicazione di vendita dei crediti»; poi Registra una vendita: 40 crediti, beneficiario, obiettivo di compensazione, valore 2.000 €, quel documento, voce di pagamento spuntata | Riga della vendita con «ID da …-000001 a …-000040» e «In attesa della dichiarazione di cancellazione»; il documento diventa pubblico; in Pagamenti la voce di vendita da 400 € (20% del valore) |
| 8.4 | [O] Registra la cancellazione senza scegliere il documento | Rifiutato: «Serve la Dichiarazione di cancellazione tombale caricata nella pratica del Rapporto» |
| 8.4b | [O] Caricate un PDF «Dichiarazione di cancellazione tombale dei crediti» e registrate la cancellazione scegliendolo | «Ritirati: cancellazione tombale del …»; badge «attivi 60» e «ritirati 40»; il documento diventa pubblico |
| 8.5 | [O] Registra una vendita di 10 crediti con data di **15 giorni fa**, senza cancellazione | In rosso: «Manca la dichiarazione di cancellazione (attesa entro 10 giorni dalla vendita)»; dal giorno dopo lo staff riceve la notifica |
| 8.6 | [C] Aprite il Rapporto RM1 | Crediti emessi in sola lettura, senza pulsanti |
| 8.7 | [O] Menu Crediti emessi | Tutti i lotti con Comune e anno; totali emessi / attivi / ritirati |
| 8.8 | Senza accesso, /programma: aprite il Progetto | Nel Rapporto anno 1: lotto con ID da/a, registro, attivi e ritirati; si scaricano la comunicazione di vendita e la dichiarazione di cancellazione |

### 8b. Simulatore di scenari

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 8b.1 | [O] Menu Simulatore → + Nuovo scenario: Comune scritto a mano «Comune di Prova», nome «Obiettivo», durata dal menu **10 anni**, primo anno 2027 → Crea | Si apre lo scenario con 10 righe di obiettivi (2027-2036) |
| 8b.2 | Scenario di riferimento → Valori medi del cluster (Tabella 3): popolazione 10000, cluster 4 → Calcola dai valori medi del cluster | Tabella dei rifiuti compilata; riepilogo: produzione 445 kg/ab, secco 95 kg/ab, differenziata circa 78,7% |
| 8b.2b | Passate ad «Anno con il 65% di differenziata» lasciando gli stessi rifiuti | Riquadro arancione «Lo Standard 4.8.1 chiede un anno con differenziata tra 64% e 66%» e avviso nei Risultati; tornando al cluster l'avviso sparisce |
| 8b.2c | Situazione attuale: anno 2025, produzione 430 kg/ab, secco 90 kg/ab | «Differenziata attuale: 79,1%»; gli obiettivi nuovi partono da questi valori |
| 8b.3 | Obiettivi: pro capite finale 350, secco pro capite finale 60 → Applica la traiettoria | Righe compilate in modo lineare; la % di differenziata cresce ogni anno; nei Risultati crediti netti positivi e crescenti, grafici aggiornati |
| 8b.3b | Impostazioni: metodo «Per utenza: solo utenze virtuose», rifiuti misurati «Indifferenziato e organico», spuntate Tariffa puntuale | Buffer secondo il Capitolo 7: 30% (20% + 10%); se il buffer impostato è più basso compare l'avviso; con «Usa questo buffer» diventa 30; nei Risultati crediti più alti e colonna «Bilancio del Comune» per confronto |
| 8b.3c | Taratura: scrivete 0,19 e premete Trova la variabilità | La variabilità cambia e il riquadro «Per abitante all'anno» mostra circa 0,190 (oppure il messaggio «Valore non raggiungibile» se con questi dati non si può) |
| 8b.4 | Cambiate la durata a **21 anni**, poi a **7 anni** | Le righe diventano 21 e poi 7; i valori già inseriti per gli stessi anni restano |
| 8b.5 | In un anno portate il secco pro capite oltre il pro capite totale | Avviso «il secco previsto supera la produzione totale» |
| 8b.6 | Salva → Duplica con nome «Ambizioso», cambiate il secco finale a 40 → Salva | Nell'elenco del Comune due scenari con % finale e crediti a confronto |
| 8b.7 | Esporta CSV e Stampa | Il CSV si apre in Excel con una riga per anno; la stampa non mostra pulsanti né menu |
| 8b.7b | Simulazione economica: valore proposto 32 € → Applica a tutti gli anni; poi cambiate a mano il valore del 2030 a 40 € | Colonna «Valore» compilata anno per anno, il 2030 a 40 € in grassetto; ricavi aggiornati |
| 8b.7c | Alla domanda «Simulare i costi in base al Caso 1 o al Caso 2?» scegliete Caso 1, poi Caso 2, con 16.735 abitanti | Tabella delle sei voci con € per abitante interpolati (Caso 1: Progetto 0,13 €/ab, totale annuo circa 16.233 €); con il Caso 2 i costi salgono; nella tabella annuale partecipazione al Programma e consulenza, margine e anno di rientro |
| 8b.7d | Cambiate la durata a 7 anni | Avviso: le tabelle valgono per progetti di 10 anni, i costi si computano a parte |
| 8b.8 | [C] Provate ad aprire /simulatore | «Questa sezione è riservata alla Fondazione» |
| 8b.9 | [A] Audit | Voci di creazione, modifica e cancellazione degli scenari |

### 9. Reclami e richieste di chiarimento

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 9.1 | [C] Reclami → Nuovo invio: Richiesta di chiarimento, Progetto di prova, oggetto e dettagli di meno di 10 caratteri | Errore «Descrivi la questione (almeno 10 caratteri)» |
| 9.2 | [C] Completate i dettagli e Invia | «Ricevuto con il codice CHI-AAAA-NNN»; in I miei invii stato «ricevuto»; lo staff riceve «Nuova richiesta di chiarimento CHI-…» |
| 9.3 | [O] Reclami → Gestisci: stato «risposto», Gestito da, Conferma di ricezione inviata il, Risposta scritta e una nota interna → Salva | Nell'elenco: gestore, data della conferma e della risposta; con il filtro «aperti» non compare più |
| 9.4 | [C] Campanella e Reclami | Notifica «Risposta a CHI-…»; in I miei invii stato «risposto» e la risposta; la nota interna non si vede |
| 9.5 | [O] + Registra (PEC, email): un reclamo di uno stakeholder arrivato via PEC | Codice REC-AAAA-NNN; compare tra gli aperti |

### 10. Prove trasversali

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 10.1 | Campanella in alto con ciascuna utenza | Le notifiche degli eventi provati, per il ruolo giusto |
| 10.2 | Email di notifica | Oggi arrivano solo all'indirizzo del titolare del servizio email (limite noto) |
| 10.3 | [C] Esci, poi «Password dimenticata?» | Email «Richiesta di reimpostazione della password»; il pulsante apre la pagina Nuova password |
| 10.4 | [A] Utenti → Reimposta password del Cliente | Al successivo accesso il Cliente deve scegliere una nuova password e, finché non lo fa, non vede alcun dato |
| 10.5 | [A] Disattivate il Cliente e provate ad accedere con lui | Non vede più alcun dato; riattivatelo |
| 10.6 | [O] Cercate le pagine Utenti, Audit, Calcolo crediti; provate anche a scrivere l'indirizzo (es. /utenti) | Non compaiono nel menu dell'Operatore e i loro dati non sono accessibili; ci sono invece Crediti emessi e Reclami |
| 10.7 | [C] Controllate menu e pratiche visibili | Menu: Le mie pratiche, I tuoi documenti, Formato dati, Reclami, Il Programma, Manuale; solo le pratiche del proprio Comune |
| 10.8 | Senza accesso, /programma | Informazioni del Programma (soggetto promotore, email, sito), enti di validazione e verifica (RINA (prova)), registri (Registro (prova)), metodologie, la modulistica pubblica della prova 1.7 e come presentare un reclamo |
| 10.9 | [A] Audit: cercate il codice della pratica di prova | Tutte le operazioni fatte, con autore, data e motivazione |
| 10.10 | [A] Dashboard: provate riquadri, filtri e ricerca | La tabella si filtra di conseguenza |
| 10.11 | [A] Premete ✦ Assistente (in basso a destra) e chiedete «Come creo un nuovo utente amministratore?» | Risposta in italiano con i passi del Manuale Amministratore e il capitolo citato; in fondo «Domande di oggi: 1/40». Se la chiave di Anthropic non è ancora inserita: «L'assistente non è ancora attivo…» |
| 10.11b | [C] Con l'utente del Comune chiedete «Quanto costa la registrazione di un progetto?» e poi «In che fase è la mia pratica?» | Cifre dello Schema tariffario (IVA esclusa, da confermare con la Fondazione); alla seconda domanda spiega dove vederlo nel portale perché non vede i dati delle pratiche |
| 10.11c | [A] Documentazione: in fondo alla pagina gli 8 documenti ufficiali del Programma; premete Apri PDF sulla Metodologia | Si apre il PDF della Metodologia CWP v1.2 in una nuova scheda |
| 10.10c | [A] Dashboard: fate clic su «Organizzazione», poi di nuovo; in Pratiche e Utenti scegliete un campo in «Ordina per» e premete ▲/▼ | La tabella si ordina in modo crescente (▲) e poi decrescente (▼); gli elenchi a schede seguono il campo e il verso scelti; «ordine predefinito» torna all'ordine iniziale |
| 10.10b | [A] Dashboard: guardate la colonna Avanzamento della pratica di prova e passate il mouse sulle luci | Tante luci accese (ambra) quante le fasi completate, le altre spente; la fase in corso ha il contorno ambra; a pratica chiusa la settima luce è verde; il conteggio «n/7» corrisponde |

## Limiti noti e funzioni in arrivo

**Limiti noti oggi (non sono errori da segnalare).**

- Le email (notifiche e conferme del feedback pubblico) arrivano solo all'indirizzo del titolare del servizio email finché il dominio della Fondazione non è verificato.
- Chi invia un'osservazione nel feedback pubblico si identifica con l'email confermata: l'accesso con **SPID, CIE o CNS** previsto dalla Guida al Programma non è ancora disponibile (serve l'adesione della Fondazione come fornitore di servizi, tramite AgID o un aggregatore accreditato).
- La verifica in due passaggi per lo staff è pronta ma spenta.
- Non c'è ancora l'antivirus sui file caricati.

**In sviluppo** (saranno aggiunti al percorso di prova quando disponibili): accesso con SPID, CIE o CNS; registro di sicurezza; antivirus; **assistente virtuale (Claude)** nel portale.
