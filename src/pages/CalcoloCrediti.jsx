/* =========================================================================
   Calcolo dei crediti (editor) — indirizzo «/crediti/:id» (id del calcolo)
   Scopo: editor di un calcolo dei crediti di CO₂eq secondo la Metodologia
     CWP v1.2, a passi (menu a sinistra): import del tracciato dati,
     impostazioni, rifiuti del territorio, delibera tariffaria, fattori di
     emissione, Banca Dati Utenze, buffer, risultati. In alto i comandi:
     Salva, Calcola, Conferma calcolo, Nuova versione, Elimina. Dai
     risultati: rapporto PDF (scarica o archivia nella pratica) e CSV.
   Chi la usa: solo Amministratori (gli altri vedono un messaggio).
   Dati: src/lib/crediti/archivio.js (leggiCalcolo, salvaCalcolo,
     eliminaCalcolo, leggi/salvaConferimenti, leggi/salvaRiuso,
     nuovaVersione) sulle tabelle calcolo_crediti, calcolo_conferimento e
     calcolo_riuso (script 11 e 18); motore di calcolo puro in
     src/lib/crediti/calcolo.js; parametri della Metodologia in
     src/lib/crediti/parametri.js; controlli di coerenza in
     src/lib/crediti/tracciato.js; rapporto PDF in
     src/lib/crediti/rapportoPdf.js (caricato solo quando serve);
     caricaDocumento e nomeUtente di src/lib/dati.js per archiviare il
     rapporto e scrivere chi ha confermato.
   Formato dei dati: il campo JSON calcolo_crediti.dati contiene rifiuti,
     pefUd, pefUnd, classiUd, classiUnd, fattori, scenarioRiuso, beni,
     psConsuntivo, volumiCentralizzati, opzioni (buffer) e, dopo un import,
     importazione (file d'origine, hash, parti, conteggi). Valori iniziali
     in datiIniziali() di archivio.js. La Banca Dati Utenze sta invece in
     tabelle di dettaglio: le utenze del passo 5a (calcolo_utenza, script
     40, una riga per utenza con i kg per frazione) e i conferimenti e il
     riuso del tracciato (passo 5b). Dal 23/10/2026 il motore usa le utenze
     del passo 5a quando il calcolo le ha (utenzeInConferimenti di
     calcolo.js; controlli di conferma nello script 41), altrimenti i
     conferimenti del 5b; il riuso viene sempre dal 5b.
   Stati: «bozza» (modificabile, eliminabile) → «confermato» (definitivo).
     Per correggere un calcolo confermato si crea una «nuova versione» in
     bozza che ne copia dati e Banca Dati Utenze.
   Sicurezza: tutte le tabelle dei calcoli sono riservate agli
     Amministratori con verifica a due fattori (policy app_is_admin,
     script 11). L'immutabilità del calcolo confermato e dei suoi dati è
     garantita dal trigger calcolo_immutabile (script 11 e 18), che alla
     conferma assegna anche confermato_da/il e, per gli ex post, il numero
     di registro CWP-REG-AAAA-NNNN. La disattivazione dei campi in sola
     lettura qui è solo interfaccia.
   Registro sviluppo e deploy: capitolo «Calcolo crediti» (scelte
     interpretative in docs/crediti-cwp.md).
   ========================================================================= */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import TabellaDati from "../components/crediti/TabellaDati.jsx";
import ImportaTracciato, { ControlliCoerenza } from "../components/crediti/ImportaTracciato.jsx";
import { controllaCoerenza } from "../lib/crediti/tracciato.js";
import { scostamentiTabella3, indicatoriQualita, CLUSTER, SOGLIA_SCOSTAMENTO } from "../lib/crediti/qualita.js";
import { caricaDocumento, nomeUtente } from "../lib/dati.js";
import {
  leggiCalcolo,
  salvaCalcolo,
  eliminaCalcolo,
  leggiConferimenti,
  salvaConferimenti,
  leggiRiuso,
  salvaRiuso,
  nuovaVersione,
} from "../lib/crediti/archivio.js";
import { calcolaCrediti, coefficientePrimoAnno, utenzeInConferimenti } from "../lib/crediti/calcolo.js";
import { leggiUtenzeCalcolo } from "../lib/crediti/utenzeCalcolo.js";
import { BENI_RIUSO, TIPOLOGIE_RIFIUTO } from "../lib/crediti/parametri.js";
import { csvInOggetti, scriviCsv, scaricaTesto } from "../lib/csv.js";
import { formatoData } from "../lib/date.js";
import { useOrdinamento, ThOrdinabile } from "../components/Ordinamento.jsx";
import UtenzeCalcolo from "../components/crediti/UtenzeCalcolo.jsx";

// Numero in formato italiano con `d` decimali fissi; "—" se manca o non è un numero.
const fmt = (v, d = 2) =>
  v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

// Passi dell'editor: [chiave usata nello stato `passo`, etichetta del menu].
// I numeri seguono l'ordine della Metodologia; «Importa» è un passo extra.
const PASSI = [
  ["importa", "Importa il tracciato"],
  ["impostazioni", "1. Impostazioni"],
  ["rifiuti", "2. Rifiuti del territorio"],
  ["delibera", "3. Delibera tariffaria"],
  ["fattori", "4. Fattori di emissione"],
  // 5a: Banca Dati Utenze per utenza (script 40, 22/10/2026), usata dal
  // motore dal 23/10/2026; 5b: conferimenti e riuso del tracciato (i
  // conferimenti valgono solo per i calcoli senza utenze nel 5a).
  ["utenze_elenco", "5a. Utenze del calcolo"],
  ["utenze", "5b. Conferimenti (tracciato)"],
  ["buffer", "6. Buffer"],
  ["risultati", "7. Risultati"],
];

/* Editor di un calcolo dei crediti (Metodologia CWP v1.2).
   Nessuna prop: l'id del calcolo arriva dall'indirizzo.
   Stato principale:
   - calcolo: riga di calcolo_crediti come salvata (stato, risultato salvato…)
   - dati / testa: copie in modifica del JSON `dati` e dei campi di testata
   - conferimenti / riuso: Banca Dati Utenze del tracciato (passo 5b)
   - utenze: utenze del passo 5a senza nomi e indirizzi
     (admin_utenze_calcolo), per il motore
   - modificato: ci sono modifiche a dati/testa non ancora salvate
   - risultato: ultimo risultato COMPLETO calcolato nel browser (con il
     dettaglio per utenza); nel database va solo un riepilogo. */
