/* =========================================================================
   Documenti
   Scopo: gestione documentale di una pratica: elenco con versioni,
     caricamento di nuovi file e download. Lo staff sceglie anche tipologia
     e visibilità (Cliente, Pubblico) e può cambiarle dopo il caricamento.
     Due usi: documenti di una fase (prop fase) o documenti generali della
     pratica (contratto, amministrativi: senza fase).
   Usato da: DettaglioPratica.jsx (sotto ogni fase, in forma compatta, e
     nel riquadro «Documenti generali»).
   Chi lo vede: cliente/Comune (carica e scarica i documenti visibili a
     lui), operatore e admin (tutti i documenti, visibilità, hash).
   Dati: elencaDocumenti, caricaDocumento, urlDocumento,
     aggiornaVisibilitaDocumento (src/lib/dati.js); tabella documento,
     archivio privato «documenti»; controlli sui file in src/lib/file.js.
   Sicurezza (garantita dal database):
     - versione e «corrente» li calcola un trigger (script 07): un nuovo
       file con lo stesso nome nella stessa pratica è la versione successiva,
       la precedente diventa non corrente. Nulla viene sovrascritto;
     - il Cliente non sceglie la visibilità: il trigger forza
       visibile_cliente = true e pubblico = false (script 07);
     - il Cliente vede solo i documenti visibili a lui o pubblici, e i file
       nell'archivio con le stesse regole (script 02, 04, 07);
     - il Cliente non può caricare su pratiche non attive (script 08);
     - formati, dimensione (50 MB) e contenuto sono controllati anche
       dall'archivio (script 14), non solo da src/lib/file.js;
     - solo lo staff modifica la visibilità (RLS doc_update).
     Notifiche (create dal database, script 09/17): un caricamento del
     Comune avvisa lo staff; uno dello staff avvisa il Comune solo se il
     documento è visibile al Cliente o pubblico.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { COLORI as C, TIPOLOGIE_DOCUMENTO } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  elencaDocumenti,
  caricaDocumento,
  urlDocumento,
  aggiornaVisibilitaDocumento,
} from "../lib/dati.js";
import { ACCEPT, FORMATI_LEGGIBILI } from "../lib/file.js";

/* Gestione documentale: elenco versionato e upload.
   Props:
   - praticaId: id della pratica;
   - fase: se passata, i documenti sono filtrati e legati a quella fase;
     altrimenti mostra i documenti generali della pratica (senza fase);
   - compatto: true sotto una fase (niente riquadro, titolo più piccolo);
   - consentiCaricamento: false per il Comune sulle pratiche non attive
     (sospese, annullate, chiuse) e sulle fasi non aperte: il pulsante
     «+ Carica» non compare (backlog 24; il database rifiuta comunque il
     caricamento, script 08 e 21).
   - richiesti: tipologie dei documenti richiesti per la fase (script 21);
     compaiono per prime nel menu della tipologia e, se ci sono, anche il
     Comune sceglie la tipologia del file (serve all'indicatore
     «presente / manca» della fase);
   - onCaricato(): facoltativa, chiamata dopo un caricamento riuscito (la
     pratica aggiorna l'indicatore dei documenti richiesti).
   Il cliente carica i propri; lo staff carica e imposta la visibilità. */
