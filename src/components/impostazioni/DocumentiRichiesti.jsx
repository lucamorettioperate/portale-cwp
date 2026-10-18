/* =========================================================================
   DocumentiRichiesti (Impostazioni)
   Scopo: elenco dei documenti richiesti in ogni fase (requisiti §4,
     «eventuali documenti richiesti»), per Progetto e Rapporto di
     Monitoraggio. Ogni voce è una tipologia di documento attesa in una
     fase; nella pratica la fase mostra «presente / manca» (componente
     DocumentiRichiesti di DettaglioPratica.jsx). È solo un indicatore: non
     blocca la chiusura della fase (decisione di Luca del 18/10/2026).
     Una voce non si cancella: si toglie (attivo = false) e si può rimettere.
   Usato da: pagina Impostazioni (/impostazioni).
   Chi lo vede: admin.
   Dati: elencaDocumentiRichiesti({ tutti: true }), salvaDocumentoRichiesto
     (src/lib/dati.js) sulla tabella documento_richiesto (script 21).
   Sicurezza (garantita dal database, script 21): leggono tutti gli utenti
     autenticati, scrivono solo gli Amministratori (RLS richiesto_insert e
     richiesto_update); nessuna cancellazione; ogni modifica è nell'audit.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C, TIPOLOGIE_DOCUMENTO, TIPI_PRATICA, fasiDi } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { elencaDocumentiRichiesti, salvaDocumentoRichiesto } from "../../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../stili.js";

// Valore speciale del menu: tipologia scritta a mano.
const ALTRA = "__altra__";

/* Sezione «Documenti richiesti per fase» delle Impostazioni. Nessuna prop. */
export default function DocumentiRichiesti() {
  const [voci, setVoci] = useState([]);
  // null = modulo chiuso; altrimenti la nuova voce in compilazione.
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  // Rilegge tutte le voci, anche quelle tolte.
  async function carica() {
    const { data, error } = await elencaDocumentiRichiesti({ tutti: true });
    if (error) setErrore(error.message);
    setVoci(data || []);
  }
  useEffect(() => { carica(); }, []);

  // Salva la nuova voce. Una tipologia già presente nella stessa fase viene
  // rifiutata dal database (vincolo unico): in quel caso basta rimetterla.
  async function salva() {
    setErrore("");
    const tipologia = (modulo.tipologia === ALTRA ? modulo.altra : modulo.tipologia || "").trim();
    if (!tipologia) return setErrore("Indica la tipologia del documento.");
    setInCorso(true);
    const { error } = await salvaDocumentoRichiesto({
      tipo_pratica: modulo.tipo,
      fase_numero: Number(modulo.fase),
      tipologia,
      descrizione: (modulo.descrizione || "").trim() || null,
    });
    setInCorso(false);
    if (error) {
      return setErrore(/duplicate|unique/i.test(error.message)
        ? "Questa tipologia è già nell'elenco della fase: se è stata tolta, premi «Rimetti»."
        : error.message);
    }
    setModulo(null);
    carica();
  }

  // Toglie o rimette una voce.
  async function cambiaAttivo(v, attivo) {
    setErrore("");
    const { error } = await salvaDocumentoRichiesto({ id: v.id, attivo });
    if (error) setErrore(error.message);
    carica();
  }

  const nomeFase = (tipo, n) => fasiDi(tipo).find((f) => f.numero === n)?.nome || "";

  return (
    <section style={{ ...riquadro, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Documenti richiesti per fase</h2>
        {!modulo && (
          <button onClick={() => setModulo({ tipo: "progetto", fase: "1", tipologia: TIPOLOGIE_DOCUMENTO[0], altra: "", descrizione: "" })} style={btnPrimario}>
            + Aggiungi
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 14px", lineHeight: 1.5 }}>
        I documenti che ci si aspetta in ogni fase. Nella pratica la fase mostra quali sono presenti e quali mancano
        (un documento conta se ha quella tipologia); la fase si può chiudere comunque.
      </p>

      {voci.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessun documento richiesto.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {voci.map((v) => (
          <div key={v.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: v.attivo ? 1 : 0.6 }}>
            <div style={{ fontSize: 13, minWidth: 0 }}>
              <span style={{ color: C.grafite }}>{TIPI_PRATICA[v.tipo_pratica]} · Fase {v.fase_numero} {nomeFase(v.tipo_pratica, v.fase_numero)} · </span>
              <b>{v.tipologia}</b>
              {v.descrizione && <div style={{ fontSize: 11.5, color: C.grafite }}>{v.descrizione}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!v.attivo && <Badge bg={C.paperWarm} fg={C.grafite}>tolto</Badge>}
              <button onClick={() => cambiaAttivo(v, !v.attivo)} style={btnMini}>{v.attivo ? "Togli" : "Rimetti"}</button>
            </div>
          </div>
        ))}
      </div>

      {modulo && (
        <div style={{ marginTop: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>
              Tipo di pratica
              <select value={modulo.tipo} onChange={(e) => setModulo({ ...modulo, tipo: e.target.value, fase: "1" })} style={campo}>
                <option value="progetto">Progetto</option>
                <option value="rapporto">Rapporto di Monitoraggio</option>
              </select>
            </label>
            <label style={etichetta}>
              Fase
              <select value={modulo.fase} onChange={(e) => setModulo({ ...modulo, fase: e.target.value })} style={campo}>
                {fasiDi(modulo.tipo).map((f) => <option key={f.numero} value={f.numero}>Fase {f.numero} · {f.nome}</option>)}
              </select>
            </label>
            <label style={etichetta}>
              Tipologia del documento
              <select value={modulo.tipologia} onChange={(e) => setModulo({ ...modulo, tipologia: e.target.value })} style={campo}>
                {TIPOLOGIE_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}
                <option value={ALTRA}>Altra (scrivila)…</option>
              </select>
            </label>
            {modulo.tipologia === ALTRA && (
              <label style={etichetta}>
                Nuova tipologia
                <input value={modulo.altra} onChange={(e) => setModulo({ ...modulo, altra: e.target.value })} style={campo} placeholder="Es. Delibera tariffaria" />
              </label>
            )}
          </div>
          <label style={etichetta}>
            Descrizione (facoltativa, la vede anche il Comune)
            <input value={modulo.descrizione} onChange={(e) => setModulo({ ...modulo, descrizione: e.target.value })} style={campo} placeholder="Es. firmato dal legale rappresentante" />
          </label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Aggiungi"}</button>
            <button onClick={() => { setModulo(null); setErrore(""); }} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </section>
  );
}
