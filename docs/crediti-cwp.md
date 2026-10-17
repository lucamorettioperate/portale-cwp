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

## Garanzie

- Accesso solo agli Amministratori con verifica a due fattori.
- Un calcolo **confermato** è immutabile (dati, Banca Dati Utenze e
  risultato); le correzioni si fanno con una **nuova versione**, che conserva
  il collegamento all'originale.
- Creazione, ricalcolo e conferma sono registrati nell'audit trail.