export default function CalcoloCrediti() {
  const { id } = useParams();
  const { ruolo, utente } = useAuth();
  const navigate = useNavigate();
  const [calcolo, setCalcolo] = useState(null);
  const [dati, setDati] = useState(null);
  const [testa, setTesta] = useState(null); // titolo, anno, tipo, data_avvio, note
  const [conferimenti, setConferimenti] = useState([]);
  const [riuso, setRiuso] = useState([]);
  const [utenze, setUtenze] = useState([]);
  const [passo, setPasso] = useState("impostazioni");
  const [modificato, setModificato] = useState(false);
  const [risultato, setRisultato] = useState(null);
  // Messaggio sotto l'intestazione: { testo, errore? } oppure null.
  const [messaggio, setMessaggio] = useState(null);
  // Testo dell'operazione in corso (es. "Salvataggio…"); "" = nessuna.
  // Finché non è vuoto i pulsanti principali sono disattivati.
  const [inCorso, setInCorso] = useState("");
  // Vero quando è aperto il riquadro «Confermare il calcolo?».
  const [conferma, setConferma] = useState(false);

  // Legge il calcolo e la sua Banca Dati Utenze e riallinea lo stato locale
  // (le modifiche non salvate vanno perse).
  async function carica() {
    const { data, error } = await leggiCalcolo(id);
    if (error || !data) {
      setMessaggio({ errore: true, testo: error?.message || "Calcolo non trovato" });
      return;
    }
    setCalcolo(data);
    setDati(data.dati);
    setTesta({ titolo: data.titolo, anno: data.anno, tipo: data.tipo, data_avvio: data.data_avvio || "", note: data.note || "" });
    const [c, r, u] = await Promise.all([leggiConferimenti(id), leggiRiuso(id), leggiUtenzeCalcolo(id)]);
    setConferimenti(c.data || []);
    setRiuso(r.data || []);
    setUtenze(u.data || []);
    if (u.error) setMessaggio({ errore: true, testo: "Utenze del calcolo non lette: " + u.error.message });
    setModificato(false);
    // Calcolo ancora vuoto: si parte dall'import del tracciato.
    if (!data.dati?.rifiuti?.length && !(c.data || []).length && !(u.data || []).length && data.stato !== "confermato") setPasso("importa");
  }

  // Rilegge le utenze del passo 5a dopo un caricamento o una modifica dal
  // modulo (il database ha già azzerato il risultato salvato).
  async function ricaricaUtenze() {
    const u = await leggiUtenzeCalcolo(id);
    if (u.error) setMessaggio({ errore: true, testo: "Utenze del calcolo non lette: " + u.error.message });
    else setUtenze(u.data || []);
    await ricaricaTestata();
  }

  // Rilegge solo la testata del calcolo (non la Banca Dati Utenze). Serve
  // dopo un salvataggio della Banca Dati: il database azzera il risultato
  // salvato quando cambiano le righe (20_rinforzi_integrita.sql) e la
  // pagina deve mostrarlo, nascondendo «Conferma calcolo».
  async function ricaricaTestata() {
    const { data } = await leggiCalcolo(id);
    if (!data) return;
    setCalcolo(data);
    if (!data.risultato) setRisultato(null);
  }

  // Righe della Banca Dati Utenze usate dal motore, dai controlli di
  // coerenza, dagli indicatori di qualità e dal buffer: le utenze del passo
  // 5a se ci sono (una riga per frazione con i kg misurati e la categoria
  // di simulazione come classe), altrimenti i conferimenti del tracciato.
  // Calcolate una volta sola per ogni cambio (elenchi anche di decine di
  // migliaia di utenze). Hook prima dei ritorni anticipati più sotto.
  const origineBdu = utenze.length ? "utenze" : "conferimenti";
  const righeBdu = useMemo(() => (utenze.length ? utenzeInConferimenti(utenze) : conferimenti), [utenze, conferimenti]);

  // Ricarica quando cambia il calcolo nell'indirizzo (es. dopo «Nuova versione»).
  useEffect(() => {
    if (ruolo === "admin") carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ruolo]);

  // Avviso se si chiude la pagina con modifiche non salvate.
  // Vale solo per chiusura/ricarica della scheda del browser, non per la
  // navigazione interna del portale (es. il link «← Tutti i calcoli»).
  useEffect(() => {
    const avvisa = (e) => {
      if (modificato) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [modificato]);

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>Questa sezione è riservata agli amministratori.</div>
      </div>
    );
  }
  if (!calcolo || !dati) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: messaggio?.errore ? C.red : C.grafite }}>
          {messaggio?.testo || "Caricamento…"}
        </div>
      </div>
    );
  }

  // Calcolo confermato: tutto in sola lettura (prop `sola` ai passi).
  const confermato = calcolo.stato === "confermato";
  // Funzioni di modifica passate ai passi: uniscono il pezzo cambiato allo
  // stato e segnano «modificato». Nulla va nel database finché non si preme
  // Salva o Calcola.
  const aggiornaDati = (parziale) => {
    setDati((d) => ({ ...d, ...parziale }));
    setModificato(true);
  };
  const aggiornaOpzioni = (parziale) => aggiornaDati({ opzioni: { ...dati.opzioni, ...parziale } });
  const aggiornaTesta = (parziale) => {
    setTesta((t) => ({ ...t, ...parziale }));
    setModificato(true);
  };

  // «Salva»: scrive testata e JSON `dati` (non la Banca Dati Utenze, che si
  // salva già al momento dell'import). Non ricalcola il risultato.
  async function salva() {
    setMessaggio(null);
    setInCorso("Salvataggio…");
    const { error } = await salvaCalcolo(id, {
      titolo: testa.titolo,
      anno: Number(testa.anno),
      tipo: testa.tipo,
      data_avvio: testa.data_avvio || null,
      note: testa.note || null,
      dati,
    });
    setInCorso("");
    if (error) setMessaggio({ errore: true, testo: "Salvataggio non riuscito: " + error.message });
    else {
      setModificato(false);
      setMessaggio({ testo: "Dati salvati." });
      // Se i dati sono cambiati il database ha azzerato il risultato
      // salvato (20_rinforzi_integrita.sql): va ripremuto «Calcola».
      await ricaricaTestata();
    }
  }

  // «Calcola»: esegue il motore nel browser sui dati correnti (anche non
  // salvati), mostra i risultati e, se il calcolo è in bozza, salva insieme
  // dati e riepilogo del risultato. Su un calcolo confermato mostra solo il
  // dettaglio, senza salvare nulla.
  async function esegui() {
    setMessaggio(null);
    const r = calcolaCrediti({
      ...dati,
      anno: testa.anno,
      tipo: testa.tipo,
      dataAvvio: testa.data_avvio,
      conferimenti,
      riuso,
      utenze,
    });
    setRisultato(r);
    setPasso("risultati");
    // Dati impossibili (valori negativi, data inesistente, buffer fuori da
    // 0-80%: collaudo V01, D02/D04/D07): il motore non dà crediti e il
    // risultato NON si salva. Se c'era un risultato salvato si cancella,
    // così il calcolo non si può confermare né usare per il rapporto.
    if (r.bloccato) {
      setMessaggio({ errore: true, testo: "Calcolo bloccato: " + r.errori.join(" ") });
      if (confermato || !calcolo?.risultato) return;
      const { error } = await salvaCalcolo(id, {
        risultato: null, delta_i_kg: null, buffer_pct: null, crediti_lordi: null, crediti_netti: null, calcolato_il: null,
      });
      if (!error) {
        const { data } = await leggiCalcolo(id);
        if (data) setCalcolo(data);
      }
      return;
    }
    // Riepilogo salvato nel database (senza il dettaglio di ogni utenza).
    // Il dettaglio può avere centinaia di migliaia di righe: si salvano solo
    // i totali per classe (chiave "macro|classe"). Un'utenza è «virtuosa»
    // se ΔI < 0, cioè se riduce le emissioni rispetto all'atteso; qui si
    // contano le utenze rappresentate (nUtenze), non le righe.
    const perClasse = {};
    r.utenze.dettaglio.forEach((u) => {
      const k = `${u.macro}|${u.classe}`;
      perClasse[k] = perClasse[k] || { macro: u.macro, classe: u.classe, utenze: 0, virtuose: 0, deltaI: 0 };
      perClasse[k].utenze += u.nUtenze;
      if (u.deltaI < 0) perClasse[k].virtuose += u.nUtenze;
      perClasse[k].deltaI += u.deltaI;
    });
    const { dettaglio, ...utenzeSenzaDettaglio } = r.utenze;
    // righe: quante righe della Banca Dati Utenze ha usato il calcolo (e,
    // dal 23/10/2026, quante utenze del passo 5a). Alla conferma il
    // database le confronta con quelle salvate e rifiuta la conferma se non
    // coincidono (20_rinforzi_integrita.sql, 41_utenze_nel_calcolo.sql).
    const riepilogo = {
      ...r,
      utenze: { ...utenzeSenzaDettaglio, perClasse: Object.values(perClasse) },
      righe: { conferimenti: conferimenti.length, riuso: riuso.length, utenze: utenze.length },
    };
    // Un calcolo confermato non si scrive (lo rifiuterebbe anche il database).
    if (confermato) return;
    setInCorso("Salvataggio del risultato…");
    const { error } = await salvaCalcolo(id, {
      titolo: testa.titolo,
      anno: Number(testa.anno),
      tipo: testa.tipo,
      data_avvio: testa.data_avvio || null,
      note: testa.note || null,
      dati,
      // Colonne di sintesi usate da elenco, registro e rapporto.
      // Unità: ΔI in kgCO₂eq, crediti in tCO₂eq, buffer in %.
      risultato: riepilogo,
      delta_i_kg: r.deltaI,
      buffer_pct: r.buffer.totale,
      crediti_lordi: r.crediti.lordi,
      crediti_netti: r.crediti.netti,
      calcolato_il: r.calcolatoIl,
    });
    setInCorso("");
    if (error) setMessaggio({ errore: true, testo: "Risultato calcolato ma non salvato: " + error.message });
    else {
      setModificato(false);
      const { data } = await leggiCalcolo(id);
      if (data) setCalcolo(data);
    }
  }

  // Conferma definitiva: basta impostare stato = "confermato". I trigger
  // del database verificano che esista un risultato calcolato sulla Banca
  // Dati Utenze salvata (trg_calcolo_coerenza, script 20), registrano chi e
  // quando e, per gli ex post, assegnano il numero di registro (script 18).
  // Poi si ricarica tutto.
  async function confermaCalcolo() {
    setInCorso("Conferma…");
    const { error } = await salvaCalcolo(id, { stato: "confermato" });
    setInCorso("");
    setConferma(false);
    if (error) setMessaggio({ errore: true, testo: error.message });
    else carica();
  }

  // «Nuova versione» di un calcolo confermato: crea una bozza «(rev.)» che
  // copia dati e Banca Dati Utenze (versione_di = id attuale) e la apre.
  // La copia avviene nel database in un'unica operazione (script 20): se
  // fallisce non resta nessuna bozza a metà.
  async function revisione() {
    setInCorso("Creazione della nuova versione…");
    const { data, error } = await nuovaVersione(calcolo);
    setInCorso("");
    if (error) setMessaggio({ errore: true, testo: error.message });
    if (data) navigate(`/crediti/${data.id}`);
  }

  // Elimina la bozza (solo bozze: il database rifiuta la cancellazione di un
  // calcolo confermato) e torna all'elenco.
  async function elimina() {
    if (!window.confirm("Eliminare definitivamente questa bozza di calcolo?")) return;
    const { error } = await eliminaCalcolo(id);
    if (error) setMessaggio({ errore: true, testo: error.message });
    else navigate("/crediti");
  }

  /* Import del tracciato dati (passo «Importa il tracciato»): sostituisce le
     parti scelte e salva subito, annotando nel calcolo il file di origine.
     Riceve dal componente ImportaTracciato:
     - tracciato: dati già letti e validati (rifiuti, classi, anagrafica,
       conferimenti, riuso, conteggi)
     - parti: { rifiuti, delibera, anagrafica, utenze, riuso } = cosa sostituire
     - origine: { nome, documentoId?, hash? } del file importato.
     Ordine dei salvataggi: prima il JSON `dati`, poi conferimenti, poi riuso.
     Non è una transazione unica: se un passo fallisce, quelli precedenti
     restano salvati e si mostra l'errore; un import rimasto a metà non si
     può comunque confermare (controllo delle righe, script 20). Alla fine
     il risultato è azzerato (va ricalcolato) e si passa a «Banca Dati
     Utenze». */
  async function importaTracciato({ tracciato: t, parti, origine }) {
    setMessaggio(null);
    const nuovi = { ...dati };
    if (parti.rifiuti) nuovi.rifiuti = t.rifiuti;
    if (parti.delibera) {
      nuovi.classiUd = t.classiUd;
      nuovi.classiUnd = t.classiUnd;
    }
    // Dall'anagrafica si prendono solo i valori presenti nel file: quelli
    // assenti non cancellano i valori già inseriti a mano.
    if (parti.anagrafica) {
      if (t.anagrafica.pefUd != null) nuovi.pefUd = String(t.anagrafica.pefUd);
      if (t.anagrafica.pefUnd != null) nuovi.pefUnd = String(t.anagrafica.pefUnd);
      if (t.anagrafica.tariffaPuntuale != null) nuovi.opzioni = { ...nuovi.opzioni, tariffaPuntuale: t.anagrafica.tariffaPuntuale };
    }
    // Traccia dell'ultimo import (mostrata nel passo «Importa» e nel rapporto).
    nuovi.importazione = {
      file: origine.nome,
      documentoId: origine.documentoId || null,
      hash: origine.hash || null,
      importatoIl: new Date().toISOString(),
      parti: Object.keys(parti).filter((k) => parti[k]),
      conteggi: t.conteggi,
      // Anno indicato nel foglio 1_Anagrafica: controllo di tempestività
      // (Gestione qualità dati, qualita.js).
      annoDati: t.anagrafica.anno || dati.importazione?.annoDati || null,
    };
    setInCorso("Salvataggio dei dati importati…");
    const { error } = await salvaCalcolo(id, {
      titolo: testa.titolo, anno: Number(testa.anno), tipo: testa.tipo,
      data_avvio: testa.data_avvio || null, note: testa.note || null, dati: nuovi,
    });
    if (error) {
      setInCorso("");
      return setMessaggio({ errore: true, testo: "Import non salvato: " + error.message });
    }
    if (parti.utenze) {
      const r = await salvaConferimenti(id, t.conferimenti, (f, tot) => setInCorso(`Banca Dati Utenze: ${f} di ${tot} righe…`));
      if (r.error) { setInCorso(""); return setMessaggio({ errore: true, testo: "Banca Dati Utenze non salvata: " + r.error.message }); }
      setConferimenti(t.conferimenti);
    }
    if (parti.riuso) {
      const r = await salvaRiuso(id, t.riuso);
      if (r.error) { setInCorso(""); return setMessaggio({ errore: true, testo: "Beni a riuso non salvati: " + r.error.message }); }
      setRiuso(t.riuso);
    }
    setDati(nuovi);
    setModificato(false);
    setRisultato(null);
    // Il database ha azzerato il risultato salvato (dati e righe cambiati).
    await ricaricaTestata();
    setInCorso("");
    setMessaggio({ testo: `Tracciato «${origine.nome}» importato e salvato. Controlla i passi e premi «Calcola».` });
    setPasso("utenze");
  }

  /* Rapporto di calcolo in PDF (backlog 6): dal risultato salvato.
     archivia = false: il PDF si scarica nel browser.
     archivia = true: il PDF è caricato tra i documenti della pratica
     (tipologia «Rapporto di calcolo dei crediti», non visibile al Comune:
     la visibilità si cambia poi nella pratica). Il pulsante compare solo per
     i calcoli confermati.
     Il rapporto usa calcolo.risultato (quello salvato), mai un risultato
     non salvato: per questo si blocca se ci sono modifiche pendenti. */
  async function rapporto(archivia = false) {
    setMessaggio(null);
    if (!calcolo.risultato) return setMessaggio({ errore: true, testo: "Premi prima «Calcola»: il rapporto si basa sul risultato salvato." });
    if (modificato) return setMessaggio({ errore: true, testo: "Ci sono modifiche non salvate: premi «Calcola» (o «Salva») prima del rapporto." });
    setInCorso(archivia ? "Archiviazione del rapporto…" : "Preparazione del rapporto…");
    try {
      const esiti = controllaCoerenza({ anno: calcolo.anno, rifiuti: dati.rifiuti, pefUd: dati.pefUd, pefUnd: dati.pefUnd, classiUd: dati.classiUd, classiUnd: dati.classiUnd, conferimenti, riuso, ps: psTipologie });
      // jsPDF è caricato solo quando serve (alleggerisce il portale).
      const { generaRapportoPdf } = await import("../lib/crediti/rapportoPdf.js");
      const { blob, nomeFile } = await generaRapportoPdf({
        calcolo,
        dati,
        risultato: calcolo.risultato,
        coerenza: esiti,
        qualita: qualitaDati(),
        confermatoDa: await nomeUtente(calcolo.confermato_da),
      });
      if (!archivia) {
        // Download senza server: link temporaneo al file in memoria, cliccato
        // e rimosso; l'indirizzo si libera dopo 5 secondi.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomeFile;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setMessaggio({ testo: `Rapporto scaricato: ${nomeFile}` });
      } else {
        // Documento generale della pratica (nessuna fase), con le stesse
        // regole di ogni caricamento: nuova versione, hash, controlli sul file.
        const { error } = await caricaDocumento({
          praticaId: calcolo.pratica_id,
          file: new File([blob], nomeFile, { type: "application/pdf" }),
          tipologia: "Rapporto di calcolo dei crediti",
          visibileCliente: false,
          utenteId: utente?.id,
        });
        if (error) throw new Error(error.message);
        setMessaggio({ testo: `Rapporto archiviato tra i documenti generali della pratica ${calcolo.pratica?.codice || ""} (non visibile al Comune finché non lo rendi visibile).` });
      }
    } catch (e) {
      setMessaggio({ errore: true, testo: "Rapporto non generato: " + e.message });
    }
    setInCorso("");
  }

  // Controlli di coerenza sui dati attuali (solo dove servono: costano su grandi Banche Dati).
  // psTipologie: peso specifico (kg/m³) per tipologia, dai fattori del
  // passo 4; accetta la virgola decimale, valore assente = 0.
  const psTipologie = Object.fromEntries(dati.fattori.map((f) => [f.id, Number(String(f.ps ?? "").replace(",", ".")) || 0]));
  const coerenza = ["utenze_elenco", "utenze", "risultati"].includes(passo) || conferma
    ? controllaCoerenza({ anno: testa.anno, rifiuti: dati.rifiuti, pefUd: dati.pefUd, pefUnd: dati.pefUnd, classiUd: dati.classiUd, classiUnd: dati.classiUnd, conferimenti: righeBdu, riuso, ps: psTipologie, origine: origineBdu })
    : null;

  // Controlli della Gestione qualità dei dati (qualita.js): confronto con la
  // Tabella 3 dello Standard e indicatori. Oltre la soglia del 30% serve una
  // motivazione prima della conferma.
  function qualitaDati() {
    const q = dati.qualita || {};
    return {
      ...q,
      scostamenti: scostamentiTabella3({ rifiuti: dati.rifiuti, popolazione: q.popolazione, cluster: q.cluster }),
      indicatori: indicatoriQualita({ anno: testa.anno, annoDati: dati.importazione?.annoDati, classiUd: dati.classiUd, classiUnd: dati.classiUnd, conferimenti: righeBdu, conteggi: origineBdu === "utenze" ? null : dati.importazione?.conteggi }),
    };
  }
  const qualita = passo === "risultati" || conferma ? qualitaDati() : null;
  const manca = qualita && qualita.scostamenti.some((s) => s.oltre) && !(dati.qualita?.motivazione || "").trim();
  // Errori dei controlli di coerenza (livello «errore», non gli avvisi):
  // con anche uno solo la conferma definitiva non è disponibile (collaudo
  // V01, R05: prima si poteva confermare un calcolo senza Banca Dati
  // Utenze). Il database rifiuta comunque la conferma senza Banca Dati o
  // con un risultato bloccato (script 35).
  const erroriConferma = conferma ? (coerenza || []).filter((e) => e.livello === "errore") : [];
  const nonConfermabile = manca || erroriConferma.length > 0;

  // Tipologie di rifiuto ammesse (dai fattori), per le tendine e gli import CSV.
  const tipologieOpzioni = dati.fattori.map((f) => ({ valore: f.id, etichetta: f.nome }));
  // Riepilogo del risultato salvato nel database (null se mai calcolato).
  const salvato = calcolo.risultato;

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 24px" }}>
        <Link to="/crediti" style={{ fontSize: 12.5, color: C.green, fontWeight: 600, textDecoration: "none" }}>← Tutti i calcoli</Link>

        {/* Intestazione */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "8px 0 14px" }}>
          <div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 21, margin: "0 0 4px" }}>{testa.titolo}</h1>
            <div style={{ fontSize: 13, color: C.grafite }}>
              {calcolo.pratica?.codice} · {calcolo.pratica?.organizzazione?.denominazione} · anno {testa.anno} ·{" "}
              {testa.tipo === "ex_post" ? "ex post" : "ex ante"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {confermato ? (
              <Badge bg="#dfe9db" fg={C.green}>Confermato il {formatoData(calcolo.confermato_il)}{calcolo.numero_registro ? ` · ${calcolo.numero_registro}` : ""}</Badge>
            ) : (
              <Badge bg={C.paperWarm} fg={C.grafite}>Bozza</Badge>
            )}
            {!confermato && (
              <button onClick={salva} disabled={!modificato || !!inCorso} style={{ ...btnMini, opacity: modificato ? 1 : 0.55 }}>
                {modificato ? "Salva" : "Salvato"}
              </button>
            )}
            <button onClick={esegui} disabled={!!inCorso} style={btnPrimario}>Calcola</button>
            {/* Si conferma solo una bozza con risultato salvato e senza
                modifiche pendenti: si conferma ciò che è nel database. */}
            {!confermato && salvato && !modificato && (
              <button onClick={() => setConferma(true)} style={btnMini}>Conferma calcolo</button>
            )}
            {confermato && <button onClick={revisione} style={btnMini}>Nuova versione</button>}
            {!confermato && <button onClick={elimina} style={{ ...btnMini, color: C.red }}>Elimina</button>}
          </div>
        </div>

        {conferma && (
          <div style={{ ...riquadro, borderColor: C.ocra, marginBottom: 14 }}>
            <b>Confermare il calcolo?</b>
            <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 10px" }}>
              Un calcolo confermato diventa definitivo: dati e risultato non si possono più modificare né cancellare.
              Per eventuali correzioni si creerà una nuova versione. Crediti netti: <b>{fmt(calcolo.crediti_netti, 3)} tCO₂eq</b>.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Gestione qualità dati 3.1.2: scostamento oltre il 30% → motivazione obbligatoria */}
              {manca && (
                <div style={{ color: C.red, fontSize: 12.5, width: "100%" }}>
                  Ci sono scostamenti oltre il {SOGLIA_SCOSTAMENTO}% dalla Tabella 3 dello Standard: scrivi la motivazione nel passo «Risultati» e ricalcola.
                </div>
              )}
              {erroriConferma.length > 0 && (
                <div style={{ color: C.red, fontSize: 12.5, width: "100%" }}>
                  Non si può confermare finché i controlli di coerenza segnalano errori:
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{erroriConferma.map((e) => <li key={e.testo}>{e.testo}</li>)}</ul>
                </div>
              )}
              <button onClick={confermaCalcolo} disabled={nonConfermabile} style={{ ...btnPrimario, opacity: nonConfermabile ? 0.5 : 1 }}>Conferma definitivamente</button>
              <button onClick={() => setConferma(false)} style={btnMini}>Annulla</button>
            </div>
          </div>
        )}

        {(messaggio || inCorso) && (
          <div style={{ fontSize: 13, marginBottom: 12, color: messaggio?.errore ? C.red : C.green }}>{inCorso || messaggio.testo}</div>
        )}
        {confermato && (
          <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 12 }}>
            Calcolo confermato: i dati sono in sola lettura. «Calcola» mostra di nuovo il dettaglio senza modificare nulla.
          </div>
        )}

        <div className="layout-crediti" style={{ display: "grid", gap: 18 }}>
          {/* Passi */}
          <nav aria-label="Passi del calcolo" style={{ display: "grid", gap: 4, alignContent: "start" }}>
            {PASSI.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPasso(k)}
                aria-current={passo === k ? "step" : undefined}
                style={{
                  textAlign: "left",
                  background: passo === k ? C.white : "transparent",
                  border: `1px solid ${passo === k ? C.green : "transparent"}`,
                  borderRadius: 9,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: passo === k ? C.green : C.ink,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <section style={riquadro}>
            {passo === "importa" && (
              <ImportaTracciato calcolo={calcolo} anno={testa.anno} ps={psTipologie} sola={confermato} ultima={dati.importazione} onImporta={importaTracciato} />
            )}
            {/* Un solo passo visibile alla volta; ogni passo riceve i dati e
                la funzione per modificarli, e `sola` se il calcolo è confermato. */}
            {(passo === "utenze" || passo === "risultati") && <ControlliCoerenza esiti={coerenza} />}
            {passo === "risultati" && <QualitaDati qualita={qualita} aggiorna={aggiornaDati} sola={confermato} />}
            {passo === "impostazioni" && (
              <Impostazioni testa={testa} aggiorna={aggiornaTesta} sola={confermato} />
            )}
            {passo === "rifiuti" && (
              <Passo titolo="Rifiuti del territorio (Catasto ISPRA)" nota="Capitolo 3. Per ogni codice EER: tipologia, quantità nell'anno di riferimento e se è prodotto solo dalle utenze domestiche (scarto verde, inerti). Più codici EER possono confluire nella stessa tipologia.">
                <TabellaDati
                  solaLettura={confermato}
                  nomeModello="rifiuti_ISPRA"
                  colonne={[
                    { chiave: "codice", titolo: "Codice EER", alias: ["eer"], larghezza: 90 },
                    { chiave: "descrizione", titolo: "Descrizione", larghezza: 180 },
                    { chiave: "tipologia", titolo: "Tipologia", tipo: "scelta", opzioni: tipologieOpzioni, obbligatorio: true, larghezza: 170 },
                    { chiave: "qtot", titolo: "Quantità (t/anno)", alias: ["quantita", "tonnellate", "qtot"], tipo: "numero", obbligatorio: true },
                    { chiave: "soloDomestiche", titolo: "Solo domestiche", tipo: "si_no" },
                    { chiave: "considerato", titolo: "Considerato", tipo: "si_no" },
                  ]}
                  righe={dati.rifiuti}
                  // Una riga senza «Considerato» indicato vale come considerata.
                  onChange={(r) => aggiornaDati({ rifiuti: r.map((x) => ({ ...x, considerato: x.considerato ?? true })) })}
                  esempio={[
                    { codice: "200301", descrizione: "Rifiuti urbani non differenziati", tipologia: "indifferenziato", qtot: "1250,4", soloDomestiche: false, considerato: true },
                    { codice: "200108", descrizione: "Rifiuti biodegradabili di cucine e mense", tipologia: "organico", qtot: "860", soloDomestiche: false, considerato: true },
                    { codice: "200201", descrizione: "Rifiuti biodegradabili (verde)", tipologia: "verde", qtot: "210", soloDomestiche: true, considerato: true },
                  ]}
                  vuota="Nessun rifiuto. Aggiungi le righe o importa il file del Catasto ISPRA."
                />
                {/* Somma delle tonnellate delle sole righe considerate. */}
                <Totale etichetta="Totale considerato" valore={dati.rifiuti.filter((r) => r.considerato !== false).reduce((s, r) => s + (Number(String(r.qtot).replace(",", ".")) || 0), 0)} unita="t/anno" />
              </Passo>
            )}
            {passo === "delibera" && (
              <Delibera dati={dati} aggiorna={aggiornaDati} sola={confermato} />
            )}
            {passo === "fattori" && (
              <Fattori dati={dati} aggiorna={aggiornaDati} sola={confermato} />
            )}
            {passo === "utenze_elenco" && (
              <>
                <UtenzeCalcolo calcoloId={id} sola={confermato} onCambio={ricaricaUtenze} />
                {/* Controlli sulle utenze rispetto alla delibera (categorie
                    mancanti o sconosciute), solo se ci sono utenze. */}
                {utenze.length > 0 && <div style={{ marginTop: 16 }}><ControlliCoerenza esiti={coerenza} /></div>}
              </>
            )}
            {passo === "utenze" && (
              <BancaDati
                calcoloId={id}
                tipo={testa.tipo}
                dati={dati}
                aggiorna={aggiornaDati}
                sola={confermato}
                conferimenti={conferimenti}
                riuso={riuso}
                utenzeAttive={utenze.length}
                onConferimenti={(righe) => { setConferimenti(righe); ricaricaTestata(); }}
                onRiuso={(righe) => { setRiuso(righe); ricaricaTestata(); }}
                tipologie={tipologieOpzioni}
              />
            )}
            {passo === "buffer" && (
              <Buffer dati={dati} opzioni={dati.opzioni} aggiorna={aggiornaOpzioni} sola={confermato} conferimenti={righeBdu} riuso={riuso} />
            )}
            {passo === "risultati" && (
              <Risultati risultato={risultato} salvato={salvato} onCalcola={esegui} testa={testa} onRapporto={rapporto} confermato={confermato} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ---------------- Passo 1: impostazioni ---------------- */
/* Testata del calcolo: titolo, anno, tipo di stima, data di avvio, note.
   Props: testa (valori), aggiorna(parziale) (modifica la testata),
   sola (sola lettura). Mostra il coefficiente del primo anno parziale. */
function Impostazioni({ testa, aggiorna, sola }) {
  // Formula 1: se l'avvio cade nell'anno di riferimento, coefficiente =
  // giorni dall'avvio al 31/12 diviso 365; altrimenti 1.
  const pa = coefficientePrimoAnno(testa.data_avvio, testa.anno);
  return (
    <Passo titolo="Impostazioni" nota="Anno solare di riferimento e tipo di stima. Se il progetto è partito durante l'anno, i valori attesi si riducono in proporzione ai giorni effettivi (Capitolo 2, formula 1).">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
        <label style={lbl}>Titolo<input disabled={sola} value={testa.titolo} onChange={(e) => aggiorna({ titolo: e.target.value })} style={campo} /></label>
        <label style={lbl}>Anno di riferimento<input disabled={sola} type="number" value={testa.anno} onChange={(e) => aggiorna({ anno: e.target.value })} style={campo} /></label>
        <label style={lbl}>
          Tipo di stima
          <select disabled={sola} value={testa.tipo} onChange={(e) => aggiorna({ tipo: e.target.value })} style={campo}>
            <option value="ex_post">Ex post (letture reali)</option>
            <option value="ex_ante">Ex ante (valori stimati)</option>
          </select>
        </label>
        <label style={lbl}>Avvio del progetto (primo anno)<input disabled={sola} type="date" value={testa.data_avvio} onChange={(e) => aggiorna({ data_avvio: e.target.value })} style={campo} /></label>
      </div>
      {pa.coefficiente < 1 && (
        <div style={{ fontSize: 12.5, color: C.ocra, marginTop: 10 }}>
          Primo anno parziale: {pa.giorni} giorni su 365 → valori attesi × {fmt(pa.coefficiente, 4)}.
        </div>
      )}
      <label style={{ ...lbl, marginTop: 12 }}>
        Note e fonti (descrizione delle scelte del Progetto)
        <textarea disabled={sola} value={testa.note} onChange={(e) => aggiorna({ note: e.target.value })} rows={4} style={{ ...campo, resize: "vertical" }} />
      </label>
    </Passo>
  );
}

/* ---------------- Passo 3: delibera tariffaria ---------------- */
/* Ripartizione del PEF (in %) e classi delle utenze domestiche (con Kb) e
   non domestiche (con superficie e Kd).
   Props: dati (JSON del calcolo), aggiorna(parziale), sola.
   Le percentuali PEF si salvano come testo con il punto decimale. */
function Delibera({ dati, aggiorna, sola }) {
  // Somma delle due quote PEF: solo un avviso se diversa da 100%, non blocca.
  const somma = (Number(String(dati.pefUd).replace(",", ".")) || 0) + (Number(String(dati.pefUnd).replace(",", ".")) || 0);
  return (
    <Passo titolo="Delibera tariffaria dell'Ente" nota="Capitolo 3 (formule 2-12): ripartizione PEF tra utenze domestiche e non domestiche, classi con numero di utenze e coefficienti della quota variabile (Kb per le domestiche, Kd per le non domestiche).">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <label style={{ ...lbl, width: 180 }}>PEF % utenze domestiche<input disabled={sola} inputMode="decimal" value={dati.pefUd} onChange={(e) => aggiorna({ pefUd: e.target.value.replace(",", ".") })} style={campo} /></label>
        <label style={{ ...lbl, width: 180 }}>PEF % utenze non domestiche<input disabled={sola} inputMode="decimal" value={dati.pefUnd} onChange={(e) => aggiorna({ pefUnd: e.target.value.replace(",", ".") })} style={campo} /></label>
      </div>
      {somma > 0 && Math.abs(somma - 100) > 0.01 && <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 8 }}>La somma è {fmt(somma, 2)}%: dovrebbe essere 100%.</div>}

      <h3 style={h3}>Classi di utenze domestiche</h3>
      <TabellaDati
        solaLettura={sola}
        nomeModello="classi_domestiche"
        colonne={[
          { chiave: "classe", titolo: "Classe", obbligatorio: true, larghezza: 160 },
          { chiave: "n", titolo: "N. utenze", alias: ["numero", "utenze"], tipo: "numero", obbligatorio: true },
          { chiave: "kb", titolo: "Kb", tipo: "numero", obbligatorio: true },
        ]}
        righe={dati.classiUd}
        onChange={(r) => aggiorna({ classiUd: r })}
        esempio={[
          { classe: "1 componente", n: 1200, kb: "0,6" },
          { classe: "2 componenti", n: 1500, kb: "1,4" },
        ]}
      />
      <h3 style={h3}>Classi di utenze non domestiche</h3>
      <TabellaDati
        solaLettura={sola}
        nomeModello="classi_non_domestiche"
        colonne={[
          { chiave: "classe", titolo: "Categoria", alias: ["classe"], obbligatorio: true, larghezza: 220 },
          { chiave: "n", titolo: "N. utenze", alias: ["numero", "utenze"], tipo: "numero", obbligatorio: true },
          { chiave: "superficie", titolo: "Superficie (m²)", alias: ["superficie", "mq", "m2"], tipo: "numero", obbligatorio: true },
          { chiave: "kd", titolo: "Kd (kg/m²/anno)", alias: ["kd"], tipo: "numero", obbligatorio: true },
        ]}
        righe={dati.classiUnd}
        onChange={(r) => aggiorna({ classiUnd: r })}
        esempio={[{ classe: "1 - Musei, biblioteche, scuole", n: 12, superficie: 5400, kd: "2,6" }]}
      />
    </Passo>
  );
}

/* ---------------- Passo 4: fattori di emissione ---------------- */
/* Fattori di emissione e pesi specifici per tipologia di rifiuto, scenario
   e fattori dei beni a riuso, opzione «riuso come credito».
   Props: dati, aggiorna(parziale), sola. */
function Fattori({ dati, aggiorna, sola }) {
  // Cambiando scenario si riportano i FErid dei beni ai valori della
  // Tabella 5 per quello scenario (eventuali valori manuali si perdono).
  function cambiaScenario(scenario) {
    const beni = dati.beni.map((b) => {
      const def = BENI_RIUSO.find((x) => x.id === b.id);
      return def ? { ...b, fe: scenario === "preparazione" ? def.fePreparazione : def.feRiutilizzo } : b;
    });
    aggiorna({ scenarioRiuso: scenario, beni });
  }
  // Rimette i fattori di tutte le tipologie ai valori della Metodologia
  // (src/lib/crediti/parametri.js). Non tocca i beni a riuso.
  function ripristina() {
    aggiorna({
      fattori: TIPOLOGIE_RIFIUTO.map((t) => ({ id: t.id, nome: t.nome, fe: t.fe, ps: t.ps, recupero: t.recupero, calcolato: !!t.calcolato, fonte: t.fonte })),
    });
  }
  return (
    <Passo titolo="Fattori di emissione e pesi specifici" nota="Capitolo 5. FErid(r) in kgCO₂eq/kg dalla Tabella 3 (USEPA WARM) e Tabella 4 (WRAP); pesi specifici di default dalla Tabella 8. L'indifferenziato si calcola come media pesata delle frazioni a recupero (formule 16-17). Il Progetto può indicare valori diversi, citandone la fonte.">
      <TabellaDati
        solaLettura={sola}
        nomeModello="fattori_emissione"
        colonne={[
          { chiave: "id", titolo: "Codice", larghezza: 110 },
          { chiave: "nome", titolo: "Tipologia", larghezza: 170 },
          { chiave: "fe", titolo: "FErid (kgCO₂eq/kg)", tipo: "numero" },
          { chiave: "ps", titolo: "Peso specifico (kg/m³)", tipo: "numero" },
          { chiave: "recupero", titolo: "Frazione a recupero", tipo: "si_no" },
          { chiave: "calcolato", titolo: "Calcolato (f. 16-17)", tipo: "si_no" },
          { chiave: "fonte", titolo: "Fonte", larghezza: 170 },
        ]}
        righe={dati.fattori}
        onChange={(r) => aggiorna({ fattori: r })}
      />
      {!sola && <button onClick={ripristina} style={{ ...btnLink, marginTop: 6 }}>Ripristina i valori della Metodologia</button>}

      <h3 style={h3}>Beni destinati a riutilizzo (Tabella 5)</h3>
      <label style={{ ...lbl, maxWidth: 360, marginBottom: 8 }}>
        Scenario
        <select disabled={sola} value={dati.scenarioRiuso} onChange={(e) => cambiaScenario(e.target.value)} style={campo}>
          <option value="riutilizzo">Centro riutilizzo / operatore dell'usato</option>
          <option value="preparazione">Centro di preparazione per il riutilizzo</option>
        </select>
      </label>
      {/* Scelta interpretativa aperta (vedi docs/crediti-cwp.md): resta
          disattivata finché la Fondazione non la conferma. */}
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, margin: "0 0 10px", maxWidth: 820 }}>
        <input
          type="checkbox"
          disabled={sola}
          checked={!!dati.opzioni?.riusoComeCredito}
          onChange={(e) => aggiorna({ opzioni: { ...dati.opzioni, riusoComeCredito: e.target.checked } })}
          style={{ marginTop: 3 }}
        />
        <span>
          Tratta il riuso come riduzione di emissioni. <b>Da confermare con la Fondazione:</b> applicate alla lettera, le
          formule 26 e 29 (EP(b) = − Q × FErid(b), con FErid negativo) fanno aumentare le emissioni quando un'utenza
          conferisce beni a riuso. Senza conferma resta disattivato.
        </span>
      </label>
      <TabellaDati
        solaLettura={sola}
        nomeModello="beni_riuso"
        colonne={[
          { chiave: "id", titolo: "Codice", larghezza: 100 },
          { chiave: "nome", titolo: "Bene", larghezza: 160 },
          { chiave: "peso", titolo: "Peso medio (kg)", tipo: "numero" },
          { chiave: "fe", titolo: "FErid (kgCO₂eq/kg)", tipo: "numero" },
        ]}
        righe={dati.beni}
        onChange={(r) => aggiorna({ beni: r })}
      />
    </Passo>
  );
}

