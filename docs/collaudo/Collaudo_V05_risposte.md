# CWP — collaudo dei profili Cliente A/B e Operatore

V05 · avviato il 20 ottobre 2026 · aggiornato il 21 ottobre 2026 · campagna in corso · assistente AI escluso

> **Risposte dello sviluppo (Claude, per Fondazione Operate) — 21/10/2026.** Le risposte sono inserite sotto D08, O01, D05-R1 e «Prosecuzione». Le correzioni di D05-R1 e O01 sono **in produzione dal 21/10/2026 alle 10:50 circa (commit `39c9bc8`)**, su mandato di Luca Moretti; nessuno script del database. Verifica dal vivo: sulle due righe del 21/10 alle 09:20:41 e 09:21:21 «Testo completo» mostra rispettivamente «Aggiunto:» e «Tolto:» con la riga temporanea, e l'oggetto «Organizzazione «COLLAUDO AL V03 - COMUNE B - 20261020» (916f3283)».
>
> | ID | Stato | In breve |
> |---|---|---|
> | D05-R1 | `CORRETTO_DA_RITESTARE` | «Testo completo»: valori interi Prima/Dopo e parte Tolto/Aggiunto; nome dell'organizzazione nell'oggetto; ricerca sui valori; CSV con valori interi |
> | O01 | `CORRETTO_DA_RITESTARE` | Pagina «Account disattivato» al posto degli archivi vuoti |
> | D08 | `APERTO` | Configurazione, non codice: serve un dominio verificato su Resend (azione di Luca Moretti) |

## Esito concreto e perimetro

Entrambi gli account sintetici sono stati creati manualmente dall’utente e sono utilizzabili. Il 21 ottobre, dopo la riattivazione dichiarata dall’utente, è stato verificato il ritorno di B alla propria pratica e al documento B, mantenendo il diniego verso A; la verifica è avvenuta con un nuovo accesso sicuro. L’agente ha effettuato accessi sequenziali tramite il modulo sicuro del browser, verificando ogni volta l’identità effettivamente mostrata dal portale.

Nei percorsi UI riprovati, Cliente A vede soltanto la pratica A e Cliente B soltanto B. L’apertura diretta dell’altra pratica restituisce «Pratica non trovata.»; il percorso di back-office riporta alla pratica del Cliente corrente. Utenti, Audit e il calcolatore riservato risultano negati a entrambi. Le viste documentali mostrano soltanto i file della rispettiva pratica, oltre ai modelli comuni del Programma.

Sono verifiche dell’interfaccia e dei percorsi applicativi osservabili: non costituiscono una certificazione completa delle autorizzazioni del database, dello storage o di ogni possibile richiesta al servizio. Non sono state impiegate chiamate dirette alle API, token, cookie o URL firmati per aggirare i limiti del browser.

Riferimenti: piano V04 approvato, rapporto V03, `CWP_AGGIORNAMENTO_COLLAUDO_V04_20261020.md` e integrazione `CWP_D08_EMAIL_E_PROFILO_CLIENTE_A_20261020.md`. I risultati locali e le regressioni dei calcoli restano quelli già registrati; non sono stati rieseguiti in questa fase del Cliente B e non vengono sommati alle prove di autorizzazione. La corrispondenza fra bundle online e commit resta basata sulla dichiarazione dello sviluppo, non su un confronto crittografico del bundle.

## Identità e dati usati

| Profilo | Identità verificata nella sessione | Organizzazione/pratica visibile |
|---|---|---|
| Cliente A | `belfiore.luca+cwp-cliente-a@gmail.com`, ruolo Cliente; nome nell’elenco Admin «Comune A» | `COLLAUDO AL V03 - COMUNE A - 20261020`, pratica `c70a0531-09f0-47d0-86e9-3f51ce3b03ff`, codice COLLAUDO-V03-A-20261020 |
| Cliente B | `belfiore.luca+cwp-cliente-b@gmail.com`, ruolo Cliente; nome nell’elenco Admin «Comune B»; scheda riletta il 21 ottobre | `COLLAUDO AL V03 - COMUNE B - 20261020`, pratica `dc33ade9-6831-432e-8dbd-05bd7f461a48`, codice COLLAUDO-V03-B-20261020 |

Per B la visibilità della sola organizzazione B è osservata nell’elenco e nel dettaglio Cliente e confermata nella scheda Admin del 21 ottobre: nome Comune B, ruolo Cliente e sola organizzazione B mostrata; comando Disattiva disponibile. Non è una lettura diretta del database. Gli indirizzi con `+` sono ora accettati come due identità applicative distinte. La consegna delle email agli alias rimane un controllo separato.

Attesi sintetici: A, popolazione 1.000 e ISTAT segnaposto 000001, Adesione completata; B, popolazione 2.000 e ISTAT segnaposto 000002, Adesione in corso. Nessun codice ISTAT è utilizzabile per rappresentare un Comune reale. Nessun progetto registrato ufficialmente né credito emesso in questa fase.

## Verifiche Cliente B

