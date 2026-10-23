# Calcolo dei crediti CWP — note metodologiche

Sezione del portale riservata agli Amministratori (menu **Crediti CWP**).
Implementa la *Metodologia Carbon WastePrint® v1.2* (Studio Associato Wastelab e
Altraleonia S.r.l.). Il motore di calcolo è in `src/lib/crediti/calcolo.js`
(funzioni pure, verificate da `test/crediti.test.mjs`); i parametri di default
sono in `src/lib/crediti/parametri.js`; i dati sono salvati nelle tabelle dello
script `supabase/11_crediti.sql`.

## Dati da acquisire

| Passo | Dato | Fonte (Metodologia) |
|---|---|---|
| Impostazioni | Anno di riferimento, ex ante / ex post, data di avvio se primo anno | Cap. 2 |
| Rifiuti del territorio | Per codice EER: tipologia, Qtot(r) in t/anno, solo domestiche | Cap. 3, Tab. 1 — Catasto ISPRA |
| Delibera tariffaria | PEF%UD, PEF%UnD; classi domestiche (N, Kb); classi non domestiche (N, superficie, Kd) | Cap. 3, Tab. 1 |
| Fattori di emissione | FErid(r), pesi specifici, beni a riuso (peso, FErid(b)) | Cap. 5, Tab. 3-5, 8 |
| Banca Dati Utenze | Per utenza e rifiuto: svuotamenti, volume contenitore, pesi/volumi presso strutture informatizzate e centri di raccolta; beni a riuso | Cap. 6.1, Tab. 9-12 |
| Buffer | Utenze e rifiuti monitorati, tariffa puntuale, scelta "solo utenze virtuose" | Cap. 7, Tab. 15-16 |

Tutti i file si importano in CSV (anche salvati da Excel); ogni passo offre il
modello da scaricare.

## Banca Dati Utenze per utenza (dal 22/10/2026, in costruzione)

