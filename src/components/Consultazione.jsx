/* =========================================================================
   Consultazione
   Scopo: riquadro «Feedback pubblico» (il termine della Guida al
     Programma, cap. 3.9) di un Progetto o di un Rapporto di Monitoraggio
     (fase 3, requisiti §6; per i Rapporti Guida 6.3.1, script 23). Lo staff
     apre il feedback pubblicando un documento per la durata della fase 3
     (30 giorni per il Progetto, 20 per il Rapporto, modificabili
     dall'Admin), modera le osservazioni, pubblica errata corrige e lo
     chiude. Nel codice e nel database il nome resta «consultazione». Il Comune legge le osservazioni ammesse e risponde.
     Le osservazioni NON si scrivono qui: arrivano dalla pagina pubblica
     /consultazioni/<id> (pagina ConsultazioniPubbliche e Edge Function
     «consultazione-pubblica»), solo dopo la conferma dell'email
     dell'autore (decisione D).
   Usato da: DettaglioPratica.jsx (Progetti e Rapporti).
   Chi lo vede: operatore e admin (tutto, con nome ed email degli autori);
     cliente/Comune (osservazioni ammesse, firmate «Partecipante» o con il
     nome scelto dall'autore; può rispondere).
   Dati: da src/lib/dati.js leggiConsultazione, apriConsultazione,
     chiudiConsultazione, moderaCommento, rispondiCommento, elencaDocumenti,
     elencaErrata, pubblicaErrataCorrige, autoriCommenti,
     urlAllegatoCommento, urlDocumento. Tabelle consultazione, commento,
     consultazione_errata, documento; archivi «documenti» e
     «allegati-consultazione»; funzioni rispondi_commento (script 07),
     staff_errata_corrige e staff_autori_commenti (script 17).
   Sicurezza:
     - garantito dal database: solo lo staff apre e chiude (funzioni
       staff_apri_consultazione e staff_chiudi_consultazione, script 21) e
       modera (RLS commento_update); il documento in consultazione diventa
       pubblico e resta bloccato finché la consultazione è attiva (si
       sostituisce solo con l'errata corrige, script 21); nome ed email degli autori non
       sono leggibili dal portale (colonne escluse, script 17) e lo staff li
       ottiene solo con staff_autori_commenti; il Comune risponde solo alle
       osservazioni ammesse (rispondi_commento); gli allegati delle
       osservazioni non ammesse non sono scaricabili dal Comune; l'errata
       corrige con ripartenza del periodo richiede la motivazione e rende
       pubblico il documento allegato;
     - il Comune legge solo le osservazioni ammesse (Pubblicato /
       Risposto): lo garantisce la policy commento_select dello script 19;
       il filtro commentiVisibili qui sotto resta come seconda difesa.
     Notifiche: apertura della consultazione e osservazione ammessa (al
     Comune), nuove osservazioni (allo staff) le genera il database.
     Ogni osservazione ha un numero progressivo per consultazione
     (commento.numero, script 21), mostrato come «Osservazione n. X».
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
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
  elencaDurateFasi,
} from "../lib/dati.js";
import { formatoData, giorniA } from "../lib/date.js";
import { campo, etichetta, btnPrimario, btnMini, btnLink, dataOra } from "./stili.js";

/* Consultazione pubblica (fase 3, requisiti §6).
   - Lo staff apre la consultazione pubblicando un documento per la durata della fase 3,
     modera le osservazioni, pubblica errata corrige e la chiude.
   - Le osservazioni arrivano dalla pagina pubblica /consultazioni/<id>,
     solo dopo che l'autore ha confermato la propria email (decisione D):
     nel portale non si scrivono più osservazioni.
   - Lo staff vede nome ed email degli autori; il Comune vede solo le
     osservazioni ammesse, firmate «Partecipante» (o con il nome, se
     l'autore ha acconsentito), e risponde.
   - Errata corrige: lo staff decide caso per caso se far ripartire il
     periodo, con motivazione (decisione B).
   Props: praticaId (id della pratica), tipo ("progetto" | "rapporto"). */
