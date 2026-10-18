<!--
  Manuale Amministratore — testo sorgente.
  Da questo file si generano Word e PDF:  node strumenti/genera_documenti.cjs amministratore
  Il registro delle revisioni è in strumenti/revisioni_documenti.json ("amministratore"):
  a ogni modifica aggiungere una revisione (numero, data, descrizione).
  Lo stesso testo è nel manuale online (Claude Doc "Manuale Amministratore").
  Documento riservato agli Amministratori: si scarica solo dall'area Documentazione.
-->

## Introduzione e ruoli

Questo manuale descrive tutte le funzioni del portale che riguardano **Fondazione Operate**: la gestione delle pratiche dei Comuni (back-office), l'amministrazione del portale e il **calcolo dei crediti CWP**. È riservato agli **Amministratori**. Il manuale per i Comuni è il *Manuale Utente*; l'architettura tecnica è descritta nel *Registro sviluppo e deploy*.

Nel portale la Fondazione lavora con due ruoli:

| Cosa | Operatore di back-office | Amministratore |
| --- | --- | --- |
| Cruscotto, pratiche, fasi, scadenze | sì | sì |
| Documenti, integrazioni, consultazione, pagamenti | sì | sì |
| Export del fascicolo | sì | sì |
| Gestione utenti | — | sì |
| Audit trail | — | sì |
| Impostazioni (durata delle fasi, Enti di Validazione, modelli) | — | sì |
| Calcolo dei crediti CWP | — | sì |
| Documentazione (Registro e questo manuale) | — | sì |

L'**Ente di Validazione** (RINA) non ha un accesso al portale: il suo rapporto viene caricato dall'Operatore nella pratica.

**Regole generali.**

- **Ogni azione importante è registrata** nell'audit trail, con autore, data e ora, stato prima e dopo. Il registro non si può modificare.
- **Le azioni eccezionali richiedono una motivazione**: cambio di stato della pratica, modifica di una scadenza, chiusura di un'integrazione senza risposta, modifica della durata delle fasi. La motivazione finisce nell'audit.
- **I documenti non si sovrascrivono mai**: ogni caricamento crea una nuova versione e le precedenti restano consultabili.
- **Un calcolo dei crediti confermato non si modifica più**: le correzioni si fanno con una nuova versione.

## Accesso, profilo e verifica in due passaggi

Si accede da [portale-cwp.vercel.app](https://portale-cwp.vercel.app) con **Email** e **Password**, poi **Accedi**. In alto compaiono il menu del proprio ruolo, la campanella delle notifiche, l'indicazione *Operatore* o *Admin*, l'email (sotto c'è scritto **Il mio profilo**) ed **Esci**.

| Ruolo | Voci di menu |
| --- | --- |
| Operatore | Cruscotto, Pratiche, Manuale |
| Amministratore | Cruscotto, Pratiche, Utenti, Audit, Crediti CWP, Impostazioni, Documentazione |

**Il mio profilo.** Facendo clic sulla propria email si apre la pagina con i dati dell'account, il pulsante **Cambia password** e i documenti da scaricare (per l'Amministratore: Manuale Utente, Manuale Amministratore e Registro sviluppo e deploy).

**Password.** Al primo accesso il portale chiede di sostituire la password temporanea. La password si cambia da **Il mio profilo → Cambia password**; se è stata dimenticata si usa **Password dimenticata?** nella pagina di accesso: arriva un'email «Portale Carbon WastePrint (CWP) — Richiesta di reimpostazione della password» con il pulsante **Scegli una nuova password →**.

**Verifica in due passaggi (MFA).** Quando è attiva, dopo la password Operatori e Amministratori inseriscono un codice dall'app di autenticazione del telefono. Oggi è **spenta** per decisione della Fondazione; quando verrà accesa la procedura sarà questa.

*Primo accesso (attivazione):*

1. Installate sul telefono un'app di autenticazione (Google Authenticator, Microsoft Authenticator, Authy).
2. Nell'app scegliete **Aggiungi account** e inquadrate il QR code mostrato dalla schermata **Verifica a due fattori**. Se non riuscite, aprite *Non riesci a inquadrare il codice?* e digitate la chiave a mano.
3. Scrivete nel campo **Codice a 6 cifre** il codice che compare nell'app e premete **Attiva e accedi**.

