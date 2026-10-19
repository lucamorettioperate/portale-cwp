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

## Corrispondenza con le formule

| Formula | Dove |
|---|---|
| 1 — primo anno parziale | `coefficientePrimoAnno` |
| 2-8 — ripartizione domestiche / non domestiche | `produzioneAttesa` |
| 9-12 — valori attesi per classe | `produzioneAttesa` |
| 13-15 — emissioni attese | `calcolaCrediti` (territorio e per utenza) |
| 16-17 — FE dell'indifferenziato | `fattoreIndifferenziato` |
| 18 — peso specifico a consuntivo | `pesiSpecifici` |
| 19-22 — conferimenti in peso | `conferimentiInPeso` |
| 25-30 — emissioni di progetto | `calcolaCrediti` |
| 31-32 — variazione di impatto e crediti | `calcolaCrediti` |
| Tab. 15-16 — buffer | `calcolaBuffer` |

## Scelte interpretative da confermare (Fondazione / RINA)

1. **FEdes(r)**: la Tabella 2 lo descrive come fattore dello scenario
   "Riduzione"; si usa quindi FErid(r) (Tabella 3/4). Il Progetto può
   indicare valori diversi.
2. **Emissioni attese per utenza**: EA(i) è calcolato sulle sole tipologie di
   rifiuto misurate nella Banca Dati Utenze; le tipologie non misurate sono
   coperte dal buffer della Tabella 16.
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

**Simulazione economica (19/10/2026).** Ricavi = crediti netti interi × valore unitario digitato (con variazione annua facoltativa; valori minimo e massimo facoltativi per gli scenari peggiore e migliore, come nell'Allegato A del contratto tipo). Costi a carico del Comune o del gestore, IVA esclusa, con tre listini:

| Listino | Voci per ogni anno del periodo |
|---|---|
| Contratti tipo della Fondazione (predefinito; bozze EsaCom del 15/10/2026) | Partecipazione al Programma: registrazione Progetto 3.000 €, registrazione crediti Progetto 6.000 €, registrazione Rapporto 15.000 €, registrazione crediti Rapporto 0,10 €/abitante. Consulenza: redazione Progetto 0,08 €/abitante, redazione Rapporto 0,20 €/abitante. Valori modificabili; quelli per abitante ricavati dai contratti EsaCom (154.247 abitanti: 15.425 €, 12.340 €, 30.849 €) |
| Schema tariffario v1.2 (tariffe massime, `src/lib/tariffe.js`) | Progetto nel primo anno (3.000 € + saldo per fascia di popolazione + 0,15 € per credito previsto); Rapporto (1.000 € + saldo per fascia + 0,20 € per credito); emissione a scaglioni; vendita 20% del valore con minimo a scaglioni |
| Solo costi indicati | Nessuna tariffa |

In tutti i casi si aggiungono ente di validazione (una tantum), ente di verifica (ogni anno) e altri costi annui. Uscite: ricavi (con intervallo), costi, margine e cumulato per anno, anno di rientro, costo e ricavo per abitante nel periodo (come gli indicatori dell'Allegato A). Funzione `simulaEconomia` di `simulatore.js`.

**Attenzione al confronto con le stime dei contratti.** L'Allegato A del contratto EsaCom stima circa 0,19-0,23 crediti per abitante all'anno (29.000-35.000 crediti per 154.247 abitanti, contabilizzando secco e organico per utenza con tariffazione puntuale). Il simulatore, che lavora sui totali del Comune e conta solo i rifiuti evitati, dà valori molto più bassi (Bovisio-Masciago: circa 0,04 crediti per abitante all'anno): il calcolo per utenza della Metodologia somma solo le utenze virtuose (formula 32), che a livello di Comune si compensano con le altre. Il metodo di stima va allineato con quello usato per l'Allegato A.

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
