import React, { useRef, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import { csvInOggetti, scriviCsv, scaricaTesto } from "../../lib/csv.js";

/* Tabella di dati modificabile in pagina, con importazione da CSV (anche
   salvato da Excel) e scaricamento del modello.
   colonne: [{ chiave, titolo, tipo: "testo"|"numero"|"si_no"|"scelta",
               opzioni: [{valore, etichetta}], alias: [...], obbligatorio, larghezza }] */
export default function TabellaDati({ colonne, righe, onChange, solaLettura, nomeModello, esempio = [], vuota = "Nessuna riga." }) {
  const inputRef = useRef(null);
  const [messaggio, setMessaggio] = useState(null);

  function aggiorna(i, chiave, valore) {
    const nuove = righe.map((r, j) => (j === i ? { ...r, [chiave]: valore } : r));
    onChange(nuove);
  }

  function aggiungi() {
    const vuota = {};
    colonne.forEach((c) => (vuota[c.chiave] = c.tipo === "si_no" ? false : c.tipo === "scelta" ? c.opzioni?.[0]?.valore ?? "" : ""));
    onChange([...righe, vuota]);
  }

  function rimuovi(i) {
    onChange(righe.filter((_, j) => j !== i));
  }

  async function importa(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const testo = await file.text();
    const schema = colonne.map((c) => ({
      chiave: c.chiave,
      titoli: [c.titolo, c.chiave, ...(c.alias || [])],
      tipo: c.tipo === "numero" ? "numero" : c.tipo === "si_no" ? "si_no" : "testo",
      obbligatorio: c.obbligatorio,
    }));
    const esito = csvInOggetti(testo, schema);
    if (esito.colonneMancanti.length) {
      setMessaggio({ errore: true, testo: `Colonne mancanti nel file: ${esito.colonneMancanti.join(", ")}. Scarica il modello per vedere le intestazioni attese.` });
    } else {
      // Le colonne a scelta accettano sia il valore sia l'etichetta.
      const convertite = esito.righe.map((r) => {
        const o = { ...r };
        colonne.filter((c) => c.tipo === "scelta").forEach((c) => {
          const v = String(o[c.chiave] || "").toLowerCase();
          const trovata = c.opzioni.find((op) => String(op.valore).toLowerCase() === v || String(op.etichetta).toLowerCase() === v);
          o[c.chiave] = trovata ? trovata.valore : o[c.chiave];
        });
        return o;
      });
      onChange(convertite);
      setMessaggio({
        errore: esito.errori.length > 0,
        testo:
          `Importate ${convertite.length} righe.` +
          (esito.erroriTotali ? ` ${esito.erroriTotali} righe scartate: ${esito.errori.slice(0, 3).join(" ")}` : ""),
      });
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function modello() {
    scaricaTesto(
      `${nomeModello || "modello"}.csv`,
      scriviCsv(
        colonne.map((c) => c.titolo),
        esempio.map((r) => colonne.map((c) => (c.tipo === "si_no" ? (r[c.chiave] ? "sì" : "no") : r[c.chiave] ?? "")))
      )
    );
  }

  return (
    <div>
      {!solaLettura && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <button onClick={aggiungi} style={btn}>+ Riga</button>
          <label style={{ ...btn, display: "inline-block" }}>
            Importa CSV
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={importa} style={{ display: "none" }} />
          </label>
          <button onClick={modello} style={btnLink}>Scarica il modello</button>
        </div>
      )}
      {messaggio && (
        <div style={{ fontSize: 12.5, color: messaggio.errore ? C.amber : C.green, marginBottom: 8 }}>{messaggio.testo}</div>
      )}
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 9 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: C.paper, textAlign: "left" }}>
              {colonne.map((c) => (
                <th key={c.chiave} style={{ padding: "7px 8px", fontWeight: 700, color: C.grafite, whiteSpace: "nowrap" }}>{c.titolo}</th>
              ))}
              {!solaLettura && <th style={{ width: 30 }} />}
            </tr>
          </thead>
          <tbody>
            {righe.length === 0 && (
              <tr><td colSpan={colonne.length + 1} style={{ padding: 12, color: C.grafite }}>{vuota}</td></tr>
            )}
            {righe.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                {colonne.map((c) => (
                  <td key={c.chiave} style={{ padding: "3px 4px", minWidth: c.larghezza || 90 }}>
                    {solaLettura ? (
                      <span style={{ padding: "4px", display: "inline-block" }}>
                        {c.tipo === "si_no" ? (r[c.chiave] ? "sì" : "no") : c.tipo === "scelta" ? c.opzioni.find((o) => o.valore === r[c.chiave])?.etichetta ?? r[c.chiave] : r[c.chiave] ?? ""}
                      </span>
                    ) : c.tipo === "si_no" ? (
                      <input type="checkbox" checked={!!r[c.chiave]} onChange={(e) => aggiorna(i, c.chiave, e.target.checked)} aria-label={c.titolo} />
                    ) : c.tipo === "scelta" ? (
                      <select value={r[c.chiave] ?? ""} onChange={(e) => aggiorna(i, c.chiave, e.target.value)} style={campo} aria-label={c.titolo}>
                        {c.opzioni.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
                      </select>
                    ) : (
                      <input
                        value={r[c.chiave] ?? ""}
                        inputMode={c.tipo === "numero" ? "decimal" : undefined}
                        onChange={(e) => aggiorna(i, c.chiave, c.tipo === "numero" ? e.target.value.replace(",", ".") : e.target.value)}
                        style={{ ...campo, textAlign: c.tipo === "numero" ? "right" : "left" }}
                        aria-label={c.titolo}
                      />
                    )}
                  </td>
                ))}
                {!solaLettura && (
                  <td style={{ textAlign: "center" }}>
                    <button onClick={() => rimuovi(i)} aria-label="Elimina riga" style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15 }}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const campo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "5px 6px",
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  fontSize: 12.5,
  fontFamily: "'Inter', sans-serif",
  background: C.white,
};
const btn = {
  background: C.white,
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "6px 11px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const btnLink = { background: "none", border: "none", color: C.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "6px 4px" };
