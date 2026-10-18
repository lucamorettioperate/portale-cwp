import React, { useEffect, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import Badge from "./Badge.jsx";
import { elencaPagamenti, salvaPagamento } from "../lib/dati.js";
import { formatoData, giorniA, oggiIso } from "../lib/date.js";

/* Pagamenti (requisiti §7): nessun incasso online. Il back-office censisce
   il piano previsto (più voci con scadenze diverse) e registra gli incassi.
   L'operatore e ogni modifica sono registrati dal database.
   solaLettura: il Comune vede le voci e lo stato dei pagamenti ma non le
   modifica (decisione del 18/10/2026, backlog 27; regola nel database,
   script 17). */
export default function Pagamenti({ praticaId, solaLettura = false }) {
  const [voci, setVoci] = useState([]);
  const [modulo, setModulo] = useState(null); // voce in modifica o nuova
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const { data } = await elencaPagamenti(praticaId);
    setVoci(data || []);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  async function salva() {
    setErrore("");
    if (!modulo.descrizione?.trim()) return setErrore("Indica la voce di pagamento.");
    const importo = modulo.importo === "" || modulo.importo == null ? null : Number(String(modulo.importo).replace(",", "."));
    if (importo != null && (isNaN(importo) || importo < 0)) return setErrore("Importo non valido.");
    setInCorso(true);
    const { error } = await salvaPagamento({
      id: modulo.id,
      pratica_id: praticaId,
      descrizione: modulo.descrizione.trim(),
      importo,
      scadenza: modulo.scadenza || null,
      pagato: !!modulo.pagato,
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

  const totale = voci.reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const incassato = voci.filter((v) => v.pagato).reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const euro = (n) => (n == null ? "—" : Number(n).toLocaleString("it-IT", { style: "currency", currency: "EUR" }));

  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: 0 }}>Pagamenti</h3>
        {!modulo && !solaLettura && (
          <button onClick={() => setModulo({ descrizione: "", importo: "", scadenza: "", pagato: false, riferimento: "" })} style={btnPrimario}>
            + Voce di pagamento
          </button>
        )}
      </div>

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
          const g = !v.pagato ? giorniA(v.scadenza) : null;
          const scaduto = g != null && g < 0;
          return (
            <div key={v.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13 }}>
                <b>{v.descrizione}</b> · {euro(v.importo)}
                <div style={{ fontSize: 11.5, color: C.grafite }}>
                  {v.scadenza && <>Scadenza {formatoData(v.scadenza)}</>}
                  {v.pagato && <> · {solaLettura ? "pagamento registrato il" : "incassato il"} {formatoData(v.data_pagamento)}</>}
                  {v.riferimento && <> · rif. {v.riferimento}</>}
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
