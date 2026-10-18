/* =========================================================================
   Consultazioni pubbliche — tre pagine PUBBLICHE in questo file
   (requisiti §6; decisioni B e D del 18/10/2026). Non serve un account:
   - «/consultazioni»            ElencoConsultazioni: consultazioni aperte;
   - «/consultazioni/:id»        PaginaConsultazione: documento, errata
                                 corrige, osservazioni ammesse e modulo per
                                 inviare un'osservazione;
   - «/consultazioni/conferma»   ConfermaOsservazione: conferma dell'email
                                 (collegamento ricevuto, parametro ?t=).
   Scopo: permettere a chiunque di leggere il Progetto in consultazione per
     30 giorni e inviare osservazioni, che Fondazione Operate modera e a cui
     il Comune risponde (la moderazione avviene nel back-office, componente
     Consultazione).
   Chi la usa: pubblico senza accesso.
   Dati: solo consultazionePubblica(azione, dati) di src/lib/dati.js, che
     chiama la Edge Function "consultazione-pubblica" con le azioni
     "elenco", "dettaglio", "invia", "conferma".
   Sicurezza: il browser non legge mai direttamente il database. È la Edge
     Function (con chiave di servizio, Verify JWT disattivato) a decidere
     cosa mostrare: solo consultazioni di Progetti, solo osservazioni
     ammesse, mai l'email, il nome solo se l'autore lo ha scelto. Sempre lì
     si ripetono i controlli di questo modulo (lunghezze, consenso, formato
     e contenuto dell'allegato, 10 MB) e ci sono i limiti di invio
     (3 all'ora per email, 100 all'ora per consultazione). L'osservazione
     arriva alla Fondazione solo dopo la conferma dell'email (token monouso
     valido 48 ore) e va poi moderata.
   Registro sviluppo e deploy: capitolo «Portale (frontend)» (la funzione
     nel capitolo «Edge Functions»).
   ========================================================================= */
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { COLORI as C } from "../lib/cwpProgram.js";
import { consultazionePubblica } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";
import { campo, etichetta, btnPrimario, dataOra } from "../components/stili.js";

/* Cornice comune delle pagine pubbliche: intestazione con loghi e link
   (elenco consultazioni, accesso al portale) e area centrale.
   Prop `children`: il contenuto della pagina. Non usa Header, che richiede
   l'accesso. */
function Cornice({ children }) {
  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <header style={{ background: C.white, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <img src="/loghi/carbonwasteprint.png" alt="Carbon WastePrint" style={{ height: 56, width: "auto" }} />
          <span style={{ fontSize: 12, color: C.grafite }}>Programma di</span>
          <img src="/loghi/fondazione-operate.png" alt="Fondazione Operate" style={{ height: 34, width: "auto" }} />
          <span style={{ flex: 1 }} />
          <Link to="/consultazioni" style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Consultazioni pubbliche</Link>
          <Link to="/" style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Accedi al portale</Link>
        </div>
      </header>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "26px 20px 48px" }}>{children}</main>
    </div>
  );
}

// Stile dei riquadri bianchi usati in tutte e tre le pagine.
const scheda = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" };

/* ---------- Elenco ---------- */
/* Pagina «/consultazioni». Nessuna prop.
   Stato unico: { caricamento, elenco, errore }. Ogni voce dell'elenco
   (dalla Edge Function) ha id, codice, ente, titolo, data_chiusura. */
