# CWP — nuovi rilievi per verifica e correzione

V01 · 21 ottobre 2026 · Luca Belfiore / AltraLeonia
Destinatario: Luca Moretti, Fondazione Operate — consegna all'agente di sviluppo

## 1. Perimetro dell'integrazione

Questo file contiene soltanto sei rilievi aggiuntivi emersi dalla mail di Rocío del 21 ottobre e dal successivo controllo in sola lettura di portale, audit e sorgente. Non sono sei errori già riprodotti con nuove scritture: per ciascuno sono distinti il comportamento osservato, la regola da verificare e la prova ancora necessaria.

Prima di prepararlo sono stati controllati in Gmail i riscontri effettivamente inviati nel thread «CWP – esiti del collaudo, correzioni e profili di prova»:

- 20/10/2026, 09:45, con `CWP_BUGFIX_HANDOFF_A_MORETTI_V01_20261020.md`;
- 21/10/2026, 10:03, con `CWP_COLLAUDO_PROFILI_AB_V05_20261020.md`;
- risposta di Moretti del 21/10/2026, 11:02, con `Collaudo_V05_risposte.md`.

Le sei schede sotto non risultano già trattate in modo specifico in questi invii. Non vengono riproposti i difetti e le riserve precedenti, i controlli sui profili, D05-R1, O01 o D08. Anche la completezza documentale R06 e il tema già censito dei rapporti prima della registrazione restano nel rispettivo percorso, senza nuove schede duplicate. I risultati e i limiti dei report precedenti restano validi.

La sessione di verifica del 21 ottobre non ha effettuato salvataggi sul portale, cambi di fase, assegnazioni, nuovi scenari, ricalcoli o conferme. Assistente AI del portale escluso. I codici N01–N06 sono riferimenti interni di questa integrazione, da raccordare al registro esistente dopo aver controllato eventuali nuove segnalazioni dello stesso problema.

## 2. Versioni e fonti

Portale osservato: https://portale-cwp.vercel.app/ il 21/10/2026.

Revisione del sorgente pubblico letta: **48eae7018722cc5ed11964322d39c52a8b6bee20**. Questo identifica il codice consultato, non certifica la corrispondenza con il bundle online o gli script installati nel database. Prima della diagnosi verificare la revisione corrente ed eventuali correzioni intervenute.

Fonti del Programma:

- **Guida al Programma Carbon WastePrint v1.2**, Tabella 3 e §§6.2.1–6.2.4, pagine stampate 22–24 (pagine PDF 27–29): termini, ID progetto e validazione.
- **Metodologia Carbon WastePrint v1.2**, capitolo 5, pagine stampate 13–14 (PDF 18–19), formule 16–17: fattore dell'indifferenziato.
- Per N01 occorre l'originale **«Costi per il Soggetto Promotore», Casi 1/2, 28/07/2026**: non era disponibile fra i file consultati. Lo Schema tariffario del Programma è una fonte diversa e non lo sostituisce.

La regola del Programma o del listino originale prevale su commenti nel codice e manuali software. Dove manca una decisione, registrare `ATTESA_REGOLA`, esplicitare la domanda e chiedere conferma a Moretti/Fondazione prima di cambiare la logica.

## N01 — Voci «una tantum» ripetute negli anni del simulatore

**Qualifica:** ripetizione annuale osservata; correttezza economica da verificare sul listino. Non accertato un addebito indebito.

**Dove leggere:** Simulatore → scenario esistente **Bovisio-Masciago**, «Dati ISPRA 2021 - obiettivo 2036», aggiornato il 19/10; Caso 1 – Progetto volontario, 16.735 abitanti, periodo 2027–2036 di dieci anni. Non modificare lo scenario per il confronto iniziale.

**Osservato:** le colonne indicano €/abitante all'anno e €/anno. Le tre righe «una tantum» sono Progetto (0,13; 2.175,55 euro/anno), Registrazione Progetto (0,10; 1.673,50) e Registrazione Crediti Progetto (0,12; 2.008,20). Le componenti sono ripetute nel prospetto di tutti i dieci anni. Il totale tariffario annuale è 16.232,95 euro.

