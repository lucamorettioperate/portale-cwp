<!--
  Manuale Amministratore — testo sorgente.
  Da questo file si generano Word e PDF:  node strumenti/genera_documenti.cjs amministratore
  Il registro delle revisioni è in strumenti/revisioni_documenti.json ("amministratore"):
  a ogni modifica aggiungere una revisione (numero, data, descrizione).
  Lo stesso testo è nel manuale online (Claude Doc "Manuale Amministratore").
  Documento riservato agli Amministratori: si scarica solo dall'area Documentazione.
-->

## Introduzione e ruoli

Questo manuale descrive tutte le funzioni del portale che riguardano **Fondazione Operate**: la gestione delle pratiche dei Comuni (back-office), l'amministrazione del portale, il **calcolo dei crediti CWP** e la gestione dei **crediti emessi**. È riservato agli **Amministratori**. Il manuale per i Comuni è il *Manuale Utente*; l'architettura tecnica è descritta nel *Registro sviluppo e deploy*.

Il portale usa i nomi dei documenti ufficiali del Programma (Guida al Programma, Standard CWP, Schema tariffario, Politica di reclamo, Gestione della qualità dei dati, v1.2): la Fondazione è il **promotore del programma**, il Comune (o chi presenta il progetto) è il **promotore del progetto**, RINA è l'**ente di validazione e verifica**.

Nel portale la Fondazione lavora con due ruoli:

| Cosa | Operatore di back-office | Amministratore |
| --- | --- | --- |
| Dashboard, pratiche, fasi, scadenze | sì | sì |
| Documenti, integrazioni, feedback pubblico, pagamenti | sì | sì |
| Export del fascicolo | sì | sì |
| Anagrafiche (Organizzazioni, Enti di Validazione, Registri) | sì | sì |
| Crediti emessi: caricamento sul registro, vendite, cancellazioni | sì | sì |
| Emissione dei crediti | — | sì |
| Reclami e richieste di chiarimento | sì | sì |
| Gestione utenti | — | sì |
| Audit trail | — | sì |
| Impostazioni (pagina pubblica del Programma, metodologie, durata delle fasi, documenti richiesti, modelli) | — | sì |
| Calcolo dei crediti CWP | — | sì |

Gli **Amministratori** possono essere più di uno e hanno tutti accesso completo a tutti i dati. Un Amministratore può nominare altri Amministratori (capitolo «Gestione utenti»). L'**Amministratore principale** è luca.moretti@operate.it: nessuno lo può modificare, disattivare o cancellare.
| Documentazione (Registro e questo manuale) | — | sì |

L'**Ente di Validazione** (RINA) non ha un accesso al portale: i suoi rapporti vengono caricati dall'Operatore nella pratica.

**Regole generali.**

- **Ogni azione importante è registrata** nell'audit trail, con autore, data e ora, stato prima e dopo. Il registro non si può modificare.
- **Le azioni eccezionali richiedono una motivazione**: cambio di stato della pratica (compresi ritiro e rientro), modifica di una scadenza, verifica sull'accuratezza e accertamenti, chiusura di un'integrazione senza risposta, modifica della durata delle fasi. La motivazione finisce nell'audit.
- **I documenti non si sovrascrivono mai**: ogni caricamento crea una nuova versione e le precedenti restano consultabili.
- **Nulla si cancella**: tutti i dati delle pratiche si conservano per 12 anni (Guida al Programma 6.2.1 e 6.5.1).
- **Un calcolo dei crediti confermato non si modifica più**: le correzioni si fanno con una nuova versione.

## Accesso, profilo e verifica in due passaggi

Si accede da [portale-cwp.vercel.app](https://portale-cwp.vercel.app) con **Email** e **Password**, poi **Accedi**. In alto compaiono il menu del proprio ruolo, la campanella delle notifiche, l'indicazione *Operatore* o *Admin*, l'email (sotto c'è scritto **Il mio profilo**) ed **Esci**.

| Ruolo | Voci di menu |
| --- | --- |
| Operatore | Dashboard, Pratiche, Anagrafiche, Crediti emessi, Reclami, Manuale |
| Amministratore | Dashboard, Pratiche, Utenti, Audit, Anagrafiche, Calcolo crediti, Crediti emessi, Reclami, Impostazioni, Documentazione |

**Ordinare tabelle ed elenchi.** Ogni tabella del portale si ordina per qualsiasi colonna: fate clic sull'intestazione per l'ordine crescente (freccia ▲) e di nuovo per il decrescente (▼); le colonne non ordinate mostrano ↕. Vale per Dashboard, Audit, Calcolo crediti, Registro dei crediti, Simulatore (scenari, risultati, costi e parte economica) e per le tabelle del calcolo. Gli elenchi a schede (Pratiche, Utenti, Organizzazioni, Enti di Validazione, Registri, Reclami, Crediti emessi, documenti, pagamenti e Rapporti di una pratica) hanno in alto il menu **Ordina per** con il pulsante ▲/▼ del verso; «ordine predefinito» torna all'ordine iniziale. I valori vuoti restano sempre in fondo. Le tabelle in cui si inseriscono i dati anno per anno restano in ordine di anno.

**Il mio profilo.** Facendo clic sulla propria email si apre la pagina con i dati dell'account, il pulsante **Cambia password** e i documenti da scaricare (per l'Amministratore: Manuale Utente, Manuale Amministratore e Registro sviluppo e deploy).

**Password.** Al primo accesso il portale chiede di sostituire la password temporanea. La password si cambia da **Il mio profilo → Cambia password**; se è stata dimenticata si usa **Password dimenticata?** nella pagina di accesso: arriva un'email «Portale Carbon WastePrint (CWP) — Richiesta di reimpostazione della password» con il pulsante **Scegli una nuova password →**.

**Verifica in due passaggi (MFA).** Quando è attiva, dopo la password Operatori e Amministratori inseriscono un codice dall'app di autenticazione del telefono. Oggi è **spenta** per decisione della Fondazione; quando verrà accesa la procedura sarà questa.

*Primo accesso (attivazione):*

1. Installate sul telefono un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy).
2. Nell'app scegliete **Aggiungi account** e inquadrate il QR code mostrato dalla schermata **Verifica a due fattori**. Se non riuscite, aprite *Non riesci a inquadrare il codice?* e digitate la chiave a mano.
3. Scrivete nel campo **Codice a 6 cifre** il codice che compare nell'app e premete **Attiva e accedi**.

*Accessi successivi:* dopo la password inserite il codice a 6 cifre e premete **Accedi**. Con l'errore «Codice non valido o scaduto» attendete il codice successivo dell'app e riprovate. Se perdete il telefono vedete il capitolo «Manutenzione ed emergenze».

## Dashboard

La **Dashboard** è la pagina iniziale dello staff: mostra in un'unica tabella tutte le pratiche, Progetti e Rapporti, con l'avanzamento, la fase corrente, la scadenza e ciò che c'è da fare.

**Barra di avanzamento a LED.** La colonna **Avanzamento** mostra per ogni pratica (quindi per ogni Comune) una barra di 7 luci, una per fase. Le fasi **completate sono accese** (ambra), quelle **ancora da fare sono spente**. La **settima luce**, la Chiusura, si accende in **verde**. La fase in corso è spenta ma ha un contorno ambra, così si vede subito dove è arrivata la pratica. Accanto c'è il conteggio, ad esempio «4/7». Passando il mouse su una luce compaiono numero, nome e stato della fase.

**Riquadri in alto.** Ogni riquadro conta le pratiche e, se cliccato, filtra la tabella. Si clicca di nuovo per togliere il filtro.

| Riquadro | Cosa conta |
| --- | --- |
| Pratiche in corso | Pratiche attive |
| In scadenza (≤ 7 gg) | Fase aperta che scade entro 7 giorni (numero in arancione) |
| Scadute | Fase aperta con scadenza passata (numero in rosso) |
| In attesa del Cliente | Integrazioni richieste e senza risposta |
| Integrazioni da verificare | Integrazioni con risposta del Cliente da chiudere |
| Feedback pubblico aperti | Periodi di feedback pubblico aperti, di Progetti e Rapporti |

**Ricerca e filtri.** Il campo «Cerca organizzazione, codice o progetto…» e i filtri per stato, tipo (Progetti, Rapporti), anno di monitoraggio e fase. **Azzera filtri** li toglie tutti.

**Tabella.** Colonne Pratica, Organizzazione, Stato, Fase corrente, Scadenza (con «scaduta da N gg», «scade oggi», «tra N gg») e **Da fare** (integrazioni da verificare, in attesa del Cliente, feedback pubblico in corso). Fate clic su una riga per aprire la pratica.

La *fase corrente* è l'ultima aperta; se nessuna è aperta, la prima non iniziata.

## Pratiche: Progetti e Rapporti di monitoraggio

La pagina **Pratiche** elenca a sinistra i Progetti (con più di 4 progetti compare il campo **Cerca…**) e mostra a destra il dettaglio di quello selezionato.

**Creare un Progetto**

1. Premete **+ Nuovo progetto**.
2. Scegliete l'ente: **Organizzazione esistente** dal menu, oppure **Nuova** indicando **Denominazione** (es. Comune di …) e **Tipo** (es. Ente locale, Soggetto gestore).
3. **Codice pratica**: lasciatelo vuoto per avere il codice automatico `CWP-AAAA-NNNN`.
4. **Titolo**: una descrizione breve.
5. **Territorio: codici ISTAT dei Comuni (6 cifre)**, separati da virgola (es. `041044, 041001`).
6. **Periodo di riferimento**: *10 anni (una volta)* oppure *7 anni rinnovabili 3 volte* (Standard 4.3.8).
7. **Popolazione residente** e **Crediti previsti nel periodo**: servono per le tariffe dello Schema tariffario (capitolo «Pagamenti»); si possono completare dopo.
8. Premete **Crea progetto**.

Vengono create le 7 fasi: la 1 (Adesione) già *In corso*, le altre *Non iniziata*.

**Un solo progetto per territorio.** Un Comune (codice ISTAT) può stare in un solo Progetto non annullato né ritirato (Standard 4.6). Se il codice è già usato il portale rifiuta il salvataggio con il messaggio «Il territorio con codice ISTAT … è già nel Progetto …»; se il codice non ha 6 cifre compare «Codice ISTAT non valido: ogni Comune ha un codice di 6 cifre».

**Intestazione della pratica.** In alto compaiono l'**ID progetto** (o **ID rapporto**): `CWP-…`, cioè l'ID univoco assegnato dalla Fondazione (Guida 6.2.1), l'organizzazione, lo stato della pratica e lo **stato nel Programma** («Nel Programma: …»), con i nomi della Guida (Tabelle 3 e 4):

| Nel Programma | Quando |
| --- | --- |
| richiesta di registrazione (per il Rapporto: richiesta di registrazione del rapporto) | fino al completamento della fase 2 |
| in fase di validazione | fase 2 completata |
| in fase di verifica documentale | fase 5 completata |
| progetto registrato (per il Rapporto: rapporto registrato e crediti registrati) | fase 6 completata |
| progetto ritirato | Progetto ritirato |
| non registrato (pratica annullata) | pratica annullata |

**Dati del Progetto e del Rapporto.** Sotto l'intestazione un riquadro riporta: **Territorio (codici ISTAT)**, **Co-promotori** (gli altri soggetti promotori, Guida 3.3.1), **Periodo di riferimento**, **Popolazione residente**, **Crediti previsti nel periodo** (Progetto) o **Crediti previsti nell'anno** (Rapporto) e, dopo la chiusura della fase 6, la data di registrazione (**Registrato il** per il Progetto, che è la sua data di inizio secondo lo Standard 4.5; **Crediti registrati il** per il Rapporto). Il Comune li vede in sola lettura.

Per cambiarli:

