/* =========================================================================
   Programma — indirizzo «/programma» (pagina PUBBLICA, senza accesso)
   Scopo: la parte pubblica della piattaforma online richiesta dalla Guida
     al Programma (cap. 3.7) e dallo Standard CWP (cap. 2.3, 5 e 6):
     - informazioni del Programma: soggetto promotore del programma, PEC,
       email e sito ufficiale (Guida 3.1 e 3.6);
     - elenco degli enti di validazione e verifica, dei registri e delle
       metodologie approvate;
     - documenti del Programma e modulistica pubblici;
     - Progetti dal momento in cui sono «in fase di validazione», con ID,
       promotori, territorio (codici ISTAT), stato nel Programma, documenti
       pubblici (rapporti di validazione e verifica, documenti riassuntivi
       del feedback, documenti di vendita…), Rapporti di Monitoraggio e
       crediti emessi con ID univoci e stato attivo / ritirato;
     - periodi di feedback pubblico aperti (collegamento a /consultazioni);
     - come presentare un reclamo o una richiesta di chiarimento (Politica
       di reclamo, Guida 8).
   Chi la usa: chiunque.
   Dati: consultazionePubblica("programma") e consultazionePubblica("file",
     { tipo, id }) di src/lib/dati.js, cioè la Edge Function
     «consultazione-pubblica» con la funzione SQL pubblico_programma (script
     24). Il browser non legge mai il database direttamente.
   Sicurezza: la funzione SQL sceglie i soli campi pubblici (nessun dato
     personale, nessun percorso dei file); i file si scaricano con un
     collegamento temporaneo solo se il documento è pubblico; contratti con
     l'ente e versioni private non lo sono mai (script 23).
   Registro sviluppo e deploy: capitolo «Portale (frontend)», tabella Pagine.
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { consultazionePubblica } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";
import { Cornice, scheda } from "./ConsultazioniPubbliche.jsx";

/* Pagina «/programma». Nessuna prop. Stato: { caricamento, dati, errore }. */
export default function Programma() {
  const [stato, setStato] = useState({ caricamento: true });
  const [aperto, setAperto] = useState(null); // codice del Progetto aperto
  const [erroreFile, setErroreFile] = useState("");

  useEffect(() => {
    consultazionePubblica("programma").then(({ data, error }) =>
      setStato({ caricamento: false, dati: data?.programma, errore: error?.message })
    );
  }, []);

  // Apre un documento o un modello pubblico con un collegamento temporaneo.
  async function scarica(tipo, id) {
    setErroreFile("");
    const { data, error } = await consultazionePubblica("file", { tipo, id });
    if (error) return setErroreFile(error.message);
    if (data?.url) window.open(data.url, "_blank", "noopener");
  }

  const d = stato.dati || {};
  const info = d.info || {};
  const docProgramma = (d.documenti || []).filter((x) => x.categoria === "programma");
  const modulistica = (d.documenti || []).filter((x) => x.categoria !== "programma");

  return (
    <Cornice>
      <h1 style={{ fontFamily: "'Archivo'", fontSize: 26, margin: "0 0 6px", letterSpacing: -0.4 }}>Programma Carbon WastePrint®</h1>
      <p style={{ fontSize: 14.5, color: C.grafite, margin: "0 0 20px", lineHeight: 1.55, maxWidth: 760 }}>
        La piattaforma online del Programma: elenchi di enti di validazione e verifica, registri e metodologie approvate,
        documenti e modulistica, progetti registrati con i documenti pubblici e i crediti di carbonio emessi.
      </p>
      {stato.caricamento && <div style={{ color: C.grafite }}>Caricamento…</div>}
      {stato.errore && <div style={{ ...scheda, color: C.red }}>{stato.errore}</div>}
      {erroreFile && <div style={{ color: C.red, marginBottom: 10 }}>{erroreFile}</div>}

      {stato.dati && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Informazioni del Programma */}
          <section style={scheda}>
            <h2 style={h2}>Il Programma</h2>
            <Riga etichetta="Soggetto promotore del programma" valore={info.soggetto_promotore} />
            {info.pec && <Riga etichetta="PEC" valore={info.pec} />}
            {info.email && <Riga etichetta="Email" valore={info.email} />}
            {info.sito && <Riga etichetta="Sito ufficiale" valore={<a href={`https://${info.sito.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" style={{ color: C.green }}>{info.sito}</a>} />}
            <div style={{ fontSize: 13, marginTop: 10 }}>
              <Link to="/consultazioni" style={{ color: C.green, fontWeight: 600 }}>Periodi di feedback pubblico aperti →</Link>
            </div>
          </section>

          {/* Elenchi */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <section style={scheda}>
              <h2 style={h2}>Enti di validazione e verifica</h2>
              {(d.enti || []).length === 0 && <Vuoto>Nessun ente iscritto.</Vuoto>}
              {(d.enti || []).map((e) => (
                <div key={e.denominazione} style={voce}>
                  <b>{e.denominazione}</b>
                  {e.accreditamento && <div style={sotto}>{e.accreditamento}</div>}
                </div>
              ))}
            </section>
            <section style={scheda}>
              <h2 style={h2}>Registri</h2>
              {(d.registri || []).length === 0 && <Vuoto>Nessun registro iscritto.</Vuoto>}
              {(d.registri || []).map((r) => (
                <div key={r.denominazione} style={voce}>
                  <b>{r.denominazione}</b>
                  <div style={sotto}>
                    {[r.sito_web, r.regolamento && `Regolamento: ${r.regolamento}`, r.blockchain && "cancellazione su blockchain"].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </section>
            <section style={scheda}>
              <h2 style={h2}>Metodologie approvate</h2>
              {(d.metodologie || []).map((m) => (
                <div key={m.nome + m.versione} style={voce}>
                  <b>{m.nome}</b> {m.versione && `v${m.versione}`} {m.data_versione && `del ${formatoData(m.data_versione)}`}
                  <div style={sotto}>{[m.sviluppatore, m.norma, m.stato !== "approvata" && m.stato].filter(Boolean).join(" · ")}</div>
                  {m.descrizione && <div style={sotto}>{m.descrizione}</div>}
                  {m.modello_id && <button onClick={() => scarica("modello", m.modello_id)} style={linkBtn}>↓ Documento</button>}
                </div>
              ))}
            </section>
          </div>

          {/* Documenti del Programma e modulistica */}
          <section style={scheda}>
            <h2 style={h2}>Documenti del Programma e modulistica</h2>
            {docProgramma.length + modulistica.length === 0 && <Vuoto>Nessun documento pubblicato.</Vuoto>}
            {[["Documenti del Programma", docProgramma], ["Modulistica", modulistica]].map(([titolo, elenco]) =>
              elenco.length > 0 && (
                <div key={titolo} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.grafite, margin: "6px 0" }}>{titolo}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {elenco.map((m) => (
                      <button key={m.id} onClick={() => scarica("modello", m.id)} title={m.descrizione || ""} style={btnFile}>↓ {m.titolo}</button>
                    ))}
                  </div>
                </div>
              )
            )}
          </section>

          {/* Progetti */}
          <section style={scheda}>
            <h2 style={h2}>Progetti</h2>
            {(d.progetti || []).length === 0 && <Vuoto>Nessun progetto ancora in fase di validazione.</Vuoto>}
            <div style={{ display: "grid", gap: 8 }}>
              {(d.progetti || []).map((p) => (
                <div key={p.codice} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px" }}>
                  <button onClick={() => setAperto(aperto === p.codice ? null : p.codice)} style={{ ...linkBtn, color: C.ink, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      <span style={{ fontSize: 12, color: C.grafite }}>ID {p.codice}</span>
                      <b style={{ display: "block", fontSize: 15 }}>{p.promotore}</b>
                      <span style={{ fontSize: 13, color: C.grafite }}>{p.titolo}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: p.stato === "progetto ritirato" ? C.red : C.green }}>{p.stato}</span>
                  </button>
                  {aperto === p.codice && <DettaglioProgetto p={p} scarica={scarica} />}
                </div>
              ))}
            </div>
          </section>

          {/* Reclami */}
          <section style={scheda}>
            <h2 style={h2}>Reclami e richieste di chiarimento</h2>
            <p style={{ fontSize: 13.5, color: C.grafite, lineHeight: 1.55, margin: 0 }}>
              Chiunque può presentare un reclamo o chiedere un chiarimento in qualsiasi momento, per iscritto
              {info.pec ? <> alla PEC <b>{info.pec}</b></> : " all'indirizzo PEC del soggetto promotore del programma"}, indicando nome,
              organizzazione, contatti, i dettagli della questione e un eventuale conflitto di interessi. Si riceve una
              conferma via email e poi una risposta scritta. I reclami verso un promotore del progetto, un ente di validazione e
              verifica o un registro vanno prima rivolti a loro (Politica di reclamo del Programma). Gli utenti del portale
              possono scrivere anche dalla pagina «Reclami».
            </p>
          </section>
        </div>
      )}
    </Cornice>
  );
}

/* Dettaglio pubblico di un Progetto: dati, documenti pubblici, Rapporti
   con documenti e crediti. Props: p (Progetto da pubblico_programma),
   scarica(tipo, id). */
function DettaglioProgetto({ p, scarica }) {
  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: C.grafite, display: "grid", gap: 2 }}>
        {(p.copromotori || []).length > 0 && <span>Altri promotori: {p.copromotori.join(", ")}</span>}
        <span>Territorio (codici ISTAT): {(p.territorio || []).join(", ") || "—"}</span>
        <span>Periodo di riferimento: {p.periodo}</span>
        {p.data_registrazione && <span>Registrato il {formatoData(p.data_registrazione)}</span>}
      </div>
      <Documenti elenco={p.documenti} scarica={scarica} />
      {(p.rapporti || []).map((r) => (
        <div key={r.codice} style={{ background: C.paper, borderRadius: 9, padding: "8px 12px" }}>
          <div style={{ fontSize: 13 }}>
            <b>Rapporto di Monitoraggio anno {r.anno}</b> · <span style={{ color: C.grafite }}>ID {r.codice} · {r.stato}</span>
          </div>
          <Documenti elenco={r.documenti} scarica={scarica} />
          {(r.crediti || []).map((l) => (
            <div key={l.codice} style={{ fontSize: 12.5, marginTop: 6 }}>
              <b>Crediti {l.codice}</b>: {Number(l.quantita).toLocaleString("it-IT")} emessi il {formatoData(l.data_emissione)}
              <span style={{ color: C.grafite }}> (ID da {l.id_primo} a {l.id_ultimo})</span>
              <div style={{ color: C.grafite }}>
                {l.registro ? `Registro: ${l.registro} · ` : ""}
                attivi {Number(l.riepilogo?.attivi || 0).toLocaleString("it-IT")} · ritirati {Number(l.riepilogo?.ritirati || 0).toLocaleString("it-IT")} · {l.riepilogo?.stato}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Elenco di documenti pubblici scaricabili. Props: elenco, scarica.
function Documenti({ elenco, scarica }) {
  if (!elenco || elenco.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {elenco.map((d) => (
        <button key={d.id} onClick={() => scarica("documento", d.id)} title={d.tipologia || ""} style={btnFile}>
          ↓ {d.tipologia || d.nome} <span style={{ color: C.grafite, fontWeight: 400 }}>(v{d.versione})</span>
        </button>
      ))}
    </div>
  );
}

// Riga «etichetta: valore» delle informazioni del Programma.
function Riga({ etichetta, valore }) {
  return (
    <div style={{ fontSize: 13.5, marginBottom: 4 }}>
      <span style={{ color: C.grafite }}>{etichetta}: </span>
      <b style={{ fontWeight: 600 }}>{valore || "—"}</b>
    </div>
  );
}

// Messaggio per un elenco vuoto.
function Vuoto({ children }) {
  return <div style={{ fontSize: 13, color: C.grafite }}>{children}</div>;
}

// Stili locali.
const h2 = { fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 10px" };
const voce = { fontSize: 13.5, marginBottom: 8 };
const sotto = { fontSize: 12, color: C.grafite };
const linkBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", color: C.green, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" };
const btnFile = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, color: C.green, cursor: "pointer", textAlign: "left" };