*Accessi successivi:* dopo la password inserite il codice a 6 cifre e premete **Accedi**. Con l'errore «Codice non valido o scaduto» attendete il codice successivo dell'app e riprovate. Se perdete il telefono vedete il capitolo «Manutenzione ed emergenze».

## Cruscotto

Il **Cruscotto** è la pagina iniziale dello staff: mostra in un'unica tabella tutte le pratiche, Progetti e Rapporti, con la fase corrente, la scadenza e ciò che c'è da fare.

**Riquadri in alto.** Ogni riquadro conta le pratiche e, se cliccato, filtra la tabella. Si clicca di nuovo per togliere il filtro.

| Riquadro | Cosa conta |
| --- | --- |
| Pratiche in corso | Pratiche attive |
| In scadenza (≤ 7 gg) | Fase aperta che scade entro 7 giorni (numero in arancione) |
| Scadute | Fase aperta con scadenza passata (numero in rosso) |
| In attesa del Cliente | Integrazioni richieste e senza risposta |
| Integrazioni da verificare | Integrazioni con risposta del Cliente da chiudere |
| Consultazioni attive | Consultazioni pubbliche aperte |

**Ricerca e filtri.** Il campo «Cerca organizzazione, codice o progetto…» e i filtri per stato, tipo (Progetti, Rapporti), anno di monitoraggio e fase. **Azzera filtri** li toglie tutti.

**Tabella.** Colonne Pratica, Organizzazione, Stato, Fase corrente, Scadenza (con «scaduta da N gg», «scade oggi», «tra N gg») e **Da fare** (integrazioni da verificare, in attesa del Cliente, consultazione in corso). Fate clic su una riga per aprire la pratica.

La *fase corrente* è l'ultima aperta; se nessuna è aperta, la prima non iniziata.

## Pratiche: Progetti e Rapporti di monitoraggio

La pagina **Pratiche** elenca a sinistra i Progetti (con più di 4 progetti compare il campo **Cerca…**) e mostra a destra il dettaglio di quello selezionato.

**Creare un Progetto**

1. Premete **+ Nuovo progetto**.
2. Scegliete l'ente: **Organizzazione esistente** dal menu, oppure **Nuova** indicando **Denominazione** (es. Comune di …) e **Tipo** (es. Ente locale, Soggetto gestore).
3. **Codice pratica**: lasciatelo vuoto per avere il codice automatico `CWP-AAAA-NNNN`.
4. **Titolo**: una descrizione breve.
5. Premete **Crea progetto**.

Vengono create le 7 fasi: la 1 (Adesione) già *In corso*, le altre *Non iniziata*.

**Creare un Rapporto di Monitoraggio annuale**

1. Aprite il Progetto (deve essere *Attivo*).
2. Nella sezione **Rapporti di Monitoraggio (N/10)** premete **+ Rapporto anno N**.
3. Il Rapporto nasce con codice `<codice progetto>-RMN`, eredita l'ente e si apre subito.

I Rapporti si creano in ordine (l'anno N richiede l'anno N−1), fino a 10. Ogni Rapporto ha fasi, documenti e pagamenti propri, senza consultazione pubblica. Per tornare al Progetto: **← Torna al Progetto**.

**Utenti del Comune.** Perché il Comune veda la pratica, il suo referente deve essere associato all'organizzazione (capitolo «Gestione utenti»).

## Gestire le fasi e lo stato della pratica

Le azioni sulle fasi compaiono nella scheda di ciascuna fase, **solo se la pratica è attiva**. Le fasi si possono aprire in qualsiasi ordine e la chiusura di una fase non apre automaticamente la successiva.