export function ElencoConsultazioni() {
  const [stato, setStato] = useState({ caricamento: true });

  // Lettura una tantum all'apertura.
  useEffect(() => {
    consultazionePubblica("elenco").then(({ data, error }) =>
      setStato({ caricamento: false, elenco: data?.consultazioni || [], errore: error?.message })
    );
  }, []);

  return (
    <Cornice>
      <h1 style={{ fontFamily: "'Archivo'", fontSize: 26, margin: "0 0 6px", letterSpacing: -0.4 }}>Consultazioni pubbliche</h1>
      <p style={{ fontSize: 14.5, color: C.grafite, margin: "0 0 20px", lineHeight: 1.55, maxWidth: 720 }}>
        Prima della validazione, ogni Progetto del Programma Carbon WastePrint® è pubblicato per 30 giorni. Chiunque
        può leggere la documentazione e inviare osservazioni, che Fondazione Operate esamina e a cui il Comune risponde.
      </p>
      {stato.caricamento && <div style={{ color: C.grafite }}>Caricamento…</div>}
      {stato.errore && <div style={{ color: C.red }}>{stato.errore}</div>}
      {!stato.caricamento && !stato.errore && stato.elenco.length === 0 && (
        <div style={{ ...scheda, color: C.grafite, textAlign: "center" }}>In questo momento non ci sono consultazioni aperte.</div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {(stato.elenco || []).map((c) => (
          <Link key={c.id} to={`/consultazioni/${c.id}`} style={{ ...scheda, textDecoration: "none", color: C.ink, display: "block" }}>
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>{c.codice}</div>
            <div style={{ fontFamily: "'Archivo'", fontSize: 18, margin: "2px 0 4px" }}>{c.ente}</div>
            <div style={{ fontSize: 13.5, color: C.grafite }}>{c.titolo}</div>
            <div style={{ fontSize: 12.5, marginTop: 8, color: C.green, fontWeight: 600 }}>
              Aperta fino al {formatoData(c.data_chiusura)} · leggi e partecipa →
            </div>
          </Link>
        ))}
      </div>
    </Cornice>
  );
}

/* ---------- Dettaglio e invio di un'osservazione ---------- */
/* Pagina «/consultazioni/:id» (id = id della consultazione, non della pratica).
   Mostra intestazione con periodo e stato, link al documento, eventuali
   errata corrige, osservazioni pubblicate con la risposta del Comune e,
   se la consultazione è aperta, il modulo di invio.
   La consultazione `c` arriva dalla Edge Function con: codice, ente,
   titolo, date, aperta, documento e documento_url (indirizzo firmato
   temporaneo), errata[], osservazioni[] (autore = «Partecipante» o nome). */
export function PaginaConsultazione() {
  const { id } = useParams();
  const [stato, setStato] = useState({ caricamento: true });

  // Rilettura a ogni cambio di id nell'indirizzo.
  useEffect(() => {
    consultazionePubblica("dettaglio", { id }).then(({ data, error }) =>
      setStato({ caricamento: false, c: data?.consultazione, errore: error?.message })
    );
  }, [id]);

  const c = stato.c;
  return (
    <Cornice>
      {stato.caricamento && <div style={{ color: C.grafite }}>Caricamento…</div>}
      {stato.errore && <div style={{ ...scheda, color: C.red }}>{stato.errore}</div>}
      {c && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={scheda}>
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>Consultazione pubblica · {c.codice}</div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 24, margin: "4px 0 4px", letterSpacing: -0.4 }}>{c.ente}</h1>
            <div style={{ fontSize: 14, color: C.grafite }}>{c.titolo}</div>
            <div style={{ fontSize: 13, marginTop: 10 }}>
              Dal {formatoData(c.data_apertura)} al {formatoData(c.data_chiusura)} ·{" "}
              <b style={{ color: c.aperta ? C.green : C.grafite }}>{c.aperta ? "aperta" : "chiusa"}</b>
            </div>
            {c.documento_url && (
              <a href={c.documento_url} target="_blank" rel="noreferrer" style={{ ...btnPrimario, display: "inline-block", marginTop: 12, textDecoration: "none" }}>
                Leggi il documento: {c.documento}
              </a>
            )}
          </div>

          {c.errata.length > 0 && (
            <div style={scheda}>
              <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 10px" }}>Errata corrige</h2>
              {c.errata.map((e, i) => (
                <div key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0 }}>
                  <div style={{ fontSize: 12, color: C.grafite }}>
                    {/* riparte = con questa errata i 30 giorni sono ripartiti. */}
                    {dataOra(e.creato_il)}
                    {e.riparte && <> · la consultazione è stata prolungata fino al {formatoData(e.nuova_chiusura)}</>}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 4, whiteSpace: "pre-wrap" }}>{e.testo}</div>
                  {e.documento_url && <a href={e.documento_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{e.documento}</a>}
                </div>
              ))}
            </div>
          )}

          <div style={scheda}>
            <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 10px" }}>Osservazioni pubblicate</h2>
            {c.osservazioni.length === 0 && <div style={{ fontSize: 13.5, color: C.grafite }}>Nessuna osservazione pubblicata finora.</div>}
            {c.osservazioni.map((o, i) => (
              <div key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
                <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>{o.autore} · {formatoData(o.creato_il)}</div>
                <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{o.testo}</div>
                {o.risposta && (
                  <div style={{ fontSize: 13.5, marginTop: 8, padding: "8px 10px", background: C.greenSoft, borderRadius: 8 }}>
                    <b>Risposta del Comune:</b> {o.risposta}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* «aperta» lo calcola la Edge Function (consultazione attiva e
              oggi dentro il periodo); lo ricontrolla anche all'invio. */}
          {c.aperta ? <ModuloOsservazione id={c.id} /> : (
            <div style={{ ...scheda, color: C.grafite }}>La consultazione è chiusa: non si possono più inviare osservazioni.</div>
          )}
        </div>
      )}
    </Cornice>
  );
}

/* Modulo per inviare un'osservazione a una consultazione aperta.
   Prop `id`: id della consultazione.
   Campi in `d`: nome, email, testo, nome_pubblico (firma col nome invece
   di «Partecipante»), privacy (consenso obbligatorio), sito (campo
   trappola anti-robot). Dopo l'invio mostra «Controlla la tua email»:
   l'osservazione è ancora IN ATTESA della conferma dell'indirizzo. */
function ModuloOsservazione({ id }) {
  const [d, setD] = useState({ nome: "", email: "", testo: "", nome_pubblico: false, privacy: false, sito: "" });
  // Email a cui è stata mandata la conferma; null finché non si invia.
  const [esito, setEsito] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  // Il campo file non è controllato da React: lo si legge al momento dell'invio.
  const fileRef = useRef(null);

  // Invio: prepara l'eventuale allegato e chiama l'azione "invia" della
  // Edge Function, che ripete tutti i controlli.
  async function invia(e) {
    e.preventDefault();
    setErrore("");
    let allegato = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      // Controllo anticipato del limite (lo stesso della Edge Function).
      if (file.size > 10 * 1024 * 1024) return setErrore("Allegato troppo grande (al massimo 10 MB).");
      // L'allegato viaggia nel corpo JSON come testo Base64. La conversione
      // procede a blocchi di 32 KB (0x8000 byte) perché passare tutto il file
      // in una volta a String.fromCharCode supera i limiti del browser.
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      allegato = { nome: file.name, dati: btoa(bin) };
    }
    setInCorso(true);
    const { error } = await consultazionePubblica("invia", { id, ...d, allegato });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setEsito(d.email);
  }

  if (esito) {
    return (
      <div style={{ ...scheda, borderColor: C.green }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 8px" }}>Controlla la tua email</h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
          Abbiamo inviato a <b>{esito}</b> un collegamento per confermare l'indirizzo. L'osservazione sarà ricevuta
          solo dopo la conferma (il collegamento vale 48 ore). Se non trovi l'email, guarda nella posta indesiderata.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={invia} style={scheda}>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 6px" }}>Invia un'osservazione</h2>
      <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 14px", lineHeight: 1.5 }}>
        Riceverai un'email per confermare il tuo indirizzo: senza conferma l'osservazione non viene ricevuta. Fondazione
        Operate esamina ogni osservazione prima della pubblicazione. Email e nome non sono pubblicati, a meno che tu non
        scelga di firmare con il nome.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        <label style={etichetta}>Nome e cognome (o ente) *<input required maxLength={120} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} style={campo} /></label>
        <label style={etichetta}>Email *<input required type="email" maxLength={200} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} style={campo} /></label>
      </div>
      <label style={etichetta}>
        Osservazione * <span style={{ fontWeight: 400 }}>({d.testo.length}/5000)</span>
        <textarea required minLength={10} maxLength={5000} rows={6} value={d.testo} onChange={(e) => setD({ ...d, testo: e.target.value })} style={{ ...campo, resize: "vertical" }} />
      </label>
      <label style={etichetta}>
        Allegato (facoltativo: PDF, JPG, PNG, DOCX o ODT, max 10 MB)
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.odt" style={{ fontSize: 13 }} />
      </label>
      {/* Campo trappola per i robot: nascosto alle persone. Se arriva
          compilato, la Edge Function risponde «ok» ma scarta l'invio. */}
      <input tabIndex={-1} autoComplete="off" value={d.sito} onChange={(e) => setD({ ...d, sito: e.target.value })} aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "4px 0 8px" }}>
        <input type="checkbox" checked={d.nome_pubblico} onChange={(e) => setD({ ...d, nome_pubblico: e.target.checked })} style={{ marginTop: 3 }} />
        <span>Pubblica il mio nome con l'osservazione (altrimenti compare «Partecipante»).</span>
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "0 0 12px" }}>
        <input type="checkbox" required checked={d.privacy} onChange={(e) => setD({ ...d, privacy: e.target.checked })} style={{ marginTop: 3 }} />
        <span>
          Acconsento al trattamento dei miei dati da parte di Fondazione Operate per la gestione della consultazione
          pubblica. *
        </span>
      </label>
      {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}
      <button type="submit" disabled={inCorso} style={btnPrimario}>{inCorso ? "Invio…" : "Invia l'osservazione"}</button>
    </form>
  );
}