**Sorgente:** [simulatore.js](https://github.com/lucamorettioperate/portale-cwp/blob/48eae7018722cc5ed11964322d39c52a8b6bee20/src/lib/crediti/simulatore.js#L663). Il commento dichiara che le voci dei Casi 1/2 sono già ripartite su dieci anni. `costiPerCaso` produce importi annui e `simulaEconomia` li applica a ogni anno (riga 820). Il diverso listino «schema» tratta il progetto nel primo anno; anche il campo separato `costoValidazione` dell'ente è applicato soltanto al primo anno (riga 831).

**Verifica/correzione richiesta:** confrontare gli importi con la tabella originale e accertare se siano quote annuali di un costo iniziale o costi da imputare una sola volta. Se la ripartizione è corretta, rendere esplicita la natura della quota nell'etichetta e nella spiegazione; se non lo è, correggere l'imputazione. Non spostare automaticamente al primo anno importi già annualizzati e non confondere le tariffe con la validazione dell'ente.

**Accettazione:** documentare fonte, unità e durata del listino; verificare primo anno, anni successivi e totale decennale sul Caso 1 e sul Caso 2. Verificare che le durate diverse da dieci anni espongano la limitazione prevista e non producano un totale presentato come approvato senza regola. Dopo un'eventuale modifica, controllare coerenza fra interfaccia ed esportazioni. Conservare gli scenari storici.

## N02 — Chiusura anticipata del feedback e disallineamento con la fase

**Qualifica:** anomalia storica riscontrata in interfaccia e audit; controllo attuale di chiusura non provato con una nuova scrittura.

**Oggetto:** [Borgoval, CWP-2026-0001](https://portale-cwp.vercel.app/pratiche?id=6e370f60-dbc5-4b68-8b5c-570182c0f690). Consultazione ID `73106985-ca88-43de-878a-c64cd9c1b382`.

**Osservato:** fase 3 «Feedback pubblico» completata, aperta e chiusa il 17/10/2026. Il riquadro della consultazione separata mostra «Chiusa» e periodo **17/10–16/11/2026**. Nell'audit, orari come esposti dal portale:

| Data e ora | Evento |
|---|---|
| 17/10/2026 13:32:36 | Apertura della fase allora denominata «Consultazione pubblica» |
| 17/10/2026 13:32:37 | Chiusura della fase |
| 17/10/2026 13:36:59 | Apertura della consultazione, dichiarata attiva per 30 giorni |
| 18/10/2026 16:10:08 | Chiusura della consultazione; dettaglio `attiva: sì → no` |

La consultazione effettiva è stata chiusa il giorno successivo, mentre la fase è stata chiusa nello stesso giorno: sono due eventi distinti. Entrambi precedono il termine esposto del 16 novembre.

**Atteso:** Guida §6.2.2 e Tabella 3: trenta giorni solari dalla registrazione del progetto nello stato «in fase di validazione».

**Verifica/correzione richiesta:** ricostruire il rapporto fra stato della fase e stato della consultazione; verificare i controlli attuali sia nell'interfaccia sia nel servizio che effettua la chiusura. Se oggi si può concludere ordinariamente prima del termine, correggere il controllo secondo la Guida e sincronizzare gli stati. Eventuali annullamenti o eccezioni autorizzate devono essere distinti dalla conclusione ordinaria e tracciati; non inventare un'eccezione per giustificare i dati di prova.

**Accettazione:** su fixture isolata verificare un istante prima del termine e il termine raggiunto, computo dei giorni solari e fuso orario; la fase e la consultazione devono rappresentare lo stesso procedimento senza chiusure ordinarie premature. Verificare il percorso autorizzato nel servizio oltre ai pulsanti. Non riaprire Borgoval né riscriverne l'audit per correggere il caso storico.

## N03 — Fase di validazione in corso con ente non assegnato

**Qualifica:** incoerenza dei dati esposti confermata; regola di blocco all'avvio da chiarire e verificare.

**Dove leggere:** stessa pratica Borgoval. Fase 5 «Validazione e verifica» **In corso**, aperta il 17/10/2026; **Ente di validazione e verifica: non assegnato**.

**Atteso:** Guida §6.2.3 e Tabella 3 prevedono l'attività dell'ente e il relativo contratto; il termine di 75 giorni decorre dal caricamento del documento conclusivo del feedback. Lo stato generale «in fase di validazione» parte già dopo la prima verifica documentale (§6.2.1) e non va confuso con l'avvio della fase operativa 5. Il caso osservato riguarda proprio la fase 5.

**Verifica/correzione richiesta:** stabilire quali dati identificano l'incarico dell'ente e se l'assegnazione è obbligatoria prima dell'apertura della fase 5. Confrontare questa regola con la logica corrente e applicare il controllo nel servizio e nell'interfaccia. La dicitura «non assegnato» non dimostra da sola l'inesistenza di un contratto esterno.

**Accettazione:** una fixture senza incarico valido segue il comportamento approvato, con motivazione comprensibile; una fixture completa può avanzare. Distinguere requisito per lo stato generale, avvio della fase 5 e conclusione della validazione. Conservare lo storico e segnalare eventuali record pregressi incoerenti senza assegnazioni automatiche arbitrarie.

## N04 — Scadenze assenti e contatori a zero

**Qualifica:** osservazione confermata; nessun errore aritmetico dei contatori dimostrato. Automazione delle date proposta da valutare.

**Osservato:** Dashboard con sei pratiche, tutte con scadenza «—»; «In scadenza (≤7 gg)» = 0 e «Scadute» = 0.

**Sorgente:** [Cruscotto.jsx, righe 44–52](https://github.com/lucamorettioperate/portale-cwp/blob/48eae7018722cc5ed11964322d39c52a8b6bee20/src/pages/Cruscotto.jsx#L44). Entrambi i contatori richiedono pratica attiva e `giorni_scadenza` non nullo; intervallo 0–7 per il primo e valore negativo per il secondo. La pagina usa i dati restituiti da `staff_cruscotto`. L'assenza di una data è quindi esclusa, non interpretata come scadenza rispettata.

**Atteso documentale:** Guida Tabella 3:

| Termine | Evento di decorrenza |
|---|---|
| 10 giorni | Caricamento del modulo |
| 30 giorni | Passaggio allo stato «in fase di validazione» |
| 20 giorni | Chiusura del periodo di feedback |
| 75 giorni | Caricamento del documento conclusivo del feedback |
| 15 giorni | Caricamento del rapporto di validazione |

**Verifica/correzione richiesta:** verificare se gli eventi necessari siano registrati e perché la scadenza resta vuota. Concordare il calcolo automatico e la gestione di integrazioni, variazioni ed eventi mancanti; non attribuire a tutte le fasi una data iniziale generica. Rendere distinguibile «nessuna scadenza nota» da «nessuna pratica scaduta», così lo zero non appare una garanzia di regolarità.

**Accettazione:** fixture con data assente, scadenza passata, oggi, +7 e +8 giorni; conteggi coerenti e comportamento documentato per pratica non attiva. Per l'automazione, verificare separatamente ogni decorrenza della tabella e la conservazione della sua fonte. Nessun inserimento retroattivo indiscriminato di date.

## N05 — Formati eterogenei dei codici progetto

**Qualifica:** eterogeneità osservata; non dimostrato un difetto del generatore automatico.

**Osservato:** `CWP-2026-0001` (Borgoval), `CWP-2026-003` (Comune di del col), `cwp-026-005` (Comune di vvoli).

**Fonti:** Guida §6.2.1 richiede un ID univoco, senza stabilire nel passaggio letto un formato specifico. [NuovoProgetto.jsx](https://github.com/lucamorettioperate/portale-cwp/blob/48eae7018722cc5ed11964322d39c52a8b6bee20/src/components/NuovoProgetto.jsx) accetta un codice manuale facoltativo e trasmette `codice.trim() || null`. Il commento dichiara il formato automatico CWP-AAAA-NNNN quando il campo è vuoto; questa dichiarazione non prova l'esecuzione del trigger nel database corrente. Non è stato accertato come siano stati creati i tre codici.

**Verifica/correzione richiesta:** identificare origine manuale o automatica e regole effettive del database. Concordare formato, normalizzazione e trattamento dei codici storici. Se i codici manuali liberi sono intenzionali, chiarirlo; se serve uniformità, applicarla ai percorsi previsti senza rinominare lo storico automaticamente.

**Accettazione:** su dati isolati verificare codice automatico, manuale, anno, maiuscole/minuscole e unicità secondo la regola approvata, compresi i riferimenti dei rapporti. Non classificare la sola differenza grafica come duplicazione o collisione già dimostrata.

## N06 — Paniere utilizzato nel fattore dell'indifferenziato

**Qualifica:** criterio del sorgente identificato; scelta metodologica da confermare prima di correggere formule o risultati.

**Osservazione UI:** bozza esistente `ec3f8c12-d554-462e-9ea0-104b198678c7`, passo 4 «Fattori di emissione». Sono marcate a recupero anche tipologie ulteriori rispetto a organico, carta, vetro, plastica e tessili. Una riga visibile o selezionata non dimostra, da sola, che entri nella formula; ad esempio il metallo non ha un fattore numerico disponibile.

**Sorgente:** [calcolo.js, funzione fattoreIndifferenziato, riga 134](https://github.com/lucamorettioperate/portale-cwp/blob/48eae7018722cc5ed11964322d39c52a8b6bee20/src/lib/crediti/calcolo.js#L134). Il filtro include quantità > 0, `recupero` vero e fattore numerico finito, senza una lista chiusa delle cinque frazioni. Il calcolatore lo richiama sui totali per tipologia; anche [riepilogoAnnoBase del simulatore](https://github.com/lucamorettioperate/portale-cwp/blob/48eae7018722cc5ed11964322d39c52a8b6bee20/src/lib/crediti/simulatore.js#L212) usa la medesima funzione.

**Metodologia:** capitolo 5, pagine 13–14 e formule 16–17: il testo nomina organico, carta e cartone, vetro, plastica e tessili; ammette inoltre altra classificazione merceologica secondo criteri descritti nel Progetto. Le definizioni richiamano le frazioni con fattore disponibile. Il sorgente applica un criterio potenzialmente più ampio di quello nominato nel testo.

**Verifica/correzione richiesta:** la Fondazione deve precisare il paniere predefinito, le condizioni per alternative motivate e il modo di documentarle nel Progetto. Allineare poi calcolatore, simulatore e spiegazione del risultato, mostrando frazioni effettivamente usate, quantità, quote e fattori. Non scegliere il paniere solo per mantenere invariati i risultati del software.

**Accettazione:** preparare una fixture con le cinque frazioni e almeno una tipologia aggiuntiva con quantità positiva e fattore noto, così da distinguere realmente i due criteri; confrontare con un calcolo indipendente conforme alla regola approvata. Coprire quantità nulla, fattore mancante, frazione esclusa e denominatore nullo, oltre a un'eventuale alternativa autorizzata e motivata. Il vecchio caso con solo organico e residuo non distingue i due panieri e non chiude questa verifica. Non ricalcolare automaticamente risultati già confermati o alterare crediti ufficiali.

## 3. Restituzione richiesta all'agente

Per ogni N01–N06 fornire: revisione effettivamente verificata; riscontro riprodotto o differenza rispetto allo storico; causa accertata; regola e fonte applicata o domanda ancora aperta; modifica proposta/eseguita; prova pertinente e risultato; effetti eventuali sui dati esistenti.

Usare stati espliciti: `APERTO`, `ATTESA_REGOLA`, `NON_RIPRODOTTO` con versione e motivazione, oppure `CORRETTO_DA_RITESTARE`. Una lettura del codice o una dichiarazione dello sviluppo non sostituisce il ritest indipendente.

Eseguire riproduzioni e prove di scrittura su fixture/copie isolate. Questa consegna non richiede nuove prove sul portale operativo, migrazioni, distribuzioni o correzioni silenziose dei dati storici. Proporre separatamente eventuali interventi sui dati. Conservare le regressioni pertinenti e gli esiti precedenti, senza riaprire l'intero collaudo né reinserire come nuove le segnalazioni già inviate.