| Azione | Quando | Cosa succede |
| --- | --- | --- |
| **Apri fase** | Fase *Non iniziata* | Apertura oggi; scadenza = oggi + durata della fase (Impostazioni). Il Comune riceve la notifica |
| **Chiudi fase** | Fase aperta | La fase diventa *Completata*. Con integrazioni ancora aperte serve la motivazione e il pulsante è **Chiudi comunque** |
| **Richiedi integrazione** | Fase aperta | Vedi il capitolo «Richieste di integrazione» |
| **Modifica scadenza** | Fase aperta | Nuova data e **Motivazione (obbligatoria)**, poi **Salva scadenza** |

**Note di fase.** Sotto ogni fase, **+ Aggiungi nota** apre un campo di testo. Senza spunta la nota è **interna** (la vede solo la Fondazione, bordo arancione); con la spunta **Visibile al Comune** la nota è **condivisa** (bordo verde) e il Comune riceve la notifica «Nuova nota della Fondazione». Le note non si modificano né si cancellano e finiscono nell'audit: per correggere, aggiungete una nuova nota.

**Ente di Validazione della pratica.** Nell'intestazione della pratica, accanto a «Ente di Validazione», premete **Assegna** (o **Cambia**), scegliete l'ente e premete **Salva**. L'elenco degli enti si gestisce in Impostazioni (capitolo «Impostazioni»). Il Comune vede il nome dell'ente assegnato. L'assegnazione è registrata nell'audit.

**Nuove versioni durante una fase.** Se il Comune carica una nuova versione di un documento mentre la fase è aperta, la scadenza **non riparte** (decisione della Fondazione del 18/10/2026). Se serve più tempo si usa **Modifica scadenza** con la motivazione.

**Cambiare lo stato della pratica.** I pulsanti sono nell'intestazione della pratica:

| Stato attuale | Pulsanti |
| --- | --- |
| Attiva | Sospendi, Annulla, Chiudi pratica |
| Sospesa | Riattiva, Annulla, Chiudi pratica |
| Chiusa | Riattiva |
| Annullata | nessuno: l'annullamento è definitivo |

1. Premete il pulsante desiderato.
2. Scrivete la **Motivazione (obbligatoria)**, almeno 3 caratteri.
3. Premete **Conferma**.

Il Comune riceve la notifica con la motivazione, che resta visibile nell'intestazione della pratica. Con la pratica sospesa, annullata o chiusa il Comune vede un avviso che lo spiega, non ha il pulsante **+ Carica** e non può rispondere alle integrazioni; può sempre scrivere nella sezione Messaggi (non sulle pratiche annullate).

## Documenti e visibilità

I documenti stanno in **Documenti della fase** (dentro ogni fase) o in **Documenti generali** (in fondo alla pratica: contratto, allegati, documentazione amministrativa).

**Caricare un documento**

1. Premete **+ Carica**.
2. Scegliete la **tipologia**: Contratto, Allegato al contratto, Documentazione amministrativa, Documento di progetto, Rapporto dell'Ente di Validazione, Integrazione, Altro.
3. Impostate la visibilità: **Visibile al Cliente** (spuntato di norma) e **Pubblico** (non spuntato di norma).
4. Premete **Scegli il file** e selezionatelo.

Formati ammessi: PDF (anche .p7m), Word, Excel, OpenDocument, RTF, CSV, TXT, JPG, PNG, ZIP, fino a 50 MB. Il portale controlla anche il contenuto reale del file.

**Versioni.** Un file con lo stesso nome nella stessa pratica diventa la nuova versione (v2, v3…); le precedenti restano consultabili. Per ogni documento lo staff vede anche l'impronta *hash* che ne garantisce l'integrità e l'etichetta *solo Fondazione* se non è visibile al Cliente.

**Cambiare la visibilità.** Le caselle **Cliente** e **Pubblico** su ogni riga si possono cambiare in qualsiasi momento; la modifica è registrata nell'audit. Il Rapporto di RINA va caricato con tipologia *Rapporto dell'Ente di Validazione*.

## Richieste di integrazione

Una richiesta di integrazione chiede al Comune un documento o un chiarimento durante una fase aperta.

