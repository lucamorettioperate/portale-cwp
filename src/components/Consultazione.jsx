import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import {
  leggiConsultazione,
  apriConsultazione,
  chiudiConsultazione,
  moderaCommento,
  rispondiCommento,
  elencaDocumenti,
  elencaErrata,
  pubblicaErrataCorrige,
  autoriCommenti,
  urlAllegatoCommento,
  urlDocumento,
} from "../lib/dati.js";
import { formatoData, giorniA } from "../lib/date.js";
import { campo, etichetta, btnPrimario, btnMini, btnLink, dataOra } from "./stili.js";

/* Consultazione pubblica (fase 3, requisiti §6).
   - Lo staff apre la consultazione pubblicando un documento per 30 giorni,
     modera le osservazioni, pubblica errata corrige e la chiude.
   - Le osservazioni arrivano dalla pagina pubblica /consultazioni/<id>,
     solo dopo che l'autore ha confermato la propria email (decisione D):
     nel portale non si scrivono più osservazioni.
   - Lo staff vede nome ed email degli autori; il Comune vede solo le
     osservazioni ammesse, firmate «Partecipante» (o con il nome, se
     l'autore ha acconsentito), e risponde.
   - Errata corrige: lo staff decide caso per caso se far ripartire i 30
     giorni, con motivazione (decisione B). */