| Caso | Obiettivo e atteso | Evidenza osservata | Esito |
|---|---|---|---|
| B01 — accesso e cambio di identità | Dopo l’uscita da A, sessione autenticata come B senza mostrare il dettaglio privato di A | Alias B e ruolo Cliente nel menu. Il vecchio URL della pratica A, rimasto dopo il login, restituisce «Pratica non trovata.» e lista della sola B. | SUPERATO sul percorso osservato |
| B02 — elenco | Nessuna pratica A o reale nell’elenco | Una voce: COLLAUDO-V03-B-20261020, Comune B. | SUPERATO |
| B03 — dettaglio proprio | Dati e stato coerenti con il riferimento | URL Cliente con ID B; popolazione 2000, ISTAT sintetico 000002, Adesione In corso, sei fasi successive non iniziate. Presente B v1 corrente. | SUPERATO |
| B04 — pratica A dal percorso Cliente | Nessun dato o documento A | Navigazione esplicita a `https://portale-cwp.vercel.app/?id=c70a0531-09f0-47d0-86e9-3f51ce3b03ff`: «Pratica non trovata.», soltanto B nell’elenco, nessun documento A. | SUPERATO per la navigazione UI |
| B05 — pratica A dal percorso back-office | Nessuna esposizione di A | Navigazione a `/pratiche?id=c70a0531-09f0-47d0-86e9-3f51ce3b03ff`: reindirizzamento a `https://portale-cwp.vercel.app/?id=dc33ade9-6831-432e-8dbd-05bd7f461a48`, dettaglio B, nessun file A. | SUPERATO |
| B06 — gestione utenti | Nessun elenco o comando Admin disponibile | `/utenti`: «Questa sezione è riservata agli amministratori.» | SUPERATO |
| B07 — audit | Nessun dato di audit riservato | `/audit`: medesimo diniego. | SUPERATO |
| B08 — calcolatore | Nessuna esposizione della bozza riservata | `/crediti/ec3f8c12-d554-462e-9ea0-104b198678c7`: medesimo diniego. | SUPERATO |
| B09 — documenti correnti | File della sola B, oltre ai modelli generali | «I tuoi documenti»: COLLAUDO_V03_B_RISERVATO.txt v1, riferimento a B; nessun file A. | SUPERATO sulla visibilità UI |
| B10 — versioni precedenti | Nessuna comparsa di A attivando il filtro storico | Selezionando «Mostra anche le versioni precedenti» resta il solo documento B v1, coerentemente con il dataset preparato. | SUPERATO sulla visibilità UI |

I controlli di A sono dettagliati nei casi A00–A10 dell’integrazione D08/Cliente A: undici riscontri favorevoli, incluso il controllo iniziale Admin di identità e associazione. I dieci casi B01–B10 sono aggiuntivi. Non sono ventuno prove complete del backend né sostituiscono l’intera matrice V03.

## Risultato simmetrico A/B

| Percorso | Cliente A | Cliente B |
|---|---|---|
| Propria pratica | A accessibile | B accessibile |
| Altra pratica tramite URL Cliente | B: Pratica non trovata | A: Pratica non trovata |
| Altra pratica tramite URL back-office | Reindirizzato alla propria A | Reindirizzato alla propria B |
| Utenti / Audit / calcolatore riservato | Negati | Negati |
| Archivio documenti | Solo A v2 corrente; A v1 col filtro storico | Solo B v1, anche col filtro storico |

Non sono stati effettuati upload, invii di messaggi, reclami, modifiche di fasi, registrazioni, conferme di calcolo o cambi di ruoli. La possibilità di caricare nella fase Adesione di B è stata soltanto osservata: non è un test di caricamento riuscito. Non è stato richiesto il download di file dell’altro Comune.

## D08 — recapito email ancora da verificare dopo la correzione

La schermata fornita dall’utente per la creazione A conferma «Utente creato» e, separatamente, «Email non inviata». Resend risponde 403: il servizio di prova può inviare soltanto all’indirizzo del titolare e richiede dominio verificato/mittente autorizzato per altri destinatari. La credenziale contenuta nella schermata non viene trascritta né la schermata duplicata in questo report.

Il difetto di configurazione è registrato come D08, priorità proposta P1. La creazione e l’accesso A/B non verificano la consegna delle email. Non è stata osservata la schermata di esito della mail B e non si presume automaticamente lo stesso fallimento per B. D08 resta aperto fino al controllo di invio e ricezione dopo la configurazione del mittente da parte dello sviluppatore.

Accettazione: evento di prova autorizzato su recapito controllato, esito applicativo corretto, ricezione effettiva con destinatario completo e mittente atteso; nessuna creazione doppia o reset password solo per provocare una mail. Le notifiche che avvisano staff reale richiedono isolamento o accordo sui destinatari prima di essere provocate. Nessuna email a Moretti è stata inviata dall’agente.

