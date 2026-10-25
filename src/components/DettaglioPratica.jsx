/* =========================================================================
   DettaglioPratica
   Scopo: pagina di dettaglio di una pratica (Progetto o Rapporto di
     Monitoraggio) con le sue 7 fasi (Guida al Programma 6.2 e 6.3.1).
     Riunisce in un'unica vista:
     intestazione, stato della pratica e stato nel Programma (Guida,
     Tabelle 3 e 4), dati del Progetto (territorio con codici ISTAT,
     co-promotori, periodo di riferimento, popolazione, crediti previsti,
     data di registrazione), Ente di validazione e verifica, cambio di
     stato (anche ritiro e rientro del Progetto), le fasi (azioni,
     verifica sull'accuratezza e accertamenti, integrazioni, note, modelli,
     documenti), messaggi, feedback pubblico, Rapporti annuali, pagamenti,
     documenti generali ed export del fascicolo.
     Lo staff apre e chiude le fasi, modifica le scadenze, richiede
     integrazioni, scrive note di fase, assegna l'Ente di Validazione e
     cambia lo stato della pratica. Le azioni critiche richiedono una
     motivazione, registrata nell'audit (requisiti §8).
     Il Comune vede fasi, note condivise, modelli da scaricare, documenti,
     pagamenti (sola lettura) e scrive messaggi alla Fondazione.
   Usato da: pagine BackOffice (/pratiche, staff) e AreaCliente
     (/ del Comune).
   Chi lo vede: cliente/Comune (solo le pratiche delle sue organizzazioni),
     operatore, admin.
   Dati: da src/lib/dati.js leggiPratica, elencaIntegrazioni,
     elencaNoteFase, elencaModelli, urlModello, elencaEnti; azioni con
     funzioni del database: apriFase (staff_apri_fase), chiudiFase
     (staff_chiudi_fase), modificaScadenzaFase (staff_modifica_scadenza),
     cambiaStatoPratica (staff_cambia_stato_pratica), richiediIntegrazione
     (staff_richiedi_integrazione) — script 08; impostaEntePratica
     (staff_imposta_ente_validazione) — script 17; aggiornaDatiPratica
     (staff_aggiorna_dati_pratica) ed estendiVerifica
     (staff_estendi_verifica) — script 23. Export: esportaFascicolo
     (src/lib/fascicolo.js). Tabelle: pratica, fase, richiesta_integrazione,
     nota_fase, modello_documento, ente_validazione.
   Sicurezza: tutte le azioni dello staff passano da funzioni del database
     che verificano il ruolo (cwp_richiedi_staff), lo stato della pratica e
     della fase e la motivazione (cwp_richiedi_motivazione, almeno 3
     caratteri). Le RLS limitano il Comune alle sue pratiche. I controlli su
     «staff» e «attiva» in questo file decidono solo quali pulsanti mostrare.
     Le notifiche (apertura/chiusura fase, integrazioni, documenti…) le
     generano i trigger del database, non questo componente.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA, STATI_FASE, PERIODI_RIFERIMENTO, FASI_VERIFICA_DOCUMENTALE, statoProgramma } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import BarraFasi from "./BarraFasi.jsx";
import Documenti from "./Documenti.jsx";
import Consultazione from "./Consultazione.jsx";
import Integrazioni from "./Integrazioni.jsx";
import Rapporti from "./Rapporti.jsx";
import Pagamenti from "./Pagamenti.jsx";
import CreditiEmessi from "./CreditiEmessi.jsx";
import Messaggi from "./Messaggi.jsx";
import NoteFase from "./NoteFase.jsx";
import {
  leggiPratica,
  apriFase,
  chiudiFase,
  modificaScadenzaFase,
  cambiaStatoPratica,
  elencaIntegrazioni,
  richiediIntegrazione,
  elencaNoteFase,
  elencaModelli,
  elencaDocumentiRichiesti,
  elencaDocumenti,
  urlModello,
  elencaEnti,
  impostaEntePratica,
  aggiornaDatiPratica,
  estendiVerifica,
} from "../lib/dati.js";
import { formatoData, giorniA } from "../lib/date.js";
import { CASI_COSTI, valoreProgettoCaso } from "../lib/crediti/simulatore.js";
import { esportaFascicolo } from "../lib/fascicolo.js";

/* Dettaglio di una pratica con le sue fasi (componente principale).
   Props:
   - praticaId: id della pratica da mostrare;
   - onAggiornato(): facoltativa, avvisa la pagina che qualcosa è cambiato
     (il BackOffice ricarica l'elenco delle pratiche);
   - onApri(id): facoltativa, apre un'altra pratica (Rapporto ↔ Progetto). */
