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
---

## 4. Risposte dello sviluppo (22/10/2026)

Redatte da Claude (agente di sviluppo) per Luca Moretti, 22/10/2026 dalle 07:50.

**Revisione verificata.** Il portale e il database in produzione sono alla revisione **48eae70** (la stessa letta dal collaudo). Le correzioni sono sul ramo separato **`correzioni-rilievi-n01-n06`**, commit `18a4653` e seguenti. **Non sono in produzione.** Lo script 39 non è stato eseguito sul database reale e non c'è stata nessuna distribuzione: servono l'OK di Luca e il mandato del collaudo.

**Prove.** Tutte le prove di scrittura sono su copie isolate:
- banco PostgreSQL 16 locale con gli script 01-39 e dati di prova (`t39.sql`);
- prove automatiche in `test/rilievi_n.test.mjs` (13 prove) e tutte le serie precedenti (16 serie superate);
- pagine provate con dati finti, su schermo da computer (1366 px) e da telefono (390 px);
- PDF generati e letti con pdftotext.

Sul portale operativo c'è stata una sola lettura, senza scritture: il 22/10 alle 07:58 le date delle fasi aperte, la configurazione delle durate e il testo della funzione `staff_apri_fase` installata.

Nessun dato storico è stato modificato: Borgoval, i codici delle pratiche, gli scenari e i calcoli confermati restano com'erano. Gli interventi sui dati sono proposti a parte (§4.7).

### N01 — Voci «una tantum» ripetute negli anni

**Stato: CORRETTO_DA_RITESTARE** (chiarezza). Le durate diverse da 10 anni restano **ATTESA_REGOLA**.

**Riprodotto.** Nella copia del motore, il Caso 1 con 16.735 abitanti dà gli stessi importi del collaudo:

| Voce | €/abitante | €/anno |
|---|---|---|
| Progetto | 0,13 | 2.175,55 |
| Registrazione Progetto | 0,10 | 1.673,50 |
| Registrazione Crediti Progetto | 0,12 | 2.008,20 |
| **Totale annuo** | | **16.232,95** |

Ogni voce si ripete in ciascuno dei 10 anni.

**Causa e regola.** Non è un addebito sbagliato: la ripetizione è voluta. La fonte sono i contratti tipo di consulenza e di partecipazione (EsaCom), da cui vengono le cifre del Caso 1. Per le attività una tantum (Redazione del Progetto, Registrazione del Progetto e Registrazione dei Crediti del Progetto) i contratti indicano un «corrispettivo unico e forfettario, il cui pagamento è stato pattuito tra le Parti in forma rateizzata su un arco temporale di dieci (10) anni», con fattura «entro il 31 gennaio di ogni anno successivo per nove anni». L'importo annuo è quindi una **rata** e il costo totale della voce è 10 rate.

Il limite era di chiarezza: l'etichetta «una tantum» accanto a un importo «€/anno» faceva pensare a un costo da pagare una volta sola.

L'originale «Costi per il Soggetto Promotore» del 28/07/2026 non era tra i file del collaudo; lo sviluppo ha usato i contratti, che lo applicano. La validazione dell'ente resta a parte: campo «Ente di validazione, una tantum», solo nel primo anno. Il listino «Schema tariffario» resta diverso: il Progetto si paga nel primo anno.

**Modifica.**
- Etichette in pagina, PDF ed Excel: «Progetto (una tantum, in 10 rate annuali)», e così per le due registrazioni del Progetto.
- Sotto la tabella dei costi, nel PDF e nel foglio «Costi» dell'Excel compare la stessa nota: corrispettivo unico pagato in 10 rate annuali uguali; l'importo è la rata annua, il costo complessivo è 10 rate. Il PDF non dice più che le voci sono «già ammortizzate».
- Con il Caso 1 o 2 e una durata diversa da 10 anni (7 o 21) compaiono:
  - un riquadro rosso «Stima, non listino approvato»;
  - la casella «Costi per il Comune nel periodo (stima)»;
  - l'avviso che la regola non è stabilita;
  - una riga «ATTENZIONE» sopra la tabella annuale del PDF e del foglio «Economia».
