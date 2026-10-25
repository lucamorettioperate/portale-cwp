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
| 1.2d | [A] Rilievo N05. + Nuovo progetto: scrivete nel campo Codice pratica «cwp-026-099», poi cancellatelo e lasciate il campo vuoto (non create la pratica se non serve) | Con il codice scritto compare l'avviso arancione «Il codice non segue il formato automatico CWP-AAAA-NNNN: verrà salvato così come è scritto»; con il campo vuoto l'avviso sparisce e il codice lo assegna il portale (CWP-AAAA-NNNN) |
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
| 4.1 | [O] Senza aprire la fase 3, nel riquadro Feedback pubblico scegliete il «Modulo di descrizione del progetto» e Apri il feedback pubblico | Feedback Attivo per 30 giorni; la fase 3 si apre da sola con scadenza uguale all'ultimo giorno del feedback (rilievo N02); il documento diventa Pubblico; il Comune riceve «Aperto il periodo di feedback pubblico»; link alla pagina pubblica |
| 4.1b | [O] Sul documento in feedback provate a togliere la spunta Pubblico | Rifiutato: «Il documento è pubblicato in una consultazione attiva…» |
| 4.1c | [O] Nella fase 3 + Carica con tipologia «Contratto con l'ente di validazione e verifica» | La casella Pubblico è disattivata; nell'elenco il documento ha «Pubblico (non ammesso)»; la voce richiesta diventa «✓ presente» |
| 4.2 | Senza accesso, aprite «feedback pubblico» dalla pagina di accesso e il Progetto | Pagina «Feedback pubblico»: si leggono documento e osservazioni pubblicate |
| 4.3 | Inviate un'osservazione con nome, email (quella del titolare del servizio email, vedi limiti) e un PDF allegato | Messaggio «Controlla la tua email»; arriva l'email di conferma |
| 4.4 | Premete il pulsante dell'email; riprovate lo stesso collegamento | Prima volta: «osservazione ricevuta», notifica allo staff; seconda volta: collegamento già utilizzato |
| 4.5 | Provate a inviare 4 osservazioni in un'ora con lo stesso indirizzo; un allegato .exe | La quarta e l'allegato sono rifiutati con un messaggio chiaro |
| 4.6 | [O] Pubblica un'osservazione; su un'altra Non pubblicare scrivendo una motivazione | Ogni osservazione ha il suo numero («Osservazione n. 1»); lo staff vede nome, email, allegato e la motivazione; il Comune riceve «Nuova osservazione a cui rispondere»; il Comune e la pagina pubblica vedono solo quella pubblicata, firmata «Partecipante» |
| 4.7 | [O] + Pubblica errata corrige spuntando «Fai ripartire i 30 giorni», prima senza e poi con motivazione | Senza motivazione: errore; con motivazione: nuova chiusura a 30 giorni, visibile anche sulla pagina pubblica; notifica al Comune |
| 4.8 | [C] Rispondete all'osservazione pubblicata | Stato Risposto; la risposta compare anche sulla pagina pubblica |
| 4.9 | [O] Rilievo N02. Prima del termine guardate il riquadro Feedback pubblico e premete Chiudi fase sulla fase 3 | Nel riquadro: «Il feedback resta aperto fino al … compreso: si chiude dal giorno successivo», nessun pulsante di chiusura; Chiudi fase 3 rifiutato: «Il feedback pubblico resta aperto fino al … compreso: la fase 3 si chiude dal giorno successivo» |
| 4.9b | [O] Dal giorno dopo il termine: Chiudi il feedback pubblico e la fase 3; poi apri e chiudi la fase 4 | Feedback Chiuso e fase 3 Completata nello stesso momento; in Audit la chiusura del feedback; fase 4 Completata |
| 4.9c | [O] Su un secondo Progetto di prova con il feedback aperto: Stato della pratica → Ritirata (motivazione), poi «Chiudi ora: pratica ritirata» senza e con motivazione | Senza motivazione il pulsante resta disattivato; con motivazione il feedback si chiude, la fase 3 resta com'è e la motivazione è in Audit |
| 4.9d | [O] Con la fase 3 completata provate ad aprire un nuovo feedback pubblico | Rifiutato: «La fase 3 (feedback pubblico) è già completata: non si apre un nuovo feedback» |

**Attenzione (dal 22/10/2026, rilievo N02).** Il feedback pubblico e la fase 3 si chiudono solo dal giorno dopo il termine (30 giorni per il Progetto, 20 per il Rapporto). Le prove 4.9b e 5.x richiedono quindi un Progetto di prova il cui feedback sia aperto da più di 30 giorni. In alternativa, solo su un ambiente di prova, l'Amministratore riduce prima la durata della fase 3 in Impostazioni: la durata vale per tutti i nuovi feedback, quindi non va cambiata sul portale operativo.