export default function DettaglioPratica({ praticaId, onAggiornato, onApri }) {
  const { ruolo } = useAuth();
  const [pratica, setPratica] = useState(null);
  const [integrazioni, setIntegrazioni] = useState([]);
  const [note, setNote] = useState([]);
  const [modelli, setModelli] = useState([]);
  // Documenti richiesti per fase (script 21) e documenti della pratica, per
  // l'indicatore «presente / manca» di ogni fase.
  const [richiesti, setRichiesti] = useState([]);
  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  // Contatore usato nella key dei componenti Documenti: cambiandolo, React
  // li ricrea e quindi rileggono i documenti dopo ogni azione.
  const [versione, setVersione] = useState(0); // per ricaricare i documenti

  const staff = ruolo === "operatore" || ruolo === "admin";

  // Legge in parallelo pratica (con fasi, organizzazione, ente),
  // integrazioni, note di fase, modelli attivi, documenti richiesti e
  // documenti della pratica.
  // silenzioso = true: non mostra «Caricamento…» (ricarica dopo un'azione).
  async function carica(silenzioso = false) {
    if (!silenzioso) setCaricamento(true);
    const [{ data }, { data: integr }, { data: nt }, { data: mod }, { data: ric }, { data: docs }] = await Promise.all([
      leggiPratica(praticaId),
      elencaIntegrazioni(praticaId),
      elencaNoteFase(praticaId),
      elencaModelli(),
      elencaDocumentiRichiesti(),
      elencaDocumenti(praticaId),
    ]);
    setPratica(data);
    setIntegrazioni(integr || []);
    setNote(nt || []);
    setModelli(mod || []);
    setRichiesti(ric || []);
    setDocumenti(docs || []);
    setCaricamento(false);
  }

  // Dopo un caricamento: rilegge solo l'elenco dei documenti (indicatore
  // dei documenti richiesti), senza ricreare i riquadri dei documenti.
  async function ricaricaDocumenti() {
    const { data } = await elencaDocumenti(praticaId);
    setDocumenti(data || []);
  }

  // Dopo ogni azione: ricarica i dati, forza la rilettura dei documenti e
  // avvisa la pagina che contiene il dettaglio.
  async function dopoAzione() {
    await carica(true);
    setVersione((v) => v + 1);
    onAggiornato && onAggiornato();
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  if (caricamento) return <Pannello>Caricamento…</Pannello>;
  // Pratica inesistente oppure non visibile per le RLS (es. di un altro Comune).
  if (!pratica) return <Pannello>Pratica non trovata.</Pannello>;

  // Fasi in ordine (il database non garantisce l'ordine).
  const fasi = (pratica.fasi || []).sort((a, b) => a.numero - b.numero);
  const st = STATI_PRATICA[pratica.stato] || STATI_PRATICA.attiva;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Intestazione pratica */}
      <div style={riquadro}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            {/* ID univoco assegnato dalla Fondazione (Guida 6.2.1) */}
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>
              ID {pratica.tipo === "rapporto" ? "rapporto" : "progetto"}: {pratica.codice || "senza codice"}
            </div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 23, margin: "3px 0 4px", letterSpacing: -0.5 }}>
              {pratica.organizzazione?.denominazione || "—"}
            </h1>
            <div style={{ fontSize: 13, color: C.grafite }}>
              {pratica.titolo || "Progetto"}
              {pratica.organizzazione?.tipo ? ` · ${pratica.organizzazione.tipo}` : ""}
            </div>
            {pratica.tipo === "rapporto" && pratica.progetto_padre_id && onApri && (
              <button onClick={() => onApri(pratica.progetto_padre_id)} style={linkBtn}>
                ← Torna al Progetto
              </button>
            )}
          </div>
          <div style={{ textAlign: "right", display: "grid", gap: 8, justifyItems: "end", alignContent: "start" }}>
            {/* In alto a destra, in piccolo, la barra a LED delle 7 fasi
                (richiesta di Luca del 21/10/2026), come nella Dashboard. */}
            <BarraFasi fasi={fasi} />
            <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
            {/* Stato nel Programma con i nomi della Guida (Tabelle 3 e 4) */}
            <span style={{ fontSize: 12, color: C.grafite }}>
              Nel Programma: <b style={{ color: C.ink }}>{statoProgramma(pratica, fasi)}</b>
            </span>
            <BottoneFascicolo praticaId={pratica.id} staff={staff} />
          </div>
        </div>
        {pratica.stato !== "attiva" && pratica.motivazione_stato && (
          <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 10 }}>
            Motivazione: {pratica.motivazione_stato}
          </div>
        )}
        {/* Conservazione per 12 anni (Guida 6.2.1 e 6.5.1, script 23): la
            data la imposta il database alla chiusura, all'annullamento o al
            ritiro. */}
        {pratica.conservare_fino_al && (
          <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 6 }}>
            Da conservare fino al {formatoData(pratica.conservare_fino_al)}
          </div>
        )}
        {/* Pratica non attiva: il Comune deve capire perché non può agire (backlog 24) */}
        {!staff && pratica.stato !== "attiva" && (
          <div style={{ marginTop: 12, background: C.ocraSoft, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            La pratica è <b>{st.label.toLowerCase()}</b>: per ora non è possibile caricare documenti né rispondere alle
            richieste di integrazione. Potete consultare tutto e scrivere alla Fondazione nella sezione Messaggi.
          </div>
        )}
        <DatiPratica pratica={pratica} staff={staff} onFatto={dopoAzione} />
        <EnteValidazione pratica={pratica} staff={staff} onFatto={dopoAzione} />
        {staff && <CambioStato pratica={pratica} onFatto={dopoAzione} />}
      </div>

      {/* Le 7 fasi del percorso */}
      <div style={{ display: "grid", gap: 10 }}>
        {fasi.map((f) => (
          <Fase
            key={f.id}
            fase={f}
            pratica={pratica}
            staff={staff}
            richieste={integrazioni.filter((r) => r.fase_id === f.id)}
            note={note.filter((n) => n.fase_id === f.id)}
            modelli={modelli.filter((m) => m.fase_numero === f.numero && (m.tipo_pratica || "progetto") === pratica.tipo)}
            richiesti={richiesti.filter((r) => r.fase_numero === f.numero && r.tipo_pratica === pratica.tipo)}
            documentiFase={documenti.filter((d) => d.fase_id === f.id)}
            onCaricato={ricaricaDocumenti}
            versione={versione}
            onCambio={dopoAzione}
          />
        ))}
      </div>

      {/* Messaggi tra Comune e Fondazione */}
      <Messaggi pratica={pratica} />

      {/* Feedback pubblico (fase 3): Progetti e Rapporti (Guida 3.9 e 6.3.1) */}
      <Consultazione praticaId={pratica.id} tipo={pratica.tipo} statoPratica={pratica.stato} onCambio={dopoAzione} />

      {/* Rapporti di Monitoraggio annuali del Progetto */}
      {pratica.tipo === "progetto" && (
        <Rapporti progetto={pratica} staff={staff} onApri={onApri} onCreato={onAggiornato} />
      )}

      {/* Crediti emessi dal Rapporto registrato (Guida 6.3.2-6.3.3, script 24) */}
      {pratica.tipo === "rapporto" && <CreditiEmessi rapporto={pratica} onCambio={onAggiornato} />}

      {/* Pagamenti: lo staff li gestisce, il Comune li consulta */}
      <Pagamenti praticaId={pratica.id} pratica={pratica} solaLettura={!staff} />

      {/* Documenti generali della pratica (contratto, amministrativi).
          Il Comune non può caricare sulle pratiche non attive. */}
      <Documenti key={`gen-${versione}`} praticaId={pratica.id} consentiCaricamento={staff || pratica.stato === "attiva"} />
    </div>
  );
}