> **Risposta dello sviluppo — 21/10/2026 · Stato: `APERTO` (configurazione in carico a Luca Moretti)**
>
> **Causa accertata.** Le funzioni `crea-utente` e `recupera-password` inviano con Resend dal mittente di prova `onboarding@resend.dev`, perché il segreto `EMAIL_MITTENTE` non è impostato. In modalità di prova Resend consegna solo all'indirizzo del titolare dell'account e risponde 403 per gli altri destinatari. Il punto era già nel Registro (backlog 17). Il portale lo segnala correttamente: «Utente creato» e, a parte, «Email non inviata».
>
> Per lo stesso motivo anche le email di B e dell'Operatore non sono arrivate.
>
> Il codice non va modificato. Servono tre passi di configurazione, che richiedono l'accesso al DNS di un dominio della Fondazione (per esempio `operate.it` o un sottodominio come `portale.operate.it`):
> 1. **Resend → Domains → Add domain**, poi copiare i record DNS indicati (SPF, DKIM, eventualmente MX di ritorno) nel pannello DNS del dominio e premere **Verify**.
> 2. **Supabase → Edge Functions → Secrets:** impostare `EMAIL_MITTENTE`, per esempio «Portale CWP <portale@operate.it>».
> 3. Prova di accettazione, come chiede il collaudo: una sola reimpostazione password su un profilo sintetico con casella controllata. Va verificata la ricezione, con destinatario completo e mittente atteso.
>
> Le notifiche verso lo staff reale vanno provocate solo dopo un accordo sui destinatari.


## Limiti e prove ancora aperte

- **Contenuto dei download:** per A lo strumento del browser ha bloccato la restituzione del file con BrowserCredentialRecoveryError/retained_data_restricted. Dopo il recupero consentito della pagina e un unico nuovo tentativo il limite è rimasto. Non sono state usate acquisizioni alternative di dati trattenuti, URL firmati o token. Hash A non confrontati in questa sessione; download e fascicolo B non eseguiti a causa del limite già noto. È un blocco della prova, non un fallimento dimostrato del prodotto.
- **Attesi di integrità:** A v1 SHA-256 `9406923f794707eb74cc9019a032a02567d8e85cea81ef4b89209633ea96d82f`; A v2 `7235bae9a53a951e7aa095c126fbc2efd7a9254f9ee026b0f13fcca64d0d9a51`; B v1 `5718330f3ad6e97c84da93a7f8654a3f5fd20db995506f32c9ef19ccfc8af2a5`. Sono riferimenti dei file V03, non nuovi confronti superati.
- **Cambio iniziale password:** non osservato direttamente per A o B. I moduli sicuri non restituiscono i segreti all’agente. Non si deduce dal login riuscito né che il cambio sia stato imposto né che sia stato aggirato: potrebbe essere stato completato dall’utente fuori dalla vista dell’agente.
- **Operatore:** accesso e ruolo verificati il 21 ottobre; risultati OP01–OP13 sotto. Due salvataggi sulle sole note dell’anagrafica B, con ripristino verificato. Consegna email, cambio iniziale password, associazioni Admin e protezioni backend restano distinti e non integralmente osservati. Nessuna protezione disabilitata.
- **Revoca/riattivazione e notifiche:** revoca verificata sulle nuove consultazioni di pratica e documenti della sessione B già aperta, come dettagliato sotto. Riattivazione verificata il 21 ottobre su un nuovo accesso sicuro, nei casi B14–B16. Non osservato il ripristino sulla medesima sessione del giorno precedente: la scheda del browser di automazione non era più disponibile. Questo limite non dimostra una scadenza della sessione imposta dal portale. Operazioni di scrittura dopo la revoca, invalidazione di ogni token e accesso a URL di storage già emessi non provati. Le notifiche restano da verificare con destinatari controllati.
- **Metodologia e altri rilievi:** restano aperte le riserve della Fondazione e i limiti riportati nei dossier V03/V04; il buon esito di questi controlli di autorizzazione non li chiude. Nessuna prova di carico, sicurezza attiva, concorrenza o recupero eseguita.

## Revoca e riattivazione: esiti e limiti

L’utente ha comunicato «disattivato» dopo la richiesta di disattivare esclusivamente B dal proprio browser esterno Admin. L’agente ha ricaricato la sessione B preesistente, senza uscire né autenticarsi nuovamente. La pagina continua a riconoscere l’alias B e il ruolo Cliente, ma la pratica e i documenti privati non sono più mostrati. Il valore del flag Admin non è stato riletto dall’agente: l’intervento amministrativo è attestato dall’utente, mentre il cambiamento nella sessione Cliente è stato osservato direttamente.

