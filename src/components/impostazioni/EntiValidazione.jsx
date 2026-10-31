/* =========================================================================
   EntiValidazione
   Scopo: anagrafica degli Enti di Validazione (backlog 11), sezione della
     pagina Anagrafiche. Elenco degli enti con i Progetti a cui sono
     assegnati (requisiti §3), inserimento di un nuovo ente, modifica e
     disattivazione. L'ente non accede al portale: serve per
     assegnarlo alle pratiche (intestazione della pratica, componente
     EnteValidazione in DettaglioPratica.jsx). Un ente non si cancella, si
     disattiva: resta sulle pratiche a cui era assegnato.
   Usato da: pagina Anagrafiche (/anagrafiche).
   Chi lo vede: operatore e admin.
   Dati: elencaEnti, salvaEnte (src/lib/dati.js) sulla tabella
     ente_validazione (script 17).
   Sicurezza (garantita dal database, script 17): leggono gli enti tutti
     gli utenti autenticati; Operatori e Amministratori inseriscono e
     modificano (RLS ente_insert / ente_update, script 21), nessuno
     cancella; un ente disattivato non
     si può assegnare a nuove pratiche (staff_imposta_ente_validazione). Le
     modifiche sono registrate nell'audit.
   Registro sviluppo e deploy: capitolo «Portale (frontend)»
   ========================================================================= */
import { formatoData } from "../../lib/date.js";
import React, { useEffect, useState } from "react";
import { COLORI as C } from "../../lib/cwpProgram.js";
import Badge from "../Badge.jsx";
import { elencaEnti, salvaEnte } from "../../lib/dati.js";
import { riquadro, campo, etichetta, btnPrimario, btnMini } from "../stili.js";
import { useOrdinamento, SceltaOrdinamento } from "../Ordinamento.jsx";

/* Sezione «Enti di Validazione» delle Anagrafiche.
   Props: pratiche (elenco sintetico di tutte le pratiche, per mostrare i
   Progetti assegnati a ogni ente). */
export default function EntiValidazione({ pratiche = [] }) {
  const [enti, setEnti] = useState([]);
  // null = modulo chiuso; un oggetto = ente in modifica (con id) o nuovo (senza id).
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [inCorso, setInCorso] = useState(false);

  // Rilegge tutti gli enti (attivi e disattivati) in ordine alfabetico.
  async function carica() {
    const { data, error } = await elencaEnti();
    if (error) setErrore(error.message);
    setEnti(data || []);
  }
  useEffect(() => { carica(); }, []);

  // Salva l'ente: aggiorna se ha id, altrimenti lo crea.
  async function salva() {
    setErrore("");
    if (!modulo.denominazione?.trim()) return setErrore("Indica la denominazione dell'ente.");
    setInCorso(true);
    // Si inviano solo i campi del modulo (non creato_il e simili letti dal database).
    const { id, denominazione, identificativo, accreditamento, referente, email, telefono, note, attivo, approvato_il } = modulo;
    // Campo vuoto o solo spazi → null nel database.
    const pulito = (v) => (v || "").trim() || null;
    const { error } = await salvaEnte({
      id,
      denominazione: denominazione.trim(),
      identificativo: pulito(identificativo),
      accreditamento: pulito(accreditamento),
      // Rilievo T07: data di approvazione nel Programma (Guida 3.4).
      approvato_il: approvato_il || null,
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

  // Valori iniziali del modulo; in modifica vengono sovrascritti da quelli dell'ente.
  const nuovo = { denominazione: "", identificativo: "", accreditamento: "", referente: "", email: "", telefono: "", note: "", attivo: true, approvato_il: "" };

  // Ordinamento dell'elenco («Ordina per»).
  const ord = useOrdinamento(enti, {
    denominazione: (e) => e.denominazione, identificativo: (e) => e.identificativo, referente: (e) => e.referente,
    stato: (e) => (e.attivo ? "attivo" : "disattivato"), pratiche: (e) => pratiche.filter((p) => p.ente_validazione_id === e.id).length,
  });

  return (
    <section style={{ ...riquadro, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: 0 }}>Enti di Validazione</h2>
        {!modulo && <button onClick={() => setModulo(nuovo)} style={btnPrimario}>+ Nuovo ente</button>}
      </div>
      <p style={{ fontSize: 13, color: C.grafite, margin: "6px 0 14px", lineHeight: 1.5 }}>
        Gli enti che validano e verificano i Progetti (ad esempio RINA). Non accedono al portale: si assegnano
        alle pratiche dall'intestazione della pratica.
      </p>

      {enti.length === 0 && !modulo && <div style={{ fontSize: 13, color: C.grafite }}>Nessun ente censito.</div>}
      {enti.length > 1 && <SceltaOrdinamento ord={ord} opzioni={[["denominazione", "Denominazione"], ["identificativo", "Identificativo"], ["referente", "Referente"], ["stato", "Stato"], ["pratiche", "Pratiche assegnate"]]} style={{ marginBottom: 10, flexWrap: "wrap" }} />}
      <div style={{ display: "grid", gap: 6 }}>
        {ord.ordinate.map((e) => (
          <div key={e.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", opacity: e.attivo ? 1 : 0.65 }}>
            <div style={{ fontSize: 13 }}>
              <b>{e.denominazione}</b>
              {e.identificativo && <> · {e.identificativo}</>}
              <div style={{ fontSize: 11.5, color: C.grafite }}>
                {[e.approvato_il && `Approvato il ${formatoData(e.approvato_il)}`, e.accreditamento && `Accreditamento: ${e.accreditamento}`, e.referente, e.email, e.telefono].filter(Boolean).join(" · ") || "—"}
              </div>
              <div style={{ fontSize: 11.5, color: C.grafite }}>
                {(() => {
                  const assegnate = pratiche.filter((p) => p.ente_validazione_id === e.id);
                  return assegnate.length ? `Pratiche assegnate: ${assegnate.map((p) => p.codice || p.titolo).join(", ")}` : "Nessuna pratica assegnata";
                })()}
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
            <label style={etichetta}>Approvato il (Guida 3.4)<input type="date" value={modulo.approvato_il || ""} onChange={(e) => setModulo({ ...modulo, approvato_il: e.target.value })} style={campo} /></label>
            <label style={etichetta}>Accreditamento<input value={modulo.accreditamento || ""} onChange={(e) => setModulo({ ...modulo, accreditamento: e.target.value })} style={campo} placeholder="Es. Accredia n. …" /></label>
            <label style={etichetta}>Referente<input value={modulo.referente || ""} onChange={(e) => setModulo({ ...modulo, referente: e.target.value })} style={campo} /></label>
            <label style={etichetta}>Email<input type="email" value={modulo.email || ""} onChange={(e) => setModulo({ ...modulo, email: e.target.value })} style={campo} /></label>
            <label style={etichetta}>Telefono<input value={modulo.telefono || ""} onChange={(e) => setModulo({ ...modulo, telefono: e.target.value })} style={campo} /></label>
          </div>
          <label style={etichetta}>Note<textarea value={modulo.note || ""} onChange={(e) => setModulo({ ...modulo, note: e.target.value })} rows={2} style={{ ...campo, resize: "vertical" }} /></label>
          {/* «Attivo» solo in modifica: un ente nuovo nasce sempre attivo. */}
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
