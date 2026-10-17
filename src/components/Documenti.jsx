import React, { useEffect, useRef, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  elencaDocumenti,
  caricaDocumento,
  urlDocumento,
  registraAudit,
} from "../lib/dati.js";

/* Gestione documentale di una pratica: elenco versionato e upload.
   Il cliente carica le proprie; lo staff carica e imposta la visibilità. */
export default function Documenti({ praticaId }) {
  const { ruolo, utente } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";

  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [inUpload, setInUpload] = useState(false);
  const [errore, setErrore] = useState("");
  const inputRef = useRef(null);

  async function carica() {
    setCaricamento(true);
    const { data } = await elencaDocumenti(praticaId);
    setDocumenti(data || []);
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore("");
    setInUpload(true);
    const { data, error } = await caricaDocumento({
      praticaId,
      file,
      visibileCliente: true,
      visibileFondazione: true,
      pubblico: false,
      utenteId: utente?.id,
    });
    if (error) {
      setErrore("Caricamento non riuscito: " + error.message);
    } else {
      await registraAudit({
        utente_id: utente?.id,
        ruolo,
        operazione: "caricamento documento",
        oggetto_tipo: "documento",
        oggetto_id: data.id,
        stato_successivo: `v${data.versione}`,
      });
      await carica();
    }
    setInUpload(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function scarica(doc) {
    const { data } = await urlDocumento(doc.storage_path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Documenti</h3>
        <label
          style={{
            background: inUpload ? C.line : C.green,
            color: C.white,
            borderRadius: 8,
            padding: "7px 13px",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: inUpload ? "default" : "pointer",
          }}
        >
          {inUpload ? "Caricamento…" : "+ Carica documento"}
          <input
            ref={inputRef}
            type="file"
            onChange={onFile}
            disabled={inUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>

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
                  {d.pubblico && <Badge bg={C.ocraSoft} fg={C.amber}>pubblico</Badge>}
                </div>
                <div style={{ fontSize: 11, color: C.grafite, marginTop: 2 }}>
                  {new Date(d.creato_il).toLocaleString("it-IT")}
                  {staff && d.hash_file && <> · hash {d.hash_file.slice(0, 10)}…</>}
                </div>
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

      <p style={{ fontSize: 11, color: C.grafite, marginTop: 12, lineHeight: 1.5 }}>
        Ogni caricamento crea una nuova versione. Le versioni precedenti restano
        consultabili e nessun documento viene mai sovrascritto.
      </p>
    </div>
  );
}