/* ---------------- Passo 5: Banca Dati Utenze ---------------- */
// Schemi per l'import CSV della Banca Dati (csvInOggetti di src/lib/csv.js):
// - chiave: nome del campo nell'oggetto riga
// - titoli: intestazioni accettate nel file (il primo è quello del modello)
// - obbligatorio: colonna che deve esserci
// - tipo "numero": valore convertito in numero; min: 0 = negativo non
//   ammesso (collaudo V01, D07).
// Conferimenti: S = svuotamenti, VC = volume contenitore, StIn = strutture
// informatizzate, CdR = centri di raccolta; «N. utenze» > 1 quando una riga
// rappresenta più utenze con valori medi (stima ex ante).
const SCHEMA_CONFERIMENTI = [
  { chiave: "utenza", titoli: ["Utenza", "codice utenza", "id utenza"], obbligatorio: true },
  { chiave: "macro", titoli: ["Macrocategoria", "tipo utenza", "macro"], obbligatorio: true },
  { chiave: "classe", titoli: ["Classe", "categoria"], obbligatorio: true },
  { chiave: "tipologia", titoli: ["Tipologia rifiuto", "rifiuto", "tipologia"], obbligatorio: true },
  { chiave: "svuotamenti", titoli: ["Svuotamenti", "S"], tipo: "numero", min: 0 },
  { chiave: "volume", titoli: ["Volume contenitore (L)", "volume", "VC"], tipo: "numero", min: 0 },
  { chiave: "pesoStrutture", titoli: ["Peso strutture informatizzate (kg)", "PStIn"], tipo: "numero", min: 0 },
  { chiave: "volumeStrutture", titoli: ["Volume strutture informatizzate (L)", "VStIn"], tipo: "numero", min: 0 },
  { chiave: "pesoCdr", titoli: ["Peso centri di raccolta (kg)", "PCdR"], tipo: "numero", min: 0 },
  { chiave: "volumeCdr", titoli: ["Volume centri di raccolta (L)", "VCdR"], tipo: "numero", min: 0 },
  { chiave: "nUtenze", titoli: ["N. utenze (valori medi)", "n utenze", "numero utenze"], tipo: "numero", min: 0 },
];
const SCHEMA_RIUSO = [
  { chiave: "utenza", titoli: ["Utenza", "codice utenza"], obbligatorio: true },
  { chiave: "macro", titoli: ["Macrocategoria", "tipo utenza", "macro"], obbligatorio: true },
  { chiave: "classe", titoli: ["Classe", "categoria"], obbligatorio: true },
  { chiave: "bene", titoli: ["Bene", "codice bene"], obbligatorio: true },
  { chiave: "pezzi", titoli: ["Pezzi", "numero pezzi"], tipo: "numero", min: 0 },
  { chiave: "peso", titoli: ["Peso (kg)", "peso"], tipo: "numero", min: 0 },
  { chiave: "nUtenze", titoli: ["N. utenze (valori medi)", "n utenze"], tipo: "numero", min: 0 },
];