export default function Consultazione({ praticaId, tipo = "progetto" }) {
  const { ruolo } = useAuth();
  const staff = ruolo === "operatore" || ruolo === "admin";
  // Giorni del feedback pubblico: durata della fase 3 del tipo di pratica
  // (tabella durata_fase); 30 o 20 finché non è letta.
  const [giorni, setGiorni] = useState(tipo === "rapporto" ? 20 : 30);
  useEffect(() => {
    elencaDurateFasi(tipo).then(({ data }) => {
      const f3 = (data || []).find((d) => d.numero === 3);
      if (f3 && f3.giorni > 0) setGiorni(f3.giorni);
    });
  }, [tipo]);

  // cons: ultima consultazione della pratica con i suoi commenti (null = nessuna).
  const [cons, setCons] = useState(null);
  // Documenti della pratica: per scegliere quello da pubblicare o l'errata corrige.
  const [documenti, setDocumenti] = useState([]);
  const [docSel, setDocSel] = useState("");
  const [errata, setErrata] = useState([]);
  // Autori per id del commento: { [commento_id]: { autore_nome, autore_email, … } } (solo staff).
  const [autori, setAutori] = useState({});
  const [caricamento, setCaricamento] = useState(true);
  // true mentre un'azione è in corso: disabilita i pulsanti.
  const [azione, setAzione] = useState(false);
  const [errore, setErrore] = useState("");
  // Moderazione «Non pubblicare»: id dell'osservazione con il modulo della
  // motivazione aperto (facoltativa, requisiti §6) e testo in scrittura.
  const [rifiuto, setRifiuto] = useState(null);
  const [motivoRifiuto, setMotivoRifiuto] = useState("");

  // Legge consultazione, documenti, errata corrige e (solo staff) gli autori.
  // Se non c'è consultazione, preseleziona il documento più recente.
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
      // La funzione del database rifiuta chi non è staff: per il Comune
      // non si chiama nemmeno.
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
  // Indirizzo della pagina pubblica (stesso dominio del portale).
  const linkPubblico = cons ? `${window.location.origin}/consultazioni/${cons.id}` : "";

  // Esegue un'azione, mostra l'eventuale errore e ricarica tutto.
  // Restituisce true se è riuscita (serve ai moduli per chiudersi).
  async function esegui(fn) {
    setAzione(true);
    setErrore("");
    const { error } = (await fn()) || {};
    if (error) setErrore(error.message);
    await carica();
    setAzione(false);
    return !error;
  }

  // Apre un documento della pratica (collegamento temporaneo, 60 secondi).
  async function apri(path) {
    const { data } = await urlDocumento(path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  // Apre l'allegato di un'osservazione (archivio «allegati-consultazione»).
  async function apriAllegato(path) {
    const { data } = await urlAllegatoCommento(path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  // Il Comune vede solo le osservazioni ammesse; lo staff tutte.
  // Attenzione: è un filtro di interfaccia (vedi «Sicurezza» in testa al file).
  const commentiVisibili = (cons?.commenti || []).filter(
    (c) => staff || c.stato === "pubblicato" || c.stato === "risposto"
  );
  const docConsultazione = documenti.find((d) => d.id === cons?.documento_id);

  return (
    <Riquadro>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Feedback pubblico</h3>
        {cons && (
          <Badge bg={cons.attiva ? C.greenSoft : C.paperWarm} fg={cons.attiva ? C.green : C.grafite}>
            {cons.attiva ? "Attiva" : "Chiusa"}
          </Badge>
        )}
      </div>

      {/* Nessuna consultazione: lo staff può aprirla scegliendo uno dei
          documenti della pratica (anche versioni precedenti o di altre fasi).
          Apertura = oggi, chiusura = oggi + giorni della fase 3 (apriConsultazione). */}
      {!cons && (
        staff ? (
          documenti.length ? (
            <div>
              <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 10px" }}>
                Pubblica un documento per avviare il feedback pubblico di {giorni} giorni sulla pagina pubblica del portale (Guida 3.9).
                Il documento diventa pubblico e resta bloccato fino alla chiusura: per sostituirlo si usa l'errata corrige.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={docSel} onChange={(e) => setDocSel(e.target.value)} style={{ ...campo, width: "auto", minWidth: 260 }}>
                  {documenti.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome} (v{d.versione})</option>
                  ))}
                </select>
                <button onClick={() => docSel && esegui(() => apriConsultazione({ praticaId, documentoId: docSel }))} disabled={azione} style={btnPrimario}>
                  Apri il feedback pubblico
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>Carica prima un documento per poterlo pubblicare nel feedback pubblico.</p>
          )
        ) : (
          <p style={{ fontSize: 13, color: C.grafite, margin: 0 }}>Nessun feedback pubblico in corso.</p>
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
                    {e.riparte && <> · <b style={{ color: C.ocra }}>il periodo è ripartito: chiusura il {formatoData(e.nuova_chiusura)}</b></>}
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
              {staff && cons.attiva && <ModuloErrata giorni={giorni} cons={cons} documenti={documenti} inCorso={azione} onPubblica={(d) => esegui(() => pubblicaErrataCorrige({ consultazioneId: cons.id, ...d }))} />}
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
                      {c.numero && <b style={{ color: C.ink }}>Osservazione n. {c.numero} · </b>}
                      {/* Staff: identità reale dell'autore; Comune: solo la firma pubblica. */}
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
                  {staff && c.stato === "non_pubblicato" && c.motivazione_moderazione && (
                    <div style={{ fontSize: 12, color: C.grafite, marginTop: 6 }}>Motivazione della non pubblicazione: {c.motivazione_moderazione}</div>
                  )}
                  {c.risposta_testo && (
                    <div style={{ fontSize: 12.5, marginTop: 8, padding: "8px 10px", background: C.greenSoft, borderRadius: 7 }}>
                      <b>Risposta del Comune:</b> {c.risposta_testo}
                    </div>
                  )}

                  {!staff && (c.stato === "pubblicato" || c.stato === "risposto") && (
                    <RispostaCliente commento={c} inCorso={azione} onRispondi={(id, t) => esegui(() => rispondiCommento(id, t))} />
                  )}

                  {/* Moderazione (staff, consultazione attiva): «ricevuto» →
                      Pubblica o Non pubblicare; «pubblicato» → Non pubblicare.
                      Un'osservazione già risposta non si modera più. */}
                  {staff && cons.attiva && (c.stato === "ricevuto" || c.stato === "pubblicato") && rifiuto !== c.id && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      {c.stato === "ricevuto" && (
                        <button onClick={() => esegui(() => moderaCommento(c.id, "pubblicato", null))} disabled={azione} style={{ ...btnMini, color: C.green, borderColor: C.green }}>Pubblica</button>
                      )}
                      <button onClick={() => { setRifiuto(c.id); setMotivoRifiuto(""); }} disabled={azione} style={{ ...btnMini, color: C.red }}>Non pubblicare</button>
                    </div>
                  )}
                  {/* «Non pubblicare»: l'osservazione non si cancella; la
                      motivazione (facoltativa) resta nella pratica e nell'audit. */}
                  {staff && rifiuto === c.id && (
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      <label style={etichetta}>
                        Motivazione (facoltativa, non è pubblica)
                        <input value={motivoRifiuto} onChange={(e) => setMotivoRifiuto(e.target.value)} style={campo} placeholder="Es. fuori tema, contenuto offensivo, duplicato dell'osservazione n. 2" />
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={async () => { if (await esegui(() => moderaCommento(c.id, "non_pubblicato", motivoRifiuto.trim() || null))) setRifiuto(null); }}
                          disabled={azione}
                          style={{ ...btnMini, color: C.red }}
                        >
                          Conferma: non pubblicare
                        </button>
                        <button onClick={() => setRifiuto(null)} style={btnMini}>Annulla</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {staff && cons.attiva && (
            <button onClick={() => esegui(() => chiudiConsultazione(cons.id))} disabled={azione} style={{ ...btnMini, marginTop: 14 }}>Chiudi il feedback pubblico</button>
          )}
        </div>
      )}
    </Riquadro>
  );
}

/* Pubblicazione di un'errata corrige (staff).
   Props: cons (consultazione attiva), documenti (della pratica), inCorso,
   onPubblica({ testo, documentoId, riparte, motivazione }) → true se riuscita.
   Effetto (staff_errata_corrige, script 17): se «riparte», la chiusura
   diventa oggi + i giorni del feedback (prop giorni) e la motivazione è obbligatoria; l'eventuale
   documento collegato diventa pubblico. */
function ModuloErrata({ giorni, cons, documenti, inCorso, onPubblica }) {
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
        <span>Fai ripartire i {giorni} giorni da oggi (chiusura attuale: {formatoData(cons.data_chiusura)})</span>
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

/* Risposta del Comune a un'osservazione ammessa (anche modifica di una
   risposta già data). Props: commento, inCorso, onRispondi(id, testo) →
   true se riuscita. La funzione rispondi_commento (script 07) controlla che
   l'osservazione sia della pratica del Comune e ammessa, e la porta allo
   stato «risposto». */
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

// Etichetta e colori del badge per lo stato di un'osservazione.
// Stati: ricevuto (da moderare), pubblicato, non_pubblicato, risposto.
function statoCommento(stato) {
  switch (stato) {
    case "pubblicato": return { label: "Pubblicato", bg: "#dfe9db", fg: C.green };
    case "non_pubblicato": return { label: "Non pubblicato", bg: "#f6dcd6", fg: C.red };
    case "risposto": return { label: "Risposto", bg: C.greenSoft, fg: C.green };
    default: return { label: "Ricevuto", bg: C.paperWarm, fg: C.grafite };
  }
}

// Contenitore bianco del riquadro «Consultazione pubblica».
function Riquadro({ children }) {
  return <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>{children}</div>;
}
