<!--
  Manuale Test — testo sorgente (guida per chi collauda il portale).
  Da questo file si generano Word e PDF:  node strumenti/genera_documenti.cjs test
  Revisioni in strumenti/revisioni_documenti.json ("test").
  REGOLA: si aggiorna a ogni rilascio, insieme a Registro sviluppo e deploy,
  Manuale Utente e Manuale Amministratore. Deve restare sintetico.
  Documento riservato agli Amministratori: si scarica solo dall'area Documentazione.
-->

## A chi serve questa guida

Questa guida è per chi **collauda il portale** senza conoscere il Programma Carbon WastePrint®. In poche pagine spiega il metodo CWP, che cosa fa il portale e propone un **percorso di prova** che segue una pratica dall'adesione del Comune fino al calcolo dei crediti.

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
| **Buffer** | Una quota dei crediti (fino al 30%) trattenuta a garanzia, più bassa se il Comune misura bene i conferimenti | Analisi del rischio della Metodologia |

**Chi partecipa.**

- Il **Comune** (o ente, o soggetto gestore) aderisce, fornisce documenti e dati: nel portale è il ruolo *Cliente*.
- **Fondazione Operate** gestisce il Programma: gli **Operatori** seguono le pratiche, gli **Amministratori** amministrano il portale e calcolano i crediti.
- L'**Ente di Validazione** (es. RINA) verifica in modo indipendente; non usa il portale: il suo rapporto viene caricato dalla Fondazione.
- Il **pubblico** può presentare osservazioni durante la consultazione pubblica.

