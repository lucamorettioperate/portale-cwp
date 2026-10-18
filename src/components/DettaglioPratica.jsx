import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA, STATI_FASE } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import Documenti from "./Documenti.jsx";
import Consultazione from "./Consultazione.jsx";
import Integrazioni from "./Integrazioni.jsx";
import Rapporti from "./Rapporti.jsx";
import Pagamenti from "./Pagamenti.jsx";
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
  urlModello,
  elencaEnti,
  impostaEntePratica,
} from "../lib/dati.js";
import { formatoData, giorniA } from "../lib/date.js";
import { esportaFascicolo } from "../lib/fascicolo.js";

/* Dettaglio di una pratica con le sue 7 fasi.
   L'Operatore/Admin apre e chiude le fasi, modifica le scadenze, richiede
   integrazioni, scrive note di fase, assegna l'Ente di Validazione e cambia
   lo stato della pratica. Le azioni critiche richiedono una motivazione,
   registrata nell'audit (requisiti §8).
   Il Comune vede fasi, note condivise, modelli da scaricare, documenti,
   pagamenti (sola lettura) e scrive messaggi alla Fondazione.
   Registro sviluppo e deploy: capitolo «Portale (frontend)». */
export default function DettaglioPratica({ praticaId, onAggiornato, onApri }) {
  const { ruolo } = useAuth();
  const [pratica, setPratica] = useState(null);
  const [integrazioni, setIntegrazioni] = useState([]);
  const [note, setNote] = useState([]);
  const [modelli, setModelli] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [versione, setVersione] = useState(0); // per ricaricare i documenti

  const staff = ruolo === "operatore" || ruolo === "admin";

  async function carica(silenzioso = false) {
    if (!silenzioso) setCaricamento(true);
    const [{ data }, { data: integr }, { data: nt }, { data: mod }] = await Promise.all([
      leggiPratica(praticaId),
      elencaIntegrazioni(praticaId),
      elencaNoteFase(praticaId),
      elencaModelli(),
    ]);
    setPratica(data);
    setIntegrazioni(integr || []);
    setNote(nt || []);
    setModelli(mod || []);
    setCaricamento(false);
  }

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
  if (!pratica) return <Pannello>Pratica non trovata.</Pannello>;

  const fasi = (pratica.fasi || []).sort((a, b) => a.numero - b.numero);
  const st = STATI_PRATICA[pratica.stato] || STATI_PRATICA.attiva;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Intestazione pratica */}
      <div style={riquadro}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>
              {pratica.codice || "senza codice"}
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
            <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
            <BottoneFascicolo praticaId={pratica.id} staff={staff} />
          </div>
        </div>
        {pratica.stato !== "attiva" && pratica.motivazione_stato && (
          <div style={{ fontSize: 12.5, color: C.grafite, marginTop: 10 }}>
            Motivazione: {pratica.motivazione_stato}
          </div>
        )}
        {/* Pratica non attiva: il Comune deve capire perché non può agire (backlog 24) */}
        {!staff && pratica.stato !== "attiva" && (
          <div style={{ marginTop: 12, background: C.ocraSoft, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            La pratica è <b>{st.label.toLowerCase()}</b>: per ora non è possibile caricare documenti né rispondere alle
            richieste di integrazione. Potete consultare tutto e scrivere alla Fondazione nella sezione Messaggi.
          </div>
        )}
        <EnteValidazione pratica={pratica} staff={staff} onFatto={dopoAzione} />
        {staff && <CambioStato pratica={pratica} onFatto={dopoAzione} />}
      </div>

      {/* Le 7 fasi */}
      <div style={{ display: "grid", gap: 10 }}>
        {fasi.map((f) => (
          <Fase
            key={f.id}
            fase={f}
            pratica={pratica}
            staff={staff}
            richieste={integrazioni.filter((r) => r.fase_id === f.id)}
            note={note.filter((n) => n.fase_id === f.id)}
            modelli={modelli.filter((m) => m.fase_numero === f.numero)}
            versione={versione}
            onCambio={dopoAzione}
          />
        ))}
      </div>

      {/* Messaggi tra Comune e Fondazione */}
      <Messaggi pratica={pratica} />

      {/* Consultazione pubblica (fase 3, solo per i Progetti) */}
      {pratica.tipo === "progetto" && <Consultazione praticaId={pratica.id} />}

      {/* Rapporti di Monitoraggio annuali del Progetto */}
      {pratica.tipo === "progetto" && (
        <Rapporti progetto={pratica} staff={staff} onApri={onApri} onCreato={onAggiornato} />
      )}

      {/* Pagamenti: lo staff li gestisce, il Comune li consulta */}
      <Pagamenti praticaId={pratica.id} solaLettura={!staff} />

      {/* Documenti generali della pratica (contratto, amministrativi) */}
      <Documenti key={`gen-${versione}`} praticaId={pratica.id} consentiCaricamento={staff || pratica.stato === "attiva"} />
    </div>
  );
}