| Caso aggiunto | Riscontro dopo la disattivazione dichiarata | Esito e limite |
|---|---|---|
| B11 — pratica su sessione già aperta | Ricaricato l’URL già aperto con ID B. Messaggio «Non risultano ancora pratiche a tuo carico.»; nessun elenco o dettaglio privato B. L’alias B resta riconosciuto. | SUPERATO sulle nuove consultazioni UI; nessuna prova di invalidazione completa della sessione di autenticazione. |
| B12 — documenti della sessione revocata | Navigazione a I tuoi documenti dopo la ricarica: «Non ci sono ancora documenti. Quando la Fondazione caricherà il contratto o altri documenti, li troverai qui.»; nessun file B. Restano i modelli generali del Programma, senza download eseguiti. | SUPERATO sulla visibilità dei documenti della pratica. |
| B13 — versioni precedenti dopo la revoca | Selezionata la casella Mostra anche le versioni precedenti, con stato selezionato confermato dal controllo DOM. Archivio privato ancora vuoto; nessun file A/B. | SUPERATO sul filtro UI; byte e URL di storage non verificati. |

La persistenza dell’identità nel menu non è stata classificata da sola come un difetto: il criterio applicato è il blocco dei contenuti privati sulle nuove consultazioni. Non sono state eseguite scritture, messaggi, reclami o upload per verificare eventuali effetti persistenti dopo la revoca.

**O01 — messaggio poco chiaro dopo la revoca (miglioria proposta, P3).** La UI presenta archivi vuoti e prospetta futuri caricamenti della Fondazione, invece di comunicare la disattivazione dell’account. Questo può essere confuso con un’assenza di pratiche o documenti. Proposta da concordare: mostrare uno stato esplicito «account disattivato» con istruzioni per contattare il supporto, senza esporre dati privati. Non è una prova di accesso indebito né un nuovo difetto di isolamento.

> **Risposta dello sviluppo — 21/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> Accolta la proposta. Chi entra con un account disattivato, o ricarica una pagina già aperta, vede ora il riquadro **«Account disattivato»**:
> - è indicata l'email dell'account;
> - un testo spiega che pratiche e documenti non sono consultabili e invita a scrivere alla Fondazione;
> - c'è il pulsante **Esci**.
>
> Gli archivi vuoti non vengono più mostrati.
>
> Nessun dato privato è letto dalla pagina. Il controllo usa il campo `attivo` del proprio profilo, che ciascuno può già leggere (regola `profilo_self_select`). Le regole del database continuano a bloccare pratiche e documenti come prima.
>
> **File modificati:** `src/components/AccountDisattivato.jsx` (nuovo) e `src/App.jsx` (controllo in `Protetta`, prima di ogni altra pagina riservata). Verificato a schermo su computer e telefono, con dati di prova.
>
> **Per il ritest:** caso 10.5 del Manuale di test 3.10. Disattivare B, ricaricare la sessione B, poi riattivarlo.


Variazione operativa del piano V04: usare B, ora già aperto, invece di A per la prova reversibile di revoca. Rimangono invariati perimetro, rischio e divieti: un solo account sintetico, nessuna cancellazione, nessun reset password, nessun utente reale o Admin modificato. La variazione evita un ulteriore cambio di accesso prima del test.

Sequenza e stato aggiornati:

1. **Eseguito dall’utente:** disattivazione dichiarata del solo `belfiore.luca+cwp-cliente-b@gmail.com` dal browser esterno Admin, con la sessione B dell’agente lasciata aperta.
2. **Eseguito dall’agente:** ricarica della sessione e consultazioni di pratica, documenti e versioni precedenti con i risultati B11–B13. L’esito riguarda nuove richieste dopo la revoca; non prova la cancellazione di copie già ottenute legittimamente.
3. **Eseguito il 21 ottobre:** l’utente ha comunicato «riattivato». La scheda del giorno precedente non era più disponibile nel browser di automazione; una nuova scheda sullo stesso portale ha richiesto il login. Dopo il modulo sicuro, l’identità B, la propria pratica e il documento B sono stati osservati nuovamente. L’accesso diretto ad A resta negato. Il ripristino sulla stessa sessione preesistente non è verificato; non si attribuisce al portale la perdita della scheda di automazione.
4. **Eseguito il 21 ottobre:** accesso sicuro a `belfiore.luca+cwp-operatore@gmail.com`; il profilo mostra «COLLAUDO V03 Operatore» e «Operatore di back-office». Verifiche OP01–OP13 riportate sotto; nessuna nuova organizzazione creata. La scheda Admin dell’Operatore e il ruolo selezionato sono stati riletti; il modulo non propone associazioni Cliente per questo ruolo, ma non espone una tabella separata con cui dimostrare lo zero delle associazioni nel database.


### Riattivazione verificata il 21 ottobre 2026

| Caso aggiunto | Atteso e riscontro | Esito e limite |
|---|---|---|
| B14 — accesso dopo riattivazione | Nuovo accesso tramite modulo sicuro: alias B e ruolo Cliente confermati nel portale. Una sola pratica nell’elenco, B; dettaglio B con popolazione 2000, ISTAT sintetico 000002, Adesione In corso e documento B v1 corrente. | SUPERATO_UI su nuova sessione; stato Admin attestato dall’utente, non riletto. |
| B15 — ripristino archivio proprio | I tuoi documenti mostra COLLAUDO_V03_B_RISERVATO.txt v1 con riferimento a COLLAUDO-V03-B-20261020; nessun documento A. | SUPERATO_UI sulla visibilità; download e confronto hash non eseguiti. |
| B16 — separazione dopo riattivazione | Navigazione diretta all’URL Cliente con ID A: «Pratica non trovata.»; resta la sola B nell’elenco e non compare alcun documento A. | SUPERATO_UI per il percorso visitato; non certifica tutte le autorizzazioni backend/storage. |