1. Nella fase premete **Richiedi integrazione**.
2. Descrivete nel campo **Cosa deve integrare il Cliente** cosa serve (es. «manca la delibera tariffaria 2025 firmata»).
3. Premete **Invia richiesta**. La fase passa a *In attesa di integrazione* e il Comune riceve la notifica.
4. Quando il Comune risponde ricevete la notifica «Il Cliente ha risposto a una richiesta di integrazione»; la richiesta diventa *Risposta ricevuta* e mostra documento ed eventuale nota.
5. Verificate il documento e premete **Accetta e chiudi**.

Se il Comune non risponde potete premere **Chiudi senza risposta**, scrivere la motivazione e confermare con **Conferma chiusura**.

Quando non restano richieste aperte la fase torna *In corso*. Nel Cruscotto i riquadri *In attesa del Cliente* e *Integrazioni da verificare* mostrano le richieste da seguire.

## Consultazione pubblica

La consultazione pubblica riguarda solo i Progetti (fase 3) e dura 30 giorni. Si svolge sulla **pagina pubblica** del portale (`/consultazioni`), aperta a tutti senza credenziali e collegata anche dalla pagina di accesso.

**Aprire la consultazione**

1. Caricate prima il documento da sottoporre a consultazione (capitolo «Documenti e visibilità»).
2. Nel riquadro **Consultazione pubblica** della pratica scegliete il documento.
3. Premete **Apri consultazione**. Il periodo va da oggi a 30 giorni dopo, il Comune riceve la notifica e la consultazione compare nell'elenco pubblico.

Nel riquadro trovate il periodo, i giorni rimanenti, il documento e il **link alla pagina pubblica** da diffondere.