// Riporta la macrocategoria scritta nel file a "UD" (domestica) o "UnD"
// (non domestica); null se non riconosciuta (la riga viene scartata).
function normalizzaMacro(v) {
  const s = String(v || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["ud", "domestica", "domestiche", "d"].includes(s)) return "UD";
  if (["und", "nondomestica", "nondomestiche", "nd"].includes(s)) return "UnD";
  return null;
}

/* Passo «Banca Dati Utenze»: import CSV di conferimenti e beni a riuso
   (alternativo al tracciato Excel), riepilogo per tipologia, scelta del
   peso specifico a consuntivo.
   Props:
   - calcoloId, tipo ("ex_post" | "ex_ante"), dati, aggiorna, sola
   - conferimenti, riuso: righe attuali; onConferimenti / onRiuso: aggiornano
     lo stato della pagina dopo un import
   - tipologie: [{ valore, etichetta }] ammesse.
   - utenzeAttive: numero di utenze del passo 5a; se più di 0 il motore usa
     quelle e NON questi conferimenti (il riuso invece sì): lo dice un
     riquadro in cima (23/10/2026).
   ATTENZIONE: l'import CSV salva SUBITO nel database e sostituisce tutte
   le righe esistenti (cancella e reinserisce a blocchi di 1000). I dati
   si controllano tutti PRIMA di cancellare (collaudo V01, D07): un file con
   errori non tocca la Banca Dati salvata. Resta senza transazione unica il
   caso di un guasto di rete a metà salvataggio: la tabella può restare
   incompleta, ma il calcolo non si può confermare finché non si ripete il
   salvataggio e non si ripreme «Calcola» (script 20). */