Richiesta di Luca Moretti del 22/10/2026: il simulatore lavora su dati
aggregati, mentre il **calcolo dei crediti è per utenza**. Ogni calcolo
carica obbligatoriamente l'elenco **completo** delle utenze dell'anno,
domestiche e non domestiche, perché le utenze cambiano di continuo
(nessuna anagrafe riusata da un anno all'altro).

**Modello da compilare:** `public/modelli/Banca_dati_utenze_CWP_v1.xlsx`
(generato da `strumenti/genera_banca_dati_utenze.py`), con i fogli
Istruzioni, Utenze_domestiche, Utenze_non_domestiche e Categorie.

**Foglio Utenze_domestiche** — una riga per ogni utenza domestica attiva nell'anno.

| Colonna | Obbligatoria | Cosa contiene |
| --- | --- | --- |
| Codice utenza | sì | Codice dell'utenza nel sistema del Comune o del gestore (es. codice TARI); unico nel file |
| Nome capofamiglia | sì | Nome e cognome dell'intestatario |
| Indirizzo | sì | Via, numero civico ed eventuale interno |
| Categoria tariffaria | no | Classe della quota variabile nella delibera TARI (di solito il numero di componenti: 1, 2, … 6 e oltre). Se presente, il portale la propone come **categoria di simulazione** |
| N. componenti | no | Componenti del nucleo familiare: colloca l'utenza nella classe della delibera (Kb); se manca si usano i valori medi |
| Mq abitazione | no | Superficie dell'abitazione in m² |
| Produzione totale (kg) | sì | Rifiuti prodotti nell'anno, somma di tutte le frazioni |
| Indifferenziato (kg) | sì | Secco residuo dell'anno, anche 0 |
| Organico, Carta e cartone, Plastica, Vetro, Metallo, Verde, Legno, Tessili, RAEE, Ingombranti, Inerti (kg) | no | Kg di ciascuna frazione nell'anno; vuoto = frazione non raccolta o non misurata (vuoto è diverso da 0) |
| Svuotamenti (una colonna per frazione) | no | Numero di svuotamenti o conferimenti della frazione nell'anno, intero |

**Foglio Utenze_non_domestiche** — una riga per ogni attività, ente o ufficio. Stesse colonne, con queste differenze:

| Colonna | Obbligatoria | Cosa contiene |
| --- | --- | --- |
| Ragione sociale | sì | Al posto del nome del capofamiglia |
| Categoria tariffaria | no, ma da compilare se nota | Numero della categoria della delibera TARI (DPR 158/1999, es. 22 = ristoranti; il foglio Categorie ha l'elenco di riferimento). Se presente, il portale la propone come **categoria di simulazione** |
| Mq locali | no | Superficie tassata dei locali in m² (al posto dei mq dell'abitazione); se manca si usano i valori medi della categoria |
| N. componenti | — | Non c'è: vale solo per le domestiche |

**Categoria di simulazione.** Non è nel file: è un campo del portale, per ogni utenza, che dice quale classe o categoria usa il calcolo per i rifiuti attesi. All'arrivo del file il portale la propone uguale alla categoria tariffaria; la Fondazione può cambiarla dal modulo dell'utenza. Le utenze senza categoria tariffaria restano «da assegnare» finché non la si indica.

**Regole.**
- Ogni anno si carica l'**elenco completo** delle utenze, domestiche e non domestiche: le utenze cambiano di continuo e nessun dato si riprende dall'anno prima.
- Numeri senza unità di misura; decimali con la virgola.
- La produzione totale deve corrispondere alla somma delle frazioni: il portale segnala le differenze oltre l'1%.
- Oltre 1 milione di righe o 50 MB: un CSV per foglio, con lo stesso nome, dentro uno ZIP.

**Dove finiscono i dati.** Tabella `calcolo_utenza` (script 40): una riga per
utenza con codice, tipo (UD/UnD), nominativo, indirizzo, componenti, mq,
categoria tariffaria, categoria di simulazione (se vuota il database mette la
tariffaria), produzione totale e un campo JSON con kg e svuotamenti per
frazione (codici di `parametri.js`). Il database rifiuta: indifferenziato
mancante, kg negativi, svuotamenti non interi, frazioni sconosciute, codice
doppio nello stesso calcolo, componenti su un'utenza non domestica.

**Gestione nel portale (passo «5a. Utenze del calcolo»,
`src/components/crediti/UtenzeCalcolo.jsx`).** Due schede, domestiche e non
domestiche, con ricerca e pagine da 50; riquadri con i numeri e le utenze
senza categoria di simulazione; «Carica il file dell'anno» (anteprima con
errori e avvisi, poi «Sostituisci l'elenco»; un file con righe sbagliate non
si carica); modulo di ogni utenza (nuova, modifica, eliminazione) con tutti i
campi, la categoria di simulazione che segue la tariffaria finché non la si
cambia e il pulsante «= somma delle frazioni». Lettura del file e controlli in
`src/lib/crediti/bancaDatiUtenze.js` (prove `test/bancaDatiUtenze.test.mjs`),
accesso al database in `src/lib/crediti/utenzeCalcolo.js`. File di prova con
20 + 20 utenze inventate: `test/dati/Banca_dati_utenze_prova_40.xlsx`
(`strumenti/genera_utenze_casuali.py`).

**Dati personali (scelta di Luca: salvati e visibili allo staff).** Nessuna
lettura diretta della tabella: Operatori e Amministratori la consultano con
`staff_elenco_utenze`, che scrive nell'audit ogni consultazione; il motore di
calcolo legge con `admin_utenze_calcolo`, senza nomi e indirizzi. Caricamento
e cancellazione solo dell'Amministratore, con una voce di audit per
caricamento (numero di utenze, nessun nome). Il Comune non vede la tabella.
Da completare: DPIA e accordo sul trattamento con i Comuni (art. 28 GDPR).
Questa Banca Dati sostituirà i fogli 5_Conferimenti e 6_Letture del tracciato,
che oggi bloccano i dati personali.

**Come il calcolo usa le utenze (dal 23/10/2026, script 41).** Quando il
calcolo ha le utenze del passo 5a, il motore usa quelle; i conferimenti del
passo 5b (tracciato) valgono solo per i calcoli senza utenze, compresi quelli
fatti prima. I beni a riuso vengono sempre dal passo 5b.
- Ogni utenza va nella **classe della delibera indicata dalla sua categoria di
  simulazione** (UD tra le classi domestiche, UnD tra le categorie non
  domestiche): da lì prende i rifiuti attesi (formule 9-12) e le emissioni
  attese EA(i).
- I **kg** di ogni frazione sono il peso prodotto dall'utenza (Ptot, formula
  21) e si usano così come sono: non servono svuotamenti × volume × peso
  specifico. Gli svuotamenti restano informativi.
- **Frazioni per utenza** (estensione della scelta interpretativa 2, da
  confermare): EA(i) ed EP(i) si calcolano solo sulle frazioni con un valore
  per quell'utenza, anche 0. Una frazione lasciata vuota (non raccolta o non
  misurata) non entra né nelle emissioni attese né in quelle di progetto: così
  una frazione non misurata non diventa un credito.