**Come arriva un'osservazione.** Sulla pagina pubblica chiunque scrive nome, email, testo e, se vuole, un allegato (PDF, JPG, PNG, DOCX o ODT, massimo 10 MB). Deve acconsentire al trattamento dei dati e può scegliere di pubblicare il proprio nome. Il portale gli invia un'email con il pulsante **Conferma e invia l'osservazione →**, valido 48 ore e una sola volta: solo dopo la conferma l'osservazione arriva alla Fondazione come *Ricevuto*, con la notifica «Nuova osservazione da moderare». Il portale limita gli invii (3 all'ora per indirizzo) e blocca i robot.

**Moderare le osservazioni.** Lo staff vede di ogni osservazione nome, email («email confermata»), data e ora, allegato e se l'autore ha scelto di pubblicare il nome.

| Pulsante | Effetto |
| --- | --- |
| Pubblica | L'osservazione diventa *Pubblicato*: compare sulla pagina pubblica e il Comune può rispondere |
| Non pubblicare | L'osservazione diventa *Non pubblicato* (motivazione «Non ammesso dal moderatore») |

Sulla pagina pubblica e per il Comune l'autore compare come *Partecipante*, oppure con il nome se l'ha scelto; l'email non è mai pubblicata. Le risposte le scrive il Comune e compaiono anche sulla pagina pubblica.

**Errata corrige.** Se il documento in consultazione contiene un errore:

1. Se serve, caricate il documento corretto tra i documenti della pratica.
2. Nel riquadro premete **+ Pubblica errata corrige**.
3. Descrivete la correzione in **Cosa viene corretto** e scegliete l'eventuale **Documento corretto**.
4. Decidete se spuntare **Fai ripartire i 30 giorni da oggi**: in questo caso la **Motivazione** è obbligatoria (decisione della Fondazione del 18/10/2026: si decide caso per caso).
5. Premete **Pubblica errata corrige**.

L'errata corrige compare nella pratica e sulla pagina pubblica, il Comune riceve la notifica e l'operazione (con l'eventuale proroga) finisce nell'audit.

**Chiudere la consultazione.** Dopo la data di chiusura il portale non accetta più osservazioni, ma lo stato va chiuso a mano con **Chiudi consultazione**.

**Da sapere.** Finché il dominio della Fondazione non è verificato sul servizio email, le email di conferma arrivano solo all'indirizzo del titolare del servizio: prima di una consultazione reale il dominio va verificato.

## Messaggi con il Comune

In ogni pratica la sezione **Messaggi** è la conversazione tra Fondazione e Comune su quella pratica. Scrivete nel campo «Scrivi un messaggio…» e premete **Invia**. I messaggi della Fondazione sono firmati «Fondazione Operate · nome dell'operatore». A ogni messaggio l'altra parte riceve una notifica e un'email (staff: «Nuovo messaggio dal Cliente»). I messaggi non si modificano né si cancellano e sono registrati nell'audit.

## Pagamenti

Ogni pratica ha la sezione **Pagamenti** con il riepilogo *Previsto · incassato · da incassare*. Il portale non incassa pagamenti online: la Fondazione registra le voci previste e gli incassi. Il Comune vede le stesse voci in sola lettura e riceve una notifica quando se ne aggiunge una.

**Aggiungere una voce**

1. Premete **+ Voce di pagamento**.
2. Compilate **Voce** (es. quota di adesione), **Importo (€)**, **Scadenza** e, se serve, **Riferimento / note**.
3. Premete **Salva**.

**Registrare un incasso**

1. Sulla voce premete **Registra incasso**.
2. Spuntate **Pagamento registrato** e controllate la data del pagamento (di norma oggi).
3. Premete **Salva**.

Ogni voce mostra *Da pagare*, *Scaduto* o *Pagato*. Il portale registra automaticamente chi ha inserito l'incasso, e l'operazione finisce nell'audit.

## Export del fascicolo

Il pulsante **Esporta fascicolo**, nell'intestazione della pratica, scarica tutto il fascicolo in un file ZIP (`Fascicolo_<codice>_<data>.zip`). L'avanzamento si legge sul pulsante: raccolta dati, documenti, riepiloghi, compressione.

| Contenuto | Dettaglio |
| --- | --- |
| Documenti/Generali, Documenti/Fase N | Tutti i documenti, in tutte le versioni (`nome_vN`) |
| pratica.csv, fasi.csv, documenti.csv | Dati della pratica, delle fasi e dei documenti, con l'impronta SHA-256 |
| integrazioni.csv | Se ci sono richieste di integrazione |
| consultazione.csv, consultazione_info.txt | Se c'è stata una consultazione |
| pagamenti.csv, audit.csv | Solo nell'export dello staff |
| LEGGIMI.txt | Descrizione del contenuto |

I file CSV si aprono direttamente con Excel. Se alcuni file non si recuperano il pulsante lo segnala («N file non recuperati»). Il Comune ha lo stesso export («Scarica documentazione») senza pagamenti e audit.

## Notifiche ed email

La campanella in alto mostra le notifiche interne; le stesse arrivano anche per email.

| Lo staff riceve una notifica quando | Il Comune riceve una notifica quando |
| --- | --- |
| il Comune carica un documento | si apre o si chiude una fase |
| il Comune risponde a un'integrazione | arriva una richiesta di integrazione |
| arriva un'osservazione (email confermata) da moderare | la Fondazione carica un documento visibile al Cliente |
| una fase è vicina alla scadenza o scaduta | si apre la consultazione pubblica o esce un'errata corrige |
| il Comune scrive un messaggio | la Fondazione scrive un messaggio o una nota condivisa |
| | si aggiunge una voce di pagamento |
| | la pratica cambia stato |

Gli avvisi di scadenza partono ogni mattina (3 giorni prima e a scadenza superata, una sola volta). Le email partono da «Portale CWP»; le email non partite vengono ritentate da sole ogni 15 minuti per 6 ore.

**Limite attuale.** Finché il dominio della Fondazione non è verificato sul servizio email (Resend), le email arrivano solo all'indirizzo del titolare dell'account Resend. Le notifiche interne funzionano comunque per tutti.

## Gestione utenti

La pagina **Utenti** elenca tutti gli utenti con nome, email, ruolo e organizzazioni associate.

**Creare un utente**

1. Premete **+ Nuovo utente**.
2. Inserite **Email** e, facoltativo, **Nome e cognome**.
3. La **Password temporanea** è già generata; **Genera** ne crea un'altra.
4. Scegliete il **Ruolo**: *Cliente (comune / azienda)* oppure *Operatore di back-office*.
5. Per un Cliente spuntate le **Organizzazioni associate** (almeno una; la prima è la principale). Con più di 6 organizzazioni compare la ricerca.
6. Premete **Crea utente**.
7. Comunicate all'utente email e password temporanea con un canale sicuro, separato dall'email di benvenuto.

**Modificare un utente.** **Modifica** permette di cambiare ruolo e organizzazioni. Passando a Operatore le associazioni alle organizzazioni si azzerano.

**Disattivare o riattivare.** Un utente **Disattivato** non vede più alcun dato ma resta nello storico. Non si può disattivare sé stessi.

**Password temporanea e primo accesso.** Ogni nuovo utente entra con la password temporanea: al primo accesso il portale gli chiede di sceglierne una personale e non lo lascia proseguire finché non lo fa.

**Reimpostare la password di un utente**

1. Nella riga dell'utente premete **Reimposta password**.
2. Il portale propone una password temporanea (**Genera un'altra** ne crea una diversa).
3. Premete **Conferma**: la password precedente smette di funzionare.
4. Comunicate la password temporanea all'utente con un canale sicuro, ad esempio per telefono. Al primo accesso dovrà sceglierne una personale.

La reimpostazione non è possibile per gli Amministratori né per sé stessi, e viene registrata nell'audit (senza la password).

**Limiti.** Dal portale non si creano né si nominano Amministratori: si fa da Supabase, per sicurezza. La password di un Amministratore si gestisce con **Password dimenticata?** oppure da Supabase (*Authentication → Users*).

## Audit trail

La pagina **Audit** mostra il registro automatico e non modificabile di tutte le operazioni rilevanti, dalla più recente.

- Colonne: **Data e ora**, **Utente** (con il ruolo), **Operazione**, **Pratica**, **Da → A** (stato prima e dopo), **Motivazione**.
- Il campo di ricerca filtra per operazione, utente, pratica o motivazione.
- Si vedono gli ultimi 200 eventi; **Carica eventi meno recenti** ne aggiunge altri 500.

Sono registrati, tra gli altri: apertura e chiusura delle fasi, modifiche di scadenza, cambi di stato della pratica, caricamenti di documenti con la versione, modifiche di visibilità, apertura e chiusura della consultazione, moderazione delle osservazioni, richieste e chiusure di integrazione, incassi, creazione e modifica di utenti, cambi e reimpostazioni di password, modifiche della durata delle fasi e operazioni sui calcoli dei crediti.

Il registro non si può modificare né cancellare, neppure dagli Amministratori.

## Impostazioni: fasi, Enti di Validazione e modelli

La pagina **Impostazioni** ha tre sezioni: durata delle fasi, Enti di Validazione e modelli di documento.

### Durata delle fasi

La sezione fissa quanti giorni dura ogni fase. Quando un Operatore apre una fase, la scadenza è calcolata con questi valori.

| Fase | Durata iniziale (giorni) | Giorni del percorso |
| --- | --- | --- |
| 1. Adesione | avvio | 0 |
| 2. Prima verifica documentale | 10 | 0 → 10 |
| 3. Consultazione pubblica | 30 | 10 → 40 |
| 4. Risposta ai commenti / pubblicazione | 20 | 40 → 60 |
| 5. Validazione e verifica | 75 | 60 → 135 |
| 6. Seconda verifica documentale | 15 | 135 → 150 |
| 7. Chiusura | 0 | 150 |

**Modificare una durata**

1. Scrivete i nuovi giorni nella colonna **Durata (giorni)**: le colonne *Dal giorno*, *Al giorno* e la durata complessiva si aggiornano subito.
2. Scrivete la **Motivazione della modifica** (es. «delibera della Fondazione del …»).
3. Premete **Salva la modifica** (o **Salva N modifiche**).

Valori ammessi: da 0 a 365 giorni. La nuova durata vale per le fasi **aperte da quel momento**: le scadenze già fissate restano e si cambiano pratica per pratica con *Modifica scadenza*. Ogni modifica è registrata nell'audit.

### Enti di Validazione

Anagrafica degli enti che validano i Progetti (ad esempio RINA). Gli enti non accedono al portale.

1. Premete **+ Nuovo ente**.
2. Compilate **Denominazione** (obbligatoria) e, se disponibili, **Identificativo**, **Accreditamento**, **Referente**, **Email**, **Telefono**, **Note**.
3. Premete **Salva**.

**Modifica** cambia i dati. Un ente non si cancella: togliendo **Attivo** non si può più assegnare a nuove pratiche, ma resta su quelle a cui era assegnato. L'assegnazione alle pratiche si fa dall'intestazione della pratica.

### Modelli di documento

Moduli e fac-simile che i Comuni scaricano dal portale.

1. Premete **+ Nuovo modello**.
2. Scrivete il **Titolo** (es. «Modulo di adesione») e, se serve, una **Descrizione**.
3. In **Dove compare** scegliete una fase (il modello comparirà dentro quella fase in ogni pratica, sotto «Modelli da scaricare») oppure **Generale** (comparirà nella pagina «I tuoi documenti» dei Comuni).
4. Scegliete il **File** (stessi formati e limiti dei documenti) e premete **Carica e pubblica**.

Per aggiornare un modello caricate la nuova versione e premete **Ritira** su quella vecchia: i file non si sovrascrivono. Un modello ritirato si può ripubblicare con **Ripubblica**. Ogni operazione è registrata nell'audit.

## Calcolo dei crediti CWP

La sezione **Crediti CWP** calcola i crediti di carbonio di una pratica per un anno, secondo la *Metodologia Carbon WastePrint® v1.2*. È riservata agli Amministratori.

### Come funziona il calcolo

Il calcolo confronta le emissioni **attese** del territorio (quelle che ci sarebbero senza il Progetto, stimate dalla produzione di rifiuti e dalla delibera tariffaria) con le emissioni **di progetto** (misurate sui conferimenti reali delle utenze). La differenza è la **variazione di impatto** (ΔI): se è negativa, il territorio ha ridotto le emissioni e genera crediti.

| Grandezza | Significato |
| --- | --- |
| EA — emissioni attese | Emissioni stimate per classe di utenza e per tipologia di rifiuto (formule 2-15) |
| EP — emissioni di progetto | Emissioni calcolate sui conferimenti misurati delle utenze (formule 19-30) |
| ΔI — variazione di impatto | EP − EA, per utenza e per il territorio (formula 31) |
| Crediti lordi | −ΔI, in tonnellate di CO₂ equivalente (formula 32) |
| Buffer | Quota di crediti trattenuta a garanzia, dal 30% in giù (Tabelle 15 e 16) |
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

1. Nel menu premete **Crediti CWP**: si apre l'elenco dei calcoli (Calcolo, Pratica, Anno / tipo, Crediti netti, Stato).
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

**Passo 6 — Buffer (Analisi del rischio).** Il buffer parte dal 30% e si riduce in base a come il Comune misura i conferimenti:

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

**Scarica il rapporto (PDF)** crea il **rapporto di calcolo**: scheda (pratica, ente, anno, tipo di stima, stato, numero di registro, file di origine dei dati e impronta SHA-256 dei dati), sintesi dei crediti, buffer voce per voce, dati di ingresso (rifiuti, delibera, fattori di emissione usati), risultati per tipologia e per classe, avvisi e controlli di coerenza, scelte interpretative applicate. Il rapporto di una bozza porta la scritta «BOZZA» su ogni pagina. Il dettaglio per singola utenza non è nel rapporto, per riservatezza: resta nel CSV.

**Scarica il riepilogo (CSV)** e **Scarica il dettaglio per utenza (CSV)** esportano i risultati in file che si aprono con Excel.

### Confermare e correggere

**Prima di confermare.** Controllate che: il riquadro *Da verificare* sia vuoto o che ogni voce sia spiegata nelle note; le quantità del passo 2 coincidano con il Catasto ISPRA; la somma PEF del passo 3 faccia 100; il numero di utenze della Banca Dati sia coerente con la delibera; il buffer corrisponda a come il Comune misura davvero i conferimenti.

1. Salvate e premete **Calcola**.
2. Premete **Conferma calcolo**: compare il riquadro «Confermare il calcolo?» con i crediti netti.
3. Premete **Conferma definitivamente**.

Un calcolo confermato riporta *Confermato il gg/mm/aaaa* ed è in sola lettura: dati, Banca Dati Utenze e risultato non si possono più modificare né cancellare. **Calcola** mostra di nuovo il dettaglio senza cambiare nulla.

**Numero di registro.** Alla conferma, un calcolo **ex post** riceve dal portale un numero di registro progressivo, ad esempio `CWP-REG-2026-0001`, che compare accanto a «Confermato il», nell'elenco dei calcoli e nel rapporto. Le stime ex ante non hanno numero.

**Archiviare il rapporto.** Su un calcolo confermato, **Archivia il rapporto nella pratica** salva il PDF tra i documenti generali della pratica, con tipologia *Rapporto di calcolo dei crediti* e **non visibile al Comune**: per mostrarlo al Comune spuntate «Cliente» sul documento nella pratica. Archiviandolo di nuovo nasce una nuova versione.

**Correggere un calcolo confermato.** Premete **Nuova versione**: il portale crea una bozza copia («… (rev.)») collegata all'originale, che resta intatto. Una bozza si può eliminare con **Elimina**.

Creazione, ricalcolo e conferma sono registrati nell'audit.

### Registro dei crediti

Nella pagina **Crediti CWP** la vista **Registro dei crediti** elenca i calcoli ex post confermati, in ordine di numero di registro: pratica ed ente, anno, crediti lordi, buffer, crediti netti, data e autore della conferma, stato.

- **Valido**: i crediti della riga contano nei totali.
- **Sostituito da CWP-REG-…**: il calcolo è stato corretto con una nuova versione confermata; il numero resta nel registro e non si riusa, ma i crediti non contano.

In alto compaiono il totale dei crediti netti validi e i totali per ente e anno. **Solo le righe valide** nasconde le sostituite; **Scarica il registro (CSV)** esporta tutto il registro. Fate clic su una riga per aprire il calcolo.

**Da completare.** Le regole dello *Standard CWP* e della *Guida al Programma* per emissione, trasferimento e annullamento dei crediti verranno aggiunte al registro quando i documenti saranno disponibili.

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

## Documentazione e manuali

Dalla voce **Documentazione** del menu (e da **Il mio profilo**) l'Amministratore scarica, in PDF o in Word e sempre nella revisione più recente:

| Documento | Per chi | Contenuto |
| --- | --- | --- |
| Manuale Utente | tutti i ruoli | Guida per Comuni, enti e soggetti gestori |
| Manuale Amministratore | solo Amministratori | Questo manuale: funzioni della Fondazione e calcolo dei crediti |
| Manuale Test | solo Amministratori | Guida sintetica per chi collauda il portale: metodo CWP, ruolo del portale, percorso di prova con i risultati attesi |
| Registro sviluppo e deploy | solo Amministratori | Architettura, servizi, database, codice, cronologia dei rilasci, decisioni e backlog |

Operatori e Comuni trovano il Manuale Utente nella voce **Manuale** del menu; i Comuni anche in **I tuoi documenti**. Ogni documento riporta in copertina il numero di revisione e la data; a ogni nuova funzione i tre manuali e il registro vengono aggiornati insieme.

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

## Funzioni in arrivo

Questo manuale descrive il portale alla data della revisione indicata in copertina. Sono in sviluppo, e saranno aggiunte qui quando disponibili:

- **Calcolo crediti:** regole del registro previste dallo Standard CWP (emissione, trasferimento, annullamento dei crediti).
- **Sicurezza:** registro di sicurezza (accessi e tentativi falliti), verifica in due passaggi attiva, antivirus sui file caricati, piano di protezione dagli attacchi informatici.
- **Email:** verifica del dominio, per far arrivare le notifiche a tutti gli utenti.

In valutazione: un **assistente AI (Claude) integrato nel portale**, per aiutare i Comuni nella compilazione e gli Operatori nei controlli.