Il ramo revoca/riattivazione è concluso per le consultazioni UI sopra osservate, con il limite esplicito del ritorno su nuova sessione. Non sono state eseguite nuove prove di scrittura, di storage o di invalidazione dei token. Nessun documento caricato e nessuna notifica intenzionalmente provocata in questa ripresa. Il ramo Operatore è stato poi eseguito il 21 ottobre come riportato sotto.

Condizione di arresto: se dopo la revoca una nuova richiesta restituisce dati riservati, raccogliere soltanto la minima evidenza, interrompere il ramo e registrare il rilievo ad alta priorità; nessun tentativo di ampliare l’accesso. Se il browser non permette di osservare l’esito, registrare il limite senza dichiarare SUPERATO o FALLITO il controllo applicativo.

Le schermate di prova prive di password sono disponibili temporaneamente nel workspace; non sono incluse nel dossier persistente. Il riferimento di ripresa è `analysis/v05/checkpoint_profili_ab.json`.


## Operatore — verifiche del 21 ottobre 2026

Account: `belfiore.luca+cwp-operatore@gmail.com`, nome nel profilo «COLLAUDO V03 Operatore», ruolo «Operatore di back-office». Autenticazione tramite modulo sicuro; segreti non restituiti all’agente. Dopo l’accesso il ruolo e l’alias sono stati letti nel portale. Non sono state mostrate richieste di MFA o cambio iniziale password durante l’accesso osservato. L’audit Admin letto successivamente riporta per l’Operatore un evento «cambio password», il 21/10/2026 alle 09:13:23, da «password temporanea» a «password personale»: è evidenza dell’evento registrato, senza esporre credenziali, ma non prova da sola che tutti i percorsi impongano il cambio iniziale. Il manuale acquisito dichiara la MFA disattivata per decisione della Fondazione: la configurazione effettiva del database non è stata letta né modificata.

Attesi: matrice dei ruoli in coda al Manuale Amministratore acquisito, capitoli 1–2 e 17; piano V04, fasi 2–4. L’Operatore accede alle pratiche complessive, anagrafiche, simulatore, reclami e gestione dei lotti esistenti. Utenti, audit, impostazioni, calcolo ed emissione dei crediti sono riservati agli Admin. La possibilità di leggere A e B è quindi prevista per questo ruolo. Il test non richiede di assegnargli organizzazioni Cliente.

