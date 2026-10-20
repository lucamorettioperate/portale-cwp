# Carbon WastePrint — criticità e consegna all’agente di correzione

**Destinatario:** Luca Moretti e agente incaricato dello sviluppo.  
**Versione:** V01 — 20 ottobre 2026; richiesta credenziali aggiornata al messaggio delle 09:21 Europe/Rome.  
**Oggetto:** correggere le anomalie riprodotte, verificare le lacune segnalate e predisporre una nuova versione da sottoporre a collaudo.

Questo file è autonomo: contiene priorità, dati sintetici, passi di riproduzione, risultati osservati, riferimenti al codice e criteri di verifica. Il dossier completo V03 rimane la raccolta delle prove originali; non è necessario possedere il percorso locale dell’agente che ha svolto il collaudo per leggere questa consegna. Nessuna password, chiave, credenziale o collegamento temporaneo ai documenti è incluso.

> **Risposte dello sviluppo (Claude, per Fondazione Operate) — 20/10/2026.** Le risposte sono inserite qui sotto ogni scheda, nei riquadri «Risposta dello sviluppo», e riassunte nel punto 9-bis. Le correzioni sono **in produzione dal 20/10/2026 (commit `e0c91a9`)** e lo script 35 è stato eseguito sul database reale con il mandato di Luca Moretti. Dove serve una regola della Fondazione la domanda è scritta nella scheda, con lo spazio «Risposta della Fondazione» da compilare.
>
> | Esito | ID |
> |---|---|
> | `CORRETTO_DA_RITESTARE` | D01, D02, D03, D04, D05, D06, D07, R05 (presidio), R07 |
> | `ATTESA_REGOLA` | R01, R02, R03, R04 (messaggio chiarito), R06, riuso |
> | `APERTO` | R08 |

## 1. Stato e mandato dell’agente ricevente

Il portale non è ancora sufficientemente verificato per un giudizio positivo sull’uso completo. Il caso ordinario torna, ma questo non annulla le anomalie sui dati errati. Il catalogo V03 comprende 97 casi attivi: 40 superati, 12 falliti, 15 parziali, 7 con riserva e 23 bloccati; un’ulteriore riga conserva l’esclusione dell’assistente AI. Più casi possono riferirsi allo stesso problema: 12 casi falliti non significano 12 bug indipendenti.

I rilievi sono **15**, con qualificazioni diverse: D01–D04 e D07 sono anomalie funzionali riprodotte; D05 è una lacuna osservata nella vista delle operazioni; D06 è un rischio dimostrato soltanto nell’utilità CSV locale. R01–R08 sono divergenze, convenzioni o presidi da chiarire/verificare, non otto bug backend già accertati.

Al ricevimento dell’incarico, l’agente deve:

1. Identificare la versione di partenza, riprodurre localmente le anomalie e verificare se sono ancora presenti nel codice corrente.
2. Correggere i difetti funzionali in una copia/ramo dedicato, senza intervenire direttamente sui dati o sul servizio in esercizio. Proteggere interfaccia, motore di calcolo e servizio di salvataggio nei rispettivi punti di ingresso: il solo limite grafico di un campo non basta.
3. Per D05 verificare prima il contenuto effettivo dei log; per D06 accertare il percorso di esportazione realmente esposto. Distinguere causa confermata e ipotesi di diagnosi.
4. Per R01–R08 e la questione dei segni del riuso, ottenere la regola necessaria o mantenere il punto aperto; non scegliere una formula perché permette di far passare un test.
5. Consegnare modifiche revisionabili, test di regressione pertinenti, risultati e note sugli eventuali dati già salvati da riesaminare. Non riclassificare automaticamente scenari storici o crediti.

**Confini:** l’assistente AI è escluso dal lavoro. Questa consegna non autorizza deploy, migrazioni sul database reale, cancellazioni, correzione massiva di dati storici, pubblicazioni, emissioni/vendite/cancellazioni di crediti o campagne remote di carico, sicurezza attiva, concorrenza e recupero. Il ripristino da backup e i test con guasti richiedono ambiente e accordo separati. Le correzioni possono essere preparate e verificate in locale; il rilascio e le operazioni sui dati reali richiedono il relativo mandato di Luca Moretti/Luca Belfiore.

## 2. Versioni, fonti e livelli di prova