/* Una fase: stato, date, azioni dello staff, integrazioni, documenti.
   Props: fase (riga della tabella fase), pratica, staff, richieste / note /
   modelli / richiesti (documenti richiesti) / documentiFase (già filtrati
   per questa fase dal genitore), versione (per
   ricaricare i documenti), onCambio() (dopo ogni azione riuscita),
   onCaricato() (dopo un caricamento di documento).
   Le azioni (apri, chiudi, richiedi integrazione, modifica scadenza)
   compaiono solo allo staff e solo su pratica attiva. */
function Fase({ fase: f, pratica, staff, richieste, note, modelli, richiesti, documentiFase, versione, onCambio, onCaricato }) {
  const [form, setForm] = useState(null); // null | "integrazione" | "scadenza" | "chiusura" | "accuratezza" | "accertamento"
  // Testo del modulo aperto: descrizione dell'integrazione o motivazione.
  const [testo, setTesto] = useState("");
  const [data, setData] = useState(f.data_prevista_chiusura || "");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const sf = STATI_FASE[f.stato] || STATI_FASE.non_iniziata;
  const aperta = f.stato === "in_corso" || f.stato === "in_attesa_integrazione";
  const attiva = pratica.stato === "attiva";
  const integrAperte = richieste.filter((r) => !r.risolta).length;
  // Giorni alla scadenza (negativi se scaduta), solo per le fasi aperte.
  const residui = aperta ? giorniA(f.data_prevista_chiusura) : null;
  // Fase di verifica documentale (2 o 6): ammette verifica sull'accuratezza
  // e accertamenti (Guida 6.5.2).
  const verificaDoc = FASI_VERIFICA_DOCUMENTALE.includes(f.numero);

  // Apre uno dei moduli inline azzerando testo ed errori.
  function apriForm(tipo) {
    setErrore("");
    setTesto("");
    setData(f.data_prevista_chiusura || "");
    setForm(tipo);
  }

  // Esegue un'azione del database (funzione che restituisce { error }).
  // In caso di errore mostra il messaggio del database (es. «La motivazione
  // è obbligatoria»); se riesce chiude il modulo e fa ricaricare la pratica.
  async function esegui(azione) {
    setErrore("");
    setInCorso(true);
    const { error } = await azione();
    setInCorso(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setForm(null);
    onCambio();
  }

  // Chiusura della fase. Senza integrazioni aperte si chiude subito; con
  // integrazioni aperte il primo clic apre il modulo «chiusura» e il secondo
  // («Chiudi comunque») invia la motivazione. La stessa regola è applicata
  // da staff_chiudi_fase nel database (script 08).
  function chiudi() {
    // Con integrazioni aperte la chiusura è un'eccezione: chiede la motivazione.
    if (integrAperte > 0 && form !== "chiusura") {
      apriForm("chiusura");
      return;
    }
    esegui(() => chiudiFase(f.id, form === "chiusura" ? testo : null));
  }

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${aperta ? C.green : C.line}`,
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div style={{ minWidth: 48, textAlign: "center" }}>
        <div style={{ fontFamily: "'Archivo'", fontWeight: 800, fontSize: 18, color: f.stato === "completata" ? C.green : C.ink }}>
          {f.numero}
        </div>
        <div style={{ fontSize: 10, color: C.grafite, fontWeight: 600 }}>FASE</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</span>
          <Badge bg={sf.bg} fg={sf.fg}>{sf.label}</Badge>
          {residui != null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: residui < 0 ? C.red : residui <= 3 ? C.amber : C.grafite }}>
              {residui < 0 ? `scaduta da ${-residui} gg` : residui === 0 ? "scade oggi" : `${residui} gg alla scadenza`}
            </span>
          )}
        </div>

        {/* Date */}
        <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 5, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {f.responsabile && <span>Responsabile: {f.responsabile}</span>}
          {f.data_apertura && <span>Aperta il {formatoData(f.data_apertura)}</span>}
          {f.data_prevista_chiusura && f.stato !== "completata" && (
            <span>Scadenza {formatoData(f.data_prevista_chiusura)}</span>
          )}
          {f.data_effettiva_chiusura && <span>Chiusa il {formatoData(f.data_effettiva_chiusura)}</span>}
          {f.verifica_accuratezza && (
            <span style={{ color: C.ocra }}>
              Verifica sull'accuratezza avviata{f.accertamenti > 0 ? ` · accertamenti: ${f.accertamenti} di 3` : ""}
            </span>
          )}
        </div>

        {/* Azioni staff */}
        {staff && attiva && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {/* Apri fase: il database imposta data di apertura = oggi e
                scadenza = oggi + giorni della fase (tabella durata_fase,
                modificabile dall'Admin in Impostazioni; script 08 e 13). */}
            {/* Rilievo N03 (script 39): la fase 5 parte solo con un ente di
                validazione e verifica assegnato; il database lo impone. */}
            {f.stato === "non_iniziata" && f.numero === 5 && !pratica.ente_validazione_id ? (
              <span style={{ fontSize: 12, color: C.ocra }}>Per aprire la fase 5 assegna prima l'ente di validazione e verifica (riquadro in alto).</span>
            ) : f.stato === "non_iniziata" && (
              <button onClick={() => esegui(() => apriFase(f.id))} disabled={inCorso} style={btnPrimario}>
                Apri fase
              </button>
            )}
            {aperta && (
              <>
                <button onClick={chiudi} disabled={inCorso} style={btnPrimario}>Chiudi fase</button>
                <button onClick={() => apriForm("integrazione")} disabled={inCorso} style={btnMini}>
                  Richiedi integrazione
                </button>
                <button onClick={() => apriForm("scadenza")} disabled={inCorso} style={btnMini}>
                  Modifica scadenza
                </button>
                {/* Guida 6.5.2: verifica sull'accuratezza (+15 gg, una volta),
                    poi fino a 3 accertamenti (+10 gg ciascuno). */}
                {verificaDoc && !f.verifica_accuratezza && (
                  <button onClick={() => apriForm("accuratezza")} disabled={inCorso} style={btnMini}>
                    Verifica sull'accuratezza (+15 gg)
                  </button>
                )}
                {verificaDoc && f.verifica_accuratezza && f.accertamenti < 3 && (
                  <button onClick={() => apriForm("accertamento")} disabled={inCorso} style={btnMini}>
                    Ulteriore accertamento (+10 gg)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Moduli inline delle azioni */}
        {form && (
          <div style={formBox}>
            {/* Richiesta di integrazione: la fase passa «in attesa di
                integrazione» e il Comune riceve la notifica (script 08, 09). */}
            {form === "integrazione" && (
              <>
                <label style={lbl}>
                  Cosa deve integrare il Cliente
                  <textarea
                    value={testo}
                    onChange={(e) => setTesto(e.target.value)}
                    rows={3}
                    style={{ ...campo, resize: "vertical" }}
                    placeholder="Es. manca la delibera tariffaria 2025 firmata"
                  />
                </label>
                <Bottoni
                  inCorso={inCorso}
                  conferma="Invia richiesta"
                  onConferma={() => esegui(() => richiediIntegrazione(f.id, testo.trim()))}
                  onAnnulla={() => setForm(null)}
                />
              </>
            )}
            {/* Modifica scadenza: motivazione obbligatoria, registrata nell'audit. */}
            {form === "scadenza" && (
              <>
                <label style={lbl}>
                  Nuova scadenza
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...campo, maxWidth: 200 }} />
                </label>
                <label style={lbl}>
                  Motivazione (obbligatoria)
                  <input value={testo} onChange={(e) => setTesto(e.target.value)} style={campo} placeholder="Es. proroga concordata con il Comune" />
                </label>
                <Bottoni
                  inCorso={inCorso}
                  conferma="Salva scadenza"
                  onConferma={() => esegui(() => modificaScadenzaFase(f.id, data || null, testo.trim()))}
                  onAnnulla={() => setForm(null)}
                />
              </>
            )}
            {(form === "accuratezza" || form === "accertamento") && (
              <>
                <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8, lineHeight: 1.5 }}>
                  {form === "accuratezza"
                    ? "La verifica sull'accuratezza aggiunge 15 giorni alla scadenza; il Comune e l'ente ne sono informati con una notifica (Guida 6.5.2)."
                    : `Accertamento n. ${(f.accertamenti || 0) + 1} di 3: aggiunge 10 giorni alla scadenza. Dopo il terzo, se le revisioni non sono soddisfacenti, la richiesta non è accettata e si può ripresentare dopo 6 mesi.`}
                </div>
                <label style={lbl}>
                  Motivazione / rilievi (obbligatoria)
                  <input value={testo} onChange={(e) => setTesto(e.target.value)} style={campo} placeholder="Es. dubbi sulla veridicità dei dati della Banca Dati Utenze" />
                </label>
                <Bottoni
                  inCorso={inCorso}
                  conferma={form === "accuratezza" ? "Avvia la verifica" : "Registra l'accertamento"}
                  onConferma={() => esegui(() => estendiVerifica(f.id, form, testo.trim()))}
                  onAnnulla={() => setForm(null)}
                />
              </>
            )}
            {form === "chiusura" && (
              <>
                <div style={{ fontSize: 12.5, color: C.ocra, marginBottom: 8 }}>
                  Ci sono {integrAperte} richieste di integrazione ancora aperte: chiudendo la fase il Cliente non potrà più integrare.
                </div>
                <label style={lbl}>
                  Motivazione (obbligatoria)
                  <input value={testo} onChange={(e) => setTesto(e.target.value)} style={campo} />
                </label>
                <Bottoni inCorso={inCorso} conferma="Chiudi comunque" onConferma={chiudi} onAnnulla={() => setForm(null)} />
              </>
            )}
          </div>
        )}
        {errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}

        <Integrazioni pratica={pratica} fase={f} richieste={richieste} onCambio={onCambio} />

        <NoteFase fase={f} pratica={pratica} note={note} staff={staff} onCambio={onCambio} />

        {/* Modelli di documento previsti per questa fase (backlog 12) */}
        {modelli.length > 0 && <ModelliFase modelli={modelli} />}

        {/* Documenti richiesti per la fase: presente / manca (script 21) */}
        {richiesti.length > 0 && <DocumentiRichiesti richiesti={richiesti} documenti={documentiFase} />}

        {/* Documenti della fase. Il Comune carica solo su pratica attiva e
            fase aperta (lo impone anche il database, policy doc_insert dello
            script 21): l'integrazione termina con la chiusura della fase. */}
        <Documenti key={`${f.id}-${versione}`} praticaId={pratica.id} fase={f} compatto consentiCaricamento={staff || (attiva && aperta)} richiesti={richiesti.map((r) => r.tipologia)} onCaricato={onCaricato} />
      </div>
    </div>
  );
}

/* Modelli da scaricare per la fase (caricati dall'Amministratore in Impostazioni).
   Props: modelli (righe di modello_documento con fase_numero uguale alla
   fase; solo quelli attivi, filtrati dalle RLS per chi non è Admin). */
function ModelliFase({ modelli }) {
  // Scarica il modello con un collegamento temporaneo (archivio «modelli»).
  async function scarica(m) {
    const { data } = await urlModello(m.storage_path);
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>Modelli da scaricare</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {modelli.map((m) => (
          <button key={m.id} onClick={() => scarica(m)} title={m.descrizione || ""} style={{ ...btnMini, color: C.green }}>
            ↓ {m.titolo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Documenti richiesti per la fase (configurati dall'Amministratore in
   Impostazioni, script 21). Una voce è «presente» se nella fase c'è almeno
   un documento corrente con quella tipologia. È solo un indicatore: non
   blocca la chiusura della fase (decisione di Luca del 18/10/2026).
   Props: richiesti (voci di documento_richiesto per questo tipo e numero di
   fase), documenti (documenti della fase visibili a chi guarda). */
function DocumentiRichiesti({ richiesti, documenti }) {
  const presenti = new Set(documenti.filter((d) => d.corrente).map((d) => d.tipologia));
  const mancano = richiesti.filter((r) => !presenti.has(r.tipologia)).length;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>
        Documenti richiesti {mancano === 0 ? "· tutti presenti" : `· ne mancano ${mancano}`}
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {richiesti.map((r) => {
          const ok = presenti.has(r.tipologia);
          return (
            <div key={r.id} style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, color: ok ? C.green : C.amber, minWidth: 64 }}>{ok ? "✓ presente" : "○ manca"}</span>
              <span>
                {r.tipologia}
                {r.descrizione && <span style={{ color: C.grafite }}> — {r.descrizione}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Dati del Progetto o del Rapporto (script 23): territorio con i codici
   ISTAT dei Comuni (un solo progetto per territorio, Standard 4.6),
   co-promotori (Guida 3.3.1), periodo di riferimento (Standard 4.3.8),
   popolazione e crediti previsti (per le tariffe dello Schema tariffario),
   data di registrazione (Standard 4.5: data di inizio del progetto) e, dal
   23/10/2026, il listino del Progetto (Caso 1 o Caso 2, script 43; obbligatorio dal 25/10, script 47) con il
   valore del progetto per il cliente (valoreProgettoCaso di simulatore.js).
   Il Comune li vede; lo staff li modifica con staff_aggiorna_dati_pratica.
   Props: pratica, staff, onFatto() dopo il salvataggio. */
function DatiPratica({ pratica, staff, onFatto }) {
  const progetto = pratica.tipo === "progetto";
  // null = modulo chiuso; altrimenti i valori in modifica (testi).
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  function apri() {
    setErrore("");
    setModulo({
      codici: (pratica.codici_istat || []).join(", "),
      copromotori: (pratica.copromotori || []).join("\n"),
      periodo: pratica.periodo_riferimento || "10 anni",
      popolazione: pratica.popolazione ?? "",
      crediti: pratica.crediti_previsti ?? "",
      caso: pratica.caso_listino || "",
      motivazione: "",
    });
  }

  // Salva: i codici ISTAT si separano con virgole o spazi, i co-promotori
  // uno per riga. Il database controlla formato e unicità del territorio.
  async function salva() {
    setErrore("");
    if (progetto && !modulo.caso) return setErrore("Scegli il listino: Caso 1 (progetto volontario) o Caso 2 (obbligatorio da bando di gara).");
    setInCorso(true);
    const dati = { popolazione: String(modulo.popolazione).trim(), crediti_previsti: String(modulo.crediti).trim() };
    if (progetto) {
      dati.codici_istat = modulo.codici.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
      dati.copromotori = modulo.copromotori.split("\n").map((c) => c.trim()).filter(Boolean);
      dati.periodo_riferimento = modulo.periodo;
      dati.caso_listino = modulo.caso;
    }
    const { error } = await aggiornaDatiPratica(pratica.id, dati, modulo.motivazione.trim() || null);
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    onFatto();
  }

  const riga = (etichetta, valore) => (
    <div style={{ fontSize: 12.5 }}>
      <span style={{ color: C.grafite }}>{etichetta}: </span>
      <b style={{ color: C.ink, fontWeight: 600 }}>{valore}</b>
    </div>
  );
  const numero = (n) => (n == null ? "—" : Number(n).toLocaleString("it-IT"));

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "4px 16px" }}>
        {progetto && riga("Territorio (codici ISTAT)", (pratica.codici_istat || []).join(", ") || "da indicare")}
        {progetto && (pratica.copromotori || []).length > 0 && riga("Co-promotori", pratica.copromotori.join(", "))}
        {riga("Periodo di riferimento", PERIODI_RIFERIMENTO[pratica.periodo_riferimento]?.label || pratica.periodo_riferimento || "10 anni")}
        {riga("Popolazione residente", numero(pratica.popolazione))}
        {riga(progetto ? "Crediti previsti nel periodo" : "Crediti previsti nell'anno", numero(pratica.crediti_previsti))}
        {pratica.data_registrazione && riga(progetto ? "Registrato il" : "Crediti registrati il", formatoData(pratica.data_registrazione))}
        {progetto && riga("Listino", CASI_COSTI[pratica.caso_listino] || "da indicare")}
        {progetto && (() => {
          const v = valoreProgettoCaso(pratica.caso_listino, pratica.popolazione, pratica.periodo_riferimento);
          const e = (x) => x.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
          return v ? riga("Valore del progetto per il cliente", `${e(v.totale)} in ${v.anni} anni (${e(v.annuo)} all'anno)${v.stima ? ", stima" : ""}`) : null;
        })()}
      </div>
      {staff && !modulo && (
        <button onClick={apri} style={{ ...linkBtn, marginTop: 8 }}>Modifica i dati</button>
      )}
      {staff && modulo && (
        <div style={formBox}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {progetto && (
              <label style={lbl}>
                Codici ISTAT dei Comuni (6 cifre)
                <input value={modulo.codici} onChange={(e) => setModulo({ ...modulo, codici: e.target.value })} style={campo} placeholder="Es. 041044, 041001" />
              </label>
            )}
            {progetto && (
              <label style={lbl}>
                Periodo di riferimento
                <select value={modulo.periodo} onChange={(e) => setModulo({ ...modulo, periodo: e.target.value })} style={campo}>
                  {Object.entries(PERIODI_RIFERIMENTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            )}
            {progetto && (
              <label style={lbl}>
                Listino (quanto paga il cliente)
                <select value={modulo.caso} onChange={(e) => setModulo({ ...modulo, caso: e.target.value })} style={campo}>
                  {/* Obbligatorio dal 25/10/2026 (script 47): nessuna voce «da indicare». */}
                  {!modulo.caso && <option value="" disabled>— scegli —</option>}
                  {Object.entries(CASI_COSTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            )}
            <label style={lbl}>
              Popolazione residente
              <input type="number" min="0" value={modulo.popolazione} onChange={(e) => setModulo({ ...modulo, popolazione: e.target.value })} style={campo} />
            </label>
            <label style={lbl}>
              {progetto ? "Crediti previsti nel periodo" : "Crediti previsti nell'anno"}
              <input type="number" min="0" value={modulo.crediti} onChange={(e) => setModulo({ ...modulo, crediti: e.target.value })} style={campo} />
            </label>
          </div>
          {progetto && (
            <label style={lbl}>
              Altri soggetti promotori del progetto (uno per riga, Guida 3.3.1)
              <textarea rows={2} value={modulo.copromotori} onChange={(e) => setModulo({ ...modulo, copromotori: e.target.value })} style={{ ...campo, resize: "vertical" }} />
            </label>
          )}
          <label style={lbl}>
            Motivazione (facoltativa, nell'audit)
            <input value={modulo.motivazione} onChange={(e) => setModulo({ ...modulo, motivazione: e.target.value })} style={campo} placeholder="Es. dati del Modulo di descrizione del progetto" />
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <Bottoni inCorso={inCorso} conferma="Salva i dati" onConferma={salva} onAnnulla={() => setModulo(null)} />
        </div>
      )}
    </div>
  );
}

/* Ente di Validazione della pratica: il Comune lo vede, lo staff lo assegna.
   Props: pratica (con l'ente collegato), staff, onFatto() dopo il salvataggio.
   L'assegnazione passa da staff_imposta_ente_validazione (script 17), che
   accetta solo enti attivi e solo dallo staff. L'anagrafica degli enti si
   gestisce nella pagina Anagrafiche (impostazioni/EntiValidazione.jsx). */
function EnteValidazione({ pratica, staff, onFatto }) {
  // null = selettore chiuso; un elenco = selettore aperto con quegli enti.
  const [enti, setEnti] = useState(null);
  const [scelta, setScelta] = useState(pratica.ente_validazione_id || "");
  const [errore, setErrore] = useState("");

  // Apre il selettore: enti attivi più quello già assegnato (anche se
  // disattivato nel frattempo, per non farlo sparire dalla scelta).
  async function modifica() {
    const { data } = await elencaEnti();
    setEnti((data || []).filter((e) => e.attivo || e.id === pratica.ente_validazione_id));
  }
  // Salva la scelta; «— nessuno —» toglie l'ente dalla pratica.
  async function salva() {
    setErrore("");
    if (progetto && !modulo.caso) return setErrore("Scegli il listino: Caso 1 (progetto volontario) o Caso 2 (obbligatorio da bando di gara).");
    const { error } = await impostaEntePratica(pratica.id, scelta || null);
    if (error) return setErrore(error.message);
    setEnti(null);
    onFatto();
  }

  if (!staff && !pratica.ente) return null;
  return (
    <div style={{ marginTop: 12, fontSize: 12.5, color: C.grafite, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span>Ente di validazione e verifica: <b style={{ color: C.ink }}>{pratica.ente?.denominazione || "non assegnato"}</b></span>
      {staff && !enti && <button onClick={modifica} style={{ ...linkBtn, marginTop: 0 }}>{pratica.ente ? "Cambia" : "Assegna"}</button>}
      {staff && enti && (
        <>
          <select value={scelta} onChange={(e) => setScelta(e.target.value)} style={{ ...campo, width: "auto" }}>
            <option value="">— nessuno —</option>
            {enti.map((e) => <option key={e.id} value={e.id}>{e.denominazione}</option>)}
          </select>
          <button onClick={salva} style={btnPrimario}>Salva</button>
          <button onClick={() => setEnti(null)} style={btnMini}>Annulla</button>
          {enti.length === 0 && <span>Nessun ente censito: si inseriscono nella pagina Anagrafiche.</span>}
        </>
      )}
      {errore && <span style={{ color: C.red }}>{errore}</span>}
    </div>
  );
}

/* Cambio di stato della pratica con motivazione obbligatoria (solo staff).
   Props: pratica, onFatto() dopo il cambio.
   Stati: attiva, sospesa, annullata, chiusa e, solo per i Progetti,
   ritirata (Guida 6.4.1: ritiro su lettera del promotore; da «ritirata»
   si torna solo ad «attiva», cioè il rientro nel Programma). «Annullata» è
   definitiva: il database rifiuta ogni cambio successivo
   (staff_cambia_stato_pratica, script 23), per questo qui non si mostrano
   pulsanti. La motivazione
   viene salvata sulla pratica (motivazione_stato) e nell'audit. */
function CambioStato({ pratica, onFatto }) {
  const [aperto, setAperto] = useState(false);
  const [stato, setStato] = useState("");
  const [motivazione, setMotivazione] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  if (pratica.stato === "annullata") return null;

  // Passaggi proposti per ogni stato attuale. Il database accetta qualunque
  // passaggio tranne da «annullata»: questa tabella è una scelta di interfaccia
  // (es. una pratica chiusa si può solo riattivare).
  const progetto = pratica.tipo === "progetto";
  const opzioni = ({
    attiva: ["sospesa", "annullata", "chiusa", ...(progetto ? ["ritirata"] : [])],
    sospesa: ["attiva", "annullata", "chiusa", ...(progetto ? ["ritirata"] : [])],
    chiusa: ["attiva", ...(progetto ? ["ritirata"] : [])],
    ritirata: ["attiva"],
  }[pratica.stato] || []);
  const etichette = {
    attiva: pratica.stato === "ritirata" ? "Rientro nel Programma" : "Riattiva",
    sospesa: "Sospendi (anche per controllo di qualità)",
    annullata: "Annulla",
    chiusa: "Chiudi pratica",
    ritirata: "Ritira il progetto",
  };

  // Invia il cambio di stato. Effetto: il database notifica il Comune e
  // registra l'operazione nell'audit con la motivazione.
  async function conferma() {
    setErrore("");
    setInCorso(true);
    const { error } = await cambiaStatoPratica(pratica.id, stato, motivazione.trim());
    setInCorso(false);
    if (error) setErrore(error.message);
    else {
      setAperto(false);
      onFatto();
    }
  }

  // Modulo chiuso: una fila di pulsanti, uno per ogni stato possibile.
  if (!aperto) {
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {opzioni.map((o) => (
          <button
            key={o}
            onClick={() => {
              setStato(o);
              setMotivazione("");
              setErrore("");
              setAperto(true);
            }}
            style={{ ...btnMini, color: o === "annullata" ? C.red : C.grafite }}
          >
            {etichette[o]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={formBox}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {etichette[stato]}: la pratica passerà a «{STATI_PRATICA[stato]?.label}»
        {stato === "annullata" && <span style={{ color: C.red }}> — operazione definitiva</span>}
      </div>
      {stato === "ritirata" && (
        <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8, lineHeight: 1.5 }}>
          Su lettera di tutti i promotori del progetto (nome, ID, motivo). Il progetto resta pubblico ma non emette più
          crediti; può rientrare con una nuova lettera (Guida 6.4.1). Indica nella motivazione gli estremi della lettera.
        </div>
      )}
      {stato === "sospesa" && (
        <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8, lineHeight: 1.5 }}>
          La sospensione ferma anche l'emissione dei crediti: si usa per il controllo di qualità della Guida 6.4.2.
        </div>
      )}
      <label style={lbl}>
        Motivazione (obbligatoria)
        <input value={motivazione} onChange={(e) => setMotivazione(e.target.value)} style={campo} />
      </label>
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
      <Bottoni inCorso={inCorso} conferma="Conferma" onConferma={conferma} onAnnulla={() => setAperto(false)} />
    </div>
  );
}

/* Export del fascicolo completo (ZIP, requisiti §11).
   Props: praticaId, staff. Lo staff ottiene anche pagamenti e audit; il
   Comune solo ciò che le RLS gli lasciano leggere («Scarica documentazione»).
   Il file ZIP è costruito nel browser da src/lib/fascicolo.js. */
function BottoneFascicolo({ praticaId, staff }) {
  // stato: "" = fermo; un testo di avanzamento = in lavorazione (mostrato sul
  // pulsante); "Scaricato (…)" = finito con file mancanti (avviso sotto).
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState("");
  // Avvia l'export; onAvanzamento aggiorna il testo del pulsante passo per passo.
  async function esporta() {
    setErrore("");
    setStato("Avvio…");
    try {
      const esito = await esportaFascicolo(praticaId, { staff, onAvanzamento: setStato });
      setStato(esito.mancanti.length ? `Scaricato (${esito.mancanti.length} file non recuperati)` : "");
    } catch (e) {
      setStato("");
      setErrore("Export non riuscito: " + e.message);
    }
  }
  const lavora = stato && !stato.startsWith("Scaricato");
  return (
    <div style={{ textAlign: "right" }}>
      <button onClick={esporta} disabled={lavora} style={btnMini}>
        {lavora ? stato : staff ? "Esporta fascicolo" : "Scarica documentazione"}
      </button>
      {stato.startsWith("Scaricato") && <div style={{ fontSize: 11.5, color: C.amber, marginTop: 4 }}>{stato}</div>}
      {errore && <div style={{ fontSize: 11.5, color: C.red, marginTop: 4 }}>{errore}</div>}
    </div>
  );
}

// Coppia di pulsanti dei moduli inline: conferma (testo in «conferma») e Annulla.
function Bottoni({ inCorso, conferma, onConferma, onAnnulla }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onConferma} disabled={inCorso} style={btnPrimario}>
        {inCorso ? "…" : conferma}
      </button>
      <button onClick={onAnnulla} style={btnMini}>Annulla</button>
    </div>
  );
}

// Riquadro centrato per i messaggi «Caricamento…» e «Pratica non trovata».
function Pannello({ children }) {
  return (
    <div style={{ ...riquadro, padding: "40px 28px", textAlign: "center", color: C.grafite }}>
      {children}
    </div>
  );
}

// Stili locali (simili a quelli di stili.js, ma con misure proprie).
const linkBtn = {
  background: "none",
  border: "none",
  padding: 0,
  marginTop: 6,
  color: C.green,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const riquadro = {
  background: C.white,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  padding: "22px 24px",
};
const formBox = {
  marginTop: 12,
  padding: 12,
  background: C.paper,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
};
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 10 };
const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: C.white,
};
const btnPrimario = {
  background: C.green,
  color: C.white,
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const btnMini = {
  background: C.white,
  color: C.grafite,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