- Il calcolo e gli importi non cambiano. Gli scenari salvati restano com'erano.

**Prove.**
- Caso 1 e Caso 2 su 10 anni: primo anno uguale agli anni successivi, uguale alla rata; totale uguale a 10 rate; nessun avviso.
- 7 e 12 anni: segnalati come stima.
- «Schema» e «Nessuna tariffa»: non segnalati.
- Pagina, PDF ed Excel coerenti: scenario di 7 anni, verificato a schermo su computer e telefono.

**Domanda aperta (ATTESA_REGOLA).** Come si computano i costi dei Casi 1 e 2 per Progetti di 7 anni (rinnovabili) o di 21 anni? Per esempio: rate su 7 anni, rate sempre su 10 anni, oppure una tabella diversa.

**Effetti sui dati.** Nessuno.

### N02 — Chiusura anticipata del feedback e fase 3

**Stato: CORRETTO_DA_RITESTARE.** Le eventuali eccezioni restano **ATTESA_REGOLA**.

**Riprodotto.** Sul banco, con la revisione 48eae70, il feedback si chiudeva il giorno stesso dell'apertura. La fase 3 si chiudeva anche senza nessun feedback aperto, e un feedback si apriva con la fase 3 già completata. È la sequenza di Borgoval.

**Causa.**
- `staff_chiudi_consultazione` (script 21) metteva `attiva = false` senza guardare `data_chiusura`.
- `staff_chiudi_fase` non sapeva nulla della consultazione.
- Il pulsante «Chiudi il feedback pubblico» compariva sempre.
- Fase e consultazione erano quindi due oggetti indipendenti.

**Regola applicata.** Guida §6.2.2 e Tabella 3: feedback di 30 giorni solari per il Progetto (20 per il Rapporto, Tabella 4). La durata è quella della fase 3, modificabile dall'Admin. L'ultimo giorno indicato è compreso, in ora italiana (Europe/Rome).

**Modifica** (script 39 e pagina):
- **Chiusura ordinaria.** Possibile solo dal giorno dopo il termine. Chiude anche la fase 3, se è aperta.
- **Prima del termine:**
  - con la pratica annullata, ritirata o chiusa: chiusura con motivazione obbligatoria (tipo «pratica_non_attiva»), che resta nell'audit;
  - con la pratica attiva: chiusura rifiutata, anche con una motivazione.
- **Traccia.** Ogni chiusura registra ora, tipo e motivazione sulla consultazione (nuove colonne `chiusa_il`, `chiusura_tipo`, `motivazione_chiusura`) e nell'audit.
- **Chiusura della fase 3:**
  - senza feedback: rifiutata;
  - con il feedback nel periodo: rifiutata;
  - a termine passato: chiude anche il feedback.
- **Apertura del feedback:**
  - con la fase 3 completata: rifiutata;
  - con la fase 3 non iniziata: apre anche la fase 3, con gli stessi controlli dell'apertura manuale (pratica attiva, fatture scadute).
- **Scadenza della fase 3.** Coincide con il termine del feedback e lo segue anche con l'errata corrige con ripartenza.
- **Pagina.** Prima del termine si legge «Il feedback resta aperto fino al … compreso». Il pulsante «Chiudi il feedback pubblico e la fase 3» compare solo dopo il termine. La chiusura motivata compare solo per una pratica annullata, ritirata o chiusa.
- **Percorso del servizio.** Le stesse regole sono nel database, quindi valgono anche per chiamate fatte senza i pulsanti.

**Prove** (`t39.sql`, 22/10/2026 08:00, tutte come attese):
- fase 3 senza feedback: chiusura rifiutata;
- apertura: 30 giorni, fase 3 in corso con la scadenza uguale al termine;
- giorno di apertura: chiusura rifiutata, anche con motivazione;
- ultimo giorno (termine uguale a oggi): rifiutata, anche la fase 3;
- termine passato (ieri): chiusura ordinaria, fase 3 completata oggi;
- nuovo feedback con la fase 3 completata: rifiutato;
- errata corrige con ripartenza: scadenza della fase 3 riallineata (+30);
- chiusura della fase 3 a termine passato: chiude anche il feedback;
- progetto ritirato: senza motivazione rifiutata, con motivazione «pratica_non_attiva», fase 3 invariata e motivazione nell'audit;
- Comune: rifiutato;
- `cwp_oggi()` uguale all'ora italiana anche con la sessione in un altro fuso.

