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
   - fase: se passata, i documenti sono filtrati e legati a quella fase
   - altrimenti mostra i documenti generali della pratica (senza fase)
   Il cliente carica le proprie; lo staff carica e imposta la visibilità. */
export default function Documenti({ praticaId, fase = null, compatto = false }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  const faseId = fase ? fase.id : null; // null = documenti generali

  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [inUpload, setInUpload] = useState(false);
  const [errore, setErrore] = useState("");
  const inputRef = useRef(null);
  // Opzioni di caricamento dello staff (il Cliente non sceglie la visibilità).
  const [opzioni, setOpzioni] = useState(false);
  const [tipologia, setTipologia] = useState(fase ? "Documento di progetto" : "Contratto");
  const [visCliente, setVisCliente] = useState(true);
  const [pubblico, setPubblico] = useState(false);

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

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore("");
    setInUpload(true);
    const { data, error } = await caricaDocumento({
      praticaId,
      faseId,
      file,
      tipologia: staff ? tipologia : null,
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
    }
    setInUpload(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function cambiaVisibilita(doc, flag) {
    setErrore("");
    const { error } = await aggiornaVisibilitaDocumento(doc.id, flag);
    if (error) setErrore("Visibilità non aggiornata: " + error.message);
    else carica();
  }

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
        {staff && !opzioni ? (
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

      <div style={{ fontSize: 11.5, color: C.grafite, margin: "-6px 0 10px" }}>Formati accettati: {FORMATI_LEGGIBILI}</div>

      {/* Opzioni dello staff prima di scegliere il file */}
      {staff && opzioni && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: 10, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 10, fontSize: 12.5 }}>
          <select value={tipologia} onChange={(e) => setTipologia(e.target.value)} aria-label="Tipologia del documento" style={{ padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }}>
            {TIPOLOGIE_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}
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