1. Premete **Modifica i dati**.
2. Per un Progetto correggete **Codici ISTAT dei Comuni (6 cifre)**, **Periodo di riferimento**, **Popolazione residente**, **Crediti previsti nel periodo** e **Altri soggetti promotori del progetto** (uno per riga); per un Rapporto popolazione e crediti previsti nell'anno.
3. Se serve scrivete la **Motivazione** (facoltativa, finisce nell'audit), ad esempio «dati del Modulo di descrizione del progetto».
4. Premete **Salva i dati**.

Il periodo di riferimento vale anche per i Rapporti del Progetto. Non si può passare a un periodo che ammette meno Rapporti di quelli già creati.

**Creare un Rapporto di Monitoraggio annuale**

1. Aprite il Progetto (deve essere *Attivo*).
2. Nella sezione **Rapporti di Monitoraggio (N/10)** (oppure **N/21** con il periodo di 7 anni rinnovabili) premete **+ Rapporto anno N**.
3. Il Rapporto nasce con codice `<codice progetto>-RMN`, eredita l'ente e il periodo di riferimento e si apre subito.

I Rapporti si creano in ordine (l'anno N richiede l'anno N−1), fino a 10 con il periodo di 10 anni o fino a 21 con 7 anni rinnovabili 3 volte, in qualsiasi momento mentre il Progetto è attivo. Un Progetto ritirato o annullato non può avere nuovi Rapporti. Ogni Rapporto ha documenti, pagamenti e crediti propri e lo stesso percorso di **7 fasi** del Progetto, con il feedback pubblico (Guida 6.3.1 e Tabella 4):

| Fase del Rapporto | Durata iniziale (giorni) | Responsabile |
| --- | --- | --- |
| 1. Registrazione del rapporto | avvio (già *In corso*) | Promotore del progetto |
| 2. Prima verifica documentale | 10 | Promotore del programma |
| 3. Feedback pubblico | 20 | Promotore del programma |
| 4. Risposta ai commenti | 15 | Promotore del progetto |
| 5. Verifica del rapporto | 60 | Ente di validazione e verifica |
| 6. Seconda verifica documentale | 10 | Promotore del programma |
| 7. Chiusura | 0 | Promotore del programma |

Le durate si cambiano in Impostazioni. Per tornare al Progetto: **← Torna al Progetto**. Nei Rapporti creati prima del 18/10/2026 con 4 fasi, le fasi nuove sono state aggiunte: se il Rapporto era già più avanti risultano *Completate* con una nota che spiega che non sono state svolte.

**Progetti senza Rapporti.** Se un Progetto registrato da almeno 2 anni non ha alcun Rapporto, lo staff riceve l'avviso «Progetto senza Rapporti da 2 anni»: chiedete al Comune una prova di attività entro 20 giorni (Guida 6.4.1) e caricatela con tipologia *Prova di attività del progetto*.

**Utenti del Comune.** Perché il Comune veda la pratica, il suo rappresentante deve essere associato all'organizzazione (capitolo «Gestione utenti»).

## Gestire le fasi e lo stato della pratica

Le azioni sulle fasi compaiono nella scheda di ciascuna fase, **solo se la pratica è attiva**. Ogni fase indica il proprio **Responsabile** (promotore del progetto, promotore del programma o ente di validazione e verifica). Le fasi si possono aprire in qualsiasi ordine e la chiusura di una fase non apre automaticamente la successiva.

| Azione | Quando | Cosa succede |
| --- | --- | --- |
| **Apri fase** | Fase *Non iniziata* | Apertura oggi; scadenza = oggi + durata della fase (Impostazioni). Il Comune riceve la notifica |
| **Chiudi fase** | Fase aperta | La fase diventa *Completata*. Con integrazioni ancora aperte serve la motivazione e il pulsante è **Chiudi comunque** |
| **Richiedi integrazione** | Fase aperta | Vedi il capitolo «Richieste di integrazione» |
| **Modifica scadenza** | Fase aperta | Nuova data e **Motivazione (obbligatoria)**, poi **Salva scadenza** |
| **Verifica sull'accuratezza (+15 gg)** | Fasi 2 e 6 aperte, una volta | Aggiunge 15 giorni alla scadenza (Guida 6.5.2) |
| **Ulteriore accertamento (+10 gg)** | Fasi 2 e 6, dopo la verifica sull'accuratezza, fino a 3 volte | Aggiunge 10 giorni alla scadenza |

**Verifica sull'accuratezza e accertamenti.** Nelle due verifiche documentali (fasi 2 e 6), se ci sono dubbi sui dati presentati, premete **Verifica sull'accuratezza (+15 gg)**, scrivete la **Motivazione / rilievi (obbligatoria)** e premete **Avvia la verifica**. Dopo la verifica potete registrare fino a 3 accertamenti con **Ulteriore accertamento (+10 gg)** e **Registra l'accertamento**. La fase mostra «Verifica sull'accuratezza avviata · accertamenti: N di 3» e il Comune riceve una notifica con la nuova scadenza. Dopo il terzo accertamento, se le revisioni non sono soddisfacenti, la richiesta non è accettata e si può ripresentare dopo 6 mesi.

**Attività sospese per fatture scadute.** Se la pratica ha una voce di pagamento scaduta e non pagata, il portale non apre nuove fasi e risponde «Attività sospese fino al saldo: c'è una fattura scaduta non pagata (Schema tariffario)». Registrate l'incasso per proseguire (capitolo «Pagamenti»).

**Iscrizione prima della fase 5.** La fase 5 (validazione del Progetto o verifica del Rapporto) non si apre finché la voce *Tariffa di iscrizione* della pratica non è pagata (Guida 6.2.1 e 6.3.1).

**Note di fase.** Sotto ogni fase, **+ Aggiungi nota** apre un campo di testo. Senza spunta la nota è **interna** (la vede solo la Fondazione, bordo arancione); con la spunta **Visibile al Comune** la nota è **condivisa** (bordo verde) e il Comune riceve la notifica «Nuova nota della Fondazione». Le note non si modificano né si cancellano e finiscono nell'audit: per correggere, aggiungete una nuova nota.

**Documenti richiesti.** Se in Impostazioni sono indicati i documenti richiesti per una fase (il portale ha già quelli della Guida, capitolo «Impostazioni»), la fase mostra l'elenco con **✓ presente** o **○ manca** (un documento conta se ha quella tipologia). È solo un promemoria: la fase si chiude comunque.

**Ente di Validazione della pratica.** Nell'intestazione della pratica, accanto a «Ente di validazione e verifica», premete **Assegna** (o **Cambia**), scegliete l'ente e premete **Salva**. L'elenco degli enti si gestisce nella pagina **Anagrafiche** (capitolo «Anagrafiche»). Il Comune vede il nome dell'ente assegnato. L'assegnazione è registrata nell'audit.

**Nuove versioni durante una fase.** Se il Comune carica una nuova versione di un documento mentre la fase è aperta, la scadenza **non riparte** (decisione della Fondazione del 18/10/2026). Se serve più tempo si usa **Modifica scadenza** con la motivazione.

**Cambiare lo stato della pratica.** I pulsanti sono nell'intestazione della pratica:

| Stato attuale | Pulsanti |
| --- | --- |
| Attiva | Sospendi (anche per controllo di qualità), Annulla, Chiudi pratica, Ritira il progetto (solo Progetti) |
| Sospesa | Riattiva, Annulla, Chiudi pratica, Ritira il progetto (solo Progetti) |
| Chiusa | Riattiva, Ritira il progetto (solo Progetti) |
| Ritirato | Rientro nel Programma |
| Annullata | nessuno: l'annullamento è definitivo |

1. Premete il pulsante desiderato.
2. Scrivete la **Motivazione (obbligatoria)**, almeno 3 caratteri.
3. Premete **Conferma**.

Il Comune riceve la notifica con la motivazione, che resta visibile nell'intestazione della pratica. Con la pratica sospesa, annullata, chiusa o ritirata il Comune vede un avviso che lo spiega, non ha il pulsante **+ Carica** e non può rispondere alle integrazioni; può sempre scrivere nella sezione Messaggi (non sulle pratiche annullate). La pratica chiusa la chiude sempre lo staff: completare la fase finale non la chiude da sola.

**Sospensione e controllo di qualità.** La sospensione si usa anche per il controllo di qualità della Guida 6.4.2: con il Rapporto o il Progetto sospeso non si possono emettere crediti.

**Ritiro e rientro del Progetto (Guida 6.4.1).** Il ritiro riguarda solo i Progetti, non i singoli Rapporti, e si fa su lettera di tutti i promotori del progetto (nome, ID, motivo), che si può caricare con tipologia *Richiesta di ritiro o di rientro del progetto*.

1. Premete **Ritira il progetto**.
2. Nella **Motivazione** indicate gli estremi della lettera.
3. Premete **Conferma**: la pratica diventa *Ritirato* e il Comune riceve la notifica «Progetto ritirato dal Programma».

Il Progetto ritirato resta sulla pagina pubblica del Programma, ma non emette più crediti né può avere nuovi Rapporti, e non occupa più il suo territorio. Da *Ritirato* si può solo rientrare, con una nuova lettera: **Rientro nel Programma** riporta la pratica ad *Attiva* e il Comune riceve «Progetto rientrato nel Programma». Se nel frattempo lo stesso territorio è entrato in un altro Progetto, il rientro viene rifiutato.

**Conservazione per 12 anni.** Nulla si cancella dal portale: pratiche, fasi, documenti, feedback pubblici, pagamenti, crediti e anagrafiche restano. Quando una pratica viene chiusa, annullata o ritirata, l'intestazione riporta **Da conservare fino al** (12 anni dopo, Guida 6.2.1 e 6.5.1); se la pratica viene riattivata la data sparisce. Le date già calcolate con i vecchi 10 anni sono state prolungate di 2 anni.

## Documenti e visibilità

I documenti stanno in **Documenti della fase** (dentro ogni fase) o in **Documenti generali** (in fondo alla pratica: documentazione amministrativa, deleghe, comunicazioni).

**Caricare un documento**

1. Premete **+ Carica**.
2. Scegliete la **tipologia** dall'elenco (i nomi ufficiali della Guida al Programma, vedi sotto).
3. Impostate la visibilità: **Visibile al Cliente** (spuntato di norma) e **Pubblico** (non spuntato di norma).
4. Premete **Scegli il file** e selezionatelo.

Formati ammessi: PDF (anche .p7m), Word, Excel, OpenDocument, RTF, CSV, TXT, JPG, PNG, ZIP, fino a 50 MB. Il portale controlla anche il contenuto reale del file.

**Tipologie di documento.** L'elenco propone le tipologie ufficiali:

- *documenti del Progetto*: Modulo di descrizione del progetto; Modulo di descrizione del progetto – versione privata; Documento di proprietà del progetto; Contratto con l'ente di validazione e verifica; Documento riassuntivo delle risultanze del periodo di feedback pubblico; Rapporto di validazione;
- *documenti del Rapporto*: Modulo di descrizione del rapporto di monitoraggio; Rapporto di verifica; Dichiarazione relativa all'effettività della generazione dei crediti;
- *moduli e comunicazioni*: Modulo di delega di rappresentanza; Modulo di adesione a un progetto; Modulo di recesso da un progetto; Richiesta di ritiro o di rientro del progetto; Prova di attività del progetto; Comunicazione di vendita dei crediti; Dichiarazione di cancellazione tombale dei crediti;
- *documenti di lavoro*: Documentazione amministrativa; Rapporto di calcolo dei crediti; Integrazione; Altro.

I documenti caricati prima con le vecchie tipologie le conservano.

**Documenti riservati.** Il *Contratto con l'ente di validazione e verifica* (Guida 7.3) e il *Modulo di descrizione del progetto – versione privata* (Guida 7.1) **non possono mai essere pubblici**: la casella **Pubblico** è disattivata (sulla riga compare «Pubblico (non ammesso)») e il portale rifiuta comunque la pubblicazione. Non compaiono mai sulla pagina pubblica del Programma.

**Versioni.** Un file con lo stesso nome nella stessa pratica diventa la nuova versione (v2, v3…); le precedenti restano consultabili. Per ogni documento lo staff vede anche l'impronta *hash* che ne garantisce l'integrità e l'etichetta *solo Fondazione* se non è visibile al Cliente.

**Cambiare la visibilità.** Le caselle **Cliente** e **Pubblico** su ogni riga si possono cambiare in qualsiasi momento, tranne per il documento in feedback pubblico attivo (vedi «Feedback pubblico») e per i documenti riservati; la modifica è registrata nell'audit. I documenti pubblici delle pratiche compaiono sulla pagina pubblica del Programma. I rapporti di RINA vanno caricati con tipologia *Rapporto di validazione* (Progetto) o *Rapporto di verifica* (Rapporto): nel fascicolo esportato finiscono nella cartella *Validazione*.

**Caricamenti del Comune.** Il Comune carica documenti solo nelle fasi aperte (*In corso* o *In attesa di integrazione*) e tra i documenti generali; in una fase completata o non ancora aperta il pulsante **+ Carica** non compare. Se la fase ha documenti richiesti, il Comune sceglie anche quale sta caricando.

## Richieste di integrazione

Una richiesta di integrazione chiede al Comune un documento o un chiarimento durante una fase aperta.

1. Nella fase premete **Richiedi integrazione**.
2. Descrivete nel campo **Cosa deve integrare il Cliente** cosa serve (es. «manca la delibera tariffaria 2025 firmata»).
3. Premete **Invia richiesta**. La fase passa a *In attesa di integrazione* e il Comune riceve la notifica.
4. Quando il Comune risponde ricevete la notifica «Il Cliente ha risposto a una richiesta di integrazione»; la richiesta diventa *Risposta ricevuta* e mostra documento ed eventuale nota.
5. Verificate il documento e premete **Accetta e chiudi**.

Se il Comune non risponde potete premere **Chiudi senza risposta**, scrivere la motivazione e confermare con **Conferma chiusura**.

Quando non restano richieste aperte la fase torna *In corso*. Nella Dashboard i riquadri *In attesa del Cliente* e *Integrazioni da verificare* mostrano le richieste da seguire.

## Feedback pubblico

Il **feedback pubblico** (Guida 3.9; prima nel portale si chiamava «consultazione pubblica») è la fase 3 sia dei Progetti sia dei Rapporti di Monitoraggio. Dura quanto la fase 3 in Impostazioni: di norma **30 giorni** per il Progetto e **20 giorni** per il Rapporto. Si svolge sulla **pagina pubblica** del portale (`/consultazioni`, intitolata «Feedback pubblico»), aperta a tutti senza credenziali e collegata dalla pagina di accesso e dalla pagina pubblica del Programma.

**Aprire il feedback pubblico**

1. Caricate prima il documento da sottoporre al feedback (capitolo «Documenti e visibilità»).
2. Nel riquadro **Feedback pubblico** della pratica scegliete il documento.
3. Premete **Apri il feedback pubblico**. Il periodo va da oggi a oggi più i giorni della fase 3 (date in ora italiana), il Comune riceve la notifica «Aperto il periodo di feedback pubblico» e il periodo compare nell'elenco pubblico.

Il documento scelto diventa **pubblico** e resta **bloccato** finché il feedback è attivo: non se ne possono cambiare visibilità, tipologia o fase. Per sostituirlo si usa l'errata corrige. C'è un solo feedback pubblico attivo alla volta per pratica.

Nel riquadro trovate il periodo, i giorni rimanenti, il documento e il **link alla pagina pubblica** da diffondere.

**Come arriva un'osservazione.** Sulla pagina pubblica chiunque scrive nome, email, testo e, se vuole, un allegato (PDF, JPG, PNG, DOCX o ODT, massimo 10 MB). Deve acconsentire al trattamento dei dati e può scegliere di pubblicare il proprio nome. Il portale gli invia un'email con il pulsante **Conferma e invia l'osservazione →**, valido 48 ore e una sola volta: solo dopo la conferma l'osservazione arriva alla Fondazione come *Ricevuto*, con la notifica «Nuova osservazione da moderare». Il portale limita gli invii (3 all'ora per indirizzo) e blocca i robot.

**Moderare le osservazioni.** Ogni osservazione ha un numero progressivo (**Osservazione n. 3**), lo stesso sulla pagina pubblica, per il Comune e nel fascicolo. Lo staff vede anche nome, email («email confermata»), data e ora, allegato e se l'autore ha scelto di pubblicare il nome.

| Pulsante | Effetto |
| --- | --- |
| Pubblica | L'osservazione diventa *Pubblicato*: compare sulla pagina pubblica e il Comune riceve la notifica «Nuova osservazione a cui rispondere» |
| Non pubblicare | Si apre il campo **Motivazione** (facoltativa, non pubblica); con **Conferma: non pubblicare** l'osservazione diventa *Non pubblicato*. Non viene cancellata e la motivazione resta nella pratica e nell'audit |

Sulla pagina pubblica e per il Comune l'autore compare come *Partecipante*, oppure con il nome se l'ha scelto; l'email non è mai pubblicata. Le risposte le scrive il Comune e compaiono anche sulla pagina pubblica. Nella fase 4 il Comune carica il *Documento riassuntivo delle risultanze del periodo di feedback pubblico*, anche se non ci sono state osservazioni.

**Errata corrige.** Se il documento in feedback contiene un errore:

1. Se serve, caricate il documento corretto tra i documenti della pratica.
2. Nel riquadro premete **+ Pubblica errata corrige**.
3. Descrivete la correzione in **Cosa viene corretto** e scegliete l'eventuale **Documento corretto**.
4. Decidete se spuntare **Fai ripartire i N giorni da oggi** (N = durata del feedback della pratica, 30 o 20): in questo caso la **Motivazione** è obbligatoria (decisione della Fondazione del 18/10/2026: si decide caso per caso).
5. Premete **Pubblica errata corrige**.

L'errata corrige compare nella pratica e sulla pagina pubblica, il Comune riceve la notifica e l'operazione (con l'eventuale proroga) finisce nell'audit.

**Chiudere il feedback pubblico.** Dopo la data di chiusura il portale non accetta più osservazioni, ma lo stato va chiuso a mano con **Chiudi il feedback pubblico**.

**Da sapere.** Finché il dominio della Fondazione non è verificato sul servizio email, le email di conferma arrivano solo all'indirizzo del titolare del servizio: prima di un feedback pubblico reale il dominio va verificato.

## Messaggi con il Comune

In ogni pratica la sezione **Messaggi** è la conversazione tra Fondazione e Comune su quella pratica. Scrivete nel campo «Scrivi un messaggio…» e premete **Invia**. I messaggi della Fondazione sono firmati «Fondazione Operate · nome dell'operatore». A ogni messaggio l'altra parte riceve una notifica e un'email (staff: «Nuovo messaggio dal Cliente»). I messaggi non si modificano né si cancellano e sono registrati nell'audit.

## Pagamenti

Ogni pratica ha la sezione **Pagamenti** con il riepilogo *Previsto · incassato · da incassare*. Il portale non incassa pagamenti online: la Fondazione registra le voci previste e gli incassi. Il Comune vede le stesse voci in sola lettura e riceve una notifica quando se ne aggiunge una.

**Aggiungere una voce**

1. Premete **+ Voce di pagamento**.
2. Compilate **Voce** (es. quota di adesione), **Voce dello Schema tariffario** (*Tariffa di iscrizione*, *Tariffa di registrazione*, *Emissione dei crediti*, *Vendita dei crediti* o *Altro*), **Importo (€)**, **Scadenza** e, se serve, **Riferimento / note**.
3. Premete **Salva**.

**Proporre le voci dallo Schema tariffario**

1. Premete **Proponi dallo Schema tariffario**: il portale propone le tariffe massime dello Schema tariffario v1.2 (IVA esclusa) per quella pratica, con scadenza a 30 giorni.
2. Sono già spuntate le voci che la pratica non ha ancora e che hanno un importo; una voce senza importo (manca la popolazione o mancano i crediti previsti nei dati della pratica) non si può scegliere e lo dice nella nota.
3. Premete **Aggiungi le voci scelte**. Gli importi si possono correggere dopo dalla voce (**Registra incasso**).

| Pratica | Voce proposta | Importo |
| --- | --- | --- |
| Progetto | Tariffa di iscrizione (alla richiesta di iscrizione) | 3.000 € |
| Progetto | Tariffa di registrazione (saldo ad avvenuta registrazione) | quota per popolazione + 0,15 € per credito previsto nel periodo |
| Rapporto | Tariffa di iscrizione | 1.000 € |
| Rapporto | Tariffa di registrazione (saldo) | quota per popolazione + 0,20 € per credito previsto nell'anno |
| Rapporto | Emissione dei crediti | a scaglioni sui crediti previsti nell'anno, da aggiornare con i crediti effettivamente emessi |

| Popolazione residente | Quota Progetto | Quota Rapporto |
| --- | --- | --- |
| fino a 5.000 abitanti | 1.000 € | 500 € |
| da 5.001 a 10.000 | 2.000 € | 1.000 € |
| da 10.001 a 30.000 | 4.000 € | 2.000 € |
| da 30.001 a 100.000 | 7.000 € | 4.000 € |
| oltre 100.000 | 12.000 € | 7.000 € |

**Tariffa di emissione** a scaglioni cumulativi: 1,00 € a credito fino a 1.000 crediti, 0,50 € da 1.001 a 10.000, 0,30 € oltre (ogni scaglione si paga al proprio prezzo: 2.000 crediti = 1.000 × 1,00 + 1.000 × 0,50 = 1.500 €). La voce con i crediti effettivi si aggiunge anche all'emissione (capitolo «Crediti emessi»).

**Tariffa di vendita**: il 20% del valore di vendita, ma non meno di un minimo a scaglioni cumulativi: 1,50 € a credito fino a 500, 1,75 € da 501 a 1.000, 2,00 € da 1.001 a 10.000, 2,25 € da 10.001 a 50.000, 2,50 € oltre. La voce si propone quando si registra una vendita.

**Registrare un incasso**

1. Sulla voce premete **Registra incasso**.
2. Spuntate **Pagamento registrato** e controllate la data del pagamento (di norma oggi).
3. Premete **Salva**.

Ogni voce mostra *Da pagare*, *Scaduto* o *Pagato* e la voce dello Schema tariffario. Il portale registra automaticamente chi ha inserito l'incasso, e l'operazione finisce nell'audit.

**Sospensione fino al saldo.** Con una voce scaduta e non pagata il riquadro mostra in rosso «C'è una voce scaduta non pagata: fino al saldo le attività successive sono sospese» e il portale non apre nuove fasi della pratica. Inoltre la fase 5 si apre solo con la *Tariffa di iscrizione* pagata (Guida 6.2.1 e 6.3.1). Vedi «Gestire le fasi e lo stato della pratica».

## Export del fascicolo

Il pulsante **Esporta fascicolo**, nell'intestazione della pratica, scarica tutto il fascicolo in un file ZIP (`Fascicolo_<codice>_<data>.zip`). L'avanzamento si legge sul pulsante: raccolta dati, documenti, riepiloghi, compressione.

| Contenuto | Dettaglio |
| --- | --- |
| Riepilogo.pdf | Sintesi leggibile: dati della pratica ed Ente di Validazione, fasi, documenti con impronta, integrazioni, feedback pubblici, pagamenti e storico (questi due solo per lo staff) |
| Documenti/Generali, Documenti/Fase N | Tutti i documenti, in tutte le versioni (`nome_vN`) |
| Validazione | I rapporti dell'ente (tipologie *Rapporto di validazione* e *Rapporto di verifica*) |
| Contratto del Progetto | Solo per i Rapporti: contratto e allegati del Progetto |
| pratica.csv, fasi.csv, documenti.csv | Dati della pratica (con Ente e data di conservazione), delle fasi e dei documenti, con l'impronta SHA-256 |
| integrazioni.csv | Se ci sono richieste di integrazione |
| Consultazione/ | Osservazioni del feedback pubblico, numerate e anonime, con i loro allegati, errata corrige, info.txt |
| note_di_fase.csv, messaggi.csv | Note (per il Comune solo quelle condivise) e messaggi |
| pagamenti.csv, audit.csv | Solo nell'export dello staff, con i nomi di chi ha registrato e operato |
| LEGGIMI.txt | Descrizione del contenuto |

I file CSV si aprono direttamente con Excel. Se alcuni file non si recuperano il pulsante lo segnala («N file non recuperati»). Il Comune ha lo stesso export («Scarica documentazione») senza pagamenti, audit e note interne.

## Notifiche ed email

La campanella in alto mostra le notifiche interne; le stesse arrivano anche per email.

| Lo staff riceve una notifica quando | Il Comune riceve una notifica quando |
| --- | --- |
| il Comune carica un documento | si apre o si chiude una fase |
| il Comune risponde a un'integrazione | arriva una richiesta di integrazione |
| arriva un'osservazione (email confermata) da moderare | la Fondazione carica un documento visibile al Cliente |
| una fase è vicina alla scadenza o scaduta | si apre il feedback pubblico o esce un'errata corrige |
| il Comune scrive un messaggio | la Fondazione scrive un messaggio o una nota condivisa |
| un Progetto registrato da 2 anni non ha Rapporti («Progetto senza Rapporti da 2 anni») | si aggiunge una voce di pagamento |
| una vendita di crediti è senza dichiarazione di cancellazione dopo 10 giorni | la pratica cambia stato (anche «Progetto ritirato dal Programma» e «Progetto rientrato nel Programma») |
| arriva un nuovo reclamo o una richiesta di chiarimento | si avvia la verifica sull'accuratezza o un accertamento (con la nuova scadenza) |
| | vengono emessi crediti dal Rapporto («Crediti emessi») |
| | arriva la risposta a un suo reclamo o richiesta di chiarimento |

Gli avvisi di scadenza partono ogni mattina (3 giorni prima e a scadenza superata, una sola volta); lo stesso lavoro giornaliero controlla i Progetti senza Rapporti e le dichiarazioni di cancellazione mancanti. Le email partono da «Portale CWP»; le email non partite vengono ritentate da sole ogni 15 minuti per 6 ore.

**Limite attuale.** Finché il dominio della Fondazione non è verificato sul servizio email (Resend), le email arrivano solo all'indirizzo del titolare dell'account Resend. Le notifiche interne funzionano comunque per tutti.

## Gestione utenti

La pagina **Utenti** elenca tutti gli utenti con nome, email, ruolo e organizzazioni associate.

**Un solo account cliente per Organizzazione.** Ogni Organizzazione ha al massimo **un account cliente attivo**, quello del rappresentante autorizzato (Guida 7.2). Il portale rifiuta la creazione, la modifica o la riattivazione di un secondo account attivo per la stessa Organizzazione con il messaggio «L'Organizzazione … ha già un account attivo … Disattiva quello attuale prima di attivarne un altro».

**Creare un utente**

1. Premete **+ Nuovo utente**.
2. Inserite **Email** e, facoltativo, **Nome e cognome**.
3. La **Password temporanea** è già generata; **Genera** ne crea un'altra. Se la scrivete a mano deve avere almeno 10 caratteri, con lettere e numeri.
4. Scegliete il **Ruolo**: *Cliente (comune / azienda)*, *Operatore di back-office* oppure *Amministratore*. Scegliendo Amministratore compare un promemoria: avrà accesso completo a tutti i dati e alla gestione utenti; assegnate questo ruolo solo a persone della Fondazione.
5. Per un Cliente spuntate le **Organizzazioni associate** (almeno una; la prima è la principale). Con più di 6 organizzazioni compare la ricerca.
6. Premete **Crea utente**. Se qualcosa non va a buon fine (ad esempio un'organizzazione non salvata o che ha già un account attivo), l'utente non viene creato e compare il motivo: correggete e riprovate.
7. Il portale **invia all'utente un'email** con l'indirizzo del portale, l'email di accesso e la password temporanea, ricordando che al primo accesso dovrà sceglierne una personale. La finestra dice se l'email è partita («✉ Email … inviata a …»). Se non è partita compare **⚠ Email non inviata** con il motivo: l'utente è comunque creato, e la password va comunicata a mano con un canale sicuro, ad esempio per telefono.

**Limite attuale delle email.** Finché il dominio della Fondazione non è verificato su Resend, le email partono dal mittente di prova e arrivano **solo** all'indirizzo del titolare dell'account Resend: per tutti gli altri compare «Email non inviata (Resend 403 …)». Dopo la verifica del dominio e l'impostazione del segreto `EMAIL_MITTENTE` le email arrivano a tutti.

**Cambiare il rappresentante di un'Organizzazione**

1. Ricevete il nuovo *Modulo di delega di rappresentanza* e caricatelo nella pratica.
2. In **Utenti** premete **Disattiva** sull'account del rappresentante attuale.
3. Create l'account del nuovo rappresentante con **+ Nuovo utente**, associandolo all'Organizzazione.
4. In **Anagrafiche → Organizzazioni** aggiornate **Delegato 1** (e, se cambia, **Delegato 2**).

**Modificare un utente.** **Modifica** permette di cambiare ruolo e organizzazioni. Passando a Operatore o ad Amministratore le associazioni alle organizzazioni si azzerano. Con **Modifica** si nomina Amministratore un utente esistente, o si riporta un Amministratore a Operatore.

**Eliminare un utente mai attivo.** Il pulsante **Elimina** compare solo sugli utenti che **non hanno mai operato nel portale**, cioè che non compaiono come autori di nessuna voce dell'audit trail. Basta anche il cambio della password al primo accesso perché l'utente risulti attivo. Serve, ad esempio, per un account creato per errore o con l'email sbagliata.

1. Premete **Elimina** nella riga dell'utente.
2. Leggete l'avviso e premete **Elimina definitivamente**. Con **Annulla** non succede nulla.

Si cancellano l'account, il profilo e le associazioni alle organizzazioni; nell'audit resta la voce «cancellazione profilo» con il vostro nome. L'operazione non si può annullare. Non si possono eliminare sé stessi né l'Amministratore principale. Chi ha già operato si può solo **disattivare**, così la sua storia resta nell'audit.

**Disattivare o riattivare.** Un utente **Disattivato** non vede più alcun dato ma resta nello storico. Non si può disattivare sé stessi. Si può disattivare anche un altro Amministratore. Un Cliente si riattiva solo se la sua Organizzazione non ha nel frattempo un altro account attivo.

**Password temporanea e primo accesso.** Ogni nuovo utente entra con la password temporanea: al primo accesso il portale gli chiede di sceglierne una personale e non lo lascia proseguire finché non lo fa. Finché non l'ha cambiata non vede né modifica alcun dato del portale.

**Reimpostare la password di un utente**

1. Nella riga dell'utente premete **Reimposta password**.
2. Il portale propone una password temporanea (**Genera un'altra** ne crea una diversa).
3. Premete **Conferma**: la password precedente smette di funzionare.
4. Il portale invia all'utente un'email con la nuova password temporanea e dice se è partita. Se compare **⚠ Email non inviata**, comunicate la password con un canale sicuro, ad esempio per telefono. Al primo accesso dovrà sceglierne una personale.

La reimpostazione non è possibile per gli Amministratori né per sé stessi, e viene registrata nell'audit (senza la password).

**Amministratore principale.** La riga di luca.moretti@operate.it ha il segno **Principale** e nessun pulsante: nessun Amministratore la può modificare, declassare, disattivare o cancellare. Lo impedisce il database (script 29), non solo la pagina: nemmeno dal pannello *Authentication* di Supabase si può cancellare l'account. In caso di reale necessità la protezione si toglie solo dal *SQL Editor* di Supabase, con le istruzioni in fondo allo script 29.

**Limiti.** Nessuno può cambiare il proprio ruolo né disattivare sé stesso. La password di un Amministratore non si reimposta dalla pagina Utenti: si gestisce con **Password dimenticata?** oppure da Supabase (*Authentication → Users*).

## Audit trail

La pagina **Audit** mostra il registro automatico e non modificabile di tutte le operazioni rilevanti, dalla più recente.

- Colonne: **Data e ora**, **Utente** (con il ruolo), **Operazione**, **Pratica**, **Da → A** (stato prima e dopo), **Motivazione**.
- Il campo di ricerca filtra per operazione, utente, pratica o motivazione.
- Si vedono gli ultimi 200 eventi; **Carica eventi meno recenti** ne aggiunge altri 500.

Sono registrati, tra gli altri: apertura e chiusura delle fasi, modifiche di scadenza, verifiche sull'accuratezza e accertamenti, cambi di stato della pratica (compresi ritiro e rientro), modifiche dei dati del Progetto, caricamenti di documenti con la versione, modifiche di visibilità, apertura e chiusura del feedback pubblico, moderazione delle osservazioni, richieste e chiusure di integrazione, incassi, emissioni, caricamenti sul registro, vendite e cancellazioni dei crediti, reclami, anagrafiche (organizzazioni, enti, registri), metodologie e informazioni del Programma, creazione e modifica di utenti, cambi e reimpostazioni di password, modifiche della durata delle fasi e operazioni sui calcoli dei crediti.

Il registro non si può modificare né cancellare, neppure dagli Amministratori.

## Anagrafiche: Organizzazioni, Enti di Validazione e Registri

La pagina **Anagrafiche** è aperta a Operatori e Amministratori. Nulla si cancella: le anagrafiche restano anche quando non servono più.

### Organizzazioni

Elenco dei Comuni, soggetti gestori e aziende, con la ricerca per nome, codice fiscale, partita IVA o PEC; sotto ogni organizzazione compaiono i delegati e le sue pratiche.

1. Premete **+ Nuova organizzazione** (oppure **Modifica** su una esistente).
2. Compilate **Denominazione** (obbligatoria), **Tipo**, **Codice fiscale**, **Partita IVA**, **PEC**, **Note**.
3. Dal *Modulo di delega di rappresentanza* (Guida 7.2) indicate fino a 2 persone: **Delegato 1 (rappresentante con account)** e **Delegato 2 (sostituto, senza account)**.
4. Premete **Salva**.

I **tipi** proposti sono i soggetti promotori ammessi dallo Standard CWP (4.4): Ente locale (T.U.E.L.), EGATO (Ente di governo dell'ambito), Soggetto gestore a partecipazione pubblica, Soggetto gestore delle tariffe, Soggetto gestore, Azienda, Altro. Le organizzazioni con un tipo inserito prima lo conservano.

Un'organizzazione si può creare anche al momento di creare un Progetto (**+ Nuovo progetto → Nuova**).

### Enti di Validazione

Anagrafica degli enti di validazione e verifica (ad esempio RINA). Gli enti non accedono al portale. Sotto ogni ente compaiono le pratiche a cui è assegnato. Gli enti attivi compaiono sulla pagina pubblica del Programma.

1. Premete **+ Nuovo ente**.
2. Compilate **Denominazione** (obbligatoria) e, se disponibili, **Identificativo**, **Accreditamento**, **Referente**, **Email**, **Telefono**, **Note**.
3. Premete **Salva**.

**Modifica** cambia i dati. Un ente non si cancella: togliendo **Attivo** non si può più assegnare a nuove pratiche, ma resta su quelle a cui era assegnato. L'assegnazione alle pratiche si fa dall'intestazione della pratica.

### Registri

I **registri** sono le piattaforme esterne di scambio riconosciute dal Programma (Guida 3.5, Standard cap. 6), su cui il promotore del progetto carica e vende i crediti. I registri attivi compaiono sulla pagina pubblica del Programma e si scelgono quando si caricano i crediti (capitolo «Crediti emessi»).

1. Premete **+ Nuovo registro** (oppure **Modifica** su uno esistente).
2. Compilate **Denominazione** (obbligatoria) e, se disponibili, **Sito web**, **Regolamento (riferimento)**, **PEC**, **Referente**, **Approvato il**, **Note**.
3. Spuntate **Cancellazione tombale su blockchain** se il registro la offre (sarà obbligatoria dal 1° gennaio 2028).
4. Lasciate spuntato **Attivo (nella lista pubblica)** e premete **Salva**.

Un registro non si cancella: togliendo **Attivo** non si può più scegliere e sparisce dalla pagina pubblica.

## Impostazioni

La pagina **Impostazioni** (solo Amministratori) ha sei sezioni: Il Programma (pagina pubblica), metodologie approvate, durata delle fasi del Progetto, durata delle fasi del Rapporto di Monitoraggio, documenti richiesti per fase e modelli di documento.

### Il Programma (pagina pubblica)

Le informazioni che compaiono sulla pagina pubblica del Programma (Guida 3.1 e 3.6): **Soggetto promotore del programma**, **PEC del Programma (anche per i reclami)**, **Email** e **Sito ufficiale**. Valori iniziali: soggetto promotore Fondazione Operate, gestore in esclusiva del Programma (parte commerciale e parte tecnologica, portale CWP) per conferimento dello Studio Associato Wastelab, proprietario del Programma (dal 19/10/2026); email info@carbonwasteprint.com; sito www.carbonwasteprint.com; PEC operate@pec.it (dal 19/10/2026). Tra i modelli di documento sono già pubblicati, come «Documento del Programma», gli otto documenti ufficiali v1.2 (Guida, Definizioni, Normativa, Standard, Metodologia, Politica di reclamo, Schema tariffario, Gestione della qualità dei dati), e il PDF della Metodologia è collegato alla metodologia approvata. Cambiate i campi e premete **Salva**; ogni modifica finisce nell'audit. Quando l'incarico al soggetto promotore sarà formalizzato, aggiornate il testo.

### Metodologie approvate

L'elenco delle metodologie del Programma (Guida cap. 5), pubblicato sulla pagina pubblica. È già presente la *Metodologia Carbon WastePrint®* v1.2 del 04/09/2025 (Studio Associato Wastelab e Altraleonia S.r.l., UNI EN ISO 14064-2:2019).

1. Premete **+ Metodologia** (oppure **Modifica**).
2. Compilate **Nome** (obbligatorio), **Versione**, **Data della versione**, **Sviluppatore**, **Norma di riferimento**, **Stato** (*approvata*, *in revisione* o *ritirata*) e **Descrizione**.
3. In **Documento (modello pubblico)** potete collegare il documento della metodologia, se è stato caricato tra i modelli come pubblico.
4. Premete **Salva**.

Le metodologie ritirate non compaiono sulla pagina pubblica.

### Durata delle fasi

Due tabelle, una per il **Progetto** e una per il **Rapporto di Monitoraggio**, fissano quanti giorni dura ogni fase. Quando un Operatore apre una fase, la scadenza è calcolata con questi valori; la durata della fase 3 è anche la durata del feedback pubblico.

| Fase del Progetto | Durata iniziale (giorni) | Giorni del percorso | Responsabile |
| --- | --- | --- | --- |
| 1. Adesione | avvio | 0 | Promotore del progetto |
| 2. Prima verifica documentale | 10 | 0 → 10 | Promotore del programma |
| 3. Feedback pubblico | 30 | 10 → 40 | Promotore del programma |
| 4. Risposta ai commenti / pubblicazione | 20 | 40 → 60 | Promotore del progetto |
| 5. Validazione e verifica | 75 | 60 → 135 | Ente di validazione e verifica |
| 6. Seconda verifica documentale | 15 | 135 → 150 | Promotore del programma |
| 7. Chiusura | 0 | 150 | Promotore del programma |

| Fase del Rapporto | Durata iniziale (giorni) | Giorni del percorso |
| --- | --- | --- |
| 1. Registrazione del rapporto | avvio | 0 |
| 2. Prima verifica documentale | 10 | 0 → 10 |
| 3. Feedback pubblico | 20 | 10 → 30 |
| 4. Risposta ai commenti | 15 | 30 → 45 |
| 5. Verifica del rapporto | 60 | 45 → 105 |
| 6. Seconda verifica documentale | 10 | 105 → 115 |
| 7. Chiusura | 0 | 115 |

**Modificare una durata**

1. Nella tabella giusta scrivete i nuovi giorni nella colonna **Durata (giorni)**: le colonne *Dal giorno*, *Al giorno* e la durata complessiva si aggiornano subito.
2. Scrivete la **Motivazione della modifica** (es. «delibera della Fondazione del …»).
3. Premete **Salva la modifica** (o **Salva N modifiche**).

Valori ammessi: da 0 a 365 giorni. La nuova durata vale per le fasi **aperte da quel momento**: le scadenze già fissate restano e si cambiano pratica per pratica con *Modifica scadenza*. Ogni modifica è registrata nell'audit.

### Documenti richiesti per fase

L'elenco dei documenti che ci si aspetta in ogni fase, per Progetto e Rapporto. Il portale ha già i documenti indicati dalla Guida al Programma (6.2.4, 6.3.1, Tabelle 3 e 4); l'Amministratore può toglierli o aggiungerne altri.

| Pratica | Fase | Documenti preconfigurati |
| --- | --- | --- |
| Progetto | 1 | Modulo di descrizione del progetto |
| Progetto | 3 | Contratto con l'ente di validazione e verifica (non pubblico) |
| Progetto | 4 | Documento di proprietà del progetto; Documento riassuntivo delle risultanze del periodo di feedback pubblico |
| Progetto | 5 | Rapporto di validazione |
| Rapporto | 1 | Modulo di descrizione del rapporto di monitoraggio |
| Rapporto | 3 | Contratto con l'ente di validazione e verifica (non pubblico) |
| Rapporto | 4 | Documento riassuntivo delle risultanze del periodo di feedback pubblico |
| Rapporto | 5 | Rapporto di verifica; Dichiarazione relativa all'effettività della generazione dei crediti |

1. Premete **+ Aggiungi**.
2. Scegliete **Tipo di pratica** e **Fase**.
3. Scegliete la **Tipologia del documento** oppure **Altra (scrivila)…** per una tipologia nuova (es. «Delibera tariffaria»).
4. Se serve scrivete una **Descrizione** (la vede anche il Comune) e premete **Aggiungi**.

Nella pratica la fase mostra quali documenti sono presenti e quali mancano; il Comune, caricando in quella fase, sceglie quale documento sta caricando. **Togli** disattiva una voce (si rimette con **Rimetti**). L'indicatore non blocca la chiusura della fase.

### Modelli di documento

Moduli e fac-simile che i Comuni scaricano dal portale e, se pubblici, i documenti del Programma per tutti.

1. Premete **+ Nuovo modello**.
2. Scrivete il **Titolo** (es. «Modulo di adesione») e, se serve, una **Descrizione**.
3. In **Dove compare** scegliete una fase del Progetto o del Rapporto (il modello comparirà dentro quella fase in ogni pratica di quel tipo, sotto «Modelli da scaricare») oppure **Generale** (comparirà nella pagina «I tuoi documenti» dei Comuni).
4. Spuntate **Anche sulla pagina pubblica del Programma** se il modello deve essere scaricabile da tutti, e scegliete la sezione: **Documento del Programma** (Guida, Standard, Schema tariffario, Politica di reclamo…) oppure **Modulistica**.
5. Scegliete il **File** (stessi formati e limiti dei documenti) e premete **Carica e pubblica**.

Nell'elenco, la casella **pubblico** e la scelta della sezione si cambiano anche dopo il caricamento. Per aggiornare un modello caricate la nuova versione e premete **Ritira** su quella vecchia: i file non si sovrascrivono. Un modello ritirato sparisce anche dalla pagina pubblica e si può ripubblicare con **Ripubblica**. Ogni operazione è registrata nell'audit.

## Calcolo dei crediti CWP

La voce di menu **Calcolo crediti** (prima «Crediti CWP») apre la pagina *Calcolo crediti*, che calcola i crediti di carbonio di una pratica per un anno, secondo la *Metodologia Carbon WastePrint® v1.2*. È riservata agli Amministratori. L'emissione vera e propria dei crediti si fa poi nel Rapporto (capitolo «Crediti emessi»).

### Come funziona il calcolo

Il calcolo confronta le emissioni **attese** del territorio (quelle che ci sarebbero senza il Progetto, stimate dalla produzione di rifiuti e dalla delibera tariffaria) con le emissioni **di progetto** (misurate sui conferimenti reali delle utenze). La differenza è la **variazione di impatto** (ΔI): se è negativa, il territorio ha ridotto le emissioni e genera crediti.

| Grandezza | Significato |
| --- | --- |
| EA — emissioni attese | Emissioni stimate per classe di utenza e per tipologia di rifiuto (formule 2-15) |
| EP — emissioni di progetto | Emissioni calcolate sui conferimenti misurati delle utenze (formule 19-30) |
| ΔI — variazione di impatto | EP − EA, per utenza e per il territorio (formula 31) |
| Crediti lordi | −ΔI, in tonnellate di CO₂ equivalente (formula 32) |
| Buffer | Quota di crediti trattenuta a garanzia: somma delle voci delle Tabelle 15 e 16 (più il 20% con le sole utenze virtuose), al massimo 80% |
| Crediti netti | Crediti lordi × (1 − buffer) |
| Debito | Se ΔI è positiva il territorio ha aumentato le emissioni: non ci sono crediti |

Le formule del portale sono le stesse della Metodologia e sono verificate da test automatici. La corrispondenza formula per formula è nel documento `docs/crediti-cwp.md` del repository.

**Ex post ed ex ante.** Il calcolo *Ex post* usa le letture reali della Banca Dati Utenze ed è quello che genera i crediti. Il calcolo *Ex ante* usa valori stimati e serve per le previsioni, ad esempio nel Progetto.

**Primo anno.** Se il Progetto è partito durante l'anno, indicando la data di avvio il portale riduce i valori in proporzione ai giorni (formula 1, *Coefficiente primo anno*).

### Preparare i dati

I dati arrivano dal Comune e dal soggetto gestore nel **tracciato dati standard CWP** (file Excel, versione 1.0), che ogni ente scarica dalla pagina pubblica **Formato dati** del portale. Il tracciato ha un foglio per ogni gruppo di dati.

| Foglio del tracciato | Passo del calcolo |
| --- | --- |
| 1_Anagrafica | Ripartizione PEF (passo 3) e tariffa puntuale (passo 6) |
| 2_Rifiuti | 2. Rifiuti del territorio |
| 3_Classi_domestiche, 4_Classi_non_domestiche | 3. Delibera tariffaria |
| 5_Conferimenti (totali per utenza) | 5. Banca Dati Utenze |
| 6_Letture (singole letture) | 5. Banca Dati Utenze: le letture sono sommate per utenza e tipologia |
| 7_Riuso | 5. Banca Dati Utenze (beni a riuso) |

**Protezione dei dati personali.** La Banca Dati Utenze deve contenere solo un **codice anonimo** per ogni utenza: niente nomi, codici fiscali, indirizzi, email o telefoni. Il portale controlla il file prima dell'import e lo **blocca** se trova dati personali, indicando foglio e riga (con il valore oscurato): chiedete al Comune di sostituirli con codici e di caricare di nuovo il file.

Il Comune carica il tracciato tra i documenti della sua pratica: il file Excel (.xlsx) oppure, se è molto grande, uno ZIP con i fogli salvati in CSV (es. `6_Letture.csv`).

### Importare il tracciato nel calcolo

Il primo passo del calcolo, **Importa il tracciato**, legge il file e compila in un colpo solo i passi 2, 3 e 5. Si apre da solo quando il calcolo è ancora vuoto.

1. Nel calcolo aprite **Importa il tracciato**.
2. Scegliete il file. In **Dai documenti della pratica** compaiono i file .xlsx e .zip caricati nella pratica del calcolo: premete **Leggi questo file** sulla versione giusta. In alternativa, in **Oppure dal computer** premete **Scegli il file (.xlsx o .zip)**.
3. Il portale mostra l'**anteprima**: per ogni parte (ripartizione PEF e tariffa puntuale, rifiuti, classi della delibera, Banca Dati Utenze, beni a riuso) quante righe ha trovato, le righe scartate con il motivo e i **controlli di coerenza**.
4. Togliete la spunta alle parti che non volete importare.
5. Premete **Importa nel calcolo**. Le parti spuntate **sostituiscono** quelle del calcolo e sono salvate subito. Il calcolo annota il file di origine («Ultimo import»).

**Singole letture.** Se il Comune ha compilato il foglio 6_Letture, il portale somma le letture dell'anno del calcolo per ogni utenza e tipologia: gli svuotamenti domiciliari diventano numero di svuotamenti e volume medio del contenitore; pesi e volumi alle strutture informatizzate e ai centri di raccolta si sommano. Le letture di altri anni sono escluse e il numero compare tra gli avvisi. Se sono compilati sia il foglio 5 sia il foglio 6, vale il foglio 5.

**Controlli di coerenza.** Compaiono nell'anteprima, nel passo 5 e nei risultati, divisi in *da correggere* e *da verificare*. Ad esempio: ripartizione PEF diversa da 100%, indifferenziato mancante, classi della Banca Dati che non esistono nella delibera (spesso scritte in modo diverso), utenze con classi diverse su righe diverse, più utenze nella Banca Dati che nella delibera, più di 366 svuotamenti, contenitori oltre 5.000 litri, conferimenti superiori al totale del territorio, anno dei dati diverso da quello del calcolo. Non bloccano l'import: si correggono nei passi oppure con un file nuovo del Comune.

Le singole tabelle si possono ancora importare a mano in CSV nei passi 2, 3 e 5 (**Importa CSV** e **Scarica il modello**).

### Creare un calcolo

1. Nel menu premete **Calcolo crediti**: si apre l'elenco dei calcoli (Calcolo, Pratica, Anno / tipo, Crediti netti, Stato).
2. Premete **+ Nuovo calcolo**.
3. Scegliete la **Pratica** (Progetto o Rapporto di Monitoraggio), un **Titolo** (es. «Monitoraggio 2025»), l'**Anno di riferimento** e il **Tipo di stima**: *Ex post (letture della Banca Dati Utenze)* oppure *Ex ante*.
4. Solo se è il primo anno del Progetto, compilate **Avvio del progetto (solo se nel primo anno)**.
5. Premete **Crea e apri**.

Il calcolo nasce come **Bozza**. In alto trovate i pulsanti **Salva** (diventa *Salvato* quando non ci sono modifiche), **Calcola**, **Conferma calcolo** ed **Elimina**. A sinistra c'è il menu **Passi del calcolo**.

### I sette passi

Ogni tabella ha **+ Riga**, **Importa CSV** e **Scarica il modello**; una riga si toglie con la ×. Ricordatevi di premere **Salva**: se lasciate la pagina con modifiche non salvate il browser lo segnala.

**Passo 1 — Impostazioni.** Titolo, anno, tipo di stima (*Ex post (letture reali)* o *Ex ante*), avvio del progetto se primo anno, note e fonti dei dati.

**Passo 2 — Rifiuti del territorio.** Una riga per codice EER (es. 200301 *Rifiuti urbani non differenziati*, 200108 *Rifiuti biodegradabili di cucine e mense*, 200201 *Rifiuti biodegradabili (verde)*) con tipologia, quantità **Qtot (t)** in tonnellate per anno e la spunta **Solo domestiche** quando il rifiuto è raccolto solo presso le utenze domestiche. Fonte: Catasto rifiuti ISPRA o MUD del Comune. Il modello si chiama *rifiuti_ISPRA*.

**Passo 3 — Delibera tariffaria.** Dalla delibera TARI del Comune:

- **PEF % utenze domestiche** e **PEF % utenze non domestiche**: la ripartizione dei costi del piano economico finanziario; la somma deve fare 100.
- **Classi domestiche**: per ogni classe (numero di componenti del nucleo) il **N. utenze** e il coefficiente **Kb**.
- **Classi non domestiche**: per ogni categoria (es. «1 - Musei, biblioteche, scuole») il **N. utenze**, la **Superficie (m²)** e il coefficiente **Kd**.

**Passo 4 — Fattori di emissione e pesi specifici.** La tabella è già compilata con i valori della Metodologia: **FErid(r)** in kgCO₂eq/kg dalle Tabelle 3 (USEPA WARM) e 4 (WRAP) e i pesi specifici di default della Tabella 8. Il fattore dell'indifferenziato è *Calcolato (f. 16-17)* dal portale. Un valore si cambia solo citando la fonte nelle note. Qui si trovano anche i **beni a riuso** (peso e fattore FErid(b)) e l'opzione **Tratta il riuso come riduzione di emissioni**, che resta spenta finché la Fondazione non conferma la scelta (vedi «Scelte da confermare»).

**Passo 5 — Banca Dati Utenze.** Il cuore del calcolo *ex post*. Due tabelle:

- **Conferimenti**: una riga per utenza e tipologia di rifiuto, con **codice utenza**, macrocategoria (domestica o non domestica), classe, numero di **Svuotamenti** e **Volume contenitore (L)** per la raccolta domiciliare, e i pesi o volumi conferiti presso le **strutture informatizzate** e i **centri di raccolta**.
- **Beni a riuso**: una riga per utenza e bene conferito al riuso (codice bene, quantità).

**Attenzione.** **Importa CSV (sostituisce i dati)** cancella le righe già presenti nella tabella e salva subito il nuovo contenuto. Importate sempre il file completo.

L'opzione **Calcola il peso specifico a consuntivo (formula 18), invece dei valori della Tabella 8** si usa quando il gestore ha sia pesi sia volumi misurati.

**Passo 6 — Buffer (Analisi del rischio).** Il buffer è la somma di più voci e non supera l'80%; ogni voce dipende da come il Comune misura utenze e conferimenti (per i rifiuti misurati si va dal 30% con il solo indifferenziato al 3% con tutte le frazioni principali):

- utenze e rifiuti monitorati (Tabelle 15 e 16), compilabili a mano o con **Ricava dai dati importati**, che li ricava dalla Banca Dati Utenze;
- **Misura presso Centri di Raccolta / Riuso (−2%)**;
- **Misura ingombranti, verde o indumenti fuori dai centri (−1%)**;
- **Tariffa puntuale attiva nell'anno (buffer dimezzato)**;
- **Solo le utenze che riducono la CO₂eq (le altre non pesano sul territorio)**: la scelta «utenze virtuose».

**Passo 7 — Risultati.** Premete **Calcola**.

### Leggere i risultati

Dopo **Calcola** il passo 7 mostra in evidenza **Crediti netti** e **Crediti lordi (−ΔI)** in tCO₂eq e il buffer applicato, poi le tabelle di dettaglio:

- **Territorio**: anno, coefficiente primo anno, Qtot, ripartizione P%UD e P%UnD, EA del territorio, FE dell'indifferenziato;
- **Utenze**: numero di utenze e di utenze virtuose, ΔI complessiva;
- **Crediti**: buffer (%), crediti lordi, quota buffer, crediti netti, oppure il debito;
- **Dettaglio per utenza**: utenza, macrocategoria, classe, EA, EP e ΔI.

Il riquadro **Da verificare** elenca i dati mancanti o incoerenti (ad esempio un rifiuto senza fattore di emissione o una classe senza utenze). Va letto sempre prima di confermare.

**Qualità dei dati.** Nel passo 7 il riquadro **Qualità dei dati** applica il documento *Gestione della qualità dei dati* del Programma:

1. Indicate la **Popolazione residente del territorio** e il **Cluster SOSE (Standard, Tabella 2)**, da 1 a 10 (es. «1. Poli urbani», «5. Comuni turistici montani o litoranei»).
2. Il portale calcola per ogni tipologia di rifiuto la produzione del territorio in **kg/ab/anno** e la confronta con il valore medio del cluster nella **Tabella 3** dello Standard, con lo **scostamento** in percentuale. Le righe oltre **±30%** sono in rosso.
3. Se c'è almeno uno scostamento oltre il 30%, compilate la **Motivazione degli scostamenti oltre il 30% (obbligatoria per confermare)**: senza motivazione il pulsante **Conferma definitivamente** resta disattivato.

Sotto il confronto compaiono gli indicatori, con ✓ (in regola), ! (da verificare) o – (non disponibile):

| Indicatore | Cosa controlla |
| --- | --- |
| Completezza | Utenze della Banca Dati rispetto alle utenze della delibera: in regola da 90% |
| Unicità | Righe con la stessa utenza e la stessa tipologia ripetute (si sommano: verificare che non siano duplicati) |
| Letture valide sulle letture importate | Almeno il 70% (Metodologia 8.1); il 50% è ammesso solo con penali al gestore. Non disponibile se si importano i totali annui (foglio 5): chiedete al gestore la percentuale di letture a buon fine |
| Tempestività | Anno dei dati del tracciato uguale all'anno del calcolo |

Popolazione, cluster e motivazione si salvano nei dati del calcolo: se li cambiate dopo **Calcola**, il risultato si azzera e va ricalcolato.

**Scarica il rapporto (PDF)** crea il **rapporto di calcolo**: scheda (pratica, ente, anno, tipo di stima, stato, numero di registro, file di origine dei dati e impronta SHA-256 dei dati), sintesi dei crediti, buffer voce per voce, dati di ingresso (rifiuti, delibera, fattori di emissione usati), risultati per tipologia e per classe, avvisi e controlli di coerenza, scelte interpretative applicate. Nella sezione 6, insieme ad avvisi e controlli di coerenza, il rapporto riporta anche gli **indicatori di qualità dei dati**, il **confronto con la Tabella 3** (cluster, popolazione, soglia ±30%) e la **motivazione degli scostamenti**. Il rapporto di una bozza porta la scritta «BOZZA» su ogni pagina. Il dettaglio per singola utenza non è nel rapporto, per riservatezza: resta nel CSV.

**Scarica il riepilogo (CSV)** e **Scarica il dettaglio per utenza (CSV)** esportano i risultati in file che si aprono con Excel.

### Confermare e correggere

**Prima di confermare.** Controllate che: il riquadro *Da verificare* sia vuoto o che ogni voce sia spiegata nelle note; le quantità del passo 2 coincidano con il Catasto ISPRA; la somma PEF del passo 3 faccia 100; il numero di utenze della Banca Dati sia coerente con la delibera; il buffer corrisponda a come il Comune misura davvero i conferimenti; il riquadro *Qualità dei dati* sia compilato e gli scostamenti oltre il 30% siano motivati.

1. Salvate e premete **Calcola**.
2. Premete **Conferma calcolo**: compare il riquadro «Confermare il calcolo?» con i crediti netti.
3. Premete **Conferma definitivamente** (attivo solo se gli scostamenti oltre il 30% sono motivati).

**Il risultato vale solo per i dati con cui è stato calcolato.** Se dopo «Calcola» cambiate un dato, salvate o reimportate la Banca Dati Utenze, il risultato salvato si azzera e **Conferma calcolo** scompare: premete di nuovo **Calcola**. Se alla conferma compare il messaggio che la Banca Dati salvata non corrisponde a quella usata nel calcolo, ricaricate la pagina e premete **Calcola**. I calcoli in bozza calcolati prima del 18/10/2026 vanno ricalcolati prima della conferma.

Un calcolo confermato riporta *Confermato il gg/mm/aaaa* ed è in sola lettura: dati, Banca Dati Utenze e risultato non si possono più modificare né cancellare. **Calcola** mostra di nuovo il dettaglio senza cambiare nulla.

**Numero di registro.** Alla conferma, un calcolo **ex post** riceve dal portale un numero di registro progressivo, ad esempio `CWP-REG-2026-0001`, che compare accanto a «Confermato il», nell'elenco dei calcoli e nel rapporto. Le stime ex ante non hanno numero.

**Archiviare il rapporto.** Su un calcolo confermato, **Archivia il rapporto nella pratica** salva il PDF tra i documenti generali della pratica, con tipologia *Rapporto di calcolo dei crediti* e **non visibile al Comune**: per mostrarlo al Comune spuntate «Cliente» sul documento nella pratica. Archiviandolo di nuovo nasce una nuova versione.

**Correggere un calcolo confermato.** Premete **Nuova versione**: il portale crea una bozza copia («… (rev.)») collegata all'originale, che resta intatto. Una bozza si può eliminare con **Elimina**.

Creazione, ricalcolo e conferma sono registrati nell'audit.

### Registro dei crediti

Nella pagina **Calcolo crediti** la vista **Registro dei crediti** elenca i calcoli ex post confermati, in ordine di numero di registro: pratica ed ente, anno, crediti lordi, buffer, crediti netti, data e autore della conferma, stato.

**Attenzione: è un elenco interno della Fondazione.** Il «Registro dei crediti» del portale raccoglie solo i **calcoli** confermati con il loro numero di registro (`CWP-REG-…`). Non è il **registro di scambio** esterno su cui i crediti vengono caricati e venduti (capitolo «Anagrafiche → Registri»), e non emette crediti: i crediti con ID univoco si emettono nel Rapporto (capitolo «Crediti emessi»).

- **Valido**: i crediti della riga contano nei totali.
- **Sostituito da CWP-REG-…**: il calcolo è stato corretto con una nuova versione confermata; il numero resta nel registro e non si riusa, ma i crediti non contano.

In alto compaiono il totale dei crediti netti validi e i totali per ente e anno. **Solo le righe valide** nasconde le sostituite; **Scarica il registro (CSV)** esporta tutto il registro. Fate clic su una riga per aprire il calcolo.

### Scelte da confermare

Alcuni punti della Metodologia si prestano a interpretazioni. Il portale applica le scelte qui sotto, che la Fondazione (con l'Ente di Validazione) deve confermare prima dei calcoli ufficiali.

| Punto | Scelta applicata dal portale |
| --- | --- |
| FEdes(r) | Si usa FErid(r) delle Tabelle 3 e 4; il Progetto può indicare valori diversi |
| Emissioni attese per utenza | Calcolate sulle sole tipologie di rifiuto misurate; le altre sono coperte dal buffer |
| Riuso (formule 26 e 29) | Applicate alla lettera fanno *aumentare* le emissioni quando un'utenza conferisce beni a riuso; l'opzione «Tratta il riuso come riduzione» inverte il segno, ed è spenta finché non c'è conferma |
| Buffer | Trattenuto dai crediti lordi: crediti netti = lordi × (1 − buffer) |
| Tabella 16 | Le combinazioni di rifiuti misurati non elencate ricadono nella condizione minima (30%), la più prudente |
| Trasporto (Capitolo 9) | Non calcolato a parte: i fattori della Tabella 3 lo includono già |
| Residenti / non residenti | La distinzione serve solo al buffer (Tabella 15) |

## Simulatore di scenari

Il **Simulatore** (menu *Simulatore*, per Operatori e Amministratori) stima in anticipo quanti crediti un Comune potrebbe generare in **7, 10 o 21 anni**. Serve per presentare il Programma a un Comune o per confrontare obiettivi diversi. È una **stima ex ante, non certificabile**: i crediti veri si calcolano a consuntivo, con il calcolo dei crediti e la Banca Dati Utenze.

**Creare uno scenario**

1. Menu **Simulatore** → **+ Nuovo scenario**.
2. Scegliete il Comune tra quelli censiti oppure scrivetene il nome (si possono simulare anche Comuni non ancora aderenti).
3. Date un nome allo scenario (per esempio «prudente», «obiettivo», «ambizioso»), scegliete la **durata** dal menu a tendina (7, 10 o 21 anni) e il primo anno → **Crea scenario**.

Per ogni Comune si possono creare più scenari; con **Duplica** si parte da uno esistente e si cambia solo qualche obiettivo.

**1. Impostazioni.** Nome, durata (menu a tendina 7 / 10 / 21 anni, Standard 4.3.8), primo anno, **metodo di stima dei crediti**, **buffer previsto** (quota trattenuta dai crediti lordi, Capitolo 7 della Metodologia) e note sulle ipotesi.

**Metodo di stima.** Si sceglie tra due metodi, entrambi previsti dalla formula 32 della Metodologia:

- **Bilancio del Comune (tutte le utenze insieme).** Confronta i totali del Comune con lo scenario di riferimento: le utenze che peggiorano compensano quelle che migliorano, quindi i crediti nascono solo dai rifiuti evitati in totale. È la stima più prudente.
- **Per utenza: solo utenze virtuose (con buffer).** Contano solo le utenze che producono meno del valore atteso, per i rifiuti misurati per utenza (ad esempio secco e organico con la tariffa puntuale); i debiti delle altre li copre il buffer. È il metodo delle stime dell'Allegato A dei contratti tipo EsaCom. Senza Banca Dati Utenze la differenza tra le utenze si rappresenta con la **variabilità tra utenze** (proposta 30%): è un'ipotesi, da tarare sui dati reali del gestore.

Nel riquadro sotto si indicano i **rifiuti misurati per utenza** (Tabella 16), le **utenze monitorate** (Tabella 15) e se sono attive la **tariffa puntuale**, la misura ai **centri di raccolta** (−2%) e la misura di ingombranti, verde o indumenti (−1%). Il portale mostra il **buffer secondo il Capitolo 7** con le voci che lo compongono: 20% se si contano solo le utenze virtuose, più le Tabelle 15 e 16, con la parte della Tabella 16 dimezzata dalla tariffa puntuale, al massimo 80%. **Usa questo buffer** lo applica allo scenario. Se il buffer impostato è più basso del minimo, i Risultati lo segnalano.

**Taratura.** Con il metodo per utenza si può scrivere un valore di crediti netti per abitante all'anno da riprodurre (ad esempio 0,19 di una stima già fatta) e premere **Trova la variabilità**: il portale cerca la variabilità tra utenze che porta a quel risultato con i dati dello scenario.

**2. Scenario di riferimento (Standard 4.8.1).** È la situazione «senza progetto» con cui si confrontano gli obiettivi, come nel Programma. Due modi, scelti con i pulsanti:

- **Anno con il 65% di differenziata**: l'anno in cui il Comune ha raggiunto l'obiettivo di legge (tra 64% e 66%, dati Catasto ISPRA), con popolazione e rifiuti per tipologia in tonnellate; si compilano a mano o, per gli Amministratori, si importano da un calcolo dei crediti. Se la differenziata dell'anno indicato è fuori dall'intervallo il portale lo segnala (Standard 4.8.1 e addizionalità normativa 4.9.1); se è indicato il cluster, segnala anche le tipologie che si scostano più del 30% dalla Tabella 3 (Gestione della qualità dei dati, 3.1.2);
- **Valori medi del cluster (Tabella 3)**: quando il Comune non ha un anno con il 65%, si sceglie il cluster SOSE, si indica la popolazione ISPRA 2022 e si preme **Calcola dai valori medi del cluster**.

A destra il riepilogo: produzione totale e pro capite, secco pro capite, **% di raccolta differenziata** e fattore di emissione del secco (formule 16-17). **Nel calcolo il riferimento è sempre portato alla soglia minima del 65% di differenziata**: stessa produzione totale, secco al 35%. Ogni anno i risultati si calcolano per differenza da questa soglia, e la tabella dei risultati mostra di quanti punti la differenziata supera il 65%. Se i dati inseriti hanno una percentuale diversa, un avviso lo segnala; un altro avviso compare se la produzione pro capite è fuori scala (unità di misura sbagliata).

**Situazione attuale (facoltativa).** L'ultimo anno con dati disponibili (popolazione, produzione pro capite, secco pro capite): è il punto di partenza degli obiettivi e della traiettoria. I crediti si calcolano sempre rispetto allo scenario di riferimento.

**3. Obiettivi anno per anno.** Una riga per ogni anno del periodo: popolazione, **produzione totale prevista** (in tonnellate, oppure scrivendo il pro capite in kg/ab) e **secco residuo pro capite** obiettivo. Per non compilare tutto a mano, indicate gli obiettivi dell'ultimo anno (produzione pro capite e secco pro capite) e premete **Applica la traiettoria**: il portale riempie gli anni con un andamento lineare dalla situazione attuale (o dal riferimento), poi potete correggere i singoli anni. Per ogni anno il portale ricalcola il secco in tonnellate e la **% di differenziata**.

**4. Risultati.** Si aggiornano a ogni modifica:

- crediti netti stimati nel periodo e media annua, % di differenziata dell'ultimo anno, rifiuti evitati;
- grafico dei crediti netti per anno e grafico della % di differenziata rispetto all'anno base;
- riquadro **Per abitante all'anno**: crediti netti medi per abitante, da confrontare con le stime dei contratti (Allegato A EsaCom: 0,19-0,23);
- tabella anno per anno: produzione, scenario di riferimento, rifiuti evitati, crediti lordi, buffer, crediti netti e cumulati; con il metodo per utenza anche la colonna **Bilancio del Comune**, per confronto;
- eventuali avvisi (dati mancanti, secco superiore al totale).

Premete **Salva** per conservare lo scenario: nell'elenco *Scenari per Comune* compaiono, per confrontarli, la % di differenziata finale e i crediti netti stimati di ogni scenario. **Esporta CSV** scarica la tabella (si apre con Excel), **Stampa** produce una versione da stampare o salvare in PDF.

**5. Simulazione economica: ricavi e costi per il Comune.** Il **valore del credito** (€ per credito; un credito è una tonnellata di CO₂eq) si digita **anno per anno** nella colonna «Valore» della tabella. Il portale propone **32 €**: per compilare tutti gli anni insieme indicate il valore proposto e, se volete, una variazione annua, poi premete **Applica a tutti gli anni**; correggete poi i singoli anni. Poi il simulatore chiede: **«Simulare i costi in base al Caso 1 o al Caso 2?»**. Sono le tabelle «Costi per il Soggetto Promotore» di Fondazione Operate (28/07/2026), IVA esclusa, per progetti di 10 anni:

- **Caso 1 – Progetto volontario**: il Comune o il gestore aderisce di propria iniziativa;
- **Caso 2 – Progetto obbligatorio**: il progetto arriva da un bando di gara di un Comune che ha inserito il CWP come metodo; le tariffe sono più alte.

Per ogni attività (Progetto, Rapporto di Monitoraggio, registrazione del Progetto, dei crediti del Progetto, del Rapporto e dei crediti del Rapporto) il portale calcola il costo per abitante in base alla popolazione: valori fissi fino a 5.000 abitanti e oltre 100.000, **interpolati** tra 5.000 e 20.000 e tra 20.000 e 100.000 abitanti, arrotondati per eccesso al centesimo. Il costo annuo è il costo per abitante × la popolazione, mai sotto il **minimo** né sopra il **massimo** annuo della tabella. Le voci una tantum sono già ammortizzate in 10 anni, quindi si pagano ogni anno. Una tabella mostra le sei voci con € per abitante, € all'anno e il totale annuo. Le tabelle non comprendono la validazione dell'ente. Per progetti di durata diversa da 10 anni compare un avviso: i costi vanno computati a parte.

In alternativa si può scegliere lo **Schema tariffario** (tariffe massime pubblicate) o **nessuna tariffa**.

In tutti i casi potete aggiungere il costo dell'ente di validazione (una tantum), della verifica annuale e altri costi annui. Per ogni anno compaiono crediti, valore, ricavi, partecipazione al Programma (registrazioni), consulenza (redazione di Progetto e Rapporto), ente, altri costi, costi totali, margine e cumulato; in alto ricavi, costi, margine netto con l'anno di rientro e **costo e ricavo per abitante** nel periodo. È una stima indicativa, non un piano finanziario.

> **Da sapere.** Con il Caso 1 e 154.247 abitanti il simulatore riproduce le cifre dei contratti tipo EsaCom. Il simulatore stima meno crediti per abitante dell'Allegato A del contratto EsaCom, perché lavora sui totali del Comune e non per singola utenza: il metodo di stima va allineato.

**Come stima i crediti.** Il simulatore usa le formule della Metodologia CWP v1.2 a livello di Comune:

| Grandezza | Come si calcola |
| --- | --- |
| Scenario di riferimento | Rifiuti pro capite dell'anno di riferimento (o del cluster), per tipologia, × popolazione dell'anno |
| Scenario simulato | Secco obiettivo + differenziata (totale − secco) ripartita con le proporzioni del riferimento |
| Emissioni | − Σ quantità × fattore di emissione (formule 13 e 25); per il secco la media dei fattori della differenziata (formule 16-17) |
| Crediti | Lordi = riduzione delle emissioni rispetto al riferimento; netti = lordi × (1 − buffer) |

> **Da sapere.** Con queste formule i crediti nascono dai **rifiuti evitati**, cioè prodotti in meno rispetto allo scenario di riferimento: il riquadro *Da dove vengono i crediti* indica quante tCO₂eq vale una tonnellata in meno per quel Comune. Spostare rifiuti dal secco alla differenziata alza la percentuale di raccolta differenziata ma, a parità di produzione totale, non genera crediti. Il modello semplificato va confermato dalla Fondazione.

**Conformità al modello CWP.** La stima ex ante a livello di Comune è ammessa dalla Metodologia (Capitolo 6.1, valori medi su tutte le utenze; Capitolo 6.2, emissioni di progetto ex ante «complessivamente a livello di Ente»). Il simulatore segue lo Standard per la durata (4.3.8), lo scenario di riferimento (4.8.1) e l'addizionalità (4.9.1), e la Metodologia per fattori di emissione (Tabelle 3-4), fattore del secco (formule 16-17), variazione di impatto e buffer (formule 31-32, Capitolo 7). I beni a riuso valgono zero, come chiede la Metodologia per la stima ex ante (Capitolo 6.1), e non ci sono perdite (leakage, Capitolo 6.3). Non sono considerati il primo anno parziale (formula 1) e la componente trasporto (Capitolo 9). Il calcolo per singola utenza resta quello ex post.

Ogni creazione, modifica e cancellazione di uno scenario è registrata nell'audit. I Comuni non vedono gli scenari.

## Crediti emessi

Dopo la registrazione di un Rapporto di Monitoraggio la Fondazione emette i crediti, con un **ID univoco per ogni credito** (Guida 6.3.2 e 6.3.3, Tabella 5; Standard 6.2). I crediti si seguono nel riquadro **Crediti emessi** del Rapporto e nella pagina **Crediti emessi** del menu.

**Emettere i crediti (solo Amministratori)**

L'emissione è possibile solo se il Rapporto è registrato (fase 6 *Seconda verifica documentale* completata) e se Rapporto e Progetto non sono sospesi, annullati o ritirati. Prima della registrazione il riquadro spiega che i crediti si emettono dopo la seconda verifica documentale.

1. Nel Rapporto, riquadro **Crediti emessi**, premete **+ Emetti crediti**.
2. Se c'è, scegliete il **Calcolo ex post confermato (facoltativo)** del Rapporto o del suo Progetto: il totale emesso con quel calcolo non può superare i suoi crediti netti.
3. Scrivete i **Crediti da emettere (tCO₂eq)** e, nelle **Note**, ad esempio gli estremi del Rapporto di verifica e della Dichiarazione dell'ente.
4. Lasciate spuntato **Aggiungi la voce di pagamento della tariffa di emissione** per creare la voce *Emissione dei crediti* con l'importo a scaglioni e scadenza a 30 giorni.
5. Premete **Emetti**.

Nasce un **lotto** con codice `<codice Rapporto>-L1` (poi L2, L3…) e ogni credito ha l'ID `<codice lotto>-000001`, `-000002` e così via (es. `CWP-2026-0001-RM1-L1-000001`). Il lotto mostra quantità, data di emissione e ID dal primo all'ultimo. Il Comune riceve la notifica «Crediti emessi» e vede i propri crediti in sola lettura.

**Caricare i crediti sul registro (staff)**

1. Sul lotto premete **Carica sul registro**.
2. Scegliete il **Registro scelto dal promotore** (tra i registri attivi delle Anagrafiche) e la **Data**.
3. Premete **Conferma**.

**Registrare una vendita (staff)**

Quando il registro comunica una vendita (*Comunicazione di vendita dei crediti*):

1. Caricate, se c'è, la comunicazione tra i documenti del Rapporto.
2. Sul lotto premete **Registra una vendita (N disponibili)**.
3. Compilate **Crediti venduti**, **Beneficiario**, **Obiettivo di compensazione**, **Valore di vendita (€)**, la **Data** e, facoltativa, la **Comunicazione di vendita (documento del Rapporto)**, che diventa pubblica.
4. Lasciate spuntato **Aggiungi la voce di pagamento della tariffa di vendita** per creare la voce *Vendita dei crediti* (20% del valore, con il minimo dello Schema tariffario).
5. Premete **Conferma**.

Gli ID dei crediti venduti seguono quelli già venduti; non si possono vendere più crediti di quelli del lotto, e solo dopo il caricamento sul registro.

**Registrare la cancellazione (staff)**

Il registro deve inviare la *Dichiarazione di cancellazione tombale dei crediti* entro 10 giorni dalla vendita.

1. Caricate la dichiarazione tra i documenti del Rapporto (è obbligatoria).
2. Sulla vendita premete **Registra la cancellazione**, scegliete la **Dichiarazione di cancellazione tombale** e la **Data**.
3. Premete **Conferma**: i crediti venduti passano a **ritirati** e la dichiarazione diventa pubblica.

Se dopo 10 giorni dalla vendita la dichiarazione manca, la vendita mostra in rosso «Manca la dichiarazione di cancellazione (attesa entro 10 giorni dalla vendita)» e lo staff riceve ogni giorno la notifica «Manca la dichiarazione di cancellazione dei crediti venduti».

**Stato dei crediti.** Ogni lotto mostra uno di questi stati, come sul registro:

| Stato | Significato |
| --- | --- |
| da caricare sul registro | Crediti emessi, non ancora caricati su un registro |
| attivi N | Crediti sul registro, disponibili e non ancora cancellati (compresi quelli venduti in attesa della dichiarazione) |
| ritirati M | Crediti venduti e cancellati con la dichiarazione di cancellazione tombale |

**Pagina Crediti emessi.** La voce di menu **Crediti emessi** (Operatori e Amministratori) elenca tutti i lotti di tutti i Rapporti, con organizzazione e anno del Rapporto, e in alto il totale dei crediti emessi, attivi e ritirati. Dalla pagina si fanno le stesse azioni dello staff (registro, vendite, cancellazioni); l'emissione si fa solo dal Rapporto. Lotti, ID e stato compaiono anche sulla pagina pubblica del Programma. Ogni operazione è registrata nell'audit.

## Reclami e richieste di chiarimento

La pagina **Reclami** (menu di tutti gli utenti) gestisce i reclami e le richieste di chiarimento secondo la *Politica di reclamo* del Programma (Guida cap. 8). Ogni invio riceve un codice automatico: `REC-AAAA-NNN` per i reclami, `CHI-AAAA-NNN` per le richieste di chiarimento.

**Cosa fa l'utente del portale.** In **Nuovo invio** sceglie il **Tipo** (*Richiesta di chiarimento* o *Reclamo*), il **Progetto** (facoltativo), scrive **Oggetto**, **Dettagli** (almeno 10 caratteri) e l'eventuale **Dichiarazione di eventuali conflitti di interesse**, poi **Invia**. Riceve il codice e segue stato e risposta in **I miei invii**.

**Cosa fa lo staff.** La pagina mostra tutti gli invii, con i filtri *aperti* (ricevuto e in esame), *ricevuto*, *in esame*, *risposto*, *chiuso* e *tutti*. Per ogni nuovo invio lo staff riceve la notifica «Nuovo reclamo …» o «Nuova richiesta di chiarimento …».

*Registrare un reclamo arrivato per PEC o email:*

1. Premete **+ Registra (PEC, email)**.
2. Compilate **Tipo**, **Canale** (pec, portale, email, altro), **Ricevuto il**, **Nome e cognome**, **Organizzazione**, **Ruolo** (promotore del progetto, ente di validazione e verifica, sviluppatore di metodologia, registro, stakeholder), **Contatti**, **Progetto**, **Oggetto**, **Dettagli** e **Conflitto di interessi dichiarato**.
3. Premete **Salva**.

*Gestire un reclamo:*

1. Sulla riga premete **Gestisci**.
2. Aggiornate **Stato** (ricevuto, in esame, risposto, chiuso), **Gestito da**, **Conferma di ricezione inviata il** e, se previsti, i **Costi addebitati (€)**.
3. Scrivete la **Risposta scritta** e, se serve, le **Note interne (riservate)**, che l'autore non vede mai.
4. Premete **Salva**. Quando si salva la risposta, la data della risposta si imposta da sola e, se l'invio è arrivato dal portale, l'autore riceve la notifica «Risposta a …».

La riga ricorda se la conferma di ricezione è ancora da inviare. Le spese di gestione di un reclamo sono a carico di chi lo presenta, che ne viene informato; non si pagano se l'azione contestata viene annullata. Ogni modifica è registrata nell'audit.

## Pagina pubblica del Programma

La pagina **Il Programma** (`/programma`) è la parte pubblica della piattaforma richiesta dalla Guida (cap. 3.7): si apre senza credenziali ed è collegata dalla pagina di accesso, dall'intestazione delle pagine pubbliche e dal menu del Comune. Mostra:

- le **informazioni del Programma**: soggetto promotore del programma, PEC, email e sito ufficiale (da *Impostazioni → Il Programma*), con il collegamento ai periodi di feedback pubblico aperti;
- gli **enti di validazione e verifica** attivi, i **registri** attivi e le **metodologie approvate** (non ritirate);
- i **documenti del Programma** e la **modulistica**: i modelli segnati come pubblici, scaricabili;
- i **Progetti** dal momento in cui sono *in fase di validazione* (anche quelli ritirati, non quelli annullati), con ID, promotore, co-promotori, territorio (codici ISTAT), periodo di riferimento, stato nel Programma, data di registrazione e documenti pubblici scaricabili; per ogni Progetto i **Rapporti** dalla fase di validazione in poi, con stato, documenti pubblici e **crediti emessi** (lotti con ID da/a, registro, crediti attivi e ritirati);
- come presentare un **reclamo o una richiesta di chiarimento** (per PEC, o dalla pagina Reclami per chi ha un account).

La pagina non mostra dati personali. Si scaricano solo i documenti segnati come pubblici, nella versione corrente; contratti con l'ente e versioni private non compaiono mai. Per far comparire o togliere un documento basta cambiare la casella **Pubblico** nella pratica o nel modello.

## Documentazione e manuali

Dalla voce **Documentazione** del menu (e da **Il mio profilo**) l'Amministratore scarica, in PDF o in Word e sempre nella revisione più recente:

| Documento | Per chi | Contenuto |
| --- | --- | --- |
| Manuale Utente | tutti i ruoli | Guida per Comuni, enti e soggetti gestori |
| Manuale Amministratore | solo Amministratori | Questo manuale: funzioni della Fondazione e calcolo dei crediti |
| Manuale Test | solo Amministratori | Guida sintetica per chi collauda il portale: metodo CWP, ruolo del portale, percorso di prova con i risultati attesi |
| Registro sviluppo e deploy | solo Amministratori | Architettura, servizi, database, codice, cronologia dei rilasci, decisioni e backlog |
| Istruzioni di ripristino | solo Amministratori | Copie di sicurezza e ripristino di GitHub, Vercel, Supabase, Resend e del progetto Claude |
| Presentazione di riepilogo | solo Amministratori | Recap del portale in slide (PDF e PowerPoint): metodologia, funzioni, novità, punti aperti, simulatore, piani a pagamento, scelte da prendere |

**Documenti ufficiali del Programma.** In fondo alla pagina Documentazione ci sono gli **8 documenti ufficiali del Programma Carbon WastePrint® versione 1.2** (04/09/2025): 0. Guida al Programma, 1. Definizioni, 2. Normativa di riferimento, 3. Standard, 4. Metodologia, 5. Politica di reclamo, 6. Schema tariffario, 7. Gestione della qualità dei dati. **Apri PDF** li apre in una nuova scheda, **Scarica** li salva. Sono gli stessi pubblicati sulla pagina pubblica del Programma e si aggiornano da Impostazioni → Modelli (categoria «programma»).

Operatori e Comuni trovano il Manuale Utente nella voce **Manuale** del menu; i Comuni anche in **I tuoi documenti**. Ogni documento riporta in copertina il numero di revisione e la data; a ogni nuova funzione si aggiornano insieme i manuali, il Registro e la Presentazione di riepilogo. Per la presentazione il secondo pulsante è **Scarica PowerPoint**.

## Assistente virtuale

In basso a destra di ogni pagina c'è il pulsante **✦ Assistente**: apre una chat con un assistente basato su **Claude** (Anthropic) che risponde alle domande sul funzionamento del portale e del Programma. Per ora è disponibile per gli **Amministratori** e per gli **utenti degli enti**.

**Cosa sa.** Risponde solo dalla sua base di conoscenza: per gli Amministratori il Manuale Utente, questo manuale, le tariffe (Schema tariffario v1.2 e costi Caso 1 e Caso 2 del 28/07/2026) e le note sul calcolo dei crediti; per gli enti il Manuale Utente e le tariffe. Se una cosa non c'è lo dice e invita a scrivere alla Fondazione. **Non vede i dati delle pratiche** e non fa operazioni: spiega dove e come farle.

**Come si usa.** Si scrive la domanda (o si sceglie un esempio) e si preme **Invio** o **Invia**; mentre l'assistente prepara la risposta compare «Un attimo…» (di solito pochi secondi); **Nuova** ricomincia la conversazione, **✕** chiude la finestra. La conversazione resta solo nella pagina: il portale non salva domande né risposte, conta solo quante domande fa ogni utente e i token usati (limite predefinito 40 domande al giorno per utente). Le risposte sono generate da un'intelligenza artificiale: in caso di dubbio vale il manuale.

**Attivazione e costi.** L'assistente è **attivo dal 19/10/2026**. Funziona con una chiave della **Claude Console** di Anthropic, che solo Luca inserisce nei segreti di Supabase (`ANTHROPIC_API_KEY`). La chiave va creata **legata a un solo spazio di lavoro** (workspace): una chiave valida per tutti gli spazi di lavoro viene rifiutata da Anthropic. L'uso si paga con i crediti dell'organizzazione della Console a cui appartiene la chiave: con un piano Claude **Max o Team** si possono collegare i **crediti API mensili** del piano a quell'organizzazione (Impostazioni → Fatturazione su claude.ai); il primo accredito può arrivare dopo qualche giorno, e nel frattempo si usano i crediti acquistati nella Console (Fatturazione), che scadono dopo un anno. I crediti mensili si consumano per primi. Se il credito finisce, l'assistente risponde con un messaggio d'errore e nulla viene addebitato al piano. Saldo e consumi si vedono nella Console. Il modello predefinito è **Claude Haiku 5.5**, il più economico: la base di conoscenza si rilegge dalla cache, quindi una domanda costa di solito meno di un centesimo di dollaro.

**Aggiornare le conoscenze.** Quando cambiano i manuali o le tariffe si rigenera la base di conoscenza (`node strumenti/genera_base_conoscenza.cjs`) e si pubblica: l'assistente la rilegge entro 10 minuti.

## Manutenzione ed emergenze

Il portale si appoggia a quattro servizi. L'architettura completa, gli script del database e la cronologia dei rilasci sono nel **Registro sviluppo e deploy**.

| Servizio | A cosa serve | Dove si gestisce |
| --- | --- | --- |
| Vercel | Pubblica il portale (portale-cwp.vercel.app) | vercel.com, progetto portale-cwp |
| Supabase | Database, utenti, documenti, funzioni automatiche | supabase.com, organizzazione Fondazione Operate, progetto portale-cwp |
| Resend | Invio delle email di notifica e di recupero password | resend.com |
| GitHub | Codice sorgente | github.com/lucamorettioperate/portale-cwp |

**Un amministratore ha perso l'app di autenticazione (MFA attiva).** Un altro amministratore, o chi ha accesso a Supabase, apre *SQL Editor* ed esegue:

```sql
update impostazione set valore = 'false' where chiave = 'mfa_obbligatoria';
```

Il back-office torna accessibile con la sola password. Dopo aver rimesso a posto l'app, si riattiva con `'true'`. Oggi la verifica in due passaggi è spenta.

**Le email non arrivano.**

- Finché il dominio non è verificato su Resend, le email arrivano solo all'indirizzo del titolare dell'account Resend.
- Verificate che in Supabase, *Edge Functions → Secrets*, ci sia `RESEND_API_KEY` e, dopo la verifica del dominio, `EMAIL_MITTENTE`.
- Le notifiche interne del portale funzionano comunque.

**Il portale non risponde dopo giorni di inattività.** Il piano gratuito di Supabase mette in pausa il progetto dopo 7 giorni senza uso: si riattiva dalla dashboard di Supabase con *Restore project*.

**Piani a pagamento.** È deciso il passaggio di Vercel e Supabase a piani a pagamento: dopo l'attivazione il database non va più in pausa, sono disponibili i backup automatici e il repository del codice tornerà privato. Questo capitolo sarà aggiornato con piani e intestatari dei contratti.

**Chiavi e password.** Le chiavi dei servizi si inseriscono solo nelle rispettive dashboard. Non vanno mai scritte in email, chat o documenti.

**Copie di sicurezza e ripristino.** Le procedure complete sono in un documento a parte, le **Istruzioni di ripristino** (pagina *Documentazione*, solo Amministratori; una copia è anche in ogni archivio di backup). Spiegano dove stanno codice e dati, quali copie fare e con che frequenza, e come rimettere in funzione GitHub, Vercel, Supabase, Resend e il progetto Claude. In sintesi:

- a ogni rilascio importante si chiede a Claude l'archivio di backup completo e lo si conserva in due posti (computer e Google Drive);
- le copie del database di Supabase non contengono i file caricati: i file si copiano a parte;
- se un rilascio rompe qualcosa, su Vercel si ripubblica la versione precedente (*Deployments* › *Promote to Production*);
- un repository GitHub cancellato si recupera entro 90 giorni da *Settings* › *Repositories* › *Deleted repositories*.

## Funzioni in arrivo

Questo manuale descrive il portale alla data della revisione indicata in copertina. Sono in sviluppo, o in attesa di passaggi esterni, e saranno aggiunte qui quando disponibili:

- **Accesso degli stakeholder con SPID, CIE o CNS** (Guida 3.9): serve l'adesione della Fondazione come fornitore di servizi (con AgID o con un aggregatore accreditato) e il relativo contratto. Intanto chi partecipa al feedback pubblico si identifica con l'email confermata.
- **Sicurezza:** registro di sicurezza (accessi e tentativi falliti), verifica in due passaggi attiva, antivirus sui file caricati, piano di protezione dagli attacchi informatici.
- **Email:** verifica del dominio, per far arrivare le notifiche a tutti gli utenti.
- **Simulatore di scenari:** la prima versione è disponibile (capitolo «Simulatore di scenari»). In arrivo: stampa in PDF impaginata e, se la Fondazione lo decide, la visione dello scenario da parte del Comune.
- **Assistente virtuale, passi successivi:** la prima versione risponde sul funzionamento del portale (capitolo «Assistente virtuale»). In arrivo: estensione agli Operatori e, con regole sulla privacy, l'aiuto sulla singola pratica (cosa manca, bozze di richieste di integrazione e di risposte, spiegazione dei risultati del calcolo). Resta un supporto: le decisioni restano alla Fondazione.