function BancaDati({ calcoloId, tipo, dati, aggiorna, sola, conferimenti, riuso, utenzeAttive = 0, onConferimenti, onRiuso, tipologie }) {
  // Esito dell'ultima operazione: { testo, errore? } oppure null.
  const [stato, setStato] = useState(null);
  const refC = useRef(null);
  const refR = useRef(null);
  const idTipologie = tipologie.map((t) => t.valore);
  // Accetta sia il codice della tipologia sia il nome (senza maiuscole);
  // restituisce il codice oppure null.
  const trovaTipologia = (v) => {
    const s = String(v || "").toLowerCase();
    return tipologie.find((t) => t.valore === s || t.etichetta.toLowerCase() === s)?.valore || null;
  };

  // Import di un file CSV. quale: "conferimenti" oppure "riuso".
  // TUTTO O NIENTE (collaudo V01, D07, 20/10/2026): se anche una sola riga
  // ha un errore (valore negativo o non numerico, dato obbligatorio
  // mancante, macrocategoria o tipologia non riconosciute) il file NON si
  // importa e la Banca Dati salvata resta quella di prima; il messaggio
  // elenca le prime righe da correggere. Così un import parziale non può
  // sembrare un insieme di dati completo.
  async function importa(e, quale) {
    const file = e.target.files?.[0];
    // Svuota il campo: così si può reimportare lo stesso file.
    e.target.value = "";
    if (!file) return;
    setStato({ testo: "Lettura del file…" });
    const testo = await file.text();
    const esito = csvInOggetti(testo, quale === "conferimenti" ? SCHEMA_CONFERIMENTI : SCHEMA_RIUSO);
    if (esito.colonneMancanti.length) {
      setStato({ errore: true, testo: `Colonne mancanti: ${esito.colonneMancanti.join(", ")}. Scarica il modello.` });
      return;
    }
    const scarti = [];
    const righe = esito.righe
      .map((r, n) => {
        const macro = normalizzaMacro(r.macro);
        if (!macro) {
          // n + 2: la riga 1 del file è l'intestazione e n parte da 0.
          scarti.push(`riga ${n + 2}: macrocategoria «${r.macro}» (usa UD o UnD)`);
          return null;
        }
        if (quale === "conferimenti") {
          const t = trovaTipologia(r.tipologia);
          if (!t) {
            scarti.push(`riga ${n + 2}: tipologia «${r.tipologia}» sconosciuta (codici: ${idTipologie.join(", ")})`);
            return null;
          }
          return { ...r, macro, tipologia: t, nUtenze: r.nUtenze || 1 };
        }
        return { ...r, macro, nUtenze: r.nUtenze || 1 };
      })
      .filter(Boolean);
    // I numeri di riga degli scarti contano solo le righe lette senza
    // errori: se ci sono anche errori di lettura si mostrano solo quelli
    // (con il numero di riga esatto); il conteggio comprende tutto.
    const errori = esito.righeScartate ? esito.errori || [] : scarti;
    const daCorreggere = (esito.righeScartate || 0) + scarti.length;
    if (daCorreggere > 0) {
      setStato({
        errore: true,
        testo: `File non importato: ${daCorreggere} ${daCorreggere === 1 ? "riga da correggere" : "righe da correggere"} (${errori.slice(0, 3).join("; ")}${errori.length > 3 ? "…" : ""}). Nessuna riga salvata: la Banca Dati Utenze resta quella di prima.`,
      });
      return;
    }
    if (!righe.length) {
      setStato({ errore: true, testo: "Il file non contiene righe di dati: nessuna modifica." });
      return;
    }
    setStato({ testo: `Salvataggio di ${righe.length} righe…` });
    const salva = quale === "conferimenti" ? salvaConferimenti : salvaRiuso;
    const { error } = await salva(calcoloId, righe, (fatte, tot) => setStato({ testo: `Salvataggio ${fatte} di ${tot} righe…` }));
    if (error) {
      setStato({ errore: true, testo: "Salvataggio non riuscito: " + error.message });
      return;
    }
    if (quale === "conferimenti") onConferimenti(righe);
    else onRiuso(righe);
    setStato({ testo: `Importate ${righe.length} righe, tutte valide.` });
  }

  // Scarica un CSV di esempio con le intestazioni giuste e qualche riga tipo.
  function modello(quale) {
    if (quale === "conferimenti") {
      scaricaTesto(
        "banca_dati_utenze_conferimenti.csv",
        scriviCsv(
          SCHEMA_CONFERIMENTI.map((c) => c.titoli[0]),
          [
            ["U0001", "UD", "1 componente", "indifferenziato", 18, 40, "", "", "", "", ""],
            ["U0001", "UD", "1 componente", "organico", 60, 25, "", "", "", "", ""],
            ["N0042", "UnD", "1 - Musei, biblioteche, scuole", "indifferenziato", 52, 120, "", "", 35, "", ""],
          ]
        )
      );
    } else {
      scaricaTesto(
        "banca_dati_utenze_riuso.csv",
        scriviCsv(SCHEMA_RIUSO.map((c) => c.titoli[0]), [["U0001", "UD", "1 componente", "maglione", 3, "", ""]])
      );
    }
  }

  // Riepilogo dei conferimenti per tipologia.
  // Litri = (svuotamenti × volume contenitore + volume strutture + volume
  // centri di raccolta) × N. utenze; kg = pesi misurati × N. utenze.
  // Restituisce { perTipologia: { tipologia: { righe, litri, kg } }, utenze }.
  const riepilogo = useMemo(() => {
    const m = {};
    const utenze = new Set();
    conferimenti.forEach((c) => {
      utenze.add(c.utenza);
      const n = Number(c.nUtenze) || 1;
      m[c.tipologia] = m[c.tipologia] || { righe: 0, litri: 0, kg: 0 };
      m[c.tipologia].righe++;
      m[c.tipologia].litri += ((Number(c.svuotamenti) || 0) * (Number(c.volume) || 0) + (Number(c.volumeStrutture) || 0) + (Number(c.volumeCdr) || 0)) * n;
      m[c.tipologia].kg += ((Number(c.pesoStrutture) || 0) + (Number(c.pesoCdr) || 0)) * n;
    });
    return { perTipologia: m, utenze: utenze.size };
  }, [conferimenti]);
  // Riepilogo per tipologia ordinabile per colonna.
  const ordTip = useOrdinamento(Object.entries(riepilogo.perTipologia).map(([tp, v]) => ({ tp, ...v })), {
    tipologia: (x) => tipologie.find((y) => y.valore === x.tp)?.etichetta || x.tp,
    righe: (x) => x.righe, litri: (x) => x.litri, kg: (x) => x.kg,
  });

  return (
    <Passo
      titolo="Banca Dati Utenze"
      nota={
        tipo === "ex_post"
          ? "Capitolo 6.1, ex post: una riga per utenza e tipologia di rifiuto, con svuotamenti e volume del contenitore (raccolta domiciliare), pesi o volumi presso strutture informatizzate e centri di raccolta. La classe deve coincidere con quella della delibera."
          : "Capitolo 6.1, ex ante: valori stimati. Si possono usare valori medi per classe indicando nella colonna «N. utenze» quante utenze rappresenta la riga."
      }
    >
      {utenzeAttive > 0 && (
        <div style={{ background: C.ocraSoft, borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 12.5 }}>
          <b>Questo calcolo usa le {utenzeAttive.toLocaleString("it-IT")} utenze del passo 5a.</b> I conferimenti di questa pagina
          non entrano nel calcolo; i beni a riuso sì.
        </div>
      )}
      {stato && <div style={{ fontSize: 12.5, color: stato.errore ? C.amber : C.green, marginBottom: 10 }}>{stato.testo}</div>}

      <h3 style={h3}>Conferimenti di rifiuti</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        {!sola && (
          <label style={{ ...btnMini, display: "inline-block" }}>
            Importa CSV (sostituisce i dati)
            <input ref={refC} type="file" accept=".csv,text/csv" onChange={(e) => importa(e, "conferimenti")} style={{ display: "none" }} />
          </label>
        )}
        <button onClick={() => modello("conferimenti")} style={btnLink}>Scarica il modello</button>
        <span style={{ fontSize: 12.5, color: C.grafite }}>
          {conferimenti.length.toLocaleString("it-IT")} righe · {riepilogo.utenze.toLocaleString("it-IT")} utenze
        </span>
      </div>
      {Object.keys(riepilogo.perTipologia).length > 0 && (
        <table style={tabella}>
          <thead>
            <tr style={{ background: C.paper }}>
              <ThOrdinabile ord={ordTip} chiave="tipologia" style={thS}>Tipologia</ThOrdinabile>
              <ThOrdinabile ord={ordTip} chiave="righe" style={{ ...thS, textAlign: "right" }}>Righe</ThOrdinabile>
              <ThOrdinabile ord={ordTip} chiave="litri" style={{ ...thS, textAlign: "right" }}>Volume (L)</ThOrdinabile>
              <ThOrdinabile ord={ordTip} chiave="kg" style={{ ...thS, textAlign: "right" }}>Peso misurato (kg)</ThOrdinabile>
            </tr>
          </thead>
          <tbody>
            {ordTip.ordinate.map(({ tp: t, ...v }) => (
              <tr key={t} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={tdS}>{tipologie.find((x) => x.valore === t)?.etichetta || t}</td>
                <td style={tdN}>{v.righe.toLocaleString("it-IT")}</td>
                <td style={tdN}>{fmt(v.litri, 0)}</td>
                <td style={tdN}>{fmt(v.kg, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={h3}>Beni conferiti a riuso</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        {!sola && (
          <label style={{ ...btnMini, display: "inline-block" }}>
            Importa CSV (sostituisce i dati)
            <input ref={refR} type="file" accept=".csv,text/csv" onChange={(e) => importa(e, "riuso")} style={{ display: "none" }} />
          </label>
        )}
        <button onClick={() => modello("riuso")} style={btnLink}>Scarica il modello</button>
        <span style={{ fontSize: 12.5, color: C.grafite }}>{riuso.length.toLocaleString("it-IT")} righe</span>
      </div>

      {/* Il peso specifico a consuntivo (formula 18) è possibile solo ex post.
          Servono anche i volumi dei contenitori centralizzati, per tipologia. */}
      <h3 style={h3}>Peso specifico</h3>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" disabled={sola || tipo !== "ex_post"} checked={!!dati.psConsuntivo} onChange={(e) => aggiorna({ psConsuntivo: e.target.checked })} />
        Calcola il peso specifico a consuntivo (formula 18), invece dei valori della Tabella 8
      </label>
      {dati.psConsuntivo && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 6 }}>
            Volumi dei contenitori informatizzati o centralizzati (Σ S × VC, in litri/anno) da aggiungere a quelli delle utenze:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
            {[...new Set(conferimenti.map((c) => c.tipologia))].map((t) => (
              <label key={t} style={lbl}>
                {tipologie.find((x) => x.valore === t)?.etichetta || t}
                <input
                  disabled={sola}
                  inputMode="decimal"
                  value={dati.volumiCentralizzati?.[t] ?? ""}
                  onChange={(e) => aggiorna({ volumiCentralizzati: { ...dati.volumiCentralizzati, [t]: e.target.value.replace(",", ".") } })}
                  style={campo}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </Passo>
  );
}

/* ---------------- Passo 6: buffer ---------------- */
/* Opzioni dell'analisi del rischio (Tabelle 15 e 16) che determinano il
   buffer, cioè la quota di crediti trattenuta. Il calcolo vero del buffer
   è in calcolaBuffer di src/lib/crediti/calcolo.js (somma delle voci,
   dimezzata con tariffa puntuale, massimo 80%; un buffer manuale del
   Progetto sostituisce quello calcolato).
   Props: opzioni (dati.opzioni), aggiorna(parziale) che scrive in
   dati.opzioni, sola, conferimenti, riuso. (`dati` arriva ma non è usato.) */
function Buffer({ opzioni, aggiorna, sola, conferimenti, riuso }) {
  // Tipologie presenti nella Banca Dati = tipologie misurate.
  const misurate = new Set(conferimenti.map((c) => c.tipologia));
  // «Ricava dai dati importati»: propone le caselle in base alla Banca Dati
  // (rifiuti misurati, misure presso i centri, macrocategorie monitorate).
  // Le domestiche non residenti non si distinguono nei dati: resta il
  // valore già scelto (sì, se mai impostato). Senza conferimenti tutte le
  // utenze risultano monitorate.
  function ricava() {
    aggiorna({
      rifiutiMisurati: {
        indifferenziato: misurate.has("indifferenziato"),
        organico: misurate.has("organico"),
        carta: misurate.has("carta"),
        plastica: misurate.has("plastica"),
        vetro: misurate.has("vetro"),
      },
      misuraCentralizzate: conferimenti.some((c) => Number(c.pesoCdr) || Number(c.volumeCdr)) || riuso.length > 0 || opzioni.misuraCentralizzate,
      utenzeMonitorate: {
        res: conferimenti.some((c) => c.macro === "UD") || !conferimenti.length,
        nonres: opzioni.utenzeMonitorate?.nonres ?? true,
        und: conferimenti.some((c) => c.macro === "UnD") || !conferimenti.length,
      },
    });
  }
  const um = opzioni.utenzeMonitorate || {};
  const rm = opzioni.rifiutiMisurati || {};
  // Casella di spunta generica. Se `oggetto` è indicato la chiave sta in un
  // sotto-oggetto delle opzioni (es. opzioni.rifiutiMisurati.carta),
  // altrimenti direttamente in opzioni.
  const cb = (chiave, oggetto, valore, etichetta) => (
    <label key={chiave} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 0" }}>
      <input type="checkbox" disabled={sola} checked={!!valore} onChange={(e) => aggiorna(oggetto ? { [oggetto]: { ...opzioni[oggetto], [chiave]: e.target.checked } } : { [chiave]: e.target.checked })} />
      {etichetta}
    </label>
  );
  return (
    <Passo titolo="Analisi del rischio e buffer" nota="Capitolo 7. Il buffer è una riserva di crediti trattenuta a copertura delle incertezze: si sommano le voci delle Tabelle 15 e 16, si dimezza con la tariffa puntuale attiva, fino a un massimo dell'80%. Il Progetto può indicare un valore diverso motivandolo.">
      {!sola && conferimenti.length > 0 && <button onClick={ricava} style={{ ...btnMini, marginBottom: 12 }}>Ricava dai dati importati</button>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
        <div>
          <h3 style={h3}>Contributi considerati</h3>
          {cb("soloVirtuose", null, opzioni.soloVirtuose, "Solo le utenze che riducono la CO₂eq (le altre non pesano sul territorio)")}
          {opzioni.soloVirtuose && (
            <label style={{ ...lbl, maxWidth: 200, marginTop: 4 }}>
              Buffer per questa scelta (%)
              <input disabled={sola} inputMode="decimal" value={opzioni.bufferVirtuose} onChange={(e) => aggiorna({ bufferVirtuose: e.target.value.replace(",", ".") })} style={campo} />
            </label>
          )}
          <h3 style={h3}>Utenze monitorate (Tabella 15)</h3>
          {cb("res", "utenzeMonitorate", um.res, "Domestiche residenti")}
          {cb("nonres", "utenzeMonitorate", um.nonres, "Domestiche non residenti")}
          {cb("und", "utenzeMonitorate", um.und, "Non domestiche")}
          <label style={{ ...lbl, maxWidth: 260, marginTop: 6 }}>
            Categorie non domestiche non monitorate (n.)
            <input disabled={sola} type="number" min="0" value={opzioni.categorieUndNonMonitorate} onChange={(e) => aggiorna({ categorieUndNonMonitorate: e.target.value })} style={campo} />
          </label>
        </div>
        <div>
          <h3 style={h3}>Rifiuti misurati (Tabella 16)</h3>
          {cb("indifferenziato", "rifiutiMisurati", rm.indifferenziato, "Indifferenziato")}
          {cb("organico", "rifiutiMisurati", rm.organico, "Frazione organica")}
          {cb("carta", "rifiutiMisurati", rm.carta, "Carta")}
          {cb("plastica", "rifiutiMisurati", rm.plastica, "Plastica")}
          {cb("vetro", "rifiutiMisurati", rm.vetro, "Vetro")}
          {cb("misuraCentralizzate", null, opzioni.misuraCentralizzate, "Misura presso Centri di Raccolta / Riuso (−2%)")}
          {cb("misuraAltriNonCentralizzati", null, opzioni.misuraAltriNonCentralizzati, "Misura ingombranti, verde o indumenti fuori dai centri (−1%)")}
          <h3 style={h3}>Altre condizioni</h3>
          {cb("tariffaPuntuale", null, opzioni.tariffaPuntuale, "Tariffa puntuale attiva nell'anno (buffer dimezzato)")}
          <label style={{ ...lbl, maxWidth: 260, marginTop: 8 }}>
            Buffer indicato dal Progetto (%, facoltativo)
            <input disabled={sola} inputMode="decimal" value={opzioni.bufferManuale} onChange={(e) => aggiorna({ bufferManuale: e.target.value.replace(",", ".") })} style={campo} placeholder="lascia vuoto per il calcolo" />
          </label>
          {/* Con un buffer manuale serve la motivazione (finisce nel rapporto). */}
          {opzioni.bufferManuale !== "" && opzioni.bufferManuale != null && (
            <label style={{ ...lbl, marginTop: 6 }}>
              Motivazione
              <input disabled={sola} value={opzioni.motivazioneBuffer} onChange={(e) => aggiorna({ motivazioneBuffer: e.target.value })} style={campo} />
            </label>
          )}
        </div>
      </div>
    </Passo>
  );
}

/* ---------------- Passo 7: risultati ---------------- */
/* Riquadri principali (crediti netti e lordi, buffer, ΔI, utenze), tabelle
   di dettaglio e pulsanti di esportazione.
   Props:
   - risultato: risultato completo appena calcolato (con dettaglio per
     utenza) oppure null
   - salvato: riepilogo salvato nel database (senza dettaglio)
   - onCalcola, onRapporto(archivia), testa, confermato.
   Si mostra il risultato appena calcolato se c'è, altrimenti quello
   salvato. Il CSV per utenza richiede un «Calcola» nella sessione. */
function Risultati({ risultato, salvato, onCalcola, testa, onRapporto, confermato }) {
  const r = risultato || salvato;
  // Tabelle dei risultati ordinabili per colonna (prima del ritorno
  // anticipato: le regole di React vogliono gli hook sempre chiamati).
  const nomeTip = (tp) => TIPOLOGIE_RIFIUTO.find((x) => x.id === tp)?.nome || tp;
  const nomeClasse = (c) => `${c.macro === "UD" ? "Dom." : "Non dom."} ${c.classe}`;
  const ordAttesa = useOrdinamento(r?.attesa?.tipologie || [], {
    tipologia: (x) => nomeTip(x.tipologia), qtot: (x) => x.qtot, qud: (x) => x.qud, qund: (x) => x.qund,
    fe: (x) => x.fe, ea: (x) => x.ea, misurata: (x) => (r?.tipologieMisurate || []).includes(x.tipologia),
  });
  const colonneClassi = { classe: nomeClasse, n: (c) => c.n, quota: (c) => c.quota };
  (r?.attesa?.tipologie || []).forEach((x) => { colonneClassi[`t_${x.tipologia}`] = (c) => c.atteso?.[x.tipologia]; });
  const ordClassi = useOrdinamento(r?.attesa?.classi || [], colonneClassi);
  const ordPerClasse = useOrdinamento(r?.utenze?.perClasse || [], {
    classe: nomeClasse, utenze: (c) => c.utenze, virtuose: (c) => c.virtuose, deltaI: (c) => c.deltaI,
  });
  if (!r) {
    return (
      <Passo titolo="Risultati" nota="Compila i passi precedenti e premi «Calcola».">
        <button onClick={onCalcola} style={btnPrimario}>Calcola</button>
      </Passo>
    );
  }
  const dettaglio = risultato?.utenze?.dettaglio;
  // Nome leggibile di una tipologia dal suo codice.
  const tipNome = (t) => TIPOLOGIE_RIFIUTO.find((x) => x.id === t)?.nome || t;

  // CSV con una riga per utenza: produzione per tipologia (Ptot, kg),
  // emissioni attese EA, emissioni di progetto EP e ΔI (kgCO₂eq).
  // Le colonne delle tipologie sono quelle presenti in almeno un'utenza.
  function esportaUtenze() {
    const tipologie = [...new Set(dettaglio.flatMap((u) => Object.keys(u.ptot)))];
    scaricaTesto(
      `crediti_dettaglio_utenze_${testa.anno}.csv`,
      scriviCsv(
        ["Utenza", "Macrocategoria", "Classe", "N. utenze", ...tipologie.map((t) => `Ptot ${tipNome(t)} (kg)`), "EA (kgCO2eq)", "EP (kgCO2eq)", "ΔI (kgCO2eq)"],
        dettaglio.map((u) => [u.utenza, u.macro, u.classe, u.nUtenze, ...tipologie.map((t) => Number((u.ptot[t] || 0).toFixed(3))), Number(u.ea.toFixed(3)), Number(u.ep.toFixed(3)), Number(u.deltaI.toFixed(3))])
      )
    );
  }

  // CSV «Voce;Valore» con i numeri principali e le voci del buffer.
  // Funziona anche con il solo risultato salvato.
  function esportaRiepilogo() {
    const righe = [
      ["Anno", r.periodo.anno],
      ["Coefficiente primo anno", r.periodo.coefficiente],
      ["Qtot (t)", r.attesa.Qtot],
      // Quote PEF in percentuale (0-100), come nella pagina e nel PDF
      // (collaudo V01, R07: prima erano frazioni 0-1 con etichetta «%»).
      ["P%UD (%)", r.attesa.pUd * 100],
      ["P%UnD (%)", r.attesa.pUnD * 100],
      ["EA territorio (tCO2eq)", r.attesa.EAterritorio],
      ["FE indifferenziato (kgCO2eq/kg)", r.indifferenziato?.fe ?? ""],
      ["Banca Dati Utenze", r.fonte === "utenze" ? "utenze del passo 5a" : "conferimenti del tracciato (passo 5b)"],
      ["Utenze", r.utenze.totale],
      ...(r.fonte === "utenze" ? [["Utenze escluse (categoria mancante o non in delibera)", r.utenze.escluse || 0]] : []),
      ["Utenze virtuose", r.utenze.virtuose],
      ["ΔI (kgCO2eq)", r.deltaI],
      ["Buffer (%)", r.buffer.totale],
      ["Crediti lordi (tCO2eq)", r.crediti.lordi],
      ["Quota buffer (tCO2eq)", r.crediti.buffer],
      ["Crediti netti (tCO2eq)", r.crediti.netti],
      ["Debito (tCO2eq)", r.crediti.debito],
      ...r.buffer.voci.map((v) => [`Buffer - ${v.voce}`, v.valore]),
    ];
    scaricaTesto(`crediti_riepilogo_${testa.anno}.csv`, scriviCsv(["Voce", "Valore"], righe));
  }

  return (
    <Passo titolo="Risultati" nota={`Calcolato il ${new Date(r.calcolatoIl).toLocaleString("it-IT")} con la Metodologia v${r.versioneMetodologia}.`}>
      {/* Errori bloccanti (collaudo V01): nessun credito, risultato non salvato. */}
      {r.errori?.length > 0 && (
        <div role="alert" style={{ background: "#FBE9E7", border: `1px solid ${C.red}`, borderRadius: 9, padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: C.ink }}>
          <b style={{ color: C.red }}>Calcolo bloccato: dati non ammessi.</b> Nessun credito calcolato e nessun risultato salvato. Correggi e premi di nuovo «Calcola».
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{r.errori.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      {r.avvisi?.length > 0 && (
        <div style={{ background: C.ocraSoft, borderRadius: 9, padding: "10px 12px", marginBottom: 14, fontSize: 12.5 }}>
          <b>Da verificare:</b>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{r.avvisi.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      {/* Da dove vengono i dati delle utenze (23/10/2026). Assente nei
          risultati salvati prima: erano tutti dai conferimenti del tracciato. */}
      <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 10 }}>
        Banca Dati Utenze: {r.fonte === "utenze"
          ? <>utenze del passo 5a, con i kg misurati e la categoria di simulazione come classe{r.utenze.escluse ? <> · <b style={{ color: C.red }}>{r.utenze.escluse.toLocaleString("it-IT")} escluse</b> (categoria mancante o non in delibera)</> : ""}.</>
          : "conferimenti del tracciato (passo 5b)."}
      </div>

      {/* Riquadri principali. Convenzione dei segni: ΔI < 0 = il territorio
          riduce le emissioni; crediti lordi = −ΔI (in tCO₂eq); crediti netti
          = lordi meno la quota di buffer. Con ΔI > 0 non ci sono crediti ma
          un «debito» del territorio. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Riquadro valore={fmt(r.crediti.netti, 3)} unita="tCO₂eq" etichetta="Crediti netti" forte />
        <Riquadro valore={fmt(r.crediti.lordi, 3)} unita="tCO₂eq" etichetta="Crediti lordi (−ΔI)" />
        <Riquadro valore={fmt(r.buffer.totale, 1)} unita="%" etichetta={`Buffer${r.buffer.manuale ? " (indicato dal Progetto)" : ""}`} />
        <Riquadro valore={fmt(r.deltaI, 1)} unita="kgCO₂eq" etichetta="ΔI del territorio" />
        <Riquadro valore={`${r.utenze.virtuose.toLocaleString("it-IT")} / ${r.utenze.totale.toLocaleString("it-IT")}`} etichetta="Utenze che riducono / totali" />
        {r.crediti.debito > 0 && <Riquadro valore={fmt(r.crediti.debito, 3)} unita="tCO₂eq" etichetta="Debito del territorio" />}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {salvato && <button onClick={() => onRapporto(false)} style={btnPrimario}>Scarica il rapporto (PDF)</button>}
        {salvato && confermato && <button onClick={() => onRapporto(true)} style={btnMini}>Archivia il rapporto nella pratica</button>}
        <button onClick={esportaRiepilogo} style={btnMini}>Scarica il riepilogo (CSV)</button>
        {dettaglio && <button onClick={esportaUtenze} style={btnMini}>Scarica il dettaglio per utenza (CSV)</button>}
        {!dettaglio && <span style={{ fontSize: 12.5, color: C.grafite, alignSelf: "center" }}>Premi «Calcola» per il dettaglio per utenza.</span>}
      </div>

      <h3 style={h3}>Buffer</h3>
      <table style={tabella}>
        <tbody>
          {r.buffer.voci.map((v) => (
            <tr key={v.voce} style={{ borderTop: `1px solid ${C.line}` }}>
              <td style={tdS}>{v.voce}</td>
              <td style={tdN}>{v.valore > 0 ? "+" : ""}{fmt(v.valore, 1)}%</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.line}`, fontWeight: 700 }}>
            <td style={tdS}>Totale applicato{r.buffer.manuale ? ` (calcolato: ${fmt(r.buffer.calcolato, 1)}%)` : ""}</td>
            <td style={tdN}>{fmt(r.buffer.totale, 1)}%</td>
          </tr>
        </tbody>
      </table>

      <h3 style={h3}>Produzione ed emissioni attese del territorio</h3>
      <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 6 }}>
        Qtot {fmt(r.attesa.Qtot, 2)} t · ripartizione riparametrizzata P%UD {fmt(r.attesa.pUd * 100, 2)}% · P%UnD {fmt(r.attesa.pUnD * 100, 2)}%
        {r.periodo.coefficiente < 1 && ` · primo anno: ${r.periodo.giorni} giorni (× ${fmt(r.periodo.coefficiente, 4)})`}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={tabella}>
          <thead>
            <tr style={{ background: C.paper }}>
              <ThOrdinabile ord={ordAttesa} chiave="tipologia" style={thS}>Tipologia</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="qtot" style={{ ...thS, textAlign: "right" }}>Qtot (t)</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="qud" style={{ ...thS, textAlign: "right" }}>QUD (t)</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="qund" style={{ ...thS, textAlign: "right" }}>QUnD (t)</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="fe" style={{ ...thS, textAlign: "right" }}>FE (kgCO₂eq/kg)</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="ea" style={{ ...thS, textAlign: "right" }}>EA (tCO₂eq)</ThOrdinabile>
              <ThOrdinabile ord={ordAttesa} chiave="misurata" style={thS}>Misurata</ThOrdinabile>
            </tr>
          </thead>
          <tbody>
            {ordAttesa.ordinate.map((t) => (
              <tr key={t.tipologia} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={tdS}>{tipNome(t.tipologia)}{t.soloDomestiche ? " (solo domestiche)" : ""}</td>
                <td style={tdN}>{fmt(t.qtot, 2)}</td>
                <td style={tdN}>{fmt(t.qud, 2)}</td>
                <td style={tdN}>{fmt(t.qund, 2)}</td>
                <td style={tdN}>{fmt(t.fe, 3)}</td>
                <td style={tdN}>{fmt(t.ea, 2)}</td>
                <td style={tdS}>{r.tipologieMisurate.includes(t.tipologia) ? "sì" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.indifferenziato?.fe != null && (
        <div style={{ fontSize: 12, color: C.grafite, marginTop: 6 }}>
          FE indifferenziato calcolato (formule 16-17): {fmt(r.indifferenziato.fe, 4)} kgCO₂eq/kg, da{" "}
          {r.indifferenziato.composizione.map((c) => `${tipNome(c.tipologia)} ${fmt(c.quota * 100, 1)}%${c.quantita != null ? ` (${fmt(c.quantita, 2)} t; FE ${fmt(c.fe, 3)})` : ""}`).join(", ")}.
          {/* Rilievo N06 (ATTESA_REGOLA): frazioni oltre le cinque nominate dal cap. 5 ed escluse per FE mancante. */}
          {r.indifferenziato.fuoriPaniere?.length > 0 && (
            <> Comprende tipologie oltre le cinque nominate al cap. 5 della Metodologia ({r.indifferenziato.fuoriPaniere.map(tipNome).join(", ")}): il paniere da usare è in attesa di conferma della Fondazione.</>
          )}
          {r.indifferenziato.escluse?.length > 0 && <> Escluse perché senza fattore: {r.indifferenziato.escluse.map(tipNome).join(", ")}.</>}
        </div>
      )}

      <h3 style={h3}>Valori attesi per utenza della classe (kg/anno)</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tabella}>
          <thead>
            <tr style={{ background: C.paper }}>
              <ThOrdinabile ord={ordClassi} chiave="classe" style={thS}>Classe</ThOrdinabile>
              <ThOrdinabile ord={ordClassi} chiave="n" style={{ ...thS, textAlign: "right" }}>Utenze</ThOrdinabile>
              <ThOrdinabile ord={ordClassi} chiave="quota" style={{ ...thS, textAlign: "right" }}>Quota</ThOrdinabile>
              {r.attesa.tipologie.map((t) => <ThOrdinabile key={t.tipologia} ord={ordClassi} chiave={`t_${t.tipologia}`} style={{ ...thS, textAlign: "right" }}>{tipNome(t.tipologia)}</ThOrdinabile>)}
            </tr>
          </thead>
          <tbody>
            {ordClassi.ordinate.map((c) => (
              <tr key={`${c.macro}|${c.classe}`} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={tdS}>{c.macro === "UD" ? "Dom." : "Non dom."} {c.classe}</td>
                <td style={tdN}>{c.n.toLocaleString("it-IT")}</td>
                <td style={tdN}>{fmt(c.quota * 100, 2)}%</td>
                {r.attesa.tipologie.map((t) => <td key={t.tipologia} style={tdN}>{fmt(c.atteso[t.tipologia], 1)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.utenze.perClasse && (
        <>
          <h3 style={h3}>Variazione di impatto per classe</h3>
          <table style={tabella}>
            <thead>
              <tr style={{ background: C.paper }}>
                <ThOrdinabile ord={ordPerClasse} chiave="classe" style={thS}>Classe</ThOrdinabile>
                <ThOrdinabile ord={ordPerClasse} chiave="utenze" style={{ ...thS, textAlign: "right" }}>Utenze</ThOrdinabile>
                <ThOrdinabile ord={ordPerClasse} chiave="virtuose" style={{ ...thS, textAlign: "right" }}>Che riducono</ThOrdinabile>
                <ThOrdinabile ord={ordPerClasse} chiave="deltaI" style={{ ...thS, textAlign: "right" }}>ΔI (kgCO₂eq)</ThOrdinabile>
              </tr>
            </thead>
            <tbody>
              {ordPerClasse.ordinate.map((c) => (
                <tr key={`${c.macro}|${c.classe}`} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={tdS}>{c.macro === "UD" ? "Dom." : "Non dom."} {c.classe}</td>
                  <td style={tdN}>{c.utenze.toLocaleString("it-IT")}</td>
                  <td style={tdN}>{c.virtuose.toLocaleString("it-IT")}</td>
                  <td style={tdN}>{fmt(c.deltaI, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 style={h3}>Pesi specifici usati (kg/m³)</h3>
      <div style={{ fontSize: 12.5, color: C.grafite }}>
        {Object.entries(r.pesiSpecifici.ps)
          .filter(([t]) => r.tipologieMisurate.includes(t))
          .map(([t, v]) => `${tipNome(t)}: ${fmt(v, 1)} (${r.pesiSpecifici.dettaglio[t]?.metodo})`)
          .join(" · ") || "—"}
      </div>
    </Passo>
  );
}

/* ---------------- Elementi comuni ---------------- */
// Contenitore di un passo: titolo, nota esplicativa (riferimenti alla
// Metodologia) e contenuto.
function Passo({ titolo, nota, children }) {
  return (
    <div>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 4px" }}>{titolo}</h2>
      {nota && <p style={{ fontSize: 12.5, color: C.grafite, margin: "0 0 14px", lineHeight: 1.55, maxWidth: 820 }}>{nota}</p>}
      {children}
    </div>
  );
}

// Riga di totale sotto una tabella (valore con 2 decimali e unità).
function Totale({ etichetta, valore, unita }) {
  return (
    <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 8 }}>
      {etichetta}: <b style={{ color: C.ink }}>{fmt(valore, 2)}</b> {unita}
    </div>
  );
}

// Riquadro numerico dei risultati: valore già formattato, unità, etichetta;
// `forte` lo evidenzia in verde (crediti netti).
function Riquadro({ valore, unita, etichetta, forte }) {
  return (
    <div style={{ border: `1px solid ${forte ? C.green : C.line}`, borderRadius: 11, padding: "12px 14px", background: forte ? C.greenSoft : C.white }}>
      <div style={{ fontFamily: "'Archivo'", fontSize: 22, fontWeight: 800, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
        {valore} {unita && <span style={{ fontSize: 12, fontWeight: 600, color: C.grafite }}>{unita}</span>}
      </div>
      <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600, marginTop: 2 }}>{etichetta}</div>
    </div>
  );
}

// Stili condivisi dalla pagina e dai passi (thS/tdS/tdN: celle delle
// tabelle piccole; tdN allinea i numeri a destra).
const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", minWidth: 0 };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 };
const campo = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", background: C.white };
const h3 = { fontFamily: "'Archivo'", fontSize: 14, margin: "18px 0 8px" };
const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnLink = { background: "none", border: "none", color: C.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "6px 4px" };
const tabella = { width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: `1px solid ${C.line}` };
const thS = { padding: "7px 9px", textAlign: "left", fontWeight: 700, color: C.grafite, whiteSpace: "nowrap" };
const tdS = { padding: "6px 9px" };
const tdN = { padding: "6px 9px", textAlign: "right", fontVariantNumeric: "tabular-nums" };

/* Controlli della Gestione qualità dei dati (qualita.js) nel passo
   «Risultati»: popolazione e cluster SOSE del territorio, confronto della
   produzione pro capite con la Tabella 3 dello Standard CWP (soglia ±30%,
   motivazione obbligatoria se superata) e indicatori di completezza,
   unicità, letture a buon fine e tempestività. Popolazione, cluster e
   motivazione si salvano nei dati del calcolo (dati.qualita).
   Props: qualita (da qualitaDati), aggiorna(parziale), sola. */
function QualitaDati({ qualita, aggiorna, sola }) {
  // Scostamenti dalla Tabella 3 ordinabili per colonna.
  const ordScost = useOrdinamento(qualita?.scostamenti || [], {
    tipologia: (s) => TIPOLOGIE_RIFIUTO.find((x) => x.id === s.tipologia)?.nome || s.tipologia,
    procapite: (s) => s.procapite, riferimento: (s) => s.riferimento, scostamento: (s) => s.scostamento,
  });
  if (!qualita) return null;
  const set = (k) => (e) => aggiorna({ qualita: { popolazione: qualita.popolazione || "", cluster: qualita.cluster || "", motivazione: qualita.motivazione || "", [k]: e.target.value } });
  const oltre = qualita.scostamenti.filter((s) => s.oltre);
  const colore = { ok: C.green, avviso: C.amber, nd: C.grafite };
  return (
    <div style={{ marginBottom: 16, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>Qualità dei dati (documento «Gestione della qualità dei dati» del Programma)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        <label style={lbl}>
          Popolazione residente del territorio
          <input type="number" min="0" value={qualita.popolazione || ""} onChange={set("popolazione")} disabled={sola} style={campo} />
        </label>
        <label style={lbl}>
          Cluster SOSE (Standard, Tabella 2)
          <select value={qualita.cluster || ""} onChange={set("cluster")} disabled={sola} style={campo}>
            <option value="">— scegli —</option>
            {CLUSTER.map((c, i) => <option key={i} value={i + 1}>{i + 1}. {c}</option>)}
          </select>
        </label>
      </div>
      {qualita.scostamenti.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, margin: "6px 0 10px" }}>
          <thead><tr style={{ textAlign: "left", color: C.grafite }}>
            <ThOrdinabile ord={ordScost} chiave="tipologia">Tipologia</ThOrdinabile>
            <ThOrdinabile ord={ordScost} chiave="procapite" style={{ textAlign: "right" }}>kg/ab/anno</ThOrdinabile>
            <ThOrdinabile ord={ordScost} chiave="riferimento" style={{ textAlign: "right" }}>Tabella 3</ThOrdinabile>
            <ThOrdinabile ord={ordScost} chiave="scostamento" style={{ textAlign: "right" }}>Scostamento</ThOrdinabile>
          </tr></thead>
          <tbody>
            {ordScost.ordinate.map((s) => (
              <tr key={s.tipologia} style={{ color: s.oltre ? C.red : C.ink }}>
                <td>{TIPOLOGIE_RIFIUTO.find((t) => t.id === s.tipologia)?.nome || s.tipologia}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.procapite, 1)}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.riferimento, 0)}</td>
                <td style={{ textAlign: "right", fontWeight: s.oltre ? 700 : 400 }}>{s.scostamento == null ? "—" : `${s.scostamento > 0 ? "+" : ""}${fmt(s.scostamento, 1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {qualita.scostamenti.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8 }}>Indica popolazione e cluster per il confronto con la Tabella 3 dello Standard.</div>
      )}
      {(oltre.length > 0 || qualita.motivazione) && (
        <label style={lbl}>
          Motivazione degli scostamenti oltre il {SOGLIA_SCOSTAMENTO}% {oltre.length > 0 && "(obbligatoria per confermare)"}
          <textarea rows={2} value={qualita.motivazione || ""} onChange={set("motivazione")} disabled={sola} style={{ ...campo, resize: "vertical" }} />
        </label>
      )}
      <div style={{ display: "grid", gap: 3 }}>
        {qualita.indicatori.map((i) => (
          <div key={i.nome} style={{ fontSize: 12.5 }}>
            <b style={{ color: colore[i.esito] }}>{i.esito === "ok" ? "✓" : i.esito === "avviso" ? "!" : "–"}</b> {i.nome}: <b>{i.valore}</b>
            <span style={{ color: C.grafite }}> — {i.nota}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