| Caso | Obiettivo / atteso | Osservazione | Esito |
|---|---|---|---|
| OP01 — identità e ingresso | Account sintetico distinto dai Clienti; ruolo operativo effettivo | Alias Operatore nel menu; profilo con nome COLLAUDO V03 Operatore e ruolo Operatore di back-office. Dashboard con sei pratiche, incluse A e B. | SUPERATO_UI per identità/ingresso; ID completi e associazioni nel database non estratti |
| OP02 — pratica B | Accesso previsto al dettaglio B e comandi di back-office | Popolazione 2000, ISTAT 000002, Adesione In corso, file B v1; Esporta fascicolo e Modifica i dati abilitati. | SUPERATO_UI su consultazione e disponibilità comandi, non esecuzione di tutti i comandi |
| OP03 — pratica A e versioni | Accesso previsto ad A e storia documentale | Popolazione 1000, ISTAT 000001; A v2 corrente e v1 precedente, Cliente selezionato e Pubblico non selezionato. Aperto il modulo Modifica i dati e lasciato senza salvataggio. | SUPERATO_UI su consultazione/versioni e apertura modulo |
| OP04 — gestione utenti | Diniego anche tramite URL noto | `/utenti`: «Questa sezione è riservata agli amministratori.» | SUPERATO_UI |
| OP05 — audit | Nessun registro riservato | `/audit`: medesimo diniego. | SUPERATO_UI |
| OP06 — calcolo crediti | Nessun accesso alla bozza riservata | `/crediti/ec3f8c12-d554-462e-9ea0-104b198678c7`: medesimo diniego. | SUPERATO_UI |
| OP07 — impostazioni | Nessuna configurazione amministrativa | `/impostazioni`: medesimo diniego. | SUPERATO_UI |
| OP08 — documentazione proposta | Manuale Utente disponibile, documentazione Admin non proposta | Menu Manuale e profilo mostrano soltanto Manuale Utente Rev. 3.2 del 20/10/2026. Nessun collegamento al Manuale Amministratore o Registro sviluppo. | SUPERATO_UI sulla selezione dei collegamenti; protezione dei singoli URL PDF non verificata |
| OP09 — anagrafiche e persistenza | Ricerca A/B e salvataggio autorizzato su dati fittizi, senza alterare definitivamente il riferimento | Filtro COLLAUDO AL V03 mostra A/B. Modificata soltanto la nota B con la riga temporanea sotto; salvataggio e ricarica completa, riapertura e corrispondenza esatta. Ripristinato il testo originale con secondo salvataggio, seconda ricarica e nuova corrispondenza esatta. | SUPERATO_UI su scrittura, riapertura e ripristino; audit verificato nel caso OP14 con limite D05-R1 |
| OP10 — simulatore | Accesso allo scenario sintetico già predisposto | Aperto COLLAUDO AL V02 20261019 - riferimento indipendente; valori visibili 292,8 t/anno, 2928,0 nel periodo e ricavo 9344. Chiuso senza cambiamenti o salvataggi. | SUPERATO_UI su accesso/lettura; riferimento numerico V04, nessuna nuova validazione metodologica |
| OP11 — reclami | Sezione operativa raggiungibile | Pagina Reclami e richieste di chiarimento disponibile e pulsante Registra (PEC, email) abilitato. Nessun invio o registrazione. | SUPERATO_UI sulla raggiungibilità; flusso completo non eseguito |
| OP12 — crediti emessi | Pagina prevista per l’Operatore, senza emissioni di prova | Pagina disponibile, zero lotti; nessun comando di emissione visibile in questa vista. | PARZIALE: consultazione verificata, non provato il diniego all’emissione su un Rapporto ammissibile |
| OP13 — esportazioni e operazioni con effetti | Verificare byte esportati e azioni autorizzate nel loro insieme | Esporta fascicolo è abilitato; non eseguito dopo il limite di download già documentato. Non creati Rapporti, pagamenti, consultazioni pubbliche o richieste; destinatari automatici non ancora isolati. | BLOCCATO / NON_ESEGUITO secondo sottocaso; disponibilità del pulsante non prova l’esito |
| OP14 — tracciabilità delle scritture | Due eventi con autore Operatore, oggetto corretto e prima/dopo leggibili | Audit Admin: modifica organizzazione (916f3283) alle 09:20:41 e 09:21:21 del 21/10/2026, autore COLLAUDO V03 Operatore, ruolo operatore; ciascuna con una modifica al campo Note. Espansi entrambi i dettagli: testi prima/dopo troncati allo stesso prefisso, senza testo completo o attributo titolo nel controllo. | PARZIALE: eventi e campo confermati; confronto completo non consultabile, rilievo D05-R1 |
| OP15 — riscontro Admin dei profili | Ruolo Operatore e associazione B corretti | Scheda Operatore: nome e alias previsti, ruolo Operatore; modulo Modifica con Operatore di back-office selezionato, senza sezione organizzazioni; chiuso con Annulla. Scheda B: nome Comune B, ruolo Cliente, sola organizzazione B mostrata, comando Disattiva disponibile. Nessun salvataggio utenti. | SUPERATO_UI sui valori esposti; ID completi/associazioni backend non estratti |

Riga temporanea aggiunta alle sole Note B e poi rimossa: `COLLAUDO V05 20261021: prova temporanea di salvataggio e riapertura come Operatore; da ripristinare.`

Testo originale ripristinato e riletto: «Organizzazione interamente fittizia per il collaudo del 20/10/2026. Solo dati sintetici. Non usare per atti, comunicazioni o crediti ufficiali. Gruppo B per verifica separazione dati.»

Effetti effettivamente introdotti in questo ramo: **due salvataggi logici** della sola anagrafica fittizia B, uno temporaneo e uno di ripristino. Nessun altro campo compilato, nessuna fase o visibilità documentale cambiata, nessun messaggio o reclamo inviato, nessun credito confermato/emesso. La traccia storica dei due salvataggi è stata osservata nel registro Admin; il ripristino del dato non ha cancellato la storia. Il conteggio non sostituisce i conteggi storici degli oggetti V03.

I controlli OP01–OP11 hanno esito favorevole nei limiti descritti. Il controllo aggiuntivo dell’audit ha evidenziato il residuo D05-R1 sui testi lunghi. D08, le riserve metodologiche e i restanti casi della matrice rimangono aperti. Gli esiti descrivono il portale osservato il 21 ottobre, senza una nuova identificazione indipendente del bundle pubblicato. Priorità adottate nel dossier: P1 alta (D08, consegna email); P2 media (D05-R1, leggibilità audit); P3 bassa (O01, messaggio account disattivato).

### Limiti di osservazione e controlli residui

