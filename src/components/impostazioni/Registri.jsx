/* =========================================================================
   Registri (Anagrafiche)
   Scopo: elenco dei registri riconosciuti dal Programma (Guida al
     Programma 3.5, Standard CWP cap. 6), pubblicato sulla pagina pubblica
     /programma: piattaforme esterne su cui il promotore del progetto
     carica e vende i crediti. Requisiti dello Standard: regolamento,
     interfaccia pubblica, cancellazione tombale dei crediti venduti
     (con blockchain entro il 1° gennaio 2028). Un registro non si
     cancella: si disattiva.
   Usato da: pagina Anagrafiche (/anagrafiche).
   Chi lo vede: operatore e admin.
   Dati: elencaRegistri, salvaRegistro (src/lib/dati.js) sulla tabella
     registro_scambio (script 24).
   Sicurezza (garantita dal database): scrive solo lo staff (RLS
     registro_insert e registro_update); ogni modifica è nell'audit.
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { elencaRegistri, salvaRegistro } from "../../lib/dati.js";
import { formatoData } from "../../lib/date.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../stili.js";
import { useOrdinamento, SceltaOrdinamento } from "../Ordinamento.jsx";

/* Sezione «Registri». Nessuna prop. */
export default function Registri() {
  const [voci, setVoci] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const { data, error } = await elencaRegistri();
    if (error) setErrore(error.message);
    setVoci(data || []);
  }
  useEffect(() => { carica(); }, []);

  async function salva() {
    setErrore("");
    if (!modulo.denominazione?.trim()) return setErrore("Indica la denominazione.");
    setInCorso(true);
    const p = (v) => (v || "").trim() || null;
    const { error } = await salvaRegistro({
      id: modulo.id, denominazione: modulo.denominazione.trim(), sito_web: p(modulo.sito_web), regolamento: p(modulo.regolamento),
      pec: p(modulo.pec), referente: p(modulo.referente), blockchain: !!modulo.blockchain, note: p(modulo.note),
      attivo: modulo.attivo !== false, approvato_il: modulo.approvato_il || null,
    });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
  }
  const set = (k) => (e) => setModulo({ ...modulo, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  // Ordinamento dell'elenco («Ordina per»).
  const ord = useOrdinamento(voci, {
    denominazione: (r) => r.denominazione, approvato: (r) => r.approvato_il,
    blockchain: (r) => !!r.blockchain, stato: (r) => (r.attivo ? "attivo" : "disattivato"),
  });

  return (
    <section style={{ ...riquadro, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Registri</h2>
        {!modulo && <button onClick={() => setModulo({ attivo: true, blockchain: false })} style={btnPrimario}>+ Nuovo registro</button>}
      </div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 12px", lineHeight: 1.5 }}>
        Piattaforme di scambio dei crediti riconosciute dal Programma (Standard cap. 6), pubblicate sulla pagina pubblica.
      </p>
      {modulo && (
        <div style={{ marginBottom: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Denominazione *<input value={modulo.denominazione || ""} onChange={set("denominazione")} style={campo} /></label>
            <label style={etichetta}>Sito web<input value={modulo.sito_web || ""} onChange={set("sito_web")} style={campo} /></label>
            <label style={etichetta}>Regolamento (riferimento)<input value={modulo.regolamento || ""} onChange={set("regolamento")} style={campo} /></label>
            <label style={etichetta}>PEC<input value={modulo.pec || ""} onChange={set("pec")} style={campo} /></label>
            <label style={etichetta}>Referente<input value={modulo.referente || ""} onChange={set("referente")} style={campo} /></label>
            <label style={etichetta}>Approvato il<input type="date" value={modulo.approvato_il || ""} onChange={set("approvato_il")} style={campo} /></label>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
            <input type="checkbox" checked={!!modulo.blockchain} onChange={set("blockchain")} /> Cancellazione tombale su blockchain (obbligatoria dal 1° gennaio 2028)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginBottom: 10 }}>
            <input type="checkbox" checked={modulo.attivo !== false} onChange={set("attivo")} /> Attivo (nella lista pubblica)
          </label>
          <label style={etichetta}>Note<textarea rows={2} value={modulo.note || ""} onChange={set("note")} style={{ ...campo, resize: "vertical" }} /></label>
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva"}</button>
            <button onClick={() => setModulo(null)} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
      {voci.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessun registro.</div>}
      {voci.length > 1 && <SceltaOrdinamento ord={ord} opzioni={[["denominazione", "Denominazione"], ["approvato", "Data di approvazione"], ["blockchain", "Blockchain"], ["stato", "Stato"]]} style={{ marginBottom: 10, flexWrap: "wrap" }} />}
      <div style={{ display: "grid", gap: 6 }}>
        {ord.ordinate.map((r) => (
          <div key={r.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: r.attivo ? 1 : 0.6 }}>
            <div style={{ fontSize: 13 }}>
              <b>{r.denominazione}</b>
              <div style={{ fontSize: 11.5, color: C.grafite }}>
                {[r.sito_web, r.blockchain && "blockchain", r.approvato_il && `approvato il ${formatoData(r.approvato_il)}`].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!r.attivo && <Badge bg={C.paperWarm} fg={C.grafite}>disattivato</Badge>}
              {!modulo && <button onClick={() => setModulo({ ...r })} style={btnMini}>Modifica</button>}
            </div>
          </div>
        ))}
      </div>
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </section>
  );
}