/* Una fase: stato, date, azioni dello staff, integrazioni, documenti. */
function Fase({ fase: f, pratica, staff, richieste, note, modelli, versione, onCambio }) {
  const [form, setForm] = useState(null); // null | "integrazione" | "scadenza" | "chiusura"
  const [testo, setTesto] = useState("");
  const [data, setData] = useState(f.data_prevista_chiusura || "");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  const sf = STATI_FASE[f.stato] || STATI_FASE.non_iniziata;
  const aperta = f.stato === "in_corso" || f.stato === "in_attesa_integrazione";
  const attiva = pratica.stato === "attiva";
  const integrAperte = richieste.filter((r) => !r.risolta).length;
  const residui = aperta ? giorniA(f.data_prevista_chiusura) : null;

  function apriForm(tipo) {
    setErrore("");
    setTesto("");
    setData(f.data_prevista_chiusura || "");
    setForm(tipo);
  }

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
        </div>

        {/* Azioni staff */}
        {staff && attiva && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {f.stato === "non_iniziata" && (
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
              </>
            )}
          </div>
        )}

        {/* Moduli inline delle azioni */}
        {form && (
          <div style={formBox}>
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

        {/* Documenti della fase */}
        <Documenti key={`${f.id}-${versione}`} praticaId={pratica.id} fase={f} compatto consentiCaricamento={staff || attiva} />
      </div>
    </div>
  );
}

/* Modelli da scaricare per la fase (caricati dall'Amministratore in Impostazioni). */
function ModelliFase({ modelli }) {
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

/* Ente di Validazione della pratica: il Comune lo vede, lo staff lo assegna. */
function EnteValidazione({ pratica, staff, onFatto }) {
  const [enti, setEnti] = useState(null);
  const [scelta, setScelta] = useState(pratica.ente_validazione_id || "");
  const [errore, setErrore] = useState("");

  async function modifica() {
    const { data } = await elencaEnti();
    setEnti((data || []).filter((e) => e.attivo || e.id === pratica.ente_validazione_id));
  }
  async function salva() {
    setErrore("");
    const { error } = await impostaEntePratica(pratica.id, scelta || null);
    if (error) return setErrore(error.message);
    setEnti(null);
    onFatto();
  }

  if (!staff && !pratica.ente) return null;
  return (
    <div style={{ marginTop: 12, fontSize: 12.5, color: C.grafite, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span>Ente di Validazione: <b style={{ color: C.ink }}>{pratica.ente?.denominazione || "non assegnato"}</b></span>
      {staff && !enti && <button onClick={modifica} style={{ ...linkBtn, marginTop: 0 }}>{pratica.ente ? "Cambia" : "Assegna"}</button>}
      {staff && enti && (
        <>
          <select value={scelta} onChange={(e) => setScelta(e.target.value)} style={{ ...campo, width: "auto" }}>
            <option value="">— nessuno —</option>
            {enti.map((e) => <option key={e.id} value={e.id}>{e.denominazione}</option>)}
          </select>
          <button onClick={salva} style={btnPrimario}>Salva</button>
          <button onClick={() => setEnti(null)} style={btnMini}>Annulla</button>
          {enti.length === 0 && <span>Nessun ente censito: l'Amministratore li inserisce in Impostazioni.</span>}
        </>
      )}
      {errore && <span style={{ color: C.red }}>{errore}</span>}
    </div>
  );
}

/* Cambio di stato della pratica con motivazione obbligatoria. */
function CambioStato({ pratica, onFatto }) {
  const [aperto, setAperto] = useState(false);
  const [stato, setStato] = useState("");
  const [motivazione, setMotivazione] = useState("");
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  if (pratica.stato === "annullata") return null;

  const opzioni = {
    attiva: ["sospesa", "annullata", "chiusa"],
    sospesa: ["attiva", "annullata", "chiusa"],
    chiusa: ["attiva"],
  }[pratica.stato] || [];
  const etichette = { attiva: "Riattiva", sospesa: "Sospendi", annullata: "Annulla", chiusa: "Chiudi pratica" };

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
      <label style={lbl}>
        Motivazione (obbligatoria)
        <input value={motivazione} onChange={(e) => setMotivazione(e.target.value)} style={campo} />
      </label>
      {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
      <Bottoni inCorso={inCorso} conferma="Conferma" onConferma={conferma} onAnnulla={() => setAperto(false)} />
    </div>
  );
}

/* Export del fascicolo completo (ZIP). */
function BottoneFascicolo({ praticaId, staff }) {
  const [stato, setStato] = useState("");
  const [errore, setErrore] = useState("");
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

function Pannello({ children }) {
  return (
    <div style={{ ...riquadro, padding: "40px 28px", textAlign: "center", color: C.grafite }}>
      {children}
    </div>
  );
}

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