export default function Consultazione({ praticaId }) {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";

  const [cons, setCons] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const [docSel, setDocSel] = useState("");
  const [errata, setErrata] = useState([]);
  const [autori, setAutori] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  const [azione, setAzione] = useState(false);
  const [errore, setErrore] = useState("");

  async function carica() {
    setCaricamento(true);
    const { data } = await leggiConsultazione(praticaId);
    setCons(data);
    const { data: docs } = await elencaDocumenti(praticaId);
    setDocumenti(docs || []);
    if (!data && docs && docs.length) setDocSel(docs[0].id);
    if (data) {
      const { data: er } = await elencaErrata(data.id);
      setErrata(er || []);
      if (staff) {
        const { data: au } = await autoriCommenti(data.id);
        setAutori(Object.fromEntries((au || []).map((a) => [a.commento_id, a])));
      }
    }
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  if (caricamento) return <Riquadro>Caricamento…</Riquadro>;

  const residui = cons?.data_chiusura ? giorniA(cons.data_chiusura) : null;
  const linkPubblico = cons ? `${window.location.origin}/consultazioni/${cons.id}` : "";

  async function esegui(fn) {
    setAzione(true);
    setErrore("");
    const { error } = (await fn()) || {};
    if (error) setErrore(error.message);
    await carica();
    setAzione(false);
    return !error;
  }

  async function apri(path) {
    const { data } = await urlDocumento(path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function apriAllegato(path) {
    const { data } = await urlAllegatoCommento(path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  // Il Comune vede solo le osservazioni ammesse; lo staff tutte.
  const commentiVisibili = (cons?.commenti || []).filter(
    (c) => staff || c.stato === "pubblicato" || c.stato === "risposto"
  );
  const docConsultazione = documenti.find((d) => d.id === cons?.documento_id);

  return (
    <Riquadro>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Consultazione pubblica</h3>
        {cons && (
          <Badge bg={cons.attiva ? C.greenSoft : C.paperWarm} fg={cons.attiva ? C.green : C.grafite}>
            {cons.attiva ? "Attiva" : "Chiusa"}
          </Badge>
        )}
      </div>

      {/* Nessuna consultazione: lo staff può aprirla */}
      {!cons && (
        staff ? (
          documenti.length ? (
            <div>
              <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 10px" }}>
                Pubblica un documento per avviare la consultazione di 30 giorni sulla pagina pubblica del portale.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={docSel} onChange={(e) => setDocSel(e.target.value)} style={{ ...campo, width: "auto", minWidth: 260 }}>
                  {documenti.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome} (v{d.versione})</option>
                  ))}
                </select>
                <button onClick={() => docSel && esegui(() => apriConsultazione({ praticaId, documentoId: docSel }))} disabled={azione} style={btnPrimario}>
                  Apri consultazione
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>Carica prima un documento per poterlo pubblicare in consultazione.</p>
          )
        ) : (
          <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>Nessuna consultazione pubblica in corso.</p>
        )
      )}

      {cons && (
        <div>
          <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 10, lineHeight: 1.6 }}>
            Dal {formatoData(cons.data_apertura)} al {formatoData(cons.data_chiusura)}
            {cons.attiva && residui != null && (
              <> · <b style={{ color: C.ink }}>{residui > 0 ? `${residui} giorni rimanenti` : residui === 0 ? "ultimo giorno" : "periodo terminato"}</b></>
            )}
            {docConsultazione && (
              <> · Documento: <button onClick={() => apri(docConsultazione.storage_path)} style={btnLink}>{docConsultazione.nome} (v{docConsultazione.versione})</button></>
            )}
            <br />
            Pagina pubblica: <a href={linkPubblico} target="_blank" rel="noreferrer" style={{ color: C.green, fontWeight: 600 }}>{linkPubblico.replace(/^https?:\/\//, "")}</a>
            {" "}— chiunque può leggere e inviare osservazioni confermando la propria email.
          </div>

          {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

          {/* Errata corrige */}
          {(errata.length > 0 || (staff && cons.attiva)) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>Errata corrige</div>
              {errata.map((e) => (
                <div key={e.id} style={{ fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                  <div style={{ fontSize: 11.5, color: C.grafite }}>
                    {dataOra(e.creato_il)}
                    {e.riparte && <> · <b style={{ color: C.ocra }}>i 30 giorni sono ripartiti: chiusura il {formatoData(e.nuova_chiusura)}</b></>}
                  </div>
                  <div style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{e.testo}</div>
                  {e.documento && (
                    <button onClick={() => apri(e.documento.storage_path)} style={{ ...btnLink, marginTop: 4 }}>
                      {e.documento.nome} (v{e.documento.versione})
                    </button>
                  )}
                  {staff && e.motivazione && <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 3 }}>Motivazione: {e.motivazione}</div>}
                </div>
              ))}
              {staff && cons.attiva && <ModuloErrata cons={cons} documenti={documenti} inCorso={azione} onPubblica={(d) => esegui(() => pubblicaErrataCorrige({ consultazioneId: cons.id, ...d }))} />}
            </div>
          )}

          {/* Osservazioni */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite, marginBottom: 6 }}>Osservazioni</div>
          <div style={{ display: "grid", gap: 8 }}>
            {commentiVisibili.length === 0 && <div style={{ fontSize: 13, color: C.grafite }}>Nessuna osservazione ricevuta.</div>}
            {commentiVisibili.map((c) => {
              const a = autori[c.id];
              const st = statoCommento(c.stato);
              return (
                <div key={c.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "11px 13px", background: c.stato === "non_pubblicato" ? "#faf8f3" : C.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.grafite }}>
                      {staff && a ? (
                        <>
                          {a.autore_nome || "—"} · {a.autore_email || "—"}
                          {a.email_verificata_il && <span style={{ color: C.green }}> · email confermata</span>}
                          {c.firma_pubblica ? " · nome pubblicato" : " · pubblicato come «Partecipante»"}
                        </>
                      ) : (
                        c.firma_pubblica || "Partecipante"
                      )}
                      {" · "}{dataOra(c.creato_il)}
                    </span>
                    <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.testo}</div>
                  {c.allegato_path && (
                    <button onClick={() => apriAllegato(c.allegato_path)} style={{ ...btnLink, marginTop: 6 }}>Allegato: {c.allegato_nome || "file"}</button>
                  )}
                  {c.risposta_testo && (
                    <div style={{ fontSize: 12.5, marginTop: 8, padding: "8px 10px", background: C.greenSoft, borderRadius: 7 }}>
                      <b>Risposta del Comune:</b> {c.risposta_testo}
                    </div>
                  )}

                  {!staff && (c.stato === "pubblicato" || c.stato === "risposto") && (
                    <RispostaCliente commento={c} inCorso={azione} onRispondi={(id, t) => esegui(() => rispondiCommento(id, t))} />
                  )}

                  {staff && cons.attiva && (c.stato === "ricevuto" || c.stato === "pubblicato") && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {c.stato === "ricevuto" && (
                        <button onClick={() => esegui(() => moderaCommento(c.id, "pubblicato", null))} disabled={azione} style={{ ...btnMini, color: C.green, borderColor: C.green }}>Pubblica</button>
                      )}
                      <button onClick={() => esegui(() => moderaCommento(c.id, "non_pubblicato", "Non ammesso dal moderatore"))} disabled={azione} style={{ ...btnMini, color: C.red }}>Non pubblicare</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {staff && cons.attiva && (
            <button onClick={() => esegui(() => chiudiConsultazione(cons.id))} disabled={azione} style={{ ...btnMini, marginTop: 14 }}>Chiudi consultazione</button>
          )}
        </div>
      )}
    </Riquadro>
  );
}

/* Pubblicazione di un'errata corrige (staff). */
function ModuloErrata({ cons, documenti, inCorso, onPubblica }) {
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [riparte, setRiparte] = useState(false);
  const [motivazione, setMotivazione] = useState("");

  if (!aperto) return <button onClick={() => setAperto(true)} style={btnLink}>+ Pubblica errata corrige</button>;

  return (
    <div style={{ padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
      <label style={etichetta}>
        Cosa viene corretto
        <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} style={{ ...campo, resize: "vertical" }} placeholder="Es. Tabella 2, pagina 8: il valore corretto è 1.250 t" />
      </label>
      <label style={etichetta}>
        Documento corretto (facoltativo: caricalo prima tra i documenti della pratica)
        <select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} style={campo}>
          <option value="">— nessun documento —</option>
          {documenti.map((d) => <option key={d.id} value={d.id}>{d.nome} (v{d.versione})</option>)}
        </select>
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, margin: "4px 0 10px" }}>
        <input type="checkbox" checked={riparte} onChange={(e) => setRiparte(e.target.checked)} style={{ marginTop: 2 }} />
        <span>Fai ripartire i 30 giorni da oggi (chiusura attuale: {formatoData(cons.data_chiusura)})</span>
      </label>
      <label style={etichetta}>
        Motivazione {riparte ? "(obbligatoria)" : "(facoltativa)"}
        <input value={motivazione} onChange={(e) => setMotivazione(e.target.value)} style={campo} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={inCorso}
          style={btnPrimario}
          onClick={async () => {
            if (await onPubblica({ testo: testo.trim(), documentoId: documentoId || null, riparte, motivazione: motivazione.trim() || null })) {
              setAperto(false); setTesto(""); setDocumentoId(""); setRiparte(false); setMotivazione("");
            }
          }}
        >
          Pubblica errata corrige
        </button>
        <button onClick={() => setAperto(false)} style={btnMini}>Annulla</button>
      </div>
    </div>
  );
}

function RispostaCliente({ commento, inCorso, onRispondi }) {
  const [aperta, setAperta] = useState(false);
  const [testo, setTesto] = useState(commento.risposta_testo || "");
  if (!aperta) {
    return (
      <button onClick={() => setAperta(true)} style={{ ...btnMini, marginTop: 10, color: C.green, borderColor: C.green }}>
        {commento.risposta_testo ? "Modifica risposta" : "Rispondi"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} placeholder="Scrivi la risposta all'osservazione…" aria-label="Risposta all'osservazione" style={{ ...campo, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={async () => { if (await onRispondi(commento.id, testo)) setAperta(false); }} disabled={inCorso || !testo.trim()} style={btnPrimario}>Salva risposta</button>
        <button onClick={() => setAperta(false)} style={btnMini}>Annulla</button>
      </div>
    </div>
  );
}

function statoCommento(stato) {
  switch (stato) {
    case "pubblicato": return { label: "Pubblicato", bg: "#dfe9db", fg: C.green };
    case "non_pubblicato": return { label: "Non pubblicato", bg: "#f6dcd6", fg: C.red };
    case "risposto": return { label: "Risposto", bg: C.greenSoft, fg: C.green };
    default: return { label: "Ricevuto", bg: C.paperWarm, fg: C.grafite };
  }
}

function Riquadro({ children }) {
  return <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>{children}</div>;
}
