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
| Pratiche | Progetti e Rapporti di Monitoraggio, codice automatico (CWP-AAAA-NNNN), stati attiva / sospesa / annullata / chiusa | Fondazione; il Comune consulta |
| Fasi | 7 fasi con apertura, scadenza calcolata, chiusura, modifica della scadenza con motivazione | Fondazione |
| Documenti | Caricamento con versioni (mai sovrascritte), visibilità, controllo di formato e contenuto, impronta di integrità | tutti |
| Integrazioni | Richiesta della Fondazione → risposta del Comune con documento → chiusura | tutti |
| Consultazione pubblica | Pubblicazione per 30 giorni, osservazioni, moderazione, risposte del Comune | tutti |
| Pagamenti | Voci previste e incassi registrati a mano (nessun pagamento online) | Fondazione |
| Notifiche | Campanella nel portale ed email per ogni evento importante; avvisi di scadenza | tutti |
| Cruscotto | Tutte le pratiche con fase, scadenza e cose da fare, filtri e ricerca | Fondazione |
| Export | Fascicolo completo della pratica in un file ZIP | tutti |
| Audit | Registro non modificabile di ogni operazione, con motivazione | Amministratore |
| Utenti e impostazioni | Creazione utenti, associazione ai Comuni, reimpostazione password, durata delle fasi | Amministratore |
| Calcolo crediti | Calcolo secondo la Metodologia, conferma definitiva, nuove versioni | Amministratore |
| Formato dati | Pagina pubblica con il tracciato Excel standard per i dati dei Comuni | tutti, anche senza accesso |
| Documentazione | Manuali e registro tecnico da scaricare | tutti (per ruolo) |

## Percorso di prova

Seguite le prove nell'ordine: ognuna prepara la successiva. Tra parentesi l'utenza da usare: **[A]** Amministratore, **[O]** Operatore, **[C]** Cliente.

### 1. Preparazione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 1.1 | [A] Impostazioni: cambiate la durata della fase 2 da 10 a 12 giorni con una motivazione | La durata complessiva si aggiorna; la modifica compare in Audit |
| 1.2 | [A] Pratiche → + Nuovo progetto, con una **nuova** organizzazione «Comune di Prova» | Nasce la pratica CWP-AAAA-NNNN con 7 fasi; la fase 1 è In corso |
| 1.3 | [A] Utenti → + Nuovo utente, ruolo Cliente, associato a «Comune di Prova» | L'utente compare in elenco; annotate la password temporanea |
| 1.4 | [C] Accedete con la password temporanea | Il portale chiede subito una nuova password (min. 10 caratteri, lettere e numeri) |
| 1.5 | [C] Aprite Il mio profilo e il Manuale | Dati dell'account; manuale scaricabile in PDF |

### 2. Fase 1 — Adesione

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 2.1 | [O] Nella pratica, Documenti generali → + Carica un PDF con tipologia Contratto, visibile al Cliente | Documento v1; il Comune riceve la notifica e lo vede in I tuoi documenti |
| 2.2 | [O] Caricate di nuovo lo stesso file (stesso nome) | Nasce la v2; la v1 resta consultabile |
| 2.3 | [O] Caricate un documento togliendo «Visibile al Cliente» | Il Comune non lo vede |
| 2.4 | [O] Pagamenti → + Voce di pagamento (quota di adesione, importo, scadenza), poi Registra incasso | Voce Pagato con data; operazione in Audit |
| 2.5 | [O] Chiudi fase 1 | Fase Completata; notifica al Comune |

### 3. Fase 2 — Prima verifica documentale

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 3.1 | [O] Apri fase 2 | Scadenza = oggi + 12 giorni (prova 1.1); notifica al Comune |
| 3.2 | [C] Nella fase 2 caricate un documento di progetto | Lo staff riceve la notifica «Il Cliente ha caricato un documento» |
| 3.3 | [C] Provate a caricare un file .exe, un file vuoto, un .txt rinominato in .pdf | Tutti rifiutati con un messaggio chiaro |
| 3.4 | [O] Richiedi integrazione («manca la delibera TARI») | Fase In attesa di integrazione; notifica al Comune; nel Cruscotto «In attesa del Cliente» |
| 3.5 | [C] Rispondete all'integrazione caricando un file | Richiesta «Risposta ricevuta»; notifica allo staff |
| 3.6 | [O] Accetta e chiudi, poi Chiudi fase 2 | La fase torna In corso dopo la chiusura dell'integrazione, poi Completata |

### 4. Fasi 3 e 4 — Consultazione pubblica

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 4.1 | [O] Apri fase 3; nel riquadro Consultazione pubblica scegliete il documento di progetto e Apri consultazione | Consultazione Attiva per 30 giorni; notifica al Comune |
| 4.2 | [C] Nel riquadro Consultazione pubblica scrivete un'osservazione e premete Invia | Arriva allo staff come Ricevuto, con la notifica «Nuova osservazione da moderare» |
| 4.3 | [O] Pubblica un'osservazione e Non pubblicare un'altra | Il Comune vede solo quella pubblicata, con autore «Partecipante» |
| 4.4 | [C] Rispondete all'osservazione pubblicata | Stato Risposto; lo staff vede la risposta |
| 4.5 | [O] Chiudi consultazione, chiudi la fase 3, apri e chiudi la fase 4 | Consultazione Chiusa; fasi Completate |