- **Audit delle due scritture:** letto dopo un nuovo accesso con identità Admin positivamente confermata come `belfiore.luca@gmail.com`; eventi e campo modificato osservati, testi completi non disponibili nell’interfaccia (D05-R1). Un precedente modulo sicuro aveva portato nuovamente all’identità Operatore; non viene classificato come difetto di cambio account, perché l’identità fornita al modulo non è restituita all’agente. Nessun registro letto come Operatore e nessun aggiramento tentato.
- **Email e notifiche:** D08 resta aperto sul riscontro di creazione A; nessuna evidenza di ricezione per B/Operatore. Occorrono mittente verificato e prova su destinatari controllati. Non è stata provocata appositamente una notifica a staff reale.
- **Integrità documenti e fascicolo:** gli hash attesi restano disponibili sopra. L’acquisizione dei file tramite il browser resta bloccata dallo strumento: servono download manuali autorizzati dei soli file sintetici o un ambiente che consenta la raccolta. I file ottenuti potranno essere confrontati localmente senza ulteriori accessi privilegiati.
- **Associazioni e identità nel database:** letture Admin minimizzate completate per schede Operatore/B; non dedotti ID o righe nascoste dal solo nome visualizzato. L’assenza di associazioni Cliente dell’Operatore è coerente con ruolo e modulo, ma non è stata provata leggendo una tabella delle associazioni nel database.
- **Immagini di prova:** l’acquisizione di una schermata ritagliata sui soli dati fittizi è fallita per timeout del browser. Non viene allegata una schermata inesistente né classificato il timeout come difetto del portale. Le verifiche descritte si basano sui controlli della pagina e dei campi visibili.
- **Flussi ufficiali, backend e robustezza:** emissione, chiusure e gate documentali richiedono dati e ambiente idonei; protezioni database/storage, carico, concorrenza, recupero e compatibilità su altri browser/dispositivi non sono certificati da questo ramo.


## D05-R1 — dettaglio audit non leggibile per testi lunghi

**Stato:** riprodotto nell’interfaccia online il 21 ottobre 2026. **Priorità proposta: P2.** È un residuo del tema D05: i precedenti esiti favorevoli sul codice, sugli identificativi e sulle variazioni brevi restano validi per il loro perimetro, ma non dimostrano la leggibilità dei valori estesi.

**Problema concreto.** Per due modifiche reali di collaudo alle Note dell’organizzazione B, l’audit mostra autore, data, oggetto e il numero di campi cambiati. Anche aprendo «1 modifica», però, la riga rende entrambi i valori così: «Organizzazione interamente fittizia per il collaudo del 20/10/2026. Solo dati…». L’aggiunta e la successiva rimozione della riga di test, poste oltre il prefisso mostrato, non sono leggibili. Non è disponibile nel controllo osservato un testo integrale o un suggerimento con il valore completo. La ricerca della riga temporanea non restituisce questi eventi; la ricerca dell’autore permette di trovarli. L’etichetta dell’oggetto è generica «Organizzazione (916f3283)» e la ricerca della denominazione B mostra eventi della pratica, non le due modifiche dell’anagrafica.

**Riproduzione senza nuovi salvataggi.** Accedere come Admin → Audit → cercare `COLLAUDO V03 Operatore` → aprire «1 modifica» per le due righe «modifica organizzazione», oggetto `Organizzazione (916f3283)`, del 21/10/2026 alle 09:20:41 e 09:21:21, orari come mostrati dal portale. Il prefisso prima/dopo risulta identico, mentre OP09 ha verificato la modifica e il ripristino dei valori integrali dell’anagrafica. Non occorre ricreare account o modificare ancora B per riprodurre il problema.

**Riscontro nel sorgente acquisito.** `analysis/code_v04/src/lib/auditDettaglio.js`, funzione `valoreBreve`: le stringhe oltre 80 caratteri sono ridotte ai primi 77 più puntini. `modificheEvento` conserva i valori delle differenze nel proprio risultato, ma la possibilità di leggere integralmente i valori registrati nel database non è stata verificata con accesso diretto. Questa lettura del sorgente spiega un meccanismo coerente con il risultato; non prova autonomamente l’identità crittografica con il bundle online.

**Correzione richiesta all’agente di sviluppo.** Conservare il riepilogo breve per la tabella, ma consentire al solo ruolo autorizzato l’apertura e la lettura integrale del valore precedente e successivo, con ritorni a capo e caratteri speciali preservati e senza interpretare il testo come codice. La denominazione dell’organizzazione e una ricerca che raggiunga tali eventi renderebbero inoltre più semplice ricostruire la storia dell’oggetto; quest’ultima parte è una miglioria distinta dal difetto di troncamento.

**Accettazione / regressione.** Sulle due righe già esistenti l’Admin deve poter distinguere l’aggiunta della riga temporanea e la successiva rimozione, leggere i due valori integrali e verificare autore, ruolo, orario e oggetto. Coprire stringhe vuote, brevi, di 80/81 caratteri, valori con un lungo prefisso comune e righe multiple; mantenere il diniego Audit per Cliente e Operatore. Nessuna riscrittura degli eventi storici e nessun ampliamento dei privilegi per correggere la presentazione.