**Il percorso di un Progetto** è diviso in 7 fasi, con durate indicative (modificabili dall'Amministratore):

| Fase | Durata | Cosa succede |
| --- | --- | --- |
| 1. Adesione | avvio | Il Comune aderisce; la Fondazione apre la pratica e carica il contratto |
| 2. Prima verifica documentale | 10 gg | La Fondazione controlla i documenti del Comune e chiede integrazioni |
| 3. Consultazione pubblica | 30 gg | Il documento di progetto è pubblicato e chiunque può fare osservazioni |
| 4. Risposta ai commenti / pubblicazione | 20 gg | Il Comune risponde alle osservazioni ammesse |
| 5. Validazione e verifica | 75 gg | L'Ente di Validazione verifica il progetto |
| 6. Seconda verifica documentale | 15 gg | Controllo finale della documentazione |
| 7. Chiusura | — | Il Progetto è validato |

Dopo la validazione il Progetto produce ogni anno un **Rapporto di Monitoraggio** (fino a 10 anni): ogni Rapporto è una pratica con le sue fasi, e per ogni anno si calcolano i crediti.

## Il ruolo del portale

Il portale è lo strumento unico con cui Comune e Fondazione seguono la pratica. Le funzioni oggi disponibili:

| Area | Cosa fa il portale | Chi la usa |
| --- | --- | --- |
| Accesso | Email e password, password temporanea da cambiare al primo accesso, recupero della password, profilo | tutti |
| Pratiche | Progetti e Rapporti di Monitoraggio, codice automatico (CWP-AAAA-NNNN), stati attiva / sospesa / annullata / chiusa; conservazione per 10 anni, nulla si cancella | Fondazione; il Comune consulta |
| Fasi | 7 fasi per il Progetto, 4 per il Rapporto; apertura, scadenza calcolata, chiusura, modifica della scadenza con motivazione; note di fase interne o condivise; modelli da scaricare e documenti richiesti per fase | Fondazione; il Comune consulta |
| Anagrafiche | Organizzazioni ed Enti di Validazione, con le pratiche collegate | Fondazione |
| Messaggi | Conversazione tra Comune e Fondazione dentro ogni pratica | tutti |
| Documenti | Caricamento con versioni (mai sovrascritte), visibilità, controllo di formato e contenuto, impronta di integrità | tutti |
| Integrazioni | Richiesta della Fondazione → risposta del Comune con documento → chiusura | tutti |
| Consultazione pubblica | Pagina pubblica per 30 giorni; documento bloccato; osservazioni numerate con email confermata e allegato; moderazione con motivazione; risposte del Comune; errata corrige | tutti, anche senza accesso |
| Pagamenti | Voci previste e incassi registrati a mano (nessun pagamento online) | Fondazione; il Comune consulta |
| Notifiche | Campanella nel portale ed email per ogni evento importante; avvisi di scadenza | tutti |
| Cruscotto | Tutte le pratiche con fase, scadenza e cose da fare, filtri e ricerca | Fondazione |
| Export | Fascicolo completo della pratica in un file ZIP con riepilogo PDF | tutti |
| Audit | Registro non modificabile di ogni operazione, con motivazione | Amministratore |
| Utenti e impostazioni | Creazione utenti, associazione ai Comuni, reimpostazione password, durata delle fasi, documenti richiesti, modelli di documento | Amministratore |
| Calcolo crediti | Import del tracciato dati del Comune con controllo dei dati personali e della coerenza, calcolo secondo la Metodologia, rapporto PDF, conferma con numero di registro, registro dei crediti, nuove versioni | Amministratore |
| Formato dati | Pagina pubblica con il tracciato Excel standard per i dati dei Comuni | tutti, anche senza accesso |
| Documentazione | Manuali e registro tecnico da scaricare | tutti (per ruolo) |

## Percorso di prova

Seguite le prove nell'ordine: ognuna prepara la successiva. Tra parentesi l'utenza da usare: **[A]** Amministratore, **[O]** Operatore, **[C]** Cliente.

### 1. Preparazione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 1.1 | [A] Impostazioni: cambiate la durata della fase 2 da 10 a 12 giorni con una motivazione | La durata complessiva si aggiorna; la modifica compare in Audit |
| 1.2 | [A] Pratiche → + Nuovo progetto, con una **nuova** organizzazione «Comune di Prova» | Nasce la pratica CWP-AAAA-NNNN con 7 fasi; la fase 1 è In corso |
| 1.2b | [O] Anagrafiche → Organizzazioni: Modifica «Comune di Prova» aggiungendo codice fiscale e PEC | Dati salvati; sotto l'organizzazione compare la pratica creata |
| 1.3 | [A] Utenti → + Nuovo utente, ruolo Cliente, associato a «Comune di Prova» | L'utente compare in elenco; annotate la password temporanea |
| 1.4 | [C] Accedete con la password temporanea | Il portale chiede subito una nuova password (min. 10 caratteri, lettere e numeri) |
| 1.5 | [C] Aprite Il mio profilo e il Manuale | Dati dell'account; manuale scaricabile in PDF |
| 1.6 | [O] Anagrafiche → Enti di Validazione: + Nuovo ente «RINA (prova)» | L'ente compare in elenco (anche un Operatore può crearlo) |
| 1.7 | [A] Impostazioni → Modelli di documento: un modello per «Progetto · Fase 1» e uno Generale | Pubblicati; il Comune vede il primo nella fase 1 e il secondo in I tuoi documenti |
| 1.8 | [A] Impostazioni → Documenti richiesti per fase: Progetto, Fase 2, tipologia «Documento di progetto» | La voce compare in elenco |

### 2. Fase 1 — Adesione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 2.1 | [O] Nella pratica, Documenti generali → + Carica un PDF con tipologia Contratto, visibile al Cliente | Documento v1; il Comune riceve la notifica e lo vede in I tuoi documenti |
| 2.2 | [O] Caricate di nuovo lo stesso file (stesso nome) | Nasce la v2; la v1 resta consultabile |
| 2.3 | [O] Caricate un documento togliendo «Visibile al Cliente» | Il Comune non lo vede |
| 2.4 | [O] Pagamenti → + Voce di pagamento (quota di adesione, importo, scadenza), poi Registra incasso | Voce Pagato con data; operazione in Audit |
| 2.5 | [C] Aprite la pratica: sezione Pagamenti | La voce è visibile in sola lettura, senza pulsanti |
| 2.6 | [O] Nella fase 1 + Aggiungi nota: una interna e una «Visibile al Comune» | Il Comune vede solo la seconda e riceve la notifica |
| 2.7 | [C] Messaggi: scrivete una domanda; [O] rispondete | Ognuno riceve la notifica del messaggio dell'altro |
| 2.8 | [O] Intestazione della pratica: Ente di Validazione → Assegna «RINA (prova)» | Il Comune vede il nome dell'ente |
| 2.9 | [O] Chiudi fase 1 | Fase Completata; notifica al Comune |

### 3. Fase 2 — Prima verifica documentale

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 3.1 | [O] Apri fase 2 | Scadenza = oggi + 12 giorni (prova 1.1); notifica al Comune |
| 3.2 | [C] Nella fase 2 guardate «Documenti richiesti», poi caricate un file scegliendo «Documento di progetto» | Prima «○ manca», dopo «✓ presente»; lo staff riceve la notifica «Il Cliente ha caricato un documento» |
| 3.3 | [C] Provate a caricare un file .exe, un file vuoto, un .txt rinominato in .pdf | Tutti rifiutati con un messaggio chiaro |
| 3.4 | [O] Richiedi integrazione («manca la delibera TARI») | Fase In attesa di integrazione; notifica al Comune; nel Cruscotto «In attesa del Cliente» |
| 3.5 | [C] Rispondete all'integrazione caricando un file | Richiesta «Risposta ricevuta»; notifica allo staff |
| 3.6 | [O] Accetta e chiudi, poi Chiudi fase 2 | La fase torna In corso dopo la chiusura dell'integrazione, poi Completata |
| 3.7 | [C] Riaprite la fase 2 completata | Il pulsante + Carica non c'è più (si carica solo nelle fasi aperte) |

### 4. Fasi 3 e 4 — Consultazione pubblica

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 4.1 | [O] Apri fase 3; nel riquadro Consultazione pubblica scegliete il documento di progetto e Apri consultazione | Consultazione Attiva per 30 giorni; il documento diventa Pubblico; notifica al Comune; link alla pagina pubblica |
| 4.1b | [O] Sul documento in consultazione provate a togliere la spunta Pubblico | Rifiutato: «Il documento è pubblicato in una consultazione attiva…» |
| 4.2 | Senza accesso, aprite Consultazioni pubbliche (link nella pagina di accesso) e la consultazione | Si leggono documento e osservazioni pubblicate |
| 4.3 | Inviate un'osservazione con nome, email (quella del titolare del servizio email, vedi limiti) e un PDF allegato | Messaggio «Controlla la tua email»; arriva l'email di conferma |
| 4.4 | Premete il pulsante dell'email; riprovate lo stesso collegamento | Prima volta: «osservazione ricevuta», notifica allo staff; seconda volta: collegamento già utilizzato |
| 4.5 | Provate a inviare 4 osservazioni in un'ora con lo stesso indirizzo; un allegato .exe | La quarta e l'allegato sono rifiutati con un messaggio chiaro |
| 4.6 | [O] Pubblica un'osservazione; su un'altra Non pubblicare scrivendo una motivazione | Ogni osservazione ha il suo numero («Osservazione n. 1»); lo staff vede nome, email, allegato e la motivazione; il Comune riceve «Nuova osservazione a cui rispondere»; il Comune e la pagina pubblica vedono solo quella pubblicata, firmata «Partecipante» |
| 4.7 | [O] + Pubblica errata corrige spuntando «Fai ripartire i 30 giorni», prima senza e poi con motivazione | Senza motivazione: errore; con motivazione: nuova chiusura a 30 giorni, visibile anche sulla pagina pubblica; notifica al Comune |
| 4.8 | [C] Rispondete all'osservazione pubblicata | Stato Risposto; la risposta compare anche sulla pagina pubblica |
| 4.9 | [O] Chiudi consultazione, chiudi la fase 3, apri e chiudi la fase 4 | Consultazione Chiusa; fasi Completate |

### 5. Fasi 5, 6 e 7 — Validazione e chiusura

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 5.1 | [O] Apri fase 5 e caricate un PDF con tipologia «Rapporto dell'Ente di Validazione» | Documento nella fase 5 |
| 5.2 | [O] Modifica scadenza della fase 5 senza motivazione, poi con motivazione | Senza motivazione: errore; con motivazione: nuova scadenza, motivazione in Audit |
| 5.3 | [O] Chiudete le fasi 5, 6 e 7 | Tutte Completate |
| 5.4 | [O] e [C] Esporta fascicolo / Scarica documentazione | ZIP con Riepilogo.pdf, documenti, cartella Validazione (rapporto dell'Ente), Consultazione con osservazioni numerate e allegati, note e messaggi; pagamenti e audit (con i nomi) solo nell'export dello staff |

### 6. Stato della pratica e Rapporto di Monitoraggio

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 6.1 | [O] Sospendi la pratica con motivazione | Notifica al Comune con la motivazione |
| 6.2 | [C] Aprite la pratica sospesa | Avviso «La pratica è sospesa…»; nessun pulsante + Carica; i Messaggi funzionano |
| 6.3 | [O] Riattiva la pratica; nella sezione Rapporti di Monitoraggio premete + Rapporto anno 1 | Nasce la pratica CWP-…-RM1 con 4 fasi (Caricamento del rapporto in corso, Verifica documentale, Validazione e verifica, Chiusura), senza consultazione |
| 6.4 | [O] Nel Rapporto aprite la fase 2 | Scadenza = oggi + 10 giorni (durata del Rapporto in Impostazioni) |
| 6.5 | [O] Chiudete la pratica (Chiudi pratica, con motivazione) | Stato Chiusa; nell'intestazione «Da conservare fino al» con la data tra 10 anni; riattivando la data sparisce |

### 7. Calcolo dei crediti (solo Amministratore)

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 7.1 | Senza accesso, aprite la pagina Formato dati e scaricate il tracciato Excel | Il file si scarica; il foglio Istruzioni spiega ogni colonna |
| 7.2 | [C] Nella pratica RM1 caricate il file di esempio «Tracciato_esempio_compilato.xlsx» (Documentazione → file di esempio) | Documento caricato |
| 7.3 | [A] Crediti CWP → + Nuovo calcolo sul Rapporto RM1, ex post, anno **2025** | Calcolo in Bozza; si apre il passo «Importa il tracciato» |
| 7.4 | [A] Dai documenti della pratica → Leggi questo file | Anteprima: 4 rifiuti, 2+1 classi, 4 righe e 3 utenze, 1 riuso; nessuna incoerenza |
| 7.5 | [A] Importa nel calcolo; controllate i passi 2, 3 e 5 | Dati compilati e salvati; «Ultimo import» con il nome del file |
| 7.6 | [A] Dal computer, importate «Tracciato_esempio_dati_personali.xlsx» | Import bloccato: elenco con foglio, riga e tipo di dato personale |
| 7.7 | [A] Dal computer, importate «Tracciato_esempio_letture.zip» | Letture sommate (U0001: 18 svuotamenti); avviso di una lettura fuori anno esclusa |
| 7.8 | [A] Passo 3: cambiate il nome di una classe; aprite il passo 5 | Controllo di coerenza «Classi … assenti nella delibera»; ripristinate il nome |
| 7.9 | [A] Passo 6: «Ricava dai dati importati» | Il buffer si compila dai dati |
| 7.10 | [A] Passo 7: Calcola | Crediti lordi, buffer, crediti netti (o debito), dettaglio per utenza; controlli di coerenza e riquadro «Da verificare» |
| 7.11 | [A] Scaricate riepilogo e dettaglio (CSV) e Scarica il rapporto (PDF) | I CSV si aprono con Excel; il PDF ha la scritta BOZZA su ogni pagina |
| 7.12 | [A] Passo 2: cambiate una quantità e premete Salva; poi rimettete il valore giusto, salvate e premete Calcola | Dopo il primo Salva il risultato si azzera e «Conferma calcolo» scompare; ricompare solo dopo Calcola |
| 7.13 | [A] Conferma calcolo → Conferma definitivamente | Calcolo Confermato con numero di registro CWP-REG-…; in sola lettura; il passo «Importa il tracciato» non permette più l'import |
| 7.14 | [A] Scarica il rapporto (PDF), poi Archivia il rapporto nella pratica | PDF senza BOZZA, con numero di registro e impronta; nella pratica compare il documento «Rapporto di calcolo dei crediti», non visibile al Comune |
| 7.15 | [A] Crediti CWP → Registro dei crediti | Il calcolo compare come Valido; totali per ente e anno; CSV scaricabile |
| 7.16 | [A] Nuova versione, poi Calcola e conferma la nuova versione | Nasce una bozza «(rev.)»; alla conferma riceve un nuovo numero e nel registro la riga precedente diventa «Sostituito da …» |

**File di esempio.** I tre file usati sopra si scaricano da `portale-cwp.vercel.app/documentazione/esempi/` (Tracciato_esempio_compilato.xlsx, Tracciato_esempio_letture.zip, Tracciato_esempio_dati_personali.xlsx) e contengono solo dati inventati, con anno 2025. Per prove proprie usate sempre codici anonimi (U0001, U0002…), mai dati reali di persone.

### 8. Prove trasversali

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 8.1 | Campanella in alto con ciascuna utenza | Le notifiche degli eventi provati, per il ruolo giusto |
| 8.2 | Email di notifica | Oggi arrivano solo all'indirizzo del titolare del servizio email (limite noto) |
| 8.3 | [C] Esci, poi «Password dimenticata?» | Email «Richiesta di reimpostazione della password»; il pulsante apre la pagina Nuova password |
| 8.4 | [A] Utenti → Reimposta password del Cliente | Al successivo accesso il Cliente deve scegliere una nuova password e, finché non lo fa, non vede alcun dato |
| 8.5 | [A] Disattivate il Cliente e provate ad accedere con lui | Non vede più alcun dato; riattivatelo |
| 8.6 | [O] Cercate le pagine Utenti, Audit, Crediti CWP; provate anche a scrivere l'indirizzo (es. /utenti) | Non compaiono nel menu dell'Operatore e i loro dati non sono accessibili |
| 8.7 | [C] Controllate menu e pratiche visibili | Menu: Le mie pratiche, I tuoi documenti, Formato dati, Manuale; solo le pratiche del proprio Comune |
| 8.8 | [A] Audit: cercate il codice della pratica di prova | Tutte le operazioni fatte, con autore, data e motivazione |
| 8.9 | [A] Cruscotto: provate riquadri, filtri e ricerca | La tabella si filtra di conseguenza |

## Limiti noti e funzioni in arrivo

**Limiti noti oggi (non sono errori da segnalare).**

- Le email (notifiche e conferme della consultazione) arrivano solo all'indirizzo del titolare del servizio email finché il dominio della Fondazione non è verificato.
- La verifica in due passaggi per lo staff è pronta ma spenta.
- Non c'è ancora l'antivirus sui file caricati.

**In sviluppo** (saranno aggiunti al percorso di prova quando disponibili): regole del registro dei crediti previste dallo Standard CWP; registro di sicurezza; antivirus.