- Utenze **senza categoria di simulazione** o con una categoria che **non è
  tra le classi della delibera** restano fuori dal calcolo (avviso nei
  risultati, errore nei controlli di coerenza) e il calcolo **non si può
  confermare** finché non si correggono (controllo anche nel database).
- Alla conferma il database confronta il numero di utenze usato da «Calcola»
  con quelle salvate (`risultato.righe.utenze`): se l'elenco è cambiato dopo il
  calcolo, la conferma è rifiutata.
- Il motore legge le utenze con `admin_utenze_calcolo`, **senza nomi e
  indirizzi**; il dettaglio per utenza dei risultati ha solo il codice.
- Risultati, CSV di riepilogo e rapporto PDF dicono quale Banca Dati è stata
  usata e quante utenze sono state escluse.

Codice: `utenzeInConferimenti` e `calcolaCrediti` in `calcolo.js`,
`controllaCoerenza` in `tracciato.js` (parametro `origine`),
`leggiUtenzeCalcolo` in `utenzeCalcolo.js`; database: script
`41_utenze_nel_calcolo.sql` (`cwp_utenze_controllo`, nuove versioni di
`calcolo_coerenza` e `calcolo_prerequisiti_conferma`). Prove:
`test/utenzeNelCalcolo.test.mjs` e `t41.sql`.

**Stato.** In produzione: script 40 il 22/10/2026 alle 17:30 (struttura,
modello Excel, caricamento e moduli di gestione) e script 41 il 23/10/2026
(collegamento al motore). Da fare: DPIA e accordo con i Comuni; conferma della
Fondazione sulla regola delle frazioni per utenza.

## Corrispondenza con le formule

| Formula | Dove |
|---|---|
| 1 — primo anno parziale | `coefficientePrimoAnno` |
| 2-8 — ripartizione domestiche / non domestiche | `produzioneAttesa` |
| 9-12 — valori attesi per classe | `produzioneAttesa` |
| 13-15 — emissioni attese | `calcolaCrediti` (territorio e per utenza) |
| 16-17 — FE dell'indifferenziato | `fattoreIndifferenziato`: tutte le frazioni a recupero con quantità > 0 e FE numerico; restituisce anche quantità e FE di ogni frazione, `fuoriPaniere` (oltre organico, carta, vetro, plastica, tessili) ed `escluse` (senza FE). Paniere da confermare: rilievo N06, ATTESA_REGOLA |
| 18 — peso specifico a consuntivo | `pesiSpecifici` |
| 19-22 — conferimenti in peso | `conferimentiInPeso` (con le utenze del passo 5a: kg misurati, `utenzeInConferimenti`) |
| 25-30 — emissioni di progetto | `calcolaCrediti` |
| 31-32 — variazione di impatto e crediti | `calcolaCrediti` |
| Tab. 15-16 — buffer | `calcolaBuffer` |

## Scelte interpretative da confermare (Fondazione / RINA)

1. **FEdes(r)**: la Tabella 2 lo descrive come fattore dello scenario
   "Riduzione"; si usa quindi FErid(r) (Tabella 3/4). Il Progetto può
   indicare valori diversi.
2. **Emissioni attese per utenza**: EA(i) è calcolato sulle sole tipologie di
   rifiuto misurate nella Banca Dati Utenze; le tipologie non misurate sono
   coperte dal buffer della Tabella 16. Con le utenze del passo 5a (dal
   23/10/2026) la regola vale **utenza per utenza**: contano le frazioni con
   un valore per quell'utenza (anche 0), non quelle lasciate vuote.
3. **Riuso (formule 26 e 29)**: applicate alla lettera
   (EP(b) = − Q × FErid(b), con FErid(b) negativo) fanno *aumentare* le
   emissioni quando un'utenza conferisce beni a riuso. Il portale applica la
   formula come scritta; un'opzione esplicita ("Tratta il riuso come
   riduzione") inverte il segno se la Fondazione lo conferma.
4. **Buffer**: è trattenuto dai crediti lordi
   (crediti netti = crediti lordi × (1 − buffer)).
5. **Tabella 16**: le combinazioni di rifiuti misurati non elencate (ad
   esempio indifferenziato e carta senza organico) ricadono nella condizione
   minima (30%), la più cautelativa.