**Domande aperte (ATTESA_REGOLA).**
1. Esistono casi in cui la Fondazione può chiudere o annullare il feedback prima del termine con la pratica attiva? Oggi nessuno.
2. Guida §6.2.2: i 30 giorni decorrono dalla registrazione nello stato «in fase di validazione». Il portale li conta dall'apertura del feedback, quando il documento diventa pubblico. Le due date devono coincidere?

**Effetti sui dati.**
- Borgoval non è stato toccato: fase 3 completata il 17/10 e consultazione chiusa il 18/10 restano, audit compreso.
- Le chiusure passate hanno le nuove colonne vuote.
- Dopo lo script 39 un caso come Borgoval non si può più ripetere.

### N03 — Fase 5 in corso con ente non assegnato

**Stato: CORRETTO_DA_RITESTARE.** I dati del contratto con l'ente restano **ATTESA_REGOLA**.

**Riprodotto.** Sul banco, revisione 48eae70: la fase 5 si apriva senza ente; servivano solo la pratica attiva, nessuna fattura scaduta e la tariffa di iscrizione saldata. In produzione Borgoval ha la fase 5 «in corso» dal 17/10 senza ente (lettura del 22/10).

**Causa.** `staff_apri_fase` non controllava l'ente.

**Regola applicata.** Guida §6.2.3 e Tabella 3: la validazione la svolge l'ente incaricato. Il portale conosce l'incarico solo attraverso l'ente assegnato alla pratica, quindi la fase 5 parte solo con un ente attivo assegnato. Vale anche per la verifica del Rapporto (fase 5 del Rapporto).

Restano distinti:
- lo stato generale «in fase di validazione» (§6.2.1), che parte dopo la prima verifica documentale e non cambia;
- l'avvio della fase 5;
- la conclusione della validazione: la chiusura della fase 5, che non cambia.

**Modifica.**
- La fase 5 si apre solo con un ente attivo assegnato. Messaggio: «Assegna l'ente di validazione e verifica alla pratica prima di aprire la fase 5».
- Mentre la fase 5 è aperta, l'ente si può sostituire ma non togliere.
- Nella pratica, al posto di «Apri fase» compare l'indicazione di assegnare prima l'ente.

**Prove** (`t39.sql`):
- senza ente: rifiutata;
- con un ente disattivato: rifiutata;
- con un ente attivo: aperta, scadenza +75 giorni;
- togliere l'ente a fase aperta: rifiutato; sostituirlo: ammesso.

**Domanda aperta (ATTESA_REGOLA).** Il portale deve registrare anche i dati del contratto con l'ente (data, riferimento, documento) e richiederli prima della fase 5?

**Effetti sui dati.** Borgoval resta con la fase 5 in corso e senza ente: è un record pregresso incoerente, segnalato e non corretto in automatico (proposta in §4.7).

### N04 — Scadenze assenti e contatori a zero

**Stato: CORRETTO_DA_RITESTARE** (distinzione nella Dashboard e scadenza della fase 3). Il calcolo automatico sulle decorrenze della Tabella 3 resta **ATTESA_REGOLA**.

**Riprodotto.** Lettura in produzione del 22/10:

| Pratica | Fase aperta | Aperta il | Scadenza |
|---|---|---|---|
| CWP-2026-0001 (Borgoval) | 5 | 17/10 | — |
| CWP-2026-003 | 2 | 17/10 | — |
| 3 pratiche | 1 | — | — |

Anche le fasi completate 2, 3 e 4 di Borgoval non hanno una scadenza. I contatori a zero sono quindi aritmeticamente corretti: le pratiche senza data sono escluse.

