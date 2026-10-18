/* =========================================================================
   Pagamenti
   Scopo: riquadro «Pagamenti» di una pratica (requisiti §7). Nessun incasso
     online: il back-office censisce il piano previsto (più voci con
     scadenze diverse) e registra a mano gli incassi. Mostra totali,
     incassato, da incassare e lo stato di ogni voce (Pagato, Scaduto,
     Da pagare). Ogni voce ha la sua voce dello Schema tariffario
     (iscrizione, registrazione, emissione, vendita, altro; script 23) e lo
     staff può farsi proporre gli importi dallo Schema tariffario
     (src/lib/tariffe.js) in base al tipo di pratica, alla popolazione e ai
     crediti previsti. Con una voce scaduta e non pagata le attività sono
     sospese: il database non apre nuove fasi; la tariffa di iscrizione va
     saldata prima della fase 5 (Guida 6.2.1 e 6.3.1).
   Usato da: DettaglioPratica.jsx.
   Chi lo vede: operatore e admin (inserimento e modifica); cliente/Comune
     in sola lettura (decisione del 18/10/2026, backlog 27).
   Dati: elencaPagamenti, salvaPagamento (src/lib/dati.js) sulla tabella
     pagamento (script 09 e 17).
   Sicurezza (garantita dal database): solo lo staff scrive (RLS
     pagamento_write, script 17); il Comune legge solo i pagamenti delle
     sue pratiche. Un trigger (pagamento_operatore, script 09) registra chi
     ha salvato e sistema la data di pagamento; ogni modifica va nell'audit.
     Il parametro solaLettura qui nasconde solo i pulsanti.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C, VOCI_PAGAMENTO } from "../lib/cwpProgram.js";
import { proposteTariffe } from "../lib/tariffe.js";
import Badge from "./Badge.jsx";
import { elencaPagamenti, salvaPagamento, nomiUtenti } from "../lib/dati.js";
import { formatoData, giorniA, oggiIso, oggiItalia, aggiungiGiorni } from "../lib/date.js";

/* Riquadro dei pagamenti di una pratica.
   Props: praticaId (id della pratica), pratica (riga della pratica, per le
   proposte dello Schema tariffario), solaLettura (true per il Comune:
   niente pulsanti e diciture «pagato / da pagare» invece di «incassato»). */