### 5. Fasi 5, 6 e 7 — Validazione, registrazione e chiusura

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 5.0 | [O] Rilievo N03. Intestazione della pratica: Ente di validazione e verifica → Cambia → «— nessuno —» → Salva; guardate la fase 5; poi riassegnate «RINA (prova)» | Senza ente, al posto di «Apri fase» nella fase 5: «Per aprire la fase 5 assegna prima l'ente di validazione e verifica»; con l'ente riassegnato torna il pulsante |
| 5.1 | [O] Apri fase 5 (la tariffa di iscrizione non è pagata) | Rifiutato: «La tariffa di iscrizione va saldata prima della fase di validazione o verifica…» |
| 5.1b | [O] Pagamenti: Registra incasso della quota di iscrizione, poi Apri fase 5 | La fase si apre |
| 5.1c | [O] Con la fase 5 aperta: Ente → «— nessuno —» → Salva; poi scegliete un altro ente | Il primo rifiutato: «La fase 5 è aperta: l'ente si può sostituire ma non togliere»; la sostituzione riesce |
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
| 6.2b | [O] Aprite un Progetto attivo con la fase 6 non ancora completata e guardate la sezione Rapporti di Monitoraggio | Nessun pulsante + Rapporto; la riga «I Rapporti di Monitoraggio si creano dopo la registrazione del Progetto (fase 6 … completata)» |
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
| 7.17 | [A] Collaudo V01, D07. Passo 5 → Importa CSV conferimenti con le righe `S001;UD;UD1;organico;-225` e `S001;UD;UD1;indifferenziato;75` (colonna «Peso centri di raccolta (kg)») | «File non importato: 1 riga da correggere (Riga 2: «-225» non è ammesso … negativo)»; la Banca Dati di prima resta invariata; nessun risultato nuovo |
| 7.17b | [A] Ripetete con un negativo in ciascuna colonna (svuotamenti, volume, pesi, volumi, N. utenze) e nel CSV dei beni a riuso | Sempre «File non importato»; con 0 o cella vuota il file si importa |
| 7.18 | [A] Collaudo V01, D04. Importate uno ZIP con `6_Letture` contenente una lettura in data 31/02/2025 e una in data 01/06/2025 | Anteprima: 1 lettura usata; tra gli scarti «data «31/02/2025» non valida: giorno inesistente…»; con 29/02/2028 la lettura vale |
| 7.19 | [A] Collaudo V01, D02. Passo 6: buffer indicato a mano **90** → Calcola | Riquadro rosso «Calcolo bloccato: dati non ammessi» (buffer tra 0 e 80%); crediti 0; «Conferma calcolo» assente; con 80 il calcolo riprende |
| 7.20 | [A] Collaudo V01, R05. Su una bozza senza Banca Dati Utenze: Calcola → Conferma calcolo | Nel riquadro l'elenco degli errori di coerenza (fra cui «Manca la Banca Dati Utenze») e **Conferma definitivamente** disattivato |
| 7.21 | [A] Scarica il riepilogo (CSV) | Le voci «P%UD (%)» e «P%UnD (%)» sono in percentuale (100 e 0), come nella pagina e nel PDF |
| 7.22 | [A] Collaudo V01, D06. In una bozza di prova importate un conferimento con codice utenza `=1+1`, premete Calcola, scaricate il dettaglio per utenza (CSV) e apritelo con Excel | La cella mostra il testo `'=1+1` (o `=1+1` come testo), non il risultato 2; i numeri negativi (es. ΔI) restano numeri |
| 7.23 | [A] Collaudo V01, R08. Scaricate il rapporto di calcolo (PDF), il PDF del simulatore e un fascicolo; apriteli in due lettori diversi (per esempio Anteprima/Acrobat e il browser) e stampatene una pagina | Testo regolare, senza spazi strani né lettere sovrapposte; nelle proprietà del documento (Caratteri) compare LiberationSans «incorporato» |
| 7.24 | [A] Rilievo N06. Su una bozza con organico, carta, vetro, plastica, tessili, legno e metallo (quantità > 0): Calcola e scaricate il rapporto PDF | Sotto la tabella dei fattori: «FE indifferenziato calcolato… da» con quota, tonnellate e FE di ogni frazione usata; la nota «Comprende tipologie oltre le cinque nominate al cap. 5 della Metodologia (Legno): il paniere da usare è in attesa di conferma della Fondazione»; «Escluse perché senza fattore: Metallo». Lo stesso nel PDF. Il valore del fattore non cambia rispetto a prima |
| 7.25 | [A] Banca Dati Utenze. In un calcolo in bozza aprite **5a. Utenze del calcolo** → **Scarica il modello Excel**, poi **Carica il file dell'anno** con il file di prova `Banca_dati_utenze_prova_40.xlsx` → **Sostituisci l'elenco** | Anteprima: 20 domestiche e 20 non domestiche, avvisi per PROVA-UD-005 (totale diverso dalla somma) e per 4 utenze senza categoria; dopo il caricamento i riquadri dicono 20, 20 e 4; in Audit «caricamento utenze» con i numeri |
| 7.25b | [A] Caricate un file con una riga senza indifferenziato e una con un codice ripetuto | «File non caricato»: per ogni errore foglio, riga e codice; l'elenco precedente non cambia |
| 7.25c | [A] Aprite PROVA-UD-008 (categoria «da assegnare»), scrivete 2 nella categoria tariffaria, poi cambiate la categoria di simulazione in 3 e salvate | La simulazione segue la tariffaria (2) finché non la cambiate; dopo il salvataggio la riga mostra 2 e 3 «(cambiata)», i riquadri una utenza senza categoria in meno; in Audit «modifica utenza» con i campi cambiati |
| 7.25d | [A] + Nuova utenza non domestica: lasciate vuoti ragione sociale e indifferenziato, poi compilateli, usate «= somma delle frazioni» e salvate; poi riaprite e **Elimina utenza** | Prima errori in rosso e Salva disattivato; poi salvataggio riuscito; eliminazione con voce di audit |
| 7.25e | [O] Come Operatore provate ad aprire /crediti | Pagina non disponibile: la Banca Dati Utenze si gestisce solo come Amministratore |
| 7.26 | [A] Utenze nel calcolo. Nel calcolo di prova (40 utenze, delibera con le classi 1-6 e le categorie delle non domestiche) premete **Calcola** con alcune utenze ancora «da assegnare» | Risultati: riga «Banca Dati Utenze: utenze del passo 5a…» con il numero di utenze **escluse** in rosso; tra gli avvisi «N utenze senza categoria di simulazione: escluse dal calcolo»; nei Controlli di coerenza un errore con i codici; **Conferma calcolo** non disponibile |
| 7.26b | [A] Assegnate la categoria alle utenze «da assegnare» (passo 5a) e a quelle con una categoria assente dalla delibera, poi **Calcola** | Nessuna utenza esclusa, nessun errore di coerenza sulle categorie; il numero di utenze nei riquadri dei Risultati è uguale a quello del passo 5a |
| 7.26c | [A] Dopo «Calcola» modificate un'utenza (es. kg di indifferenziato) | Il risultato salvato si azzera; «Conferma calcolo» sparisce finché non si preme di nuovo «Calcola» |
| 7.26d | [A] In un calcolo con utenze nel 5a aprite **5b. Conferimenti (tracciato)** | Riquadro arancione: «Questo calcolo usa le N utenze del passo 5a…»; se ci sono anche conferimenti, tra gli avvisi dei Risultati «… righe di conferimento del passo 5b non sono usate» |
| 7.26e | [A] Un calcolo esistente senza utenze nel 5a (solo tracciato): **Calcola** | Stessi numeri di prima; riga «Banca Dati Utenze: conferimenti del tracciato (passo 5b)» |
| 7.26f | [A] **Scarica il riepilogo (CSV)** e **Scarica il dettaglio per utenza (CSV)** | Il riepilogo ha le voci «Banca Dati Utenze» e «Utenze escluse»; il dettaglio ha i codici delle utenze, nessun nome né indirizzo |

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
| 8b.5 | In un anno portate il secco pro capite oltre il pro capite totale | Riquadro rosso «Dati non ammessi»: «il secco previsto … supera la produzione totale»; nessun risultato; **Salva** disattivato (dal 20/10/2026: prima era solo un avviso) |
| 8b.5b | Collaudo V01, D01. Nella prima riga: produzione pro capite **−10**; poi secco pro capite **−10**; poi popolazione **−1000** e **0** (ripristinate ogni volta) | Ogni volta: nessun risultato, riquadro rosso con l'anno e il campo, «Da correggere prima di salvare», Salva disattivato |
| 8b.5c | Collaudo V01, D02. Buffer previsto **90**, poi **80,01**, **100**, **−1** e campo vuoto; poi **0** e **80** | Con i primi valori errore «Buffer (%) … al massimo 80» e Salva disattivato; con 0 e 80 risultati normali |
| 8b.5d | Collaudo V01, D03. Valore proposto 32 €, Applica a tutti gli anni; poi valore del 2027 **0** | Ricavi del 2027 = 0 €; cancellando il valore il 2027 torna a 32 €; con −5 compare «Valori economici non ammessi» |
| 8b.5e | Collaudo V01, R04. Con crediti e costi che si pareggiano esattamente | Riquadro «Margine netto»: «pareggio esatto nel …, nessun saldo positivo nel periodo» invece di «i costi non rientrano» |
| 8b.6 | Salva → Duplica con nome «Ambizioso», cambiate il secco finale a 40 → Salva | Nell'elenco del Comune due scenari con % finale e crediti a confronto |
| 8b.7 | Salvate e premete **Scarica PDF**, poi **Esporta Excel** e **CSV** | PDF in A4 orizzontale con loghi, avvertenza «stima ex ante», scheda e sintesi, quattro grafici (crediti netti, differenziata con soglia 65%, margine e margine cumulato), sezioni 1-5 con tutti i dati inseriti (impostazioni e buffer del Capitolo 7, riferimento con i rifiuti per tipologia, situazione attuale, obiettivi), risultati con il totale, parametri economici, costi e tabella economica, «Pagina n di n»; il file Excel si apre senza avvisi con i fogli Sintesi, Dati inseriti, Anni, Economia e Costi e i numeri sommabili; il CSV ha una riga per anno |
| 8b.7b | Confrontate il PDF con la pagina dello scenario aperto | Ogni valore inserito nella pagina (impostazioni, rifiuti del riferimento, situazione attuale, obiettivi, valore del credito, costi dell'ente) compare nel PDF con lo stesso numero; i totali dei risultati coincidono con la riga «Totale» della pagina |
| 8b.7e | Sul telefono aprite uno scenario | I pulsanti vanno a capo e la pagina non scorre di lato; le tabelle larghe scorrono dentro il loro riquadro |
| 8b.7b | Simulazione economica: valore proposto 32 € → Applica a tutti gli anni; poi cambiate a mano il valore del 2030 a 40 € | Colonna «Valore» compilata anno per anno, il 2030 a 40 € in grassetto; ricavi aggiornati |
| 8b.7c | Alla domanda «Simulare i costi in base al Caso 1 o al Caso 2?» scegliete Caso 1, poi Caso 2, con 16.735 abitanti | Tabella delle sei voci con € per abitante interpolati (Caso 1: Progetto 0,13 €/ab, totale annuo circa 16.233 €); con il Caso 2 i costi salgono; nella tabella annuale partecipazione al Programma e consulenza, margine e anno di rientro |
| 8b.7d | Rilievo N01. Cambiate la durata a 7 anni (con il Caso 1) | Riquadro rosso «Stima, non listino approvato»; casella «Costi per il Comune nel periodo (stima)»; avviso «Per 7 anni la regola non è ancora stabilita dalla Fondazione…»; nel PDF e nel foglio Economia dell'Excel la riga «ATTENZIONE» sopra la tabella annuale |
| 8b.7f | Rilievo N01. Con il Caso 1 e 10 anni guardate la tabella dei costi, il PDF e il foglio Costi dell'Excel | Le tre voci «una tantum, in 10 rate annuali»; sotto la tabella la nota «corrispettivo unico e forfettario pagato in 10 rate annuali uguali… l'importo indicato è la rata annua»; lo stesso importo in tutti i 10 anni, nessun riquadro «Stima» |
| 8b.8 | [C] Provate ad aprire /simulatore | «Questa sezione è riservata alla Fondazione» |
| 8b.9 | [A] Audit | Voci di creazione, modifica e cancellazione degli scenari, con nome e codice dello scenario nella colonna «Oggetto e modifiche» |
| 8b.9b | [A] Collaudo V01, D05. Modificate due scenari diversi (buffer in uno, produzione 2027 nell'altro) e salvate; aprite Audit e premete «n modifiche» | Ogni riga indica lo scenario giusto («Scenario del simulatore «nome» (codice)») e i cambi «Buffer (%): 20 → 25», «Anno 2027 › produzione totale (t): 300 → 290», «Crediti netti stimati …», «Ultimo ricalcolo …» |

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
| 10.5 | [A] Disattivate il Cliente e provate ad accedere con lui (o ricaricate una sua pagina già aperta) | Riquadro «Account disattivato» con l'invito a scrivere alla Fondazione e il pulsante Esci; nessun dato; riattivatelo e al nuovo accesso rivede la sua pratica |
| 10.5b | [A] Collaudo V05, D05-R1. Audit → cercate «COLLAUDO V03 Operatore» → «1 modifica» sulle due righe «modifica organizzazione» del 21/10 (09:20:41 e 09:21:21) → **Testo completo** | Oggetto «Organizzazione «COLLAUDO AL V03 - COMUNE B - 20261020» (916f3283)»; nella prima «Aggiunto:» la riga temporanea, nella seconda «Tolto:» la stessa riga; Prima e Dopo interi; cercando «prova temporanea» compaiono le due righe |
| 10.6 | [O] Cercate le pagine Utenti, Audit, Calcolo crediti; provate anche a scrivere l'indirizzo (es. /utenti) | Non compaiono nel menu dell'Operatore e i loro dati non sono accessibili; ci sono invece Crediti emessi e Reclami |
| 10.6b | [A] Controllate il menu come luca.moretti@operate.it e come altro Amministratore | Ordine: Dashboard, Anagrafiche, Simulatore, Pratiche, Reclami, Calcolo crediti, Crediti emessi, Impostazioni, Utenti, Audit, Audit User (solo il principale), Documentazione e Marketplaces in grigio, che non si apre |
| 10.7 | [C] Controllate menu e pratiche visibili | Menu: Le mie pratiche, I tuoi documenti, Reclami, Formato dati, Il Programma CWP, Manuali e, in grigio e non cliccabile, Marketplaces; solo le pratiche del proprio Comune |
| 10.8 | Senza accesso, /programma | Informazioni del Programma (soggetto promotore, email, sito), enti di validazione e verifica (RINA (prova)), registri (Registro (prova)), metodologie, la modulistica pubblica della prova 1.7 e come presentare un reclamo |
| 10.9 | [A] Audit: cercate il codice della pratica di prova | Tutte le operazioni fatte, con autore, data e motivazione |
| 10.10 | [A] Dashboard: provate riquadri, filtri e ricerca | La tabella si filtra di conseguenza |
| 10.11 | [A] Premete ✦ Assistente (in basso a destra) e chiedete «Come creo un nuovo utente amministratore?» | Durante l'attesa compare «Un attimo…»; poi risposta in italiano con i passi del Manuale Amministratore e il capitolo citato; in fondo «Domande di oggi: n/40»; grassetto e corsivo si vedono come testo formattato, senza asterischi. Se compare «non ha potuto rispondere (…credit balance is too low…)» manca credito nella Claude Console; «…not scoped to a workspace…» la chiave non è legata a uno spazio di lavoro |
| 10.11b | [C] Con l'utente del Comune chiedete «Quanto costa la registrazione di un progetto?» e poi «In che fase è la mia pratica?» | Cifre dello Schema tariffario (IVA esclusa, da confermare con la Fondazione); alla seconda domanda spiega dove vederlo nel portale perché non vede i dati delle pratiche |
| 10.11e | [C] Aprite la vostra pratica di prova e, da quella pagina, chiedete all'assistente «A che punto è questa pratica?» e «Quali documenti mancano nella fase in corso?» | Risposta con lo stato, la fase in corso e la sua scadenza, i documenti richiesti non ancora caricati, eventuali pagamenti da saldare; l'intestazione della chat dice «sulla pratica aperta» |
| 10.11f | [O] Come Operatore aprite l'assistente e chiedete «Come apro la fase successiva di una pratica?» e poi «Come creo un nuovo utente?» | Prima risposta con i passi del manuale; alla seconda spiega che la gestione utenti è riservata agli Amministratori |
| 10.12 | [A] Come luca.moretti@operate.it, con un altro utente collegato da un altro browser, guardate l'intestazione e premete **● n online** | Il numero comprende entrambi; nell'elenco compaiono nome, ruolo, pagina aperta e «collegato da …»; quando l'altro preme Esci sparisce dagli online entro 30 secondi e resta tra «visti nelle ultime 24 ore» |
| 10.12b | Entrate con un altro Amministratore | Il pulsante «n online» e la voce «Audit User» non compaiono; scrivendo /audit-utenti: «Questa sezione è riservata all'Amministratore principale» |
| 10.13 | [C] Provate l'accesso con una password sbagliata, poi entrate, scaricate un documento e premete Esci | — |
| 10.13b | [A] Come luca.moretti@operate.it aprite **Audit User** → Accessi, filtrate sull'utente del Comune | In ordine: «Accesso non riuscito – password errata», «Accesso – con email e password», «Uscita (Esci) – dopo n min di collegamento», con data e ora al secondo |
| 10.13c | Scheda Operazioni, stesso utente | Riga «download documento» con il nome del file e il codice della pratica |
| 10.13d | Scheda Utenti e stato online | Riquadri e tabella; l'utente del Comune «Non collegato» con ultimo accesso aggiornato; i pulsanti Accessi e Operazioni aprono le schede filtrate; Esporta CSV scarica il file |
| 10.11d | [C] Chiedete qualcosa all'assistente quando il credito della Console è esaurito (solo se capita; non va provocato) | Messaggio in italiano «L'assistente non è disponibile in questo momento…»; come Amministratore anche la causa tra parentesi |
| 10.14 | [A] Lasciate il portale aperto senza toccarlo per 28 minuti | Compare «Sei ancora lì?» con il conto alla rovescia; Resto collegato lo chiude; senza risposta dopo 2 minuti si esce e la pagina di accesso dice «la sessione è stata chiusa dopo un periodo senza attività» |
| 10.14b | Sbagliate per 5 volte la password di un utente di prova in pochi minuti | All'Amministratore principale arriva la notifica «Accessi non riusciti ripetuti» (campanella ed email) |
| 10.14c | [A] Nominate Amministratore un utente di prova (da un Amministratore diverso dal principale) | Al principale arriva la notifica «Nuovo Amministratore» |
| 10.14d | Aprite securityheaders.com e analizzate portale-cwp.vercel.app | Presenti Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| 10.11c | [A] Documentazione: in fondo alla pagina gli 8 documenti ufficiali del Programma; premete Apri PDF sulla Metodologia | Si apre il PDF della Metodologia CWP v1.2 in una nuova scheda |
| 10.10f | [A] Rilievo N04. Dashboard: guardate i riquadri e la colonna Scadenza | Riquadro «Fase aperta senza scadenza» con il numero delle pratiche attive la cui fase aperta non ha data (arancione se > 0); nella riga «— nessuna scadenza nota»; un clic sul riquadro filtra quelle pratiche; le pratiche sospese, chiuse o ritirate non sono contate |
| 10.10c | [A] Dashboard: fate clic su «Organizzazione», poi di nuovo; in Pratiche e Utenti scegliete un campo in «Ordina per» e premete ▲/▼ | La tabella si ordina in modo crescente (▲) e poi decrescente (▼); gli elenchi a schede seguono il campo e il verso scelti; «ordine predefinito» torna all'ordine iniziale |
| 10.10d | [A] Aprite **Pratiche**; poi, come utente del Comune, **Le mie pratiche** | In ogni riquadro dell'elenco, in alto a destra, la barra a LED delle 7 fasi con «n/7» (stato sotto); nella pratica aperta la stessa barra in alto a destra, sopra lo stato; dopo aver chiuso una fase la luce si accende anche nell'elenco |
| 10.10e | Aprite la pagina di accesso e l'intestazione | Accanto al logo Carbon WastePrint i loghi RINA e Carbon Credit con i cerchi della stessa misura; nella pagina di accesso piccoli, sulla stessa riga del logo, allineati in basso e a destra |
| 10.10g | [A] Dal telefono (o con il browser stretto sotto 760 px) aprite la Dashboard e premete **☰ Menu** | Intestazione bassa con loghi, campanella e Menu; il pannello mostra tutte le voci grandi, il profilo con il segno Admin ed Esci; scegliendo una voce il pannello si chiude e la pagina cambia; nessuna pagina scorre di lato |
| 10.10h | [A] Dal telefono: Dashboard e Audit | Ogni pratica (e ogni evento) è una scheda con le etichette delle colonne; «Ordina per» sopra le schede funziona |
| 10.10i | [O] e [C] Dal telefono: Pratiche (o Le mie pratiche con più pratiche) | Prima l'elenco; toccando una pratica il dettaglio con «← Tutte le pratiche» in alto, che riporta all'elenco; con una sola pratica il Comune vede subito il dettaglio |
| 10.10l | Dal telefono (iPhone) toccate un campo di ricerca o di testo; aprite l'assistente ✦ | La pagina non si ingrandisce; l'assistente occupa tutto lo schermo e si chiude con ✕ |
| 10.10m | [A] Dashboard: riquadri **Crediti in simulazione** e **Crediti in fase esecutiva** | Crediti ed euro di tutto il portale; nella simulazione un solo scenario per Comune (l'ultimo aggiornato); in fase esecutiva le righe Calcolati, Emessi e Venduti con il prezzo di riferimento indicato |
| 10.10n | [A] Simulatore: aprite uno scenario salvato prima del 23/10, premete **Salva**, tornate alla Dashboard | Il numero di scenari «valorizzati a 32 €/credito» scende di uno; gli euro dello scenario sono i suoi ricavi |
| 10.10o | [A] Impostazioni → Prezzo di riferimento del credito: 40 → Salva; poi rimettete il valore di prima | La Dashboard valorizza calcolati ed emessi al nuovo prezzo; due voci «modifica prezzo di riferimento del credito» in Audit; un prezzo negativo è rifiutato |
| 10.10p | [C] Come utente del Comune aprite **Le mie pratiche** | I due riquadri «Valore dei crediti della tua organizzazione» con i soli dati del vostro Comune (nessun dato di altri Comuni) |
| 10.10q | [A] Pratiche → + Nuovo progetto senza scegliere il listino; poi scegliete Caso 2 con popolazione 16735 | Senza listino: «Scegli il listino…»; con Caso 2 compare «Valore del progetto: … in 10 anni (… all'anno)» |
| 10.10r | [A] Progetto aperto prima del 23/10: «Listino: da indicare»; Modifica i dati → Caso 1, popolazione 16735 → Salva | Compare «Valore del progetto per il cliente: 162.329,50 € in 10 anni (16.232,95 € all'anno)»; in Audit «modifica pratica»; nella Dashboard il riquadro «Valore dei progetti» lo conta |
| 10.10u | [A] Dati di un Progetto → Modifica i dati: aprite il menu Listino | Solo Caso 1 e Caso 2, nessuna voce «da indicare»; i Progetti esistenti risultano Caso 1 (voce nell'Audit con la motivazione del 25/10) |
| 10.10s | [A] Simulatore: scenario con Caso 1 → Salva; poi Dashboard | Nella riga «In simulazione» del riquadro «Valore dei progetti» entra quanto paga il cliente nel periodo simulato |
| 10.10t | Aprite una pratica con fasi completate, una in corso e altre non iniziate (anche dal telefono); guardate anche la colonna Fase corrente della Dashboard | Scritta dello stato verde per Completata, arancio per In corso (e In attesa di integrazione), rossa per Non iniziata |
| 10.16 | [A] Aprite **Marketing** dal menu; [O] e [C] scrivete /marketing nell'indirizzo | Amministratore: schede Comuni, Gestori, Campagne, Richieste, Importazioni; Operatore e Comune: «Questa sezione è riservata agli amministratori» e nessuna voce nel menu |
| 10.16j | [A] Marketing → Comuni senza nessun filtro | L'elenco si carica: «7.904 Comuni», 50 per pagina |
| 10.16k | [A] Importazioni → Lettura dei siti: guardate la tabella, poi **Leggi ora 1 ente** | Tabella con in coda, in lettura, letti ed errori per Comuni e gestori; dopo qualche secondo il riquadro con pagine lette, email, PEC, telefono e referenti trovati |
| 10.16l | [A] Aprite un Comune letto (es. Comune di Lecco) in Marketing → Comuni | Email generica e PEC compilate; referenti «tributi» e «ambiente» con email dell'ufficio e fonte = pagina del sito |
| 10.16m | [A] **Ferma**, attendete un minuto, poi **Avvia la lettura** | Con la lettura ferma i numeri non cambiano; riavviata, i «letti» riprendono a crescere |
| 10.16b | [A] Importazioni → Aggiorna i Comuni; poi scheda Comuni, filtro Regione = Veneto | Nel diario ISTAT, IndicePA e uffici; i Comuni del Veneto con abitanti, email generica e PEC in colonne separate |
| 10.16c | [A] Aprite un Comune, aggiungete un referente «Tributi» con fonte, salvate; provate a scrivere una PEC nel campo «email generica» | Referente salvato; la PEC nel campo email è rifiutata con un messaggio |
| 10.16d | [A] Campagne → + Nuova campagna, testo di due paragrafi, grafica «Territorio» → Salva → Invia una prova a me | Anteprima con grafica, testo, riquadro 7/10/21 anni e pulsante «Approfondisci»; l'email di prova arriva con gli stessi contenuti |
| 10.16e | [A] Destinatari: Comuni del Molise sotto 5.000 abitanti → Cerca → Aggiungi | Solo enti con email generica; il riepilogo indica quanti sono stati saltati (senza email o disiscritti) |
| 10.16f | Aprite il pulsante «Approfondisci» dell'email di prova (anche dal telefono); inserite 16735 abitanti, 8000 t totali, 2400 t di secco, 10 anni, Caso 1 → Calcola | Nome del Comune in alto; margine 491.910 €, ricavi 654.240 €, costi 162.330 €, 20.445 crediti; grafico e tabella anno per anno; nessuno scorrimento orizzontale |
| 10.16g | Nella stessa pagina scrivete «8.000» come rifiuti totali | Avviso «La produzione risulta di … kg per abitante…»: controllare le unità |
| 10.16h | Scaricate il fascicolo; compilate la richiesta di registrazione con il consenso → Invia | PDF di 6 pagine; «Richiesta inviata»; tutti gli Amministratori ricevono notifica ed email; la richiesta compare in Marketing → Richieste con la simulazione |
| 10.16i | Dal collegamento «Non desidero ricevere altre comunicazioni» → Conferma; poi riaggiungete lo stesso ente a una nuova campagna | «Fatto…»; l'ente è saltato perché disiscritto |
| 10.15 | [A] Aprite **Notizie CO2** dal menu | Pagina con data dell'ultima ricerca e della prossima (ogni 2 ore), riquadro «Prezzi citati» se ci sono prezzi, filtri per categoria con i conteggi, elenco di notizie con data, testata, categoria, rilevanza (pallini su 5), titolo e sintesi in italiano |
| 10.15b | Leggete 10 notizie a caso e apritene 3 | Tutte parlano di crediti di carbonio volontari (mercato, marketplace, prezzi, standard e registri, regole, progetti); il titolo apre l'articolo originale in una nuova scheda |
| 10.15c | Spuntate «Mostra le scartate dal filtro» | Compaiono anche le notizie non attinenti con l'etichetta «Scartata dal filtro» e il motivo (es. solo EU ETS, certificati del GSE) |
| 10.15d | Premete **Aggiorna ora**, poi subito di nuovo | La prima volta, dopo 20-60 secondi, «Ricerca completata: n lette, n nuove, n attinenti»; la seconda «Ultima ricerca meno di 10 minuti fa»; il Registro ricerche mostra la ricerca «Aggiorna ora» con esito ok |
| 10.15e | **Nascondi** su una notizia, poi «Mostra le nascoste» e **Mostra di nuovo** | La notizia sparisce e ricompare |
| 10.15f | [O] e [C] Scrivete /notizie-co2 nell'indirizzo | Nessuna voce Notizie CO2 nel menu; la pagina dice «Questa sezione è riservata agli amministratori» e non mostra notizie |
| 10.15h | [A] Dopo una ricerca con notizie nuove (o «Aggiorna ora» da un altro Amministratore) guardate il menu, poi aprite Notizie CO2 | Pallino verde in alto a destra di «Notizie CO2»; aprendo la sezione si spegne e non ricompare finché non arrivano altre notizie; un altro Amministratore che non ha aperto la sezione lo vede ancora |
| 10.15g | [A] Il giorno dopo aprite il Registro ricerche | Ricerche «Automatica» ogni 2 ore con esito ok |
| 10.10b | [A] Dashboard: guardate la colonna Avanzamento della pratica di prova e passate il mouse sulle luci | Tante luci accese (ambra) quante le fasi completate, le altre spente; la fase in corso ha il contorno ambra; a pratica chiusa la settima luce è verde; il conteggio «n/7» corrisponde |

**Dove finiscono le segnalazioni.** Ogni segnalazione dei collaudatori entra nel **Registro issue e test** (Documentazione, solo Amministratori), con data e ora, azione correttiva e stato (per esempio «CORRETTO_DA_RITESTARE»). Le prove da ripetere sono indicate nel registro con il numero del caso di questo manuale.

## Limiti noti e funzioni in arrivo

**Limiti noti oggi (non sono errori da segnalare).**

- Le email (notifiche e conferme del feedback pubblico) arrivano solo all'indirizzo del titolare del servizio email finché il dominio della Fondazione non è verificato.
- Chi invia un'osservazione nel feedback pubblico si identifica con l'email confermata: l'accesso con **SPID, CIE o CNS** previsto dalla Guida al Programma non è ancora disponibile (serve l'adesione della Fondazione come fornitore di servizi, tramite AgID o un aggregatore accreditato).
- La verifica in due passaggi per lo staff è pronta ma spenta.
- Non c'è ancora l'antivirus sui file caricati.

**In sviluppo** (saranno aggiunti al percorso di prova quando disponibili): accesso con SPID, CIE o CNS; registro di sicurezza; antivirus; assistente virtuale per gli Operatori e aiuto sulla singola pratica.
