import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { elencaEnti, salvaEnte } from "../../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../stili.js";

/* Anagrafica degli Enti di Validazione (backlog 11) — Impostazioni, solo
   Amministratori. L'ente non accede al portale: serve per assegnarlo alle
   pratiche (intestazione della pratica). Un ente non si cancella, si
   disattiva: resta sulle pratiche a cui era assegnato. Le modifiche sono
   registrate nell'audit (script 17). */
export default function EntiValidazione() {
  const [enti, setEnti] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function carica() {
    const { data, error } = await elencaEnti();
    if (error) setErrore(error.message);
    setEnti(data || []);
  }
  useEffect(() => { carica(); }, []);

  async function salva() {
    setErrore("");
    if (!modulo.denominazione?.trim()) return setErrore("Indica la denominazione dell'ente.");
    setInCorso(true);
    const { id, denominazione, identificativo, accreditamento, referente, email, telefono, note, attivo } = modulo;
    const pulito = (v) => (v || "").trim() || null;
    const { error } = await salvaEnte({
      id,
      denominazione: denominazione.trim(),
      identificativo: pulito(identificativo),
      accreditamento: pulito(accreditamento),
      referente: pulito(referente),
      email: pulito(email),
      telefono: pulito(telefono),
      note: pulito(note),
      attivo: attivo !== false,
    });
    setInCorso(false);
    if (error) return setErrore(error.message);
    setModulo(null);
    carica();
  }

  const nuovo = { denominazione: "", identificativo: "", accreditamento: "", referente: "", email: "", telefono: "", note: "", attivo: true };

  return (
    <section style={{ ...riquadro, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Enti di Validazione</h2>
        {!modulo && <button onClick={() => setModulo(nuovo)} style={btnPrimario}>+ Nuovo ente</button>}
      </div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 14px", lineHeight: 1.5 }}>
        Gli enti che validano e verificano i Progetti (ad esempio RINA). Non accedono al portale: Operatori e
        Amministratori li assegnano alle pratiche dall'intestazione della pratica.
      </p>

      {enti.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessun ente censito.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {enti.map((e) => (
          <div key={e.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: e.attivo ? 1 : 0.65 }}>
            <div style={{ fontSize: 13 }}>
              <b>{e.denominazione}</b>
              {e.identificativo && <> · {e.identificativo}</>}
              <div style={{ fontSize: 11.5, color: C.grafite }}>
                {[e.accreditamento && `Accreditamento: ${e.accreditamento}`, e.referente, e.email, e.telefono].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!e.attivo && <Badge bg={C.paperWarm} fg={C.grafite}>disattivato</Badge>}
              {!modulo && <button onClick={() => setModulo({ ...nuovo, ...e })} style={btnMini}>Modifica</button>}
            </div>
          </div>
        ))}
      </div>

      {modulo && (
        <div style={{ marginTop: 12, padding: 12, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Denominazione *<input value={modulo.denominazione} onChange={(e) => setModulo({ ...modulo, denominazione: e.target.value })} style={campo} placeholder="Es. RINA Services S.p.A." /></label>
            <label style={etichetta}>Identificativo<input value={modulo.identificativo || ""} onChange={(e) => setModulo({ ...modulo, identificativo: e.target.value })} style={campo} placeholder="Es. P.IVA o codice" /></label>
            <label style={etichetta}>Accreditamento<input value={modulo.accreditamento || ""} onChange={(e) => setModulo({ ...modulo, accreditamento: e.target.value })} style={campo} placeholder="Es. Accredia n. …" /></label>
            <label style={etichetta}>Referente<input value={modulo.referente || ""} onChange={(e) => setModulo({ ...modulo, referente: e.target.value })} style={campo} /></label>
            <label style={etichetta}>Email<input type="email" value={modulo.email || ""} onChange={(e) => setModulo({ ...modulo, email: e.target.value })} style={campo} /></label>
            <label style={etichetta}>Telefono<input value={modulo.telefono || ""} onChange={(e) => setModulo({ ...modulo, telefono: e.target.value })} style={campo} /></label>
          </div>
          <label style={etichetta}>Note<textarea value={modulo.note || ""} onChange={(e) => setModulo({ ...modulo, note: e.target.value })} rows={2} style={{ ...campo, resize: "vertical" }} /></label>
          {modulo.id && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={modulo.attivo !== false} onChange={(e) => setModulo({ ...modulo, attivo: e.target.checked })} />
              Attivo (se lo togli, l'ente non si può più assegnare a nuove pratiche)
            </label>
          )}
          {errore && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 8 }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={salva} disabled={inCorso} style={btnPrimario}>{inCorso ? "…" : "Salva"}</button>
            <button onClick={() => { setModulo(null); setErrore(""); }} style={btnMini}>Annulla</button>
          </div>
        </div>
      )}
      {!modulo && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
    </section>
  );
}