export default function Pagamenti({ praticaId, pratica = null, solaLettura = false }) {
  // Proposte dello Schema tariffario: null = chiuse; altrimenti le voci con
  // la casella «scelta».
  const [proposte, setProposte] = useState(null);
  const [voci, setVoci] = useState([]);
  const [modulo, setModulo] = useState(null); // voce in modifica o nuova
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  // Nomi degli operatori che hanno registrato le voci (solo per lo staff,
  // requisiti §7: «operatore»): { [id]: nome }.
  const [operatori, setOperatori] = useState({});

  // Rilegge le voci, ordinate per scadenza (prima le più vicine).
  async function carica() {
    const { data } = await elencaPagamenti(praticaId);
    setVoci(data || []);
    if (!solaLettura) setOperatori(await nomiUtenti((data || []).map((v) => v.registrato_da)));
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  // Salva la voce in modifica (con id) o ne crea una nuova (senza id).
  async function salva() {
    setErrore("");
    if (!modulo.descrizione?.trim()) return setErrore("Indica la voce di pagamento.");
    // Importo facoltativo, scritto all'italiana: "1.234,50", "1234,5" o
    // "1234.50". Con la virgola, i punti sono separatori delle migliaia;
    // senza virgola, un punto seguito da esattamente 3 cifre ("1.234") è
    // un separatore delle migliaia, altrimenti è il decimale ("12.5").
    const importo = leggiImporto(modulo.importo);
    if (importo != null && (isNaN(importo) || importo < 0)) return setErrore("Importo non valido.");
    setInCorso(true);
    const { error } = await salvaPagamento({
      id: modulo.id,
      pratica_id: praticaId,
      descrizione: modulo.descrizione.trim(),
      voce: modulo.voce || "altro",
      importo,
      scadenza: modulo.scadenza || null,
      pagato: !!modulo.pagato,
      // Senza data indicata vale oggi; se la voce non è pagata la data si
      // azzera (lo fa anche il trigger del database).
      data_pagamento: modulo.pagato ? modulo.data_pagamento || oggiIso() : null,
      riferimento: modulo.riferimento?.trim() || null,
    });
    setInCorso(false);
    if (error) setErrore(error.message);
    else {
      setModulo(null);
      carica();
    }
  }

  // Apre le proposte dello Schema tariffario: si propongono già scelte le
  // voci che la pratica non ha ancora e che hanno un importo calcolabile.
  function apriProposte() {
    const presenti = new Set(voci.map((v) => v.voce));
    setProposte(proposteTariffe(pratica || {}).map((p) => ({ ...p, scelta: p.importo != null && !presenti.has(p.voce) })));
  }

  // Salva le voci scelte, con scadenza a 30 giorni (Schema tariffario).
  async function aggiungiProposte() {
    setErrore("");
    setInCorso(true);
    const scadenza = aggiungiGiorni(oggiItalia(), 30);
    for (const p of proposte.filter((x) => x.scelta && x.importo != null)) {
      const { error } = await salvaPagamento({ pratica_id: praticaId, descrizione: p.descrizione, voce: p.voce, importo: p.importo, scadenza, pagato: false, data_pagamento: null, riferimento: null });
      if (error) { setErrore(error.message); break; }
    }
    setInCorso(false);
    setProposte(null);
    carica();
  }

  // Totali: le voci senza importo contano zero.
  const totale = voci.reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const incassato = voci.filter((v) => v.pagato).reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const euro = (n) => (n == null ? "—" : Number(n).toLocaleString("it-IT", { style: "currency", currency: "EUR" }));

  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Pagamenti</h3>
        {!modulo && !proposte && !solaLettura && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pratica && <button onClick={apriProposte} style={btnMini}>Proponi dallo Schema tariffario</button>}
            <button onClick={() => setModulo({ descrizione: "", voce: "altro", importo: "", scadenza: "", pagato: false, riferimento: "" })} style={btnPrimario}>
              + Voce di pagamento
            </button>
          </div>
        )}
      </div>

      {/* Fatture scadute: le attività sono sospese fino al saldo (lo impone
          il database all'apertura delle fasi, script 23). */}
      {voci.some((v) => !v.pagato && giorniA(v.scadenza) < 0) && (
        <div style={{ fontSize: 12.5, color: C.red, marginBottom: 10 }}>
          C'è una voce scaduta non pagata: fino al saldo le attività successive sono sospese (Schema tariffario).
        </div>
      )}

      {proposte && (
        <div style={{ marginBottom: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 8, lineHeight: 1.5 }}>
            Tariffe massime dello Schema tariffario v1.2 (IVA esclusa), scadenza a 30 giorni. Gli importi si possono correggere dopo con «Registra incasso».
          </div>
          {proposte.map((p, i) => (
            <label key={p.voce} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={p.scelta} disabled={p.importo == null} onChange={(e) => setProposte(proposte.map((x, j) => (j === i ? { ...x, scelta: e.target.checked } : x)))} style={{ marginTop: 3 }} />
              <span>
                <b>{p.descrizione}</b> · {p.importo == null ? "—" : euro(p.importo)}
                <span style={{ display: "block", fontSize: 11.5, color: C.grafite }}>{p.nota}</span>
              </span>
            </label>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={aggiungiProposte} disabled={inCorso || !proposte.some((p) => p.scelta)} style={btnPrimario}>{inCorso ? "…" : "Aggiungi le voci scelte"}</button>
            <button onClick={() => setProposte(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}

      {voci.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.grafite, marginBottom: 10 }}>
          {solaLettura
            ? <>Totale {euro(totale)} · pagato {euro(incassato)} · da pagare {euro(totale - incassato)}</>
            : <>Previsto {euro(totale)} · incassato {euro(incassato)} · da incassare {euro(totale - incassato)}</>}
        </div>
      )}
      {voci.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessuna voce registrata.</div>}

      <div style={{ display: "grid", gap: 6 }}>
        {voci.map((v) => {
          // «Scaduto» solo se non pagato e con scadenza già passata.
          const g = !v.pagato ? giorniA(v.scadenza) : null;
          const scaduto = g != null && g < 0;
          return (
            <div key={v.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13 }}>
                <b>{v.descrizione}</b> · {euro(v.importo)}
                {v.voce && v.voce !== "altro" && <span style={{ color: C.grafite }}> · {VOCI_PAGAMENTO[v.voce]}</span>}
                <div style={{ fontSize: 11.5, color: C.grafite }}>
                  {v.scadenza && <>Scadenza {formatoData(v.scadenza)}</>}
                  {v.pagato && <> · {solaLettura ? "pagamento registrato il" : "incassato il"} {formatoData(v.data_pagamento)}</>}
                  {v.riferimento && <> · rif. {v.riferimento}</>}
                  {!solaLettura && v.registrato_da && <> · registrato da {operatori[v.registrato_da] || "—"}</>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {v.pagato ? (
                  <Badge bg="#dfe9db" fg={C.green}>Pagato</Badge>
                ) : scaduto ? (
                  <Badge bg="#f6dcd6" fg={C.red}>Scaduto</Badge>
                ) : (
                  <Badge bg={C.paperWarm} fg={C.grafite}>Da pagare</Badge>
                )}
                {!modulo && !solaLettura && (
                  <button onClick={() => setModulo({ ...v, importo: v.importo ?? "", scadenza: v.scadenza || "", riferimento: v.riferimento || "" })} style={btnMini}>
                    {v.pagato ? "Modifica" : "Registra incasso"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modulo && (
        <div style={{ marginTop: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
            <label style={lbl}>
              Voce
              <input value={modulo.descrizione} onChange={(e) => setModulo({ ...modulo, descrizione: e.target.value })} style={campo} placeholder="Es. quota di adesione" />
            </label>
            <label style={lbl}>
              Voce dello Schema tariffario
              <select value={modulo.voce || "altro"} onChange={(e) => setModulo({ ...modulo, voce: e.target.value })} style={campo}>
                {Object.entries(VOCI_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={lbl}>
              Importo (€)
              <input inputMode="decimal" value={modulo.importo} onChange={(e) => setModulo({ ...modulo, importo: e.target.value })} style={campo} />
            </label>
            <label style={lbl}>
              Scadenza
              <input type="date" value={modulo.scadenza} onChange={(e) => setModulo({ ...modulo, scadenza: e.target.value })} style={campo} />
            </label>
            <label style={lbl}>
              Riferimento / note
              <input value={modulo.riferimento} onChange={(e) => setModulo({ ...modulo, riferimento: e.target.value })} style={campo} placeholder="Es. bonifico n. …" />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0 10px" }}>
            <input type="checkbox" checked={!!modulo.pagato} onChange={(e) => setModulo({ ...modulo, pagato: e.target.checked })} />
            Pagamento registrato
            {modulo.pagato && (
              <input
                type="date"
                aria-label="Data del pagamento"
                value={modulo.data_pagamento || oggiIso()}
                onChange={(e) => setModulo({ ...modulo, data_pagamento: e.target.value })}
                style={{ ...campo, width: "auto" }}
              />
            )}
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva"}</button>
            <button onClick={() => { setModulo(null); setErrore(""); }} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Stili locali (simili a quelli di stili.js, ma con misure proprie).
// Converte l'importo scritto dall'utente in numero (null se vuoto, NaN se non valido).
function leggiImporto(valore) {
  if (valore === "" || valore == null) return null;
  const t = String(valore).trim().replace(/\s|€/g, "");
  if (!t) return null;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600 };
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
  padding: "6px 11px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