6. **Componente trasporto (Capitolo 9)**: non calcolata a parte, come la
   Metodologia consente; si usano i fattori della Tabella 3 che la includono.
7. **Residenti / non residenti**: la distinzione serve solo al buffer
   (Tabella 15); le classi domestiche sono quelle della delibera.

**Domande aperte dal collaudo V01 (20/10/2026)** — nessuna è stata decisa
dallo sviluppo; il portale resta com'è finché la Fondazione non indica la
regola (risposte da scrivere in `docs/collaudo/Collaudo_V01_risposte.md`):

8. **R01 — Tariffa puntuale e buffer.** Con le stesse opzioni (solo utenze
   virtuose 20%, tutte le utenze monitorate, indifferenziato e organico
   misurati, tariffa puntuale) il calcolatore dimezza tutto il buffer
   ((20 + 20) / 2 = 20%), il simulatore solo la parte della Tabella 16
   (20 + 20 / 2 = 30%). Quale lettura del Capitolo 7 vale?
9. **R02 — Distribuzione delle utenze nel simulatore** (metodo «per
   utenza»): la normale non troncata ammette produzioni negative e, con
   media zero, quote evitate fino al 122,7% dell'atteso. Dominio e
   distribuzione da approvare (troncamento, lognormale, dati individuali).
10. **R03 — Crediti interi.** La parte economica conta i crediti interi di
    ogni anno (292 invece di 292,8): conferma della convenzione e del
    trattamento delle frazioni residue (anno per anno o sul periodo).