> **Risposta dello sviluppo — 21/10/2026 · Stato: `CORRETTO_DA_RITESTARE`**
>
> **Causa accertata.** È quella indicata: `valoreBreve` accorcia oltre 80 caratteri e il componente mostrava solo quello. I valori interi erano e restano registrati nel database (`audit_event.dettaglio`, `{ campo: { da, a } }`). Nessun evento è stato riscritto.
>
> **Correzione:**
> - **Testo completo.** Nella riga il valore resta breve, ma per i valori lunghi o su più righe compare **Testo completo**, che mostra **Prima** e **Dopo** interi, con gli a capo conservati. I caratteri speciali vengono mostrati sempre come testo e mai eseguiti: React non interpreta i valori come codice.
> - **Tolto / Aggiunto.** Il riquadro indica anche la parte che cambia, ricavata togliendo l'inizio e la fine in comune, con l'indicazione «dopo i primi n caratteri uguali». Sulle due righe del 21/10 la prima mostra «Aggiunto:» con la riga temporanea, la seconda «Tolto:» con la stessa riga.
> - **Nome dell'organizzazione.** L'oggetto mostra la denominazione: «Organizzazione «COLLAUDO AL V03 - COMUNE B - 20261020» (916f3283)». Il nome è letto dall'anagrafica attuale, oppure dal dettaglio quando l'evento lo contiene.
> - **Ricerca** (miglioria indicata come distinta). Ora legge anche i valori cambiati e la denominazione: cercando «prova temporanea» o il nome di B compaiono le due modifiche.
> - **CSV di Audit User:** riporta i valori interi.
>
> Il diniego dell'Audit per Cliente e Operatore non cambia, e non è stato ampliato nessun privilegio.
>
> **File modificati:** `src/lib/auditDettaglio.js` (`valoreCompleto`, `valoreLungo`, `differenzaTesto`, `testoRicercaEvento`; denominazione in `etichettaOggetto`), `src/components/OggettoEModifiche.jsx`, `src/pages/Audit.jsx`, `src/pages/AuditUtenti.jsx`.
>
> **Prove:** `test/collaudo_v05.test.mjs`, 4 prove superate, con le due note reali:
> - valori interi;
> - aggiunta e rimozione distinte;
> - stringa vuota, breve, 80 e 81 caratteri, più righe, caratteri speciali;
> - ricerca ed etichetta.
>
> Tutte le 13 serie di prove passano. Verifica a schermo su computer e telefono con dati di prova.
>
> **Per il ritest:** caso 10.5b, senza nuovi salvataggi: le due righe del 21/10 alle 09:20:41 e 09:21:21.


## Prosecuzione concretamente necessaria

1. Moretti: completare la configurazione del mittente email e concordare destinatari di prova, quindi verificare invio/ricezione senza nuove credenziali esposte o notifiche involontarie a staff reale.
2. Acquisire manualmente i soli documenti sintetici A v1/v2, B v1 e i fascicoli consentiti, oppure predisporre un ambiente che ne permetta la raccolta; confrontare contenuto, versioni e hash con gli attesi già definiti.
3. Riprovare D05-R1 dopo la correzione e risolvere le decisioni metodologiche ancora aperte con la fonte autorevole. Non qualificare i risultati tecnici/economici come ammissibili finché restano tali riserve.
4. Per completare gate ufficiali, notifiche, autorizzazioni backend/storage, compatibilità, prestazioni e recupero, predisporre il relativo ambiente, dati, strumenti e mandato nei termini del piano approvato. Carico, sicurezza attiva, concorrenza e recupero restano esclusi dall’esecuzione finché non concordati separatamente.

Il ramo ordinario dei tre profili è completato per le verifiche osservabili qui documentate; **il collaudo complessivo non è concluso né approvato come privo di difetti**. Questa integrazione non modifica il dossier storico V03 o l’allegato della bozza email già preparata e non inviata.

> **Risposta dello sviluppo — 21/10/2026**
>
> 1. **Email (D08):** vedi la risposta sotto D08. Serve un dominio verificato e il segreto `EMAIL_MITTENTE`, a cura di Luca Moretti.
> 2. **Integrità dei documenti:** il portale calcola lo SHA-256 di ogni file al caricamento e lo registra. L'**Esporta fascicolo** (Admin o Operatore) contiene `documenti.csv` con la colonna «Hash SHA-256». Il confronto con gli attesi A v1, A v2 e B v1 si può quindi fare anche su quel file e sui file del fascicolo, scaricati a mano dal browser dell'utente. Lo sviluppo non ha scaricato documenti, perché la verifica spetta al collaudo.
> 3. **D05-R1:** corretto, da ritestare con il caso 10.5b. Le decisioni metodologiche restano quelle del documento V01, con gli spazi «Risposta della Fondazione».
> 4. **Ambienti per backend, storage, carico e recupero:** da concordare con Luca Moretti. Una possibilità è un secondo progetto Supabase di prova, con gli script 01–35 e dati sintetici. Oggi il banco di prova esiste solo in locale presso lo sviluppo.
>
> **Cambio iniziale della password.** Il portale impone il cambio al primo accesso per ogni password temporanea, attraverso il campo `password_temporanea` e la pagina obbligatoria. Il cambio viene registrato nell'audit come «cambio password» da «password temporanea» a «password personale», come osservato per l'Operatore. Per A e B gli stessi eventi si leggono in Audit User → Operazioni, filtrando l'utente.