**Causa.**
- **Fase 1:** la sua durata è 0. Nella Tabella 3 il primo termine è quello della prima verifica, quindi la fase 1 non ha scadenza per costruzione.
- **Fasi 2-5 aperte il 17/10:** la funzione installata oggi imposta la scadenza (apertura + durata della tabella `durata_fase`: 10, 30, 20, 75 giorni), verificato sul banco e sul testo installato. Le date mancano perché fino al 18/10 (commit `fa5afac`) il portale poteva cambiare lo stato delle fasi con una scrittura diretta, senza scadenza. Causa probabile; la conferma è negli eventi «apertura fase» del 17/10, senza «— scadenza».

**Modifica.**
- La Dashboard ha un nuovo riquadro «Fase aperta senza scadenza», arancione quando è maggiore di zero.
- Nella colonna Scadenza compare «nessuna scadenza nota».
- Lo zero di «In scadenza» e «Scadute» non sembra più una garanzia di regolarità.
- Le pratiche non attive non entrano in nessuno dei tre riquadri.
- Le regole sono in `src/lib/scadenze.js`, provate da sole.
- La scadenza della fase 3 è ora il termine del feedback (N02).

**Prove** (`rilievi_n.test.mjs`):
- data assente: «senza scadenza», non in scadenza e non scaduta;
- scaduta ieri; in scadenza oggi e a +7; non in scadenza a +8;
- pratica sospesa, chiusa, annullata o ritirata e fase non aperta: esclusa da tutti e tre i riquadri.

Pagina verificata a schermo su computer e telefono.

**Domanda aperta (ATTESA_REGOLA).** Oggi la scadenza è sempre la data di apertura della fase più la sua durata. La Tabella 3 fa decorrere i termini da eventi precisi:
- caricamento del modulo;
- passaggio allo stato «in fase di validazione»;
- chiusura del feedback;
- caricamento del documento conclusivo del feedback;
- caricamento del rapporto di validazione.

La Fondazione deve decidere:
- se ogni termine va calcolato dal suo evento, quale documento lo fa scattare e come trattare integrazioni e sospensioni;
- se la fase 1 deve avere un termine.

**Effetti sui dati.** Nessuna data inserita a ritroso (proposta in §4.7).

### N05 — Formati eterogenei dei codici progetto

**Stato: ATTESA_REGOLA.** È stato aggiunto solo un avviso non bloccante, da ritestare.

**Origine accertata.** Il generatore (trigger `pratica_codice_automatico`, script 09) produce sempre `CWP-` + anno + 4 cifre, in maiuscolo.
- `CWP-2026-003` e `cwp-026-005` non possono venire dal generatore: sono stati scritti a mano nel campo «Codice pratica». Il campo, facoltativo, mostrava l'esempio «CWP-2026-0001».
- `CWP-2026-0001` è compatibile con il generatore. Non è dimostrato se sia stato scritto a mano o generato.

**Effetti del formato misto, senza duplicazioni dimostrate:**
- il generatore conta solo i codici `CWP-AAAA-numero`: dopo `CWP-2026-0001` e `CWP-2026-003` il prossimo automatico sarebbe `CWP-2026-0004`;
- `cwp-026-005` non è contato;
- l'unicità del database distingue maiuscole e minuscole;
- i Rapporti ereditano il codice del Progetto (es. `cwp-026-005-RM1`).

**Modifica.**
- Il campo si chiama «Codice pratica (lasciare vuoto: lo assegna il portale, CWP-AAAA-NNNN)», con l'esempio «vuoto = automatico».
- Un codice scritto a mano fuori formato mostra l'avviso «non segue il formato automatico: verrà salvato così come è scritto». Non è bloccante e nessun codice viene normalizzato o rinominato.

**Prova.** L'avviso compare per `CWP-2026-003`, `cwp-026-005`, `cwp-2026-0001`, `CWP-2026-00001` e non per `CWP-2026-0001`.

**Domande aperte (ATTESA_REGOLA).**
- I codici scritti a mano sono ammessi?
- Se sì, con quale formato, e vanno trasformati in maiuscolo?
- L'unicità deve ignorare le maiuscole?
- Come trattare i tre codici esistenti: invariati, oppure rinominati con una decisione registrata?

**Effetti sui dati.** Nessuno: nessuna rinomina.