export default function Documenti({ praticaId, fase = null, compatto = false, consentiCaricamento = true, richiesti = [], onCaricato }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const faseId = fase ? fase.id : null; // null = documenti generali

  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [inUpload, setInUpload] = useState(false);
  const [errore, setErrore] = useState("");
  const inputRef = useRef(null);
  // Opzioni di caricamento dello staff (il Cliente non sceglie la visibilità).
  // opzioni = true: lo staff ha premuto «+ Carica» e vede la barra delle
  // opzioni con il pulsante «Scegli il file».
  const [opzioni, setOpzioni] = useState(false);
  // Voci del menu della tipologia: prima i documenti richiesti dalla fase.
  const opzioniTipologia = [...new Set([...richiesti, ...TIPOLOGIE_DOCUMENTO])];
  const [tipologia, setTipologia] = useState(richiesti[0] || (fase ? "Documento di progetto" : "Contratto"));
  // Il Comune sceglie la tipologia solo se la fase ha documenti richiesti.
  const clienteSceglie = !staff && richiesti.length > 0;
  const [visCliente, setVisCliente] = useState(true);
  const [pubblico, setPubblico] = useState(false);

  // Rilegge l'elenco (tutte le versioni, dalla più recente). Con faseId
  // null si leggono solo i documenti generali.
  async function carica() {
    setCaricamento(true);
    const { data } = await elencaDocumenti(praticaId, faseId);
    setDocumenti(data || []);
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId, faseId]);

  // File scelto: lo carica come nuova versione. Per il Cliente si inviano i
  // valori fissi (visibile, non pubblico), che il database impone comunque.
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore("");
    setInUpload(true);
    const { data, error } = await caricaDocumento({
      praticaId,
      faseId,
      file,
      tipologia: staff || clienteSceglie ? tipologia : null,
      visibileCliente: staff ? visCliente : true,
      visibileFondazione: true,
      pubblico: staff ? pubblico : false,
      utenteId: utente?.id,
    });
    setOpzioni(false);
    if (error) {
      setErrore("Caricamento non riuscito: " + error.message);
    } else {
      await carica();
      onCaricato && onCaricato();
    }
    setInUpload(false);
    // Svuota il selettore: così si può ricaricare anche lo stesso file.
    if (inputRef.current) inputRef.current.value = "";
  }

  // Staff: cambia una visibilità del documento. flag è un oggetto con il
  // campo da aggiornare, es. { visibile_cliente: false } o { pubblico: true }.
  // La modifica è registrata nell'audit dal database.
  async function cambiaVisibilita(doc, flag) {
    setErrore("");
    const { error } = await aggiornaVisibilitaDocumento(doc.id, flag);
    if (error) setErrore("Visibilità non aggiornata: " + error.message);
    else carica();
  }

  // Apre il file con un collegamento temporaneo (valido 60 secondi).
  async function scarica(doc) {
    const { data } = await urlDocumento(doc.storage_path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const titolo = fase ? "Documenti della fase" : "Documenti generali";

  return (
    <div
      style={
        compatto
          ? { marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.line}` }
          : { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compatto ? 10 : 14 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: compatto ? 13 : 15, margin: 0, color: compatto ? C.grafite : C.ink }}>
          {titolo}
        </h3>
        {/* Tre casi: caricamento non consentito → niente; staff → prima
            «+ Carica» (apre le opzioni) e poi «Scegli il file»; Cliente →
            «+ Carica» apre subito la scelta del file. */}
        {!consentiCaricamento ? null : staff && !opzioni ? (
          <button
            onClick={() => setOpzioni(true)}
            style={{
              background: C.green,
              color: C.white,
              border: "none",
              borderRadius: 8,
              padding: compatto ? "5px 10px" : "7px 13px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Carica
          </button>
        ) : (
        <label
          style={{
            background: inUpload ? C.line : C.green,
            color: C.white,
            borderRadius: 8,
            padding: compatto ? "5px 10px" : "7px 13px",
            fontSize: 12,
            fontWeight: 600,
            cursor: inUpload ? "default" : "pointer",
          }}
        >
          {inUpload ? "Caricamento…" : staff ? "Scegli il file" : "+ Carica"}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onFile}
            disabled={inUpload}
            style={{ display: "none" }}
          />
        </label>
        )}
      </div>

      {consentiCaricamento && <div style={{ fontSize: 11.5, color: C.grafite, margin: "-6px 0 10px" }}>Formati accettati: {FORMATI_LEGGIBILI}</div>}

      {/* Comune: quale dei documenti richiesti sta caricando */}
      {consentiCaricamento && clienteSceglie && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}>
          Che documento state caricando?
          <select value={tipologia} onChange={(e) => setTipologia(e.target.value)} style={{ padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }}>
            {opzioniTipologia.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      )}

      {/* Opzioni dello staff prima di scegliere il file */}
      {staff && opzioni && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: 10, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 10, fontSize: 12.5 }}>
          <select value={tipologia} onChange={(e) => setTipologia(e.target.value)} aria-label="Tipologia del documento" style={{ padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }}>
            {opzioniTipologia.map((t) => <option key={t}>{t}</option>)}
          </select>
          <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input type="checkbox" checked={visCliente} onChange={(e) => setVisCliente(e.target.checked)} /> Visibile al Cliente
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input type="checkbox" checked={pubblico} onChange={(e) => setPubblico(e.target.checked)} /> Pubblico
          </label>
          <span style={{ flex: 1 }} />
          <button onClick={() => setOpzioni(false)} style={{ background: "none", border: "none", color: C.grafite, fontSize: 12.5, cursor: "pointer" }}>Annulla</button>
        </div>
      )}

      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{errore}</div>}

      {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}

      {!caricamento && documenti.length === 0 && (
        <div style={{ color: C.grafite, fontSize: 13, padding: "8px 0" }}>
          Nessun documento caricato.
        </div>
      )}

      {documenti.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Le versioni non correnti restano in elenco, attenuate. */}
          {documenti.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                background: d.corrente ? C.white : "#faf8f3",
                opacity: d.corrente ? 1 : 0.75,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.nome}
                  </span>
                  <Badge bg={C.greenSoft} fg={C.green}>v{d.versione}</Badge>
                  {d.corrente && <Badge bg="#dfe9db" fg={C.green}>corrente</Badge>}
                  {d.tipologia && <Badge bg={C.paperWarm} fg={C.grafite}>{d.tipologia}</Badge>}
                  {d.pubblico && <Badge bg={C.ocraSoft} fg={C.amber}>pubblico</Badge>}
                  {staff && !d.visibile_cliente && <Badge bg="#e8e8e2" fg={C.grafite}>solo Fondazione</Badge>}
                </div>
                <div style={{ fontSize: 11, color: C.grafite, marginTop: 2 }}>
                  {new Date(d.creato_il).toLocaleString("it-IT")}
                  {/* Primi caratteri dell'impronta SHA-256 calcolata al caricamento. */}
                  {staff && d.hash_file && <> · hash {d.hash_file.slice(0, 10)}…</>}
                </div>
                {staff && (
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11.5, color: C.grafite }}>
                    <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={d.visibile_cliente} onChange={(e) => cambiaVisibilita(d, { visibile_cliente: e.target.checked })} />
                      Cliente
                    </label>
                    <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={d.pubblico} onChange={(e) => cambiaVisibilita(d, { pubblico: e.target.checked })} />
                      Pubblico
                    </label>
                  </div>
                )}
              </div>
              <button
                onClick={() => scarica(d)}
                style={{
                  background: "transparent",
                  color: C.green,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Scarica
              </button>
            </div>
          ))}
        </div>
      )}

      {!compatto && (
        <p style={{ fontSize: 11, color: C.grafite, marginTop: 12, lineHeight: 1.5 }}>
          Ogni caricamento crea una nuova versione. Le versioni precedenti restano
          consultabili e nessun documento viene mai sovrascritto.
        </p>
      )}
    </div>
  );
}