- Portale osservato: <https://portale-cwp.vercel.app> — prove del 19–20 ottobre 2026, Chrome, ruolo Admin.
- Repository acquisito: <https://github.com/lucamorettioperate/portale-cwp>.
- Revisione sorgente: `2526602475e4b717490dff6b8302e47f39651bbe`, ricontrollata il 20 ottobre. **Non è stato dimostrato che coincida con la build online.** Chiedere/produrre identificativo del deploy e migrazioni effettivamente applicate.
- Programma e Metodologia: v1.2 del 04/09/2025; manuale utente 2.7, amministratore 3.7, test 3.3, registro sviluppo 4.3 e ripristino 1.1, corpus del 19/10/2026.
- Fonti originali: [cartella CWP PIATTAFORMA](https://drive.google.com/drive/folders/1wn6mkVq7L0I8vMXh04HM9Zt6BPRJFPTb), [Materiale 19_10_2026](https://drive.google.com/drive/folders/1AS9_6CTd24Q42sZD7q6vMnmUZl9mB37T).
- Fonte dei calcoli: [Metodologia F05](https://drive.google.com/file/d/1jj19aR4-kXGqHwGR7S2Ra-aS_Plfu1YQ/view), in particolare formule 1, 16–17, calcolo delle emissioni e cap. 7/Tabelle 15–16. Ammissibilità: Standard F04. Procedimento: Guida F01. Qualità dei dati: F08.

Le regole metodologiche, i manuali software e il comportamento effettivo sono livelli distinti. Il codice non rende autorevole una sua interpretazione. La lettura di uno script SQL non dimostra che sia installato, né che rappresenti tutti i vincoli del database corrente. Non sono disponibili la specifica originale del 15/09, tutti gli originali commerciali/contrattuali richiamati dal simulatore o il rapporto integrale del precedente agente; la loro assenza resta visibile.

Nel seguito **PORTALE** significa comportamento osservato nell’interfaccia online; **LOCALE-SORGENTE** significa prova sui moduli del commit acquisito; **ANTEPRIMA** significa analisi del file prima dell’applicazione. Non dichiarare eseguite operazioni finali o controlli backend sulla base della sola presenza di un pulsante.

## 3. Ordine di lavorazione proposto

P0: blocchi alla validità dei risultati o al corretto controllo dei prerequisiti. P1: correzioni funzionali/tracciabilità da completare prima della chiusura del collaudo. P2: chiarezza e leggibilità, salvo impatti ulteriori. Le priorità sono proposte di collaudo, non una valutazione di vulnerabilità completa.

| Ordine | ID | Problema | Azione iniziale |
|---|---|---|---|
| 1 | D07 | CSV diretto accetta pesi negativi e salva crediti gonfiati | Validare tutti i canali di input, calcolo e persistenza |
| 2 | D01 | Produzione/secco negativi nel simulatore, RD oltre 100% | Impedire risultati salvabili da input fisicamente impossibili |
| 3 | D02 | Buffer manuale 90% salvabile oltre il massimo 80% | Applicare dominio e messaggi anche fuori dal solo campo UI |
| 4 | D04 | Date inesistenti convertite in date reali | Validazione rigorosa calendario nei parser e primo anno |
| 5 | D03 | Prezzo annuale zero sostituito dal prezzo generale | Distinguere zero esplicito, assenza e dato invalido |
| 6 | D05 | Vista operazioni senza identificazione utile dello scenario | Verificare log effettivi e renderli utilizzabili dal revisore |
| 7 | D06 | Formula innocua conservata nel CSV | Verificare esportazioni esposte e neutralizzazione sicura |
| In parallelo | R01–R08 | Regole, presidi e presentazione ancora da chiarire | Risolvere secondo le schede, senza trasformarli in bug già dimostrati |

## 4. Dati sintetici e riferimenti ripetibili

### 4.1 Simulatore: riferimento S, in tonnellate

Scenario di prova: `COLLAUDO AL V02 20261019 - riferimento indipendente`, Comune fittizio COLLAUDO AL V02. Non usare scenari reali per riprodurre i negativi.

| Voce | Valore |
|---|---|
| Anno base | 2025 |
| Popolazione | 1.000 abitanti |
| Rifiuti anno base | 260 t organico + 140 t RUR = 400 t |
| Anni simulati | 2027–2036, oppure il solo 2027 per la prova locale |
| Produzione annua prevista | 300 t = 300 kg/abitante |
| Secco previsto | 75 kg/abitante = 75 t |
| Buffer | 20% |
| Prezzo generale | 32 €/credito |

Fattore organico −3,66 kgCO₂eq/kg da F05. Nel campione a composizione costante anche il fattore RUR è −3,66. Ricostruzione indipendente aggregata: emissioni attese 400×3,66=1.464 tCO₂eq; progetto 300×3,66=1.098; riduzione 366; buffer 73,2; netto **292,8 tCO₂eq/anno**, cioè 2.928 in dieci anni. Il raccordo economico a interi è R03, da trattare separatamente.

### 4.2 Calcolatore ex post: riferimento C, mille volte più piccolo di S

Bozza di sola prova: `COLLAUDO AL V02 - EX POST sintetico NON CONFERMARE`. ID `ec3f8c12-d554-462e-9ea0-104b198678c7`; pratica associata già di prova `cwp-026-005`. Questa identificazione serve a riconoscere lo stato già esistente, non autorizza a usarla come ambiente per conferme definitive.

Anno 2025; rifiuti del territorio **0,26 t organico + 0,14 t RUR = 0,40 t**; PEF domestiche 100%, non domestiche 0%; una classe UD1, una utenza, Kb=1; misurati organico e RUR; buffer manuale 20%; nessun bene a riuso. Le quantità della Banca Dati Utenze sono in **kg**:

```csv
Utenza;Macrocategoria;Classe;Tipologia rifiuto;Peso centri di raccolta (kg)
S001;UD;UD1;organico;225
S001;UD;UD1;indifferenziato;75
```

Atteso indipendente: 400 kg×3,66=1.464 kgCO₂eq; progetto 300 kg×3,66=1.098 kg; ΔI=−366 kg; lordo **0,366 tCO₂eq**, buffer 0,0732, netto **0,2928**. UI arrotondata a tre decimali: 0,293. Non confondere le tonnellate dei rifiuti territoriali con i kg dei conferimenti.

Variante per integrità: stesso CSV e due righe, ma RUR=90 kg; netto atteso **0,24888 tCO₂eq**. Il portale ha invalidato correttamente il vecchio risultato prima del ricalcolo.

Questo campione verifica l’aritmetica, non l’ammissibilità ufficiale del progetto. Popolazione/cluster e percentuale di letture valide non sono completi. Non confermare la bozza né usarla per emettere crediti.

## 5. Schede dei difetti e delle lacune

### D07 — CSV diretto accetta pesi negativi e salva crediti gonfiati

**Qualifica:** DIFETTO RIPRODOTTO. **Priorità:** P0. **Impatto proposto:** Maggiore. **Evidenza:** PORTALE.

**Atteso.** Rifiutare un peso negativo, senza risultato riutilizzabile e con messaggio esplicito.

**Riproduzione.** Bozza sintetica ec3f8c12…; passo5, importa CONFERIMENTI_NEGATIVI_DA_RIFIUTARE.csv; Calcola; scarica riepilogo; riapri. Non confermare crediti.

**Osservato.** Importate 2 righe: organico−225kg,RUR75kg. Nessuna incoerenza trovata. EA1464kg, EP−549kg, ΔI−2013kg; lordo2,013t e netto1,6104t con buffer20%. Risultato ancora presente dopo reload. Conferma calcolo abilitato.

**Limiti della prova.** Nessuna conferma finale o emissione. Il canale tracciato completo respinge invece i negativi nel parser locale. Dati e risultato ordinari ripristinati e riaperti.

**Punti di ispezione.** `src/pages/CalcoloCrediti.jsx`: `BancaDati`, `importa`, `SCHEMA_CONFERIMENTI`; `src/lib/csv.js` (`csvInOggetti`); `src/lib/crediti/tracciato.js` (`controllaCoerenza`); `src/lib/crediti/calcolo.js` (`conferimentiInPeso`, `calcolaCrediti`); `src/lib/crediti/archivio.js` (salvataggio); vincoli effettivi di `calcolo_conferimento` e trigger degli script 11/20. Nei file acquisiti non è emerso un controllo completo della non negatività, ma l’intero schema installato non è stato ispezionato.

**Verifica dopo la correzione.** Su release corretta provare valori negativi per tutti i pesi/volumi/svuotamenti nei due canali; verificare rifiuto UI/servizio e conservazione del precedente stato valido; caso ordinario e riapertura.

**Traccia nel collaudo.** Casi DAT07, DAT09; evidenze V03:NEGATIVO,RETICOLO,RIPRISTINO.

Variante esatta del CSV che il portale ha accettato:

```csv
Utenza;Macrocategoria;Classe;Tipologia rifiuto;Peso centri di raccolta (kg)
S001;UD;UD1;organico;-225
S001;UD;UD1;indifferenziato;75
```

Con riferimento C: progetto −150 kg×3,66=−549 kgCO₂eq; ΔI=−549−1.464=−2.013 kg; lordo 2,013 t e netto 1,6104 t. È un risultato fisicamente inutilizzabile prodotto da un peso negativo, non una riduzione reale. La variante è stata importata, calcolata, scaricata in CSV e riaperta; poi integralmente ripristinata al riferimento ordinario C. Non è stata eseguita la conferma definitiva.

La correzione deve chiarire anche lo scarto di singole righe: un import parziale non deve apparire come un dataset integralmente valido. Verificare che il rifiuto dei dati errati non cancelli o lasci parzialmente sostituito il precedente dataset senza un messaggio e uno stato coerenti. Il guasto di importazione non è stato provocato in esercizio.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Riproduzione.** Riprodotto sul commit corrente 640111a con lo stesso CSV. `csvInOggetti` accettava `-225` come numero valido. Il salvataggio e il motore non avevano un controllo di non negatività. Nel database le colonne `numeric` di `calcolo_conferimento` e `calcolo_riuso` non avevano vincoli (script 11 e 20 verificati).
>
> **Causa accertata.** Il controllo «negativo = scarto» esisteva solo nel lettore del tracciato completo (`interpretaTracciato`). Il canale CSV diretto (`BancaDati.importa`) non passava da quel controllo.
>
> **Correzione su quattro strati, più il database:**
>
> 1. Import CSV: colonne numeriche con `min: 0`. L'import è ora **tutto o niente**: con anche una sola riga errata il file non si importa e la Banca Dati salvata resta quella di prima. Il messaggio è «File non importato: n righe da correggere…» con riga e motivo. Così non può più comparire un import parziale come se fosse un dataset valido.
> 2. Salvataggio (`archivio.js`): `valoriNonAmmessiBdu` controlla tutte le righe **prima** di cancellare quelle vecchie.
> 3. Controlli di coerenza (`tracciato.js`): errore «Banca Dati Utenze con n righe con valori negativi o non numerici». Questo errore blocca anche la conferma (vedi R05).
> 4. Motore (`calcolaCrediti`): con valori non ammessi `bloccato = true` ed `errori` elencati; lordi, buffer, netti e debito valgono 0. La pagina mostra il riquadro rosso «Calcolo bloccato», non salva il risultato e toglie quello eventualmente già salvato.
> 5. Database (script `35_controlli_collaudo.sql`, **eseguito in produzione il 20/10**): vincoli `calcolo_conferimento_non_negativi` e `calcolo_riuso_non_negativi` (`NOT VALID`: valgono per ogni nuova riga, le righe esistenti non vengono toccate).
>
> **Campi coperti:** svuotamenti, volume contenitore, peso e volume delle strutture informatizzate, peso e volume dei centri di raccolta, N. utenze, pezzi e peso del riuso. Zero e cella vuota restano ammessi.
>
> **Prove:** `test/collaudo_v01.test.mjs`, prove «D07» (5) e «caso ordinario C» (0,2928; variante RUR 90 → 0,24888, entrambe invariate). Banco database `t35.sql`: inserimenti negativi rifiutati, positivi e vuoti accettati.
>
> **Rimane.** Resta senza transazione unica il guasto di rete a metà salvataggio. Il caso era già noto e presidiato: la conferma è impossibile finché il risultato non corrisponde alla Banca Dati salvata (script 20).
>
> **Impatto sui dati salvati.** L'ultima istruzione dello script 35 conta, in sola lettura, le righe negative già presenti. Nessuna correzione automatica. Secondo il rapporto la bozza C è già stata riportata ai valori ordinari.
>
> **Per il ritest:** casi 7.17 e 7.17b del Manuale di test 3.9 (DAT07, DAT09).

### D01 — Valori negativi producono risultati salvabili e RD oltre il 100%

**Qualifica:** DIFETTO RIPRODOTTO. **Priorità:** P0. **Impatto proposto:** Maggiore. **Evidenza:** PORTALE e LOCALE-SORGENTE.

**Atteso.** Popolazione, produzione e secco rispettano i limiti fisici; un valore impossibile è respinto o reso inequivocabilmente inutilizzabile.

**Riproduzione.** Nel nuovo scenario di riferimento, prima riga 2027: impostare produzione pro capite −10 e salvare; ripristinare 300. Impostare secco pro capite −10 e salvare; ripristinare 75. Per la popolazione negativa usare solo il caso locale SIM05.

**Osservato.** Portale: produzione −10 kg/ab → totale −10 t, lordo 1500,6 e netto 1200,5 tCO2eq per il primo anno; il messaggio sul secco eccedente non identifica come invalida la produzione negativa. Secco −10 kg/ab con totale 300 t → RD 103,3%, scenario salvato. Locale: popolazione −1000 ammessa senza avvisi, riferimento/emissioni negativi e RD 125%.

**Limiti della prova.** La popolazione negativa è riprodotta soltanto localmente. Gli esiti riguardano la simulazione; non dimostrano emissione di crediti ufficiali. Tutti i valori del nuovo scenario sono stati ripristinati.

**Punti di ispezione.** `src/pages/Simulatore.jsx` (campi e salvataggio), `src/lib/crediti/simulatore.js` (`simula`), `src/lib/crediti/scenari.js`, `supabase/28_simulatore.sql`. Sono punti di ispezione: verificare il servizio e i vincoli effettivi prima di affermare che manchino controlli in tutti gli strati.

**Verifica dopo la correzione.** Ripetere negativi/zero/vuoti/estremi su UI e servizio di salvataggio; verificare nessun risultato riutilizzabile con input invalido, poi caso ordinario e riapertura.

**Traccia nel collaudo.** Casi SIM05, SIM06, UI03; evidenze E01 SIM05/SIM06; E06 ui-negative e ui-rd-duration-restored.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Riproduzione.** Riprodotto sul codice corrente: secco −10 → RD 103,3%; produzione −10 t → netti positivi; popolazione −1000 → RD 125%. In nessun caso c'era un errore.
>
> **Causa accertata.** `simula` convertiva i valori con `num()` senza verificarne il dominio. Il secco oltre il totale veniva solo «tagliato» con un avviso. Né `scenari.js` né lo script 28 controllavano i dati dello scenario (la colonna `dati` è un jsonb senza vincoli).
>
> **Correzione.** Nuova funzione `erroriScenario` (`simulatore.js`), usata in tre punti:
> - `simula`: con errori nessun risultato (`righe` vuote, `totali` null) e l'elenco `errori`;
> - la pagina: riquadro rosso «Dati non ammessi» e «Salva» disattivato con «Da correggere prima di salvare: n»;
> - `scenari.js`: rifiuto prima di scrivere.
>
> Nel database lo script 35 aggiunge il trigger `trg_scenario_valida`.
>
> **Regole:**
> - popolazione di riferimento, attuale e di ogni anno maggiore di 0;
> - produzione totale dell'anno maggiore di 0;
> - secco e rifiuti di riferimento non negativi;
> - secco non oltre la produzione;
> - vuoto = «non indicato» (l'anno prende il punto di partenza, come prima); lo zero è un valore vero.
>
> **Aspettativa cambiata (motivata).** `test/simulatore.test.mjs` si aspettava l'avviso per il secco oltre il totale. Ora quel caso è un errore senza risultato, perché è fisicamente impossibile.
>
> **Prove:** `collaudo_v01`, «D01» (2 prove con 7 varianti) e «caso ordinario S» (292,8 l'anno; 2.928 in dieci anni, invariato). Banco database `t35.sql`.
>
> **Impatto sui dati salvati.** Gli scenari salvati non vengono modificati. Uno scenario vecchio con valori impossibili si apre ma non si salva finché non si corregge.
>
> **Per il ritest:** 8b.5, 8b.5b (SIM05, SIM06, UI03).

### D02 — Buffer del 90% applicato e salvato oltre il massimo 80%

**Qualifica:** DIFETTO RIPRODOTTO. **Priorità:** P0. **Impatto proposto:** Maggiore. **Evidenza:** PORTALE e LOCALE-SORGENTE.

**Atteso.** Il limite metodologico dell’80% è rispettato oppure il dato fuori metodo è esplicitamente impedito nell’uso della stima.

**Riproduzione.** Nel solo scenario sintetico, impostare buffer manuale 90, salvare e leggere risultati; riportare a 20.

**Osservato.** Campo DOM min=0/max=80, validity=false, ma compare “Scenario salvato”. Lordo annuo 366, buffer 329,4, netto 36,6; nessun avviso del superamento. Anche il modulo locale applica il 90%.

**Limiti della prova.** Un buffer maggiore è prudenziale rispetto al netto, ma viola il dominio dichiarato e rivela che il limite del campo non impedisce il salvataggio. Nessuna emissione ufficiale.

**Punti di ispezione.** `src/pages/Simulatore.jsx`, `src/lib/crediti/simulatore.js` (buffer manuale, massimo 80), persistenza dello scenario. Non basta affidarsi a min/max del campo HTML.

**Verifica dopo la correzione.** Provare 0, 80, appena oltre 80, 90, 100, negativi e campo vuoto; controllare motore, messaggio, salvataggio e riapertura.

**Traccia nel collaudo.** Casi SIM08, UI04; evidenze E01 SIM08; E06 ui-buffer90.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Riproduzione.** Riprodotto: nel simulatore `simula` limitava il buffer a 0–**100** (non 80). Nel calcolatore `calcolaBuffer` tagliava il buffer manuale a 80 senza avviso. Il salvataggio non controllava nulla: valeva solo `min`/`max` del campo HTML.
>
> **Correzione.**
> - Simulatore: buffer fuori da 0–80, vuoto o non numerico → errore bloccante (stesso schema di D01), «Salva» disattivato. Il motore limita comunque a 80 come ultima difesa. Gli scenari salvati senza buffer prendono il valore predefinito del 20%, come prima.
> - Calcolatore: `calcolaBuffer` restituisce `erroreManuale` e `calcolaCrediti` blocca il calcolo, senza crediti e senza salvataggio.
> - Database (script 35): vincolo `calcolo_crediti_valori_ammessi` (buffer_pct 0–80, crediti non negativi) e controllo del buffer nel trigger degli scenari.
>
> **Prove:** «D02» (3 prove): 0 e 80 ammessi; 80,01, 90, 100, −1, vuoto e testo rifiutati; buffer manuale 90 nel calcolatore bloccato. Banco database `t35.sql`.
>
> **Per il ritest:** 8b.5c e 7.19 (SIM08, UI04).

### D04 — Date impossibili normalizzate e conteggiate nelle letture

**Qualifica:** DIFETTO RIPRODOTTO. **Priorità:** P1. **Impatto proposto:** Maggiore. **Evidenza:** PORTALE-ANTEPRIMA e LOCALE-SORGENTE.

**Atteso.** 31/02/2025 è scartata con motivazione; non diventa una lettura di marzo né una data valida per il primo anno.

**Riproduzione.** Eseguire DAT02 con data("31/02/2025") e il parser integrato con una lettura sintetica avente quella data. Eseguire CAL03 con coefficientePrimoAnno("2025-02-31",2025).

**Osservato.** Il parser restituisce 3 marzo 2025; il parser integrato conta 1 lettura usata, senza errori, avvisi o scarti. Il primo anno restituisce 304 giorni e coefficiente 0,8328767123. V03: anteprima online del ZIP con31/02/2025 accetta 2 letture senza incoerenze; applicazione annullata.

**Limiti della prova.** Provato parser e anteprima; nessuna applicazione online della data impossibile.

**Punti di ispezione.** `src/lib/crediti/tracciato.js`, funzione `data`; `src/lib/crediti/calcolo.js`, `coefficientePrimoAnno`; eventuali altri parser data, incluso `src/lib/date.js`, da controllare senza presumere che condividano lo stesso difetto.

**Verifica dopo la correzione.** Giorni inesistenti, bisestili, confini anno, seriali Excel, formati ISO/italiani e importazione reale in ambiente di prova.

**Traccia nel collaudo.** Casi CAL03, DAT02; evidenze E01 CAL03/DAT02; E03 DAT02-INTEGRATO; V03:DATA_IMPOSSIBILE.

Per l’anteprima online è stato usato uno ZIP sintetico con `5_Conferimenti` vuoto e due righe in `6_Letture`: S001/UD/UD1/organico, data `31/02/2025`, centro raccolta, 225 kg; S001/UD/UD1/indifferenziato, data `01/06/2025`, centro raccolta, 75 kg. Il portale mostra «2 righe · 1 utenze · da 2 letture» e «Nessuna incoerenza trovata». L’anteprima è stata annullata. Le date valide non devono essere invalidate dalla correzione; verificare in particolare il 29 febbraio in anni bisestili e non bisestili.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Riproduzione.** Riprodotto: `data("31/02/2025")` → 3 marzo; `coefficientePrimoAnno("2025-02-31", 2025)` → 304 giorni.
>
> **Causa accertata.** `new Date` e `Date.UTC` «spostano» i giorni che non esistono, e non c'era un controllo di ritorno. In `src/lib/date.js`, `formatoData` e `giorniA` avevano lo stesso comportamento, ma lì le date vengono dal database. La colonna `calcolo_crediti.data_avvio` è di tipo `date` e Postgres rifiuta già «2025-02-31» (verificato sul banco).
>
> **Correzione.**
> - `tracciato.data` restituisce null per giorno o mese inesistenti, quindi la lettura viene scartata con il motivo «giorno inesistente o formato diverso da gg/mm/aaaa».
> - Seriali Excel accettati solo tra 1 e 2958465.
> - `coefficientePrimoAnno` restituisce un errore (e `calcolaCrediti` si blocca) invece di 304 giorni.
> - `date.js` ha la nuova `dataIsoEsiste`, usata da `formatoData` e `giorniA`.
> - Il 29/02 resta valido negli anni bisestili.
>
> **Prove:** «D04» (5 prove):
> - 31/02, 13/13 e 29/02/2025 rifiutati; 29/02/2028, 31/12 e 01/01 validi;
> - seriali Excel;
> - primo anno: 29/02/2028 → 307 giorni; 31/12 → 1 giorno;
> - ZIP con `6_Letture` del rapporto → 1 lettura usata e lo scarto motivato.
>
> **Per il ritest:** 7.18 (CAL03, DAT02).

### D03 — Prezzo annuo esplicito zero sostituito dal prezzo generale

**Qualifica:** DIFETTO RIPRODOTTO. **Priorità:** P1. **Impatto proposto:** Maggiore. **Evidenza:** PORTALE e LOCALE-SORGENTE.

**Atteso.** Zero è un valore esplicito: a prezzo 0 i ricavi annui sono 0; il vuoto può ereditare il prezzo generale.

**Riproduzione.** Con prezzo generale 32 e 292 crediti economici annui, digitare 0 nel prezzo del 2027 e leggere il ricavo. Ripristinare 32. Locale: 100 crediti, prezzi[2027]=0, prezzo generale=32.

**Osservato.** Portale: con input 0 il ricavo rimane 9344 €. Locale: prezzo effettivo 32 e ricavo 3200 € invece di 0. Il codice usa il valore numerico annuo in una selezione basata su valore vero/falso.

**Limiti della prova.** Lo zero transitorio non è stato salvato. Il comportamento di ricalcolo è riprodotto in UI; non è stata verificata la persistenza del prezzo zero.

**Punti di ispezione.** `src/lib/crediti/simulatore.js`, funzione `simulaEconomia`: il prezzo specifico passa da `num(...)` alla scelta `proprio || prezzo0 * fattore`, che considera falso anche zero. Controllare anche il prezzo generale e gli estremi min/max senza assumerli già difettosi.

**Verifica dopo la correzione.** Zero numerico e testuale, vuoto, prezzo positivo, variazione annua e riapertura; ricavi, scenari minimo/massimo e CSV coerenti.

**Traccia nel collaudo.** Casi ECO09, ECO07; evidenze E01 ECO09; osservazione UI del 19/10/2026 nella cronologia E07.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Causa accertata.** Confermata quella indicata: `proprio || prezzo0 * fattore` tratta lo 0 come «mancante». Lo stesso difetto c'era per il prezzo generale (0 = nessuna economia) e per minimo e massimo (0 = non indicati).
>
> **Correzione** (`simulaEconomia`, nuova `erroriEconomia`):
> - vuoto = eredita il valore (o non indicato); 0 = valore vero (ricavi 0);
> - prezzo generale 0 valido;
> - minimo 0 = scenario peggiore con ricavi 0;
> - prezzi o costi negativi o non numerici, e minimo superiore al massimo → «Valori economici non ammessi», niente risultato economico, «Salva» disattivato;
> - la variazione annua può essere negativa ma non sotto −100%.
>
> Nel database lo script 35 aggiunge gli stessi controlli economici.
>
> **Prove:** «D03» (3 prove): 0 numerico e testuale, vuoto, prezzo positivo, generale 0, minimo 0, negativi e testo.
>
> **Per il ritest:** 8b.5d (ECO09, ECO07). Il CSV e l'Excel usano gli stessi valori di `simulaEconomia`.

### D05 — Audit del simulatore senza identificazione utile dello scenario

**Qualifica:** LACUNA RIPRODOTTA NELLA VISTA. **Priorità:** P1. **Impatto proposto:** Media. **Evidenza:** PORTALE, vista Audit.

**Atteso.** Un revisore riconosce lo scenario modificato e può ricostruire almeno gli elementi materiali del cambiamento.

**Riproduzione.** Salvare soltanto il nuovo scenario sintetico e aprire Audit nel periodo della prova.

**Osservato.** Visibili creazione e sei aggiornamenti come insert/update scenario_simulazione con autore/ruolo e orario; nella vista consultata mancano nome/ID dello scenario e valori prima/dopo.

**Limiti della prova.** Non prova che gli stessi dettagli siano assenti nelle tabelle o in altri log del fornitore. Richiede evidenza tecnica per la tracciabilità completa.

**Punti di ispezione.** Vista Audit del portale; `src/lib/crediti/scenari.js` e `supabase/28_simulatore.sql`; confrontare dati realmente registrati, selezione della vista e presentazione. Non riscrivere gli eventi storici per completarli artificialmente.

**Verifica dopo la correzione.** Distinguere modifiche a due nuovi scenari; ricollegare ogni evento all’oggetto e confrontare almeno variazioni di input e revisione del calcolo.

**Traccia nel collaudo.** Casi UI06; evidenze Cronologia E07; osservazione UI Audit 19/10, circa 21:21–21:26 Europe/Rome.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Verifica dei log** (come richiesto, prima di correggere). Il trigger `audit_registra` (script 21, collegato agli scenari dallo script 28) registra già in `audit_event`:
> - `oggetto_id`, cioè l'id dello scenario;
> - per le modifiche, il `dettaglio` come `{ campo: { da, a } }`, compreso `dati` (tutti gli input prima e dopo), `crediti_netti_totali`, `rd_finale` e `simulato_il`;
> - per le creazioni e cancellazioni, la riga intera con il nome.
>
> **Causa accertata.** La lacuna è solo della **vista**: la pagina Audit non mostrava né l'oggetto né il dettaglio.
>
> **Correzione.** Nuova colonna «Oggetto e modifiche» in Audit e nella scheda Operazioni di Audit User (`src/lib/auditDettaglio.js`, `src/components/OggettoEModifiche.jsx`):
> - tipo, nome e codice breve dello scenario, per esempio «Scenario del simulatore «COLLAUDO AL V02 …» (5c3a9e10)»;
> - «n modifiche» apribile, con ogni campo «da → a»: buffer, popolazione e produzione anno per anno, valore del credito, crediti netti stimati, ultimo ricalcolo;
> - ricerca anche per nome o codice;
> - nel CSV di Audit User le colonne «Id oggetto» e «Modifiche».
>
> Nessun evento storico riscritto. Siccome i dati erano già registrati, la nuova vista rende leggibili **anche gli eventi del 19/10 (21:21–21:26)** delle prove. Verificato in produzione: per esempio l'evento delle 21:23:53 mostra «Scenario del simulatore «COLLAUDO AL V02 20261019 - riferimento indipendente» (8d3a7cb5)», con «Anno 2027 › secco pro capite (kg/ab): 75 → -10», «Buffer (%): 90 → 20», «Ultimo ricalcolo» e «Crediti netti stimati (tCO₂eq): 366 → 2928».
>
> **Prove:** «D05» (riconoscimento di due scenari, campi cambiati, creazione) e verifica a schermo con dati di prova (computer e telefono).
>
> **Per il ritest:** 8b.9b (UI06): due scenari nuovi modificati, poi Audit.

### D06 — Esportatore CSV conserva una cella che inizia con formula

**Qualifica:** RISCHIO LOCALE DA CONFERMARE NEL FLUSSO. **Priorità:** P1. **Impatto proposto:** Da definire in base all’esposizione. **Evidenza:** LOCALE-SORGENTE.

**Atteso.** Contenuti non attendibili esportati come testo non sono interpretati come formule da un foglio di calcolo.

**Riproduzione.** Chiamare scriviCsv(["Nota"],[["=1+1"]]); nessuna apertura o esecuzione in un foglio di calcolo.

**Osservato.** Il CSV contiene una seconda riga =1+1 senza neutralizzazione.

**Limiti della prova.** Verificata solo un’innocua formula nell’utilità CSV. Non è stato dimostrato un percorso attaccante→campo→export reale, né eseguito un attacco; altri esportatori possono avere regole differenti.

**Punti di ispezione.** `src/lib/csv.js`, funzione `scriviCsv`; mappare tutti i chiamanti e gli eventuali generatori indipendenti. La semplice inclusione tra virgolette del CSV non garantisce che un foglio di calcolo tratti una formula come testo.

**Verifica dopo la correzione.** Mappare campi esportabili non attendibili e i client supportati; provare prefissi e caratteri iniziali pericolosi con contenuti innocui, mantenendo la fedeltà del dato.

**Traccia nel collaudo.** Casi DAT04; evidenze E01 DAT04.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Esposizione mappata.**
> - `scriviCsv` (10 chiamate): riepilogo e dettaglio del calcolo, modelli, Registro dei crediti, Audit User (accessi e operazioni). Alcune celle contengono testi scritti da utenti o arrivati dai file, per esempio codici utenza, nomi di documento, email digitate al login, motivazioni.
> - Un secondo generatore indipendente nel fascicolo (`fascicolo.js`): nomi di file, commenti, osservazioni pubbliche, motivazioni.
> - Un terzo nel CSV del simulatore (`righeCsv`): nome dello scenario e del Comune.
> - L'Excel del simulatore scrive solo celle di testo `inlineStr`, che un foglio di calcolo non esegue come formule: non era esposto.
> - I PDF non sono interessati.
>
> **Correzione.** Nuova `testoSicuroCsv` (`csv.js`), usata dai tre generatori. Un testo che inizia con `=`, `+`, `-`, `@`, tabulazione o a capo prende un apostrofo davanti. I numeri veri e i testi che sono solo un numero (anche negativo, come «-3,66») restano invariati, per fedeltà del dato.
>
> **Prove:** «D06» (2 prove: prefissi pericolosi, numeri negativi invariati, CSV del simulatore).
>
> **Per il ritest:** 7.22 (DAT04). L'apertura in Excel e LibreOffice va confermata dal collaudo: dallo sviluppo non è stato aperto alcun foglio di calcolo.

## 6. Riserve e decisioni da non correggere arbitrariamente

Questi punti richiedono una regola autorevole, una verifica tecnica ulteriore o una scelta di chiarezza. Conservare gli ID: un punto può essere chiuso soltanto con la relativa motivazione ed evidenza.

### R01 — Stesse opzioni danno buffer 20% nel calcolatore e 30% nel simulatore

**Qualifica:** DIVERGENZA E RISERVA METODOLOGICA. **Priorità:** P0. **Evidenza:** LOCALE-SORGENTE e DOCUMENTALE.

**Regola da chiarire.** Una regola di dimezzamento motivata e coerente con F05; differenze tra stima ed ex post dichiarate e giustificate.

**Riproduzione disponibile.** Solo virtuose=20%; tutte le utenze monitorate=0%; RUR+organico Tab16=20%; tariffa puntuale attiva. Confrontare calcolaBuffer e bufferMetodologia.

**Osservato.** Calcolatore: (20+20)/2=20%. Simulatore: 20+20/2=30%. Il manuale e le note software descrivono letture diverse; il punto non è risolto dall’esistenza dei test dello sviluppatore.

**Limiti.** È accertata la divergenza sullo snapshot; non è stabilito quale interpretazione sia autorevole e non è dimostrata la corrispondenza dello snapshot con il pubblicato.

**Verifica richiesta.** Dopo interpretazione motivata della Fondazione/responsabile metodologico: matrice Tab15/16, virtuose, tariffa, riduzioni centri e tetto80 su entrambi i motori.

Configurazione locale esatta: calcolatore `soloVirtuose=true, bufferVirtuose=20, utenzeMonitorate={res:true, nonres:true, und:true}, rifiutiMisurati={indifferenziato:true, organico:true}, tariffaPuntuale=true` → 20%; simulatore `soloVirtuose=true, utenze="tutte", rifiuti="rur_org", tariffaPuntuale=true` → 30%. Il primo dimezza il totale, il secondo la sola quota Tabella 16. Riferimenti: `calcolaBuffer` in `calcolo.js` e `bufferMetodologia` in `simulatore.js`. Chiedere la lettura approvata di F05 e fissare gli stessi attesi in entrambi i moduli.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`**
>
> Divergenza confermata sul codice corrente: calcolatore 20%, simulatore 30% con le stesse opzioni. Nessuna formula è stata cambiata. La prova `R01` fissa il comportamento attuale, così ogni futura modifica sarà esplicita.
>
> **Domanda per la Fondazione / responsabile metodologico:** la tariffa puntuale dimezza (a) **tutto** il buffer del Capitolo 7, come fa oggi il calcolatore, oppure (b) solo la **quota della Tabella 16**, come fa oggi il simulatore? Servono la fonte (F05, pagina o paragrafo), chi conferma la regola e se la stima ex ante può differire dall'ex post.
>
> Ricevuta la regola, si allineano i due moduli con la matrice Tabella 15/16 × virtuose × tariffa × riduzioni dei centri × tetto 80%.
>
> Registrato anche in `docs/crediti-cwp.md`, punto 8.
>
> **Risposta della Fondazione:** _…_

### R02 — Modello normale delle utenze ammette quantità evitate oltre il disponibile

**Qualifica:** RISERVA SUL MODELLO. **Priorità:** P1. **Evidenza:** LOCALE-SORGENTE e DOCUMENTALE.

**Regola da chiarire.** Le quantità prodotte sono non negative e il dominio della distribuzione/statistica è compatibile con i limiti fisici. La taratura non equivale a validazione.

**Riproduzione disponibile.** Valutare quotaVirtuose(0,0.3) e quotaVirtuose(0,1.5), cioè media produzione prevista/attesa=0 con le variabilità ammesse.

**Osservato.** Quote 1,000033567 e 1,226679536: fino al 122,668% dell’atteso. Una distribuzione normale non troncata include produzioni negative. Non sono disponibili dati individuali per validare sigma.

**Limiti.** Proprietà locale del modello e caso estremo, non prova di sovraemissioni reali. La vicinanza a stime EsaCom non dimostra la validità della distribuzione o dell’ammissibilità dei crediti.

**Verifica richiesta.** Definire dominio ammissibile, distribuzione e messaggi; ripetere proprietà fisiche su un reticolo di medie/variabilità e confrontare dati individuali indipendenti.

Riproduzione locale: `quotaVirtuose(0, 0.3)` → 1,0000335671460712; `quotaVirtuose(0, 1.5)` → 1,2266795361199472. L’anomalia fisica è dimostrata nel modello estremo; non scegliere automaticamente un taglio a 100% senza valutare distribuzione, dominio e impatti sugli altri casi. La taratura per raggiungere un obiettivo commerciale non è una validazione indipendente.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`**
>
> Riprodotto esattamente: 1,0000335671460712 e 1,2266795361199472. Nessun troncamento introdotto, come raccomandato. La prova `R02` fissa i valori attuali.
>
> **Domanda:** quale dominio e quale distribuzione adottare per la produzione delle singole utenze nel metodo «per utenza»? Le opzioni sono: normale troncata a 0, lognormale, oppure taratura su dati individuali. Inoltre: chi la convalida, e con quali dati?
>
> Il metodo «Bilancio del Comune» non usa questa distribuzione. Registrato in `docs/crediti-cwp.md`, punto 9.
>
> **Risposta della Fondazione:** _…_

### R03 — Crediti tecnici frazionari e crediti economici interi

**Qualifica:** CONVENZIONE DOCUMENTATA DA RACCORDARE AL PROGRAMMA. **Priorità:** P1. **Evidenza:** PORTALE, LOCALE-SORGENTE e DOCUMENTALE.

**Regola da chiarire.** Regola esplicita su indivisibilità, arrotondamento per anno/periodo ed eventuali frazioni residue; etichette e ricavi spiegano il raccordo.

**Riproduzione disponibile.** Con 292,8 netti/anno per 10 anni e 32 €/credito leggere tabella tecnica ed economica.

**Osservato.** Tecnica: 2928 nel periodo. Economia: 292/anno, 2920 nel periodo, 9344 €/anno e 93440 € totali. Senza troncamento sarebbero 9369,60 €/anno e 93696 € totali, differenza 256 €. F15 prescrive intenzionalmente crediti netti interi.

**Limiti.** Non classificato come errore aritmetico dimostrato: il confronto automatico fallisce rispetto all’ipotesi senza troncamento, ma il codice applica una convenzione documentata. Non acquisita una regola autorevole del Programma sul trattamento delle frazioni nella stima.

**Verifica richiesta.** Una volta fissata la convenzione, provare frazioni appena sotto/sopra l’intero e cumulo delle residue, prezzi, CSV e importi ufficiali senza mescolare stima ed emissione.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`**
>
> Convenzione confermata nel codice: `Math.floor` dei netti di ogni anno (292 l'anno, 2.920 nel periodo). Nessuna modifica.
>
> **Domanda:**
> - il Programma conferma i crediti interi anno per anno?
> - le frazioni residue si accumulano negli anni successivi o si perdono?
> - l'arrotondamento è per difetto?
>
> Dopo la regola si aggiungeranno le prove con frazioni appena sotto e sopra l'intero, il cumulo delle residue, il CSV e gli importi.
>
> Registrato in `docs/crediti-cwp.md`, punto 10.
>
> **Risposta della Fondazione:** _…_

### R04 — Pareggio esatto distinto dal primo saldo positivo

**Qualifica:** CONVENZIONE E MESSAGGIO DA CHIARIRE. **Priorità:** P2. **Evidenza:** LOCALE-SORGENTE.

**Regola da chiarire.** L’indicatore di rientro chiarisce se include il pareggio esatto.

**Riproduzione disponibile.** 10 crediti×32 €, nessuna tariffa, altri costi annui320 €: cumulo0.

**Osservato.** primoAnnoPositivo=null perché la condizione è strettamente >0; il messaggio di mancato rientro può confondere pareggio e perdita.

**Limiti.** La convenzione >0 può essere intenzionale. Non è dimostrato un errore nel margine, che è correttamente0.

**Verifica richiesta.** Cumuli −0,01 / 0 / +0,01 e transizioni pluriennali, con etichetta coerente.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`** (solo il messaggio è stato chiarito)
>
> La convenzione «primo anno con cumulato > 0» non è cambiata. Si confronta al mezzo centesimo, per non contare come positivo un residuo di arrotondamento.
>
> Nuovo indicatore `primoAnnoPareggio`. Il riquadro «Margine netto» ora distingue «costi rientrati nel … (primo saldo cumulato positivo)», «pareggio esatto nel …, nessun saldo positivo nel periodo» e «i costi non rientrano nel periodo». Lo stesso dato compare nella Sintesi dell'Excel e del PDF.
>
> Prova `R04` (10 crediti × 32 € con 320 € di costi → pareggio nel 2027).
>
> **Domanda:** il pareggio esatto conta come «rientro dei costi»?
>
> **Risposta della Fondazione:** _…_

### R05 — Conferma definitiva offerta per un calcolo privo di BDU

**Qualifica:** CANDIDATO DIFETTO DI GATE, SOLO UI. **Priorità:** P0. **Evidenza:** PORTALE, bozza sintetica.

**Regola da chiarire.** Prerequisiti obbligatori e natura degli avvisi chiariti prima di una conferma utilizzabile nel procedimento.

**Riproduzione disponibile.** Nella sola nuova bozza sintetica, rifiuti 0,26t organico+0,14t RUR, UD1, nessuna BDU; calcolare e aprire “Conferma calcolo”, poi annullare.

**Osservato.** Risultato0, 0 utenze, errore di coerenza per BDU mancante, popolazione/cluster assenti e indicatori qualità incompleti. Il pulsante “Conferma definitivamente” è abilitato.

**Limiti.** Il pulsante finale NON è stato premuto. Non è provato che il backend accetti la conferma, né che l’emissione sia possibile. La bozza è rimasta incompleta e chiaramente annotata.

**Verifica richiesta.** In ambiente isolato verificare l’intero controllo lato servizio, conferma/versionamento e impossibilità di usare una pratica incompleta per atti ufficiali.

Si tratta dell’osservazione storica prima del completamento della BDU: adesso la stessa bozza è ripristinata con due conferimenti. Per riprodurre la condizione incompleta creare una copia sintetica nell’ambiente isolato; non svuotare la bozza ordinaria esistente e non confermare un atto reale.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`** (presidio prudenziale; l'elenco completo dei prerequisiti resta da confermare)
>
> **Causa accertata.** La conferma veniva bloccata solo dagli scostamenti oltre il 30% non motivati. Gli «errori» dei controlli di coerenza erano mostrati ma non bloccavano. Nel database, `calcolo_coerenza` (script 20) verificava solo che il risultato corrispondesse alla Banca Dati salvata, anche quando questa era vuota.
>
> **Correzione:**
> - **interfaccia:** «Conferma definitivamente» è disattivato quando i controlli di coerenza hanno almeno un errore (non gli avvisi), con l'elenco degli errori nel riquadro. Gli errori sono: Banca Dati mancante, PEF diverso da 100%, indifferenziato mancante, classi mancanti o assenti in delibera, utenze ambigue, valori negativi;
> - **database** (script 35): trigger `trg_calcolo_prerequisiti`, che rifiuta la conferma senza righe di conferimento o con un risultato bloccato. Provato sul banco: rifiuti attesi, e la conferma ordinaria resta possibile.
>
> Prove: `collaudo_v01` «R05» e `t35.sql`.
>
> **Domanda:** gli errori di coerenza elencati sono tutti prerequisiti bloccanti, o alcuni devono restare avvisi? Quali altri prerequisiti servono (popolazione/cluster, % di letture valide…)?
>
> **Per il ritest:** 7.20, in ambiente isolato o su una copia sintetica, senza confermare atti reali.
>
> **Risposta della Fondazione:** _…_

### R06 — Fase completata con documento obbligatorio mancante

**Qualifica:** COMPORTAMENTO NON BLOCCANTE RIPRODOTTO; GATE UFFICIALE ANCORA DA VERIFICARE. **Priorità:** P0. **Evidenza:** PORTALE e DOCUMENTALE.

**Regola da chiarire.** Specificare quali documenti bloccano fase, registrazione o conclusione secondo Programma e responsabilità del verificatore.

**Riproduzione disponibile.** Sola lettura della pratica di prova cwp-026-005 e confronto con F10; nessuna modifica a fase/documenti.

**Osservato.** Adesione risulta completata il17/10, “Descrizione del Progetto” obbligatoria risulta mancante. Il manuale Admin descrive i documenti mancanti come promemoria non bloccante. V03: nuova transizione riprodotta su COLLAUDO-V03-A-20261020; fase 1 completata senza il Modulo di descrizione.

**Limiti.** Resta distinto dal gate della registrazione ufficiale, non testato. Manuale prescrive promemoria non bloccanti.

**Verifica richiesta.** Con matrice documenti/stati approvata, riprodurre ogni passaggio senza documenti, con documento non valido e con fascicolo completo in ambiente isolato.

Aggiornamento essenziale: il 20/10 la transizione è stata effettivamente ripetuta sulla nuova pratica A; non è più soltanto un’osservazione pregressa. Resta da verificare il presidio all’avanzamento ufficiale. La Guida/Metodologia non devono essere sostituite da una scelta generica «tutti i documenti sempre bloccanti».

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`**
>
> Comportamento confermato e intenzionale secondo il Manuale Amministratore: i documenti mancanti sono promemoria non bloccanti. Nessuna modifica. Come raccomandato, non è stata scelta la regola generica «tutti i documenti sempre bloccanti».
>
> **Domanda:** serve la matrice approvata documenti × fasi/stati (quali documenti bloccano la chiusura di una fase, la registrazione, la conclusione) secondo Programma e Guida F01.
>
> Registrato in `docs/crediti-cwp.md`, punto 12.
>
> **Risposta della Fondazione:** _…_

### R07 — Percentuali CSV espresse come frazioni con etichetta percentuale

**Qualifica:** RISERVA DI CHIAREZZA. **Priorità:** P2. **Evidenza:** CSV ESPORTATO.

**Regola da chiarire.** Unità coerenti: P%UD100 oppure quotaUD(0–1)=1.

**Osservato.** CSV: P%UD;1 e P%UnD;0; UI/PDF100% e0%. I valori sono matematicamente riconciliabili ma la scala non è dichiarata.

**Limiti.** Non è un errore aritmetico del calcolo; impatto dipende dall’uso del CSV.

**Verifica richiesta.** Verificare scala e intestazione, compreso un caso misto UD/UND e roundtrip con consumer previsto.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> Nel CSV di riepilogo del calcolo le quote erano frazioni da 0 a 1 con l'etichetta «%». Ora le voci si chiamano «P%UD (%)» e «P%UnD (%)» e valgono da 0 a 100, come nella pagina e nel PDF. Aritmetica invariata. Modifica in `CalcoloCrediti.jsx` (`esportaRiepilogo`).
>
> **Per il ritest:** 7.21, compreso un caso misto UD/UnD.

### R08 — Resa tipografica irregolare dei PDF

**Qualifica:** RISERVA DI LEGGIBILITÀ. **Priorità:** P2. **Evidenza:** PDF GENERATO / RENDER POPPLER.

**Regola da chiarire.** Titoli e tabelle leggibili, senza spaziatura anomala o sovrapposizione di glifi.

**Osservato.** Rapporto calcolo e Riepilogo fascicolo su renderer locale mostrano spaziatura irregolare e alcuni glifi sovrapposti, pur con testo estraibile e tabelle entro la pagina.

**Limiti.** Non verificato su altri lettori/stampa o con assistive technology. Non attribuita una causa certa al codice/font.

**Verifica richiesta.** Aprire stessi byte in almeno due lettori e stampare; verificare font incorporati, numeri, titoli, tabelle e accessibilità del documento.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `APERTO`**
>
> **Diagnosi (ipotesi, non causa certa).** I PDF di jsPDF usano i caratteri standard Helvetica **non incorporati** (`pdffonts`: emb = no). Ogni lettore li sostituisce con un carattere locale: se le larghezze sono diverse, la spaziatura diventa irregolare e i glifi si sovrappongono, come nel render del collaudo.
>
> Sul banco dello sviluppo (poppler con caratteri metricamente compatibili) lo stesso generatore produce un rapporto regolare. I caratteri fuori codifica (CO₂, →) sono già sostituiti da `pdfTesto` nel rapporto e nel simulatore, ma **non** nel riepilogo del fascicolo.
>
> **Proposta.** Incorporare un carattere a licenza libera (OFL) nei tre generatori PDF e applicare la stessa pulizia dei testi al fascicolo. I PDF diventano più pesanti di circa 200–300 KB. Prima serve l'OK di Luca.
>
> **Servono dal collaudo** i byte originali `rapporto_bozza.pdf` e `fascicolo_Riepilogo.pdf` e il nome del lettore usato, per confermare la causa.

### Questione metodologica trasversale: riuso

Il software prevede due opzioni di segno per l’effetto del riuso, documentate come interpretazioni da confermare. Le prove locali dimostrano che entrambe le opzioni producono il cambiamento programmato; non stabiliscono quale sia metodologicamente ammissibile. Chiedere conferma sulla fonte F05 e sui casi applicativi prima di uniformare o rimuovere un’opzione. Questo richiamo non è un ulteriore bug già dimostrato.

> **Risposta dello sviluppo — 20/10/2026 · Stato: `ATTESA_REGOLA`**
>
> Nessuna modifica alle due opzioni. Per ora resta la formula 29 come scritta, con l'opzione «Tratta il riuso come riduzione» spenta (`docs/crediti-cwp.md`, punto 3).
>
> **Domanda:** con fonte F05 e casi applicativi, l'effetto del riuso va contato come riduzione (crediti) o secondo il segno letterale della formula 29? Chi lo conferma?
>
> **Risposta della Fondazione:** _…_

## 7. Cosa ha funzionato e deve rimanere stabile

1. Tutte le otto suite originali acquisite terminano con exit 0: crediti, csv, tracciato, date, tariffe, qualità, simulatore e ordinamento. Le fixture originali `tracciato_esempio.xlsx`, `tracciato_privacy.xlsx` e `tracciato_letture.zip` sono state acquisite e verificate per impronta Git. Non usare il semplice esito delle suite per negare i difetti indipendenti sopra.
2. Reticoli locali indipendenti: 1.080 combinazioni territoriali, 504 combinazioni buffer senza tariffa puntuale, 63 varianti delle categorie UND e 366 date valide, tutte senza scostamenti. Sono 2.013 combinazioni/date, non 2.013 test completi della piattaforma. Il conteggio territoriale è stato rettificato da un’iniziale etichetta 3.240 a 1.080 = 3×4×6×5×3; nessuna aspettativa numerica modificata.
3. Riferimenti ordinari S e C corretti. Per C, CSV riepilogo/dettaglio e PDF bozza concordano con il risultato indipendente; dopo le varianti i valori ordinari sono stati ripristinati e riaperti.
4. A parità di due righe, modificare RUR da 75 a 90 kg invalida il risultato e rimuove il comando Conferma prima del ricalcolo. Anche l’importazione completa del tracciato invalida il risultato precedente.
5. Importazione del tracciato con codice fiscale/indirizzo fittizi bloccata online con esempi mascherati. Non attribuire a questo campione una certificazione generale privacy.
6. Precedenza locale dichiarata: se compilati foglio 5 e foglio 6, prevalgono i totali del foglio 5 con avviso. Dati negativi scartati dal parser completo locale; mantenere il presidio e allineare il CSV diretto.
7. Due versioni TXT di A conservate; v2 corrente, v1 precedente. Fascicolo A contiene entrambe, con SHA-256 uguale ai byte originali; nessun marcatore B. Questo risultato riguarda l’export Admin, non la separazione effettiva tra Clienti.

La tolleranza numerica delle ricostruzioni locali è `max(1e-9, abs(atteso)*1e-12)` nell’unità della grandezza, per il solo errore numerico di rappresentazione. Nei valori visualizzati vale metà dell’ultima cifra decimale. ID, stati, versioni, conteggi e hash richiedono corrispondenza esatta. Non usare tolleranze per accettare input impossibili, stati impropri o una formula metodologica differente.

## 8. Profili da predisporre per continuare il collaudo

Sono già presenti due organizzazioni fittizie e due progetti di prova. Al termine della campagna V03 **non sono stati creati i nuovi utenti** e non sono state modificate credenziali o autorizzazioni di utenti reali. Prima di crearli verificare eventuali duplicati, evitando account doppi.

| Profilo richiesto | Nome proposto | Organizzazione ammessa |
|---|---|---|
| Cliente A | COLLAUDO V03 Cliente A | Solo COLLAUDO AL V03 - COMUNE A - 20261020 |
| Cliente B | COLLAUDO V03 Cliente B | Solo COLLAUDO AL V03 - COMUNE B - 20261020 |
| Operatore | COLLAUDO V03 Operatore | Profilo staff, senza organizzazioni Cliente associate |

Non è necessario un ulteriore Admin. L’Operatore, per disegno corrente, accede al back-office e alle pratiche complessive: confermare che sia l’ambito voluto e non assegnare questo account a terzi. Non richiediamo di disabilitare la verifica a due fattori (MFA).

Luca Moretti dovrebbe attivare i tre utenti con recapiti di prova controllati e comunicare identificativi e modalità di accesso. Per questi soli profili sintetici Luca Belfiore accetta anche password definitive, da trasmettere attraverso un canale sicuro separato. Non è richiesto un cambio iniziale aggiuntivo per il solo collaudo; restano applicabili le regole del portale e l’eventuale verifica a due fattori, senza disabilitarle. Non inserire password nel presente file, in ticket, log o report; non condividere il segreto o i codici temporanei MFA. Per i test di consegna delle email servono caselle realmente controllate; gli indirizzi `.invalid` proposti nella precedente preparazione sono utilizzabili solo se accettati dal sistema e non verificano la consegna.

> **Risposta dello sviluppo — 20/10/2026 · Stato: da fare (Luca Moretti)**
>
> Lo sviluppo non crea utenti e non gestisce password. I tre profili «COLLAUDO V03 Cliente A», «COLLAUDO V03 Cliente B» e «COLLAUDO V03 Operatore» li crea Luca Moretti da **Utenti → + Nuovo utente**, dopo aver controllato che non ci siano doppioni. I recapiti devono essere caselle di prova controllate. Password via canale separato, MFA non disattivata.
>
> Identificativi e associazioni effettive vanno scritti qui sotto una volta creati (senza password):
>
> | Profilo | Email di accesso | Organizzazione associata | Creato il |
> |---|---|---|---|
> | COLLAUDO V03 Cliente A | _…_ | COLLAUDO AL V03 - COMUNE A - 20261020 | _…_ |
> | COLLAUDO V03 Cliente B | _…_ | COLLAUDO AL V03 - COMUNE B - 20261020 | _…_ |
> | COLLAUDO V03 Operatore | _…_ | nessuna (staff) | _…_ |
>
> Per disegno l'Operatore vede tutte le pratiche del back-office, ma non Utenti, Audit e Calcolo crediti, nemmeno scrivendo l'indirizzo: i dati sono protetti dalle regole del database.

### Pratiche e file già preparati

| Oggetto | Identificativo e stato lasciato |
|---|---|
| Progetto A | `COLLAUDO-V03-A-20261020`, UUID `c70a0531-09f0-47d0-86e9-3f51ce3b03ff`; attivo/in richiesta di registrazione. Popolazione 1.000, ISTAT sintetico `000001`. Adesione completata senza descrizione richiesta; altre sei fasi non iniziate. |
| Progetto B | `COLLAUDO-V03-B-20261020`, UUID `dc33ade9-6831-432e-8dbd-05bd7f461a48`; attivo. Popolazione 2.000, ISTAT sintetico `000002`. Adesione in corso; altre sei fasi non iniziate. |
| Documento A | `COLLAUDO_V03_A_RISERVATO.txt`, v1 e v2, marcatura `MARCATORE_A_20261020`; flag visibile Cliente=true, pubblico=false. |
| Documento B | `COLLAUDO_V03_B_RISERVATO.txt`, v1, marcatura `MARCATORE_B_20261020`; stessi flag. |
| Bozza calcolo C | UUID `ec3f8c12-d554-462e-9ea0-104b198678c7`; riferimento ordinario C ripristinato, netto 0,2928, stato bozza. NON CONFERMARE. |

I codici ISTAT indicati sono segnaposto sintetici, non identificazioni territoriali valide. Nessun progetto ufficialmente registrato, rapporto di monitoraggio, pagamento o credito creato con questi oggetti.

Impronte SHA-256 dei file originali ed esportati:

```text
A v1  9406923f794707eb74cc9019a032a02567d8e85cea81ef4b89209633ea96d82f
A v2  7235bae9a53a951e7aa095c126fbc2efd7a9254f9ee026b0f13fcca64d0d9a51
B v1  5718330f3ad6e97c84da93a7f8654a3f5fd20db995506f32c9ef19ccfc8af2a5
```

### Risultati attesi delle prove per ruolo

- Cliente A: vede A e i relativi documenti ammessi; nessun accesso a B, neppure aprendo direttamente l’URL del suo UUID noto. Cliente B: situazione speculare. Verificare elenco, dettaglio e fascicolo; non basta che B sia nascosto dal menu.
- Operatore: funzioni consentite del back-office utilizzabili; gestione utenti e azioni riservate agli Admin negate anche per navigazione diretta. I soli pulsanti nascosti non provano il controllo lato servizio.
- Revoca: usare esclusivamente un profilo sintetico e una sua sessione già aperta; dopo la revoca non devono rimanere accessibili dati riservati. Non revocare l’Admin di lavoro o utenti reali.
- Se compare un dato estraneo, fermare quel ramo e raccogliere soltanto la minima prova; non scaricare ulteriori fascicoli reali.

Le notifiche non sono ancora collaudate. Durante le prove A/B non c’erano Clienti associati; sono state lette le regole del sorgente, ma coda e consegna non sono state osservate. Dopo l’attivazione dei Clienti anche le normali azioni possono produrre notifiche. Non caricare documenti come Cliente né inviare commenti/richieste finché le email allo staff reale non sono isolate o concordate.

## 9. Consegna richiesta dopo le correzioni

Per ogni ID consegnare una riga con: stato (`CORRETTO_DA_RITESTARE`, `NON_RIPRODOTTO`, `ATTESA_REGOLA`, `APERTO`), causa accertata o ipotesi, file/moduli modificati, test pertinenti e risultato, eventuale impatto sui dati precedenti. “Non riprodotto” richiede versione e parametri esatti; non equivale a “mai esistito”. Un test che passa non autorizza da solo a chiudere una riserva metodologica.

Allegare inoltre:

1. Revisione della correzione e istruzioni ripetibili per la verifica locale; confronto con il commit di partenza e identificazione della build che sarà proposta al collaudo.
2. Migrazioni eventualmente necessarie, con effetti e verifica in ambiente isolato. Nessuna esecuzione sul database reale implicita nell’invio del codice.
3. Esito delle otto suite originali e dei nuovi test di regressione mirati alle cause corrette. Conservare i casi ordinari S/C, le unità, il buffer autorizzato, l’invalidazione dei risultati e il versionamento dei documenti.
4. Lista dei punti rimasti aperti e delle risposte metodologiche richieste. Per R01/R03/riuso indicare fonte, regola approvata e chi l’ha confermata.
5. Identificativi dei tre utenti di prova, associazioni effettive e istruzioni per l’accesso sicuro, senza password in questo allegato.

Il riesame di dati già salvati deve essere proposto, non eseguito automaticamente: prima individuare quali canali/revisioni li possono aver prodotti, quali campi permettono di riconoscerli e come conservarne la tracciabilità. Non è stata osservata l’emissione reale di crediti errati e non si deve affermare che sia avvenuta.

Per la chiusura positiva servono P0/P1 del perimetro superati sulla release prevista, nessun difetto maggiore aperto, riserve metodologiche risolte o limitazioni d’uso approvate, e regressioni documentate. I test tra ruoli da soli non completano il collaudo: carico, concorrenza, sicurezza attiva, errori controllati, ripristino DB+file, accessibilità e compatibilità restano campagne/prerequisiti distinti.

## 9-bis. Consegna dello sviluppo (risposta al punto 9) — 20/10/2026

| ID | Stato | Causa (sintesi) | File e moduli modificati | Prove |
|---|---|---|---|---|
| D07 | `CORRETTO_DA_RITESTARE` | CSV diretto senza controllo dei negativi | `csv.js`, `CalcoloCrediti.jsx`, `archivio.js`, `tracciato.js`, `calcolo.js`, script 35 | collaudo_v01 «D07», «C»; `t35.sql` |
| D01 | `CORRETTO_DA_RITESTARE` | Nessun dominio sui dati del simulatore | `simulatore.js`, `Simulatore.jsx`, `scenari.js`, script 35 | «D01», «S»; `t35.sql` |
| D02 | `CORRETTO_DA_RITESTARE` | Limite 100 nel simulatore, taglio silenzioso a 80 nel calcolatore | `simulatore.js`, `calcolo.js`, script 35 | «D02»; `t35.sql` |
| D04 | `CORRETTO_DA_RITESTARE` | Date costruite senza verificarne l'esistenza | `tracciato.js`, `calcolo.js`, `date.js` | «D04» |
| D03 | `CORRETTO_DA_RITESTARE` | `0 \|\| prezzo` | `simulatore.js`, `Simulatore.jsx` | «D03» |
| D05 | `CORRETTO_DA_RITESTARE` | Dati registrati ma non mostrati dalla vista | `auditDettaglio.js`, `OggettoEModifiche.jsx`, `Audit.jsx`, `AuditUtenti.jsx` | «D05» |
| D06 | `CORRETTO_DA_RITESTARE` | Nessuna neutralizzazione nei 3 generatori CSV | `csv.js`, `fascicolo.js`, `simulatore.js` | «D06» |
| R01 | `ATTESA_REGOLA` | Due letture del Capitolo 7 | — | «R01» (fissa l'attuale) |
| R02 | `ATTESA_REGOLA` | Normale non troncata | — | «R02» (fissa l'attuale) |
| R03 | `ATTESA_REGOLA` | Convenzione dei crediti interi | — | — |
| R04 | `ATTESA_REGOLA` | Messaggio chiarito, regola invariata | `simulatore.js`, `Simulatore.jsx`, `simulatoreExport.js` | «R04» |
| R05 | `CORRETTO_DA_RITESTARE` | Errori di coerenza non bloccanti, conferma senza Banca Dati | `CalcoloCrediti.jsx`, `tracciato.js`, script 35 | «R05»; `t35.sql` |
| R06 | `ATTESA_REGOLA` | Promemoria non bloccanti per disegno | — | — |
| R07 | `CORRETTO_DA_RITESTARE` | Quote 0–1 con etichetta % | `CalcoloCrediti.jsx` | caso 7.21 |
| R08 | `APERTO` | Ipotesi: caratteri non incorporati | — | servono i PDF originali |
| Riuso | `ATTESA_REGOLA` | Due opzioni documentate | — | — |

**1. Revisione e build proposta.**
- Partenza: commit di produzione `640111a`. Il collaudo è stato fatto su `2526602`; tutti i difetti D01–D07 sono stati riprodotti anche su `640111a`.
- Correzioni sul ramo `correzioni-collaudo-v01` (commit `66d253e` e successivi), unito a `main` e **rilasciato in produzione il 20/10/2026 alle 17:15 circa** su incarico di Luca Moretti. **Build da collaudare: commit `e0c91a9`** su <https://portale-cwp.vercel.app>.
- Verifica locale ripetibile: `git checkout correzioni-collaudo-v01`, poi `npm ci`, `npm test` (12 serie di prove) e `npx vite build`.
- Confronto con la partenza: `git diff 640111a..correzioni-collaudo-v01`.

**2. Migrazione.** `supabase/35_controlli_collaudo.sql`.
- Vincoli `NOT VALID` e trigger: le righe già salvate non vengono controllate né modificate.
- Rieseguibile; provato sul banco Postgres 16 locale con tutti gli script 01–35 (`t35.sql`).
- **Eseguito sul database reale il 20/10/2026** su incarico di Luca Moretti. Verifica dopo l'esecuzione: 3 vincoli e 2 trigger presenti.
- L'ultima istruzione conta, in sola lettura, i dati già salvati che non rispettano le nuove regole. Esito in produzione: **0** in tutte le voci (conferimenti e riuso negativi, calcoli con buffer o crediti fuori regola, calcoli confermati senza Banca Dati, scenari con buffer non ammesso); anche 0 scenari con anni impossibili.

**3. Esito delle prove.**
- Le otto serie originali (crediti, csv, tracciato, date, tariffe, qualità, simulatore, ordinamento) e le tre successive (presenza, simulatoreExport, inattività) superate.
- Nuova serie `test/collaudo_v01.test.mjs`: 27 prove superate.
- Casi ordinari invariati: S 292,8 l'anno e 2.928 in dieci anni; C 0,2928 (buffer calcolato e manuale); variante RUR 90 = 0,24888.
- Invalidazione dei risultati e versionamento dei documenti non toccati.
- Un'aspettativa cambiata, motivata da D01 (secco oltre il totale: da avviso a errore).

**4. Punti aperti e domande metodologiche.** R01, R02, R03, R04 (solo la regola), R06, riuso e l'elenco completo dei prerequisiti di R05: le domande sono nelle schede, con lo spazio «Risposta della Fondazione». R08 resta aperto in attesa dei PDF originali.

**5. Utenti di prova.** Da creare da Luca Moretti (vedi la risposta al punto 8).

**Dati già salvati.**
- Riesame proposto, non eseguito.
- Canali che possono aver prodotto valori non ammessi: import CSV diretto della Banca Dati (pesi negativi) e scenari del simulatore salvati con buffer oltre 80% o valori negativi.
- Si riconoscono con il conteggio finale dello script 35 e, per gli scenari, con la nuova vista Audit (campi «da → a»).
- Non risulta l'emissione di crediti da calcoli con valori negativi; nessuna correzione automatica.

## 10. Provenienza delle prove e materiali di supporto

Questo testo è ricavato dal rapporto e dal registro V03 del 20/10, mantenendo le osservazioni V02 del 19/10 quando non ripetute. Nessun nuovo test o correzione è stato eseguito per preparare questo allegato.

Il dossier `CWP_COLLAUDO_V03_20261020.zip`, disponibile presso Luca Belfiore, contiene matrice completa, registri, input sintetici e prove minimizzate. Per una diagnosi che richiede i byte originali richiedere, secondo necessità, le seguenti parti:

- `dati_sintetici/CONFERIMENTI_NEGATIVI_DA_RIFIUTARE.csv`, `TRACCIATO_DATA_IMPOSSIBILE_V03.zip` e `TRACCIATO_SINTETICO_V03.zip`.
- `evidenze/cwp-v03-negativo-importato.txt`, `cwp-v03-negativo-risultato.txt`, `cwp-v03-negativo-riaperto.txt`, `cwp-v03-data-impossibile-anteprima.txt`, `cwp-v03-ripristino-riaperto.txt`.
- `evidenze/export/riepilogo_negativo.csv`, `riepilogo_ripristino.csv`, `rapporto_bozza.pdf`, `rapporto_finale_bozza.pdf`, `fascicolo_A.zip` e `fascicolo_Riepilogo.pdf`.
- `evidenze/V03_EXPORT_CONFRONTO_NUMERICO.json`, `V03_FASCICOLO_CHECK.json`, `V03_SUITE.json`, `V03_RETICOLO.json`, `BANCO_PROVA_V03.mjs`.
- `evidenze/V02_STORICO/`: prove originarie D01–D06, banchi di prova e prima esecuzione non rettificata conservata come storia. Il primo errore del banco relativo al caso riuso CAL09 è stato corretto e ritestato: non trattarlo come bug del portale.

I riferimenti ai file facilitano il recupero delle prove, ma i dati minimi e i risultati necessari per iniziare la riproduzione sono già presenti in questo Markdown. Non allegare credenziali o interi archivi con dati reali per rendere la diagnosi più semplice.