11. **Riuso**: vedi punto 3 (segno dell'effetto del riuso).
12. **R06 — Documenti obbligatori e fasi**: oggi un documento mancante è un
    promemoria non bloccante; serve la matrice documenti/stati che blocca.

## Simulatore di scenari (prima versione 19/10/2026)

Richiesto da Luca il 19/10/2026 (Registro, backlog punto 37). Pagina
`/simulatore` (Operatori e Amministratori), motore
`src/lib/crediti/simulatore.js` (prove in `test/simulatore.test.mjs`),
scenari salvati in `scenario_simulazione` (`supabase/28_simulatore.sql`).
Stima ex ante, non certificabile.

| Passo | Che cosa si inserisce o si ottiene |
|---|---|
| Scenario | Comune (censito o solo nome), nome e note; più scenari per Comune, duplicabili e confrontabili |
| Durata | Menu a tendina: 7, 10 o 21 anni (Standard 4.3.8); primo anno |
| Scenario di riferimento | Standard 4.8.1: anno con differenziata 64-66% (a mano o da un calcolo esistente) oppure valori medi del cluster SOSE (Tabella 3) × popolazione ISPRA 2022; avvisi se fuori intervallo o oltre ±30% dalla Tabella 3 |
| Situazione attuale | Facoltativa: ultimo anno disponibile, punto di partenza di obiettivi e traiettoria |
| Obiettivi annui | Per ogni anno: popolazione, produzione totale (t o kg/ab), secco residuo pro capite (kg/ab); traiettoria lineare automatica |
| Ricalcolo | Secco = secco pro capite × popolazione; differenziata = totale − secco; % differenziata = differenziata / totale |
| Crediti simulati | Per anno: lordi, buffer, netti, cumulati; totale del periodo |
| Uscite | Riepilogo, grafici, tabella, confronto tra scenari, CSV, stampa |

**Modello (semplificato, da confermare con la Fondazione)**

- Scenario di riferimento dell'anno *a*, sempre alla soglia del 65% di differenziata (richiesta di Luca del 19/10): Tot_rif(a) = Tot_rif × Pop(a) / Pop_rif; secco = 35% di Tot_rif(a); frazione *r* = 65% di Tot_rif(a) × quota di *r* nella differenziata del riferimento. Tot_rif dall'anno di riferimento dello Standard 4.8.1 o dalla Tabella 3.
- Scenario simulato: Q(secco, a) = secco pro capite(a) × Pop(a); Q(r, a) =
  (Totale(a) − Q(secco, a)) × quota di *r* nella differenziata dell'anno base.
- Emissioni: E = − Σ Q(r) × FErid(r) (formule 13 e 25); FE del secco =
  media dei FErid delle frazioni a recupero pesata con l'anno base
  (formule 16-17).
- ΔI(a) = EP(a) − EA(a); crediti lordi = −ΔI se negativa, altrimenti debito;
  netti = lordi × (1 − buffer).

**Simulazione economica (19/10/2026).** Ricavi = crediti netti interi × valore del credito digitato anno per anno (proposto 32 €; «Applica a tutti gli anni» con variazione annua facoltativa). Costi a carico del Comune o del gestore, IVA esclusa: il simulatore chiede se usare il **Caso 1** (progetto volontario) o il **Caso 2** (progetto obbligatorio da bando di gara), dalle tabelle «Costi per il Soggetto Promotore» di Fondazione Operate del 28/07/2026 (progetti di 10 anni; le voci una tantum sono un corrispettivo unico pagato in 10 rate annuali secondo i contratti di consulenza e di partecipazione, quindi l'importo annuo è una rata; validazione dell'ente esclusa). Con una durata diversa da 10 anni il risultato è segnalato come stima senza regola (`durataFuoriListino`, rilievo N01, ATTESA_REGOLA):

| Attività | Caso 1: min €/anno · €/ab ≤5.000 · 20.000 · >100.000 · max €/anno | Caso 2: idem |
|---|---|---|
| Progetto (una tantum, in 10 rate annuali) | 300 · 0,20 · 0,10 · 0,08 · 15.000 | 450 · 0,30 · 0,15 · 0,12 · 22.500 |
| Rapporto di Monitoraggio | 400 · 0,40 · 0,30 · 0,20 · 40.000 | 600 · 0,60 · 0,45 · 0,33 · 65.000 |
| Registrazione Progetto (una tantum, in 10 rate annuali) | 100 · 0,10 · 0,10 · 0,02 · 3.000 | 150 · 0,15 · 0,15 · 0,03 · 4.500 |
| Registrazione Crediti Progetto (una tantum, in 10 rate annuali) | 100 · 0,15 · 0,10 · 0,04 · 6.000 | 150 · 0,25 · 0,15 · 0,06 · 9.000 |
| Registrazione Rapporto di Monitoraggio | 150 · 0,20 · 0,18 · 0,10 · 15.000 | 225 · 0,30 · 0,28 · 0,15 · 22.500 |
| Registrazione Crediti Rapporto di Monitoraggio | 100 · 0,10 · 0,10 · 0,10 · 20.000 | 150 · 0,15 · 0,15 · 0,15 · 30.000 |

Costo per abitante interpolato linearmente tra 5.000 e 20.000 e tra 20.000 e 100.000 abitanti, arrotondato per eccesso al centesimo; costo annuo = unitario × popolazione, entro minimo e massimo. Il Caso 1 con 154.247 abitanti riproduce le cifre dei contratti tipo EsaCom. Funzioni `costoUnitario` e `costiPerCaso` di `simulatore.js`. In alternativa: Schema tariffario v1.2 (`src/lib/tariffe.js`, tariffe massime) o nessuna tariffa.

In tutti i casi si aggiungono ente di validazione (una tantum), ente di verifica (ogni anno) e altri costi annui. Uscite: ricavi (con intervallo), costi, margine e cumulato per anno, anno di rientro, costo e ricavo per abitante nel periodo (come gli indicatori dell'Allegato A). Funzione `simulaEconomia` di `simulatore.js`.

**Confronto con le stime dei contratti EsaCom (analisi del 19/10/2026).** L'Allegato A del contratto di partecipazione EsaCom stima 29.077 crediti all'anno (anni 1-4), 32.500 (anni 5-7) e 35.356 (anni 8-10) per 154.247 abitanti, cioè 0,19-0,23 crediti per abitante all'anno, «contabilizzando il rifiuto urbano residuo e la frazione organica con tariffazione puntuale». Il simulatore nella prima versione faceva solo il **bilancio del Comune** e dava molto meno (Bovisio-Masciago: 0,04). La differenza è di metodo, non un errore di calcolo: l'Allegato A usa l'opzione della formula 32 che **conta solo le utenze virtuose** (Capitolo 4.6), con il buffer del Capitolo 7.

Il simulatore ha ora i due metodi:

| Metodo | Come stima | Bovisio-Masciago, 10 anni (ISPRA 2021, obiettivo 400 / 50 kg/ab) |
|---|---|---|
| Bilancio del Comune | ΔI = EP − EA sui totali; buffer impostato (20%) | 6.707 crediti netti, 0,040 per abitante all'anno |
| Per utenza, solo utenze virtuose | Rifiuti misurati (secco e organico) che le utenze virtuose producono in meno del valore atteso; variabilità tra utenze 30%; buffer 30% (20% + Tabella 16 dimezzata per la tariffa puntuale) | 34.188 crediti netti, 0,204 per abitante all'anno |

Con il metodo per utenza Bovisio-Masciago ricade nell'intervallo dell'Allegato A. La parte maggiore dei crediti non viene dalla variabilità ipotizzata (con variabilità 0% resterebbe oltre 0,19) ma dal fatto che il Comune ha già l'84% di differenziata: il secco delle utenze è molto sotto il valore atteso dello scenario di riferimento al 65%, e misurando solo secco e organico lo spostamento verso carta, vetro e plastica non si compensa (è il motivo del buffer della Tabella 16).

Modello della stima per utenza: per ogni rifiuto misurato, con A = quantità attesa (riferimento al 65%), m = produzione prevista / A e σ = variabilità tra utenze, i rifiuti evitati dalle sole utenze virtuose sono A × [d·Φ(d/σ) + σ·φ(d/σ)] con d = 1 − m (media di max(0, 1 − X) per X normale di media m e scarto σ); crediti lordi = Σ rifiuti evitati × |FErid|. Funzioni `quotaVirtuose`, `bufferMetodologia` e `taraVariabilita` di `simulatore.js`. Lettura prudente del Capitolo 7: la tariffa puntuale dimezza la parte della Tabella 16, non il 20% delle utenze virtuose.

Altre osservazioni sull'Allegato A:
- i costi: le tabelle del 28/07/2026 con 154.247 abitanti danno 82.614 € all'anno (826.139 € in 10 anni, 5,36 € per abitante; le voci «una tantum» sono pagate in 10 rate annuali, come dicono i contratti). L'Allegato indica 6,08 € per abitante: la differenza (circa 111.700 € in 10 anni) potrebbe essere il costo dell'ente di validazione e verifica, che le tabelle escludono. Da chiarire con chi ha preparato l'Allegato;
- i ricavi per abitante dell'Allegato (11,31 e 22,92 €) usano gli stessi crediti per tutti i 10 anni (29.077 a 6 € e 35.356 a 10 €), non il profilo a scalini della tabella dei crediti.

**Conformità al modello CWP (verifica del 19/10/2026).**

| Punto | Documento CWP | Nel simulatore |
|---|---|---|
| Durata | Standard 4.3.8: 7 anni ripetibili tre volte o 10 anni | Menu 7 / 10 / 21 anni |
| Scenario di riferimento | Standard 4.8 e 4.8.1: anno con differenziata 64-66% o Tabella 3 × popolazione ISPRA 2022 | I due metodi, con controllo dell'intervallo |
| Addizionalità normativa | Standard 4.9.1 | Avviso se l'anno di riferimento è fuori 64-66% |
| Qualità dei dati | Gestione qualità 3.1.2: ±30% dalla Tabella 3 | Avviso per tipologia |
| Stima ex ante aggregata | Metodologia 6.1 (semplificazione a) e 6.2 | Valori medi su tutto il Comune |
| Emissioni | Formule 13 e 25, FErid Tabelle 3-4 | Stesse formule e fattori di `parametri.js` |
| Fattore del secco | Formule 16-17 | Media pesata del riferimento |
| Crediti e buffer | Formule 31-32, Capitolo 7 | Lordi, buffer, netti, debito |
| Riuso ex ante | Metodologia 6.1: valore pari a zero | Non considerato |
| Leakage | Metodologia 6.3: non previsto | Non considerato |
| Non coperti | Formula 1 (primo anno parziale), Capitolo 9 (trasporto), buffer da Tabelle 15-16 | Buffer impostato a mano (20% predefinito) |

**Conseguenza da comunicare.** Poiché il fattore del secco è la media dei
fattori della differenziata, con composizione costante i crediti sono
(rifiuti evitati in t) × |FE del secco|: spostare rifiuti dal secco alla
differenziata alza la % di raccolta differenziata ma, a parità di
produzione totale, non genera crediti. I crediti nascono dalla
**prevenzione** (meno rifiuti prodotti). Se la Fondazione volesse dare
peso anche alla qualità della differenziata, servirebbe una scelta
metodologica (per esempio un fattore del secco diverso o una composizione
della differenziata che cambia negli anni).

## Garanzie

- Accesso solo agli Amministratori con verifica a due fattori.
- Un calcolo **confermato** è immutabile (dati, Banca Dati Utenze e
  risultato); le correzioni si fanno con una **nuova versione**, che conserva
  il collegamento all'originale.
- Creazione, ricalcolo e conferma sono registrati nell'audit trail.