### 5. Fasi 5, 6 e 7 — Validazione e chiusura

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 5.1 | [O] Apri fase 5 e caricate un PDF con tipologia «Rapporto dell'Ente di Validazione» | Documento nella fase 5 |
| 5.2 | [O] Modifica scadenza della fase 5 senza motivazione, poi con motivazione | Senza motivazione: errore; con motivazione: nuova scadenza, motivazione in Audit |
| 5.3 | [O] Chiudete le fasi 5, 6 e 7 | Tutte Completate |
| 5.4 | [O] e [C] Esporta fascicolo / Scarica documentazione | ZIP con documenti e riepiloghi; pagamenti e audit solo nell'export dello staff |

### 6. Stato della pratica e Rapporto di Monitoraggio

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 6.1 | [O] Sospendi la pratica con motivazione | Notifica al Comune con la motivazione |
| 6.2 | [C] Provate a caricare un documento nella pratica sospesa | Caricamento rifiutato |
| 6.3 | [O] Riattiva la pratica; nella sezione Rapporti di Monitoraggio premete + Rapporto anno 1 | Nasce la pratica CWP-…-RM1 con le sue 7 fasi |

### 7. Calcolo dei crediti (solo Amministratore)

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 7.1 | Senza accesso, aprite la pagina Formato dati e scaricate il tracciato Excel | Il file si scarica; il foglio Istruzioni spiega ogni colonna |
| 7.2 | [A] Crediti CWP → + Nuovo calcolo sul Rapporto RM1, ex post, anno precedente | Calcolo in Bozza, con 7 passi |
| 7.3 | [A] Compilate i passi 2-6: per ogni tabella usate Scarica il modello e poi Importa CSV, oppure + Riga | Dati salvati; nel passo 6 «Ricava dai dati importati» compila il buffer |
| 7.4 | [A] Passo 7: Calcola | Crediti lordi, buffer, crediti netti (o debito), dettaglio per utenza; riquadro «Da verificare» |
| 7.5 | [A] Scaricate riepilogo e dettaglio (CSV) | I file si aprono con Excel |
| 7.6 | [A] Conferma calcolo → Conferma definitivamente | Calcolo Confermato, in sola lettura |
| 7.7 | [A] Nuova versione | Nasce una bozza «(rev.)»; l'originale non cambia |

Un esempio di dati di prova si costruisce compilando il tracciato con poche utenze inventate (codici anonimi come U001, U002…): mai dati reali di persone.

### 8. Prove trasversali

| N. | Prova | Risultato atteso |
| --- | --- | --- |
| 8.1 | Campanella in alto con ciascuna utenza | Le notifiche degli eventi provati, per il ruolo giusto |
| 8.2 | Email di notifica | Oggi arrivano solo all'indirizzo del titolare del servizio email (limite noto) |
| 8.3 | [C] Esci, poi «Password dimenticata?» | Email «Richiesta di reimpostazione della password»; il pulsante apre la pagina Nuova password |
| 8.4 | [A] Utenti → Reimposta password del Cliente | Al successivo accesso il Cliente deve scegliere una nuova password |
| 8.5 | [A] Disattivate il Cliente e provate ad accedere con lui | Non vede più alcun dato; riattivatelo |
| 8.6 | [O] Cercate le pagine Utenti, Audit, Crediti CWP; provate anche a scrivere l'indirizzo (es. /utenti) | Non compaiono nel menu dell'Operatore e i loro dati non sono accessibili |
| 8.7 | [C] Controllate menu e pratiche visibili | Menu: Le mie pratiche, I tuoi documenti, Formato dati, Manuale; solo le pratiche del proprio Comune |
| 8.8 | [A] Audit: cercate il codice della pratica di prova | Tutte le operazioni fatte, con autore, data e motivazione |
| 8.9 | [A] Cruscotto: provate riquadri, filtri e ricerca | La tabella si filtra di conseguenza |

## Limiti noti e funzioni in arrivo

**Limiti noti oggi (non sono errori da segnalare).**

- Le email arrivano solo all'indirizzo del titolare del servizio email finché il dominio della Fondazione non è verificato.
- La verifica in due passaggi per lo staff è pronta ma spenta.
- Il tracciato dati non si importa ancora direttamente nel calcolo: i fogli si importano come CSV, passo per passo.
- Non c'è ancora l'antivirus sui file caricati.

**In sviluppo** (saranno aggiunti al percorso di prova quando disponibili): note di fase, anagrafica degli Enti di Validazione, modelli di documento, messaggi tra Comune e Fondazione, pagamenti visibili al Comune, pagina pubblica della consultazione con conferma dell'email di chi commenta, errata corrige, allegati alle osservazioni; per i crediti import diretto del tracciato, controlli di coerenza, rapporto PDF e registro dei crediti.