### N06 — Paniere del fattore dell'indifferenziato

**Stato: ATTESA_REGOLA.** Formule e risultati invariati; è stata aggiunta solo trasparenza, da ritestare.

**Accertato.**
- `fattoreIndifferenziato` usa tutte le tipologie a recupero con quantità maggiore di 0 e un fattore numerico, quindi anche verde, legno, inerti, RAEE e ingombranti.
- Il metallo resta fuori perché non ha un fattore.
- Il simulatore usa la stessa funzione.
- Il criterio è più ampio delle cinque frazioni nominate dal capitolo 5.

**Modifica.** Nella pagina del calcolo e nel rapporto PDF, per ogni frazione usata compaiono quota, quantità (t) e fattore. Compaiono anche, a parte:
- le tipologie oltre le cinque nominate, con la nota «paniere in attesa di conferma della Fondazione»;
- quelle escluse perché senza fattore.

I calcoli confermati non cambiano: impronta e risultato salvati sono gli stessi, e i risultati salvati prima mostrano la sola quota.

**Prove** (`rilievi_n.test.mjs`). La fixture comprende le cinque frazioni, il legno (fattore noto), il metallo (senza fattore) e i RAEE (a zero):
- il risultato coincide con un calcolo indipendente del criterio attuale e differisce di più di 0,01 da quello delle sole cinque frazioni, quindi la fixture distingue davvero i due panieri;
- `fuoriPaniere` = legno; `escluse` = metallo; somma delle quote = 1;
- con le sole cinque frazioni nessuna segnalazione;
- denominatore nullo e sole frazioni senza fattore: nessun fattore.

**Domanda aperta (ATTESA_REGOLA).** Quale paniere è predefinito: le cinque frazioni o tutte quelle a recupero con un fattore? A quali condizioni è ammessa un'alternativa motivata nel Progetto, e come si documenta? Dopo la risposta si allineano calcolatore, simulatore e spiegazione.

**Effetti sui dati.** Nessun ricalcolo e nessun credito toccato.

### 4.7 Interventi sui dati proposti a parte (non eseguiti)

Da eseguire solo con decisione di Luca o della Fondazione, uno per uno, con motivazione nell'audit:
1. **Borgoval, fase 5 senza ente.** Assegnare l'ente realmente incaricato, se c'è un contratto, oppure riportare la fase allo stato corretto con una decisione registrata. Nessuna assegnazione automatica.
2. **Fasi aperte senza scadenza** (Borgoval fase 5; CWP-2026-003 fase 2). Se la Fondazione lo decide, impostare la scadenza con «Modifica scadenza» (motivazione obbligatoria), per esempio apertura + durata: 31/12/2026 e 27/10/2026. Nessun inserimento in blocco.
3. **Codici N05:** solo dopo la regola.

### 4.8 Rilascio

**Aggiornamento 22/10/2026 14:50: rilasciato in produzione con l'OK di Luca.** Script 38 e 39 eseguiti alle 14:25-14:27; portale alla revisione `b296195` (poi `e607fa1`, solo Notizie CO2). Passi eseguiti:
1. script `supabase/39_rilievi_n02_n03.sql` nel SQL Editor (si può rieseguire);
2. unione del ramo in main, con pubblicazione automatica su Vercel.

Ritest richiesti, nel Manuale di test aggiornato:

| Rilievo | Prove |
|---|---|
| N01 | 8b.7d, 8b.7f |
| N02 | 4.1, 4.9-4.9d |
| N03 | 5.0, 5.1c |
| N04 | 10.10f |
| N05 | 1.2d |
| N06 | 7.24 |

**Conseguenza per il collaudo.** Con lo script 39 il percorso di prova non può più chiudere il feedback il giorno stesso: 4.9b e le fasi 5-7 richiedono un Progetto di prova con il feedback aperto da più di 30 giorni. In alternativa, su un ambiente di prova, si riduce la durata della fase 3; sul portale operativo varrebbe per tutti i nuovi feedback. Se serve un percorso di prova accelerato, va deciso con Luca e la Fondazione: oggi non esiste e non è stato inventato.