/* ---------- Conferma dell'email ---------- */
/* Pagina «/consultazioni/conferma?t=<token>», aperta dal link dell'email.
   Manda il token alla Edge Function (azione "conferma"): se valido,
   l'osservazione passa da «in attesa» a «ricevuta» e va in moderazione.
   Esito: messaggio di ringraziamento con link alla consultazione, oppure
   l'errore (token scaduto, già usato, non valido). */
export function ConfermaOsservazione() {
  const [params] = useSearchParams();
  const [stato, setStato] = useState({ caricamento: true });
  // Impedisce un secondo invio dello stesso token, ad esempio quando React
  // in modalità sviluppo esegue due volte l'effetto.
  const fatto = useRef(false);

  useEffect(() => {
    if (fatto.current) return; // il collegamento vale una volta sola
    fatto.current = true;
    consultazionePubblica("conferma", { token: params.get("t") || "" }).then(({ data, error }) =>
      setStato({ caricamento: false, id: data?.consultazione_id, errore: error?.message })
    );
  }, [params]);

  return (
    <Cornice>
      <div style={{ ...scheda, maxWidth: 620 }}>
        {stato.caricamento && <div style={{ color: C.grafite }}>Conferma in corso…</div>}
        {stato.errore && (
          <>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 8px" }}>Conferma non riuscita</h1>
            <p style={{ fontSize: 14, color: C.red, margin: 0 }}>{stato.errore}</p>
          </>
        )}
        {stato.id && (
          <>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 20, margin: "0 0 8px" }}>Grazie, osservazione ricevuta</h1>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 12px" }}>
              Il tuo indirizzo email è confermato e l'osservazione è arrivata a Fondazione Operate. Sarà esaminata e,
              se ammessa, pubblicata nella pagina della consultazione insieme alla risposta del Comune.
            </p>
            <Link to={`/consultazioni/${stato.id}`} style={{ color: C.green, fontWeight: 600 }}>Torna alla consultazione →</Link>
          </>
        )}
      </div>
    </Cornice>
  );
}
