import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C, TIPOLOGIE_DOCUMENTO } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { elencaDocumentiOrganizzazione, urlDocumento } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";

/* "I tuoi documenti" (requisiti §5): contratto, allegati, documentazione
   amministrativa e altri documenti della Fondazione, raccolti da tutte le
   pratiche dell'organizzazione. La firma avviene fuori dalla piattaforma:
   qui si conserva il documento firmato. */
export default function TuoiDocumenti() {
  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [storico, setStorico] = useState(false);

  useEffect(() => {
    elencaDocumentiOrganizzazione().then(({ data, error }) => {
      if (error) setErrore(error.message);
      setDocumenti(data || []);
      setCaricamento(false);
    });
  }, []);

  // Raggruppa per tipologia, nell'ordine standard.
  const gruppi = useMemo(() => {
    const visibili = documenti.filter((d) => storico || d.corrente);
    const ordine = [...TIPOLOGIE_DOCUMENTO, "Senza tipologia"];
    const mappa = {};
    visibili.forEach((d) => {
      const t = d.tipologia || "Senza tipologia";
      (mappa[t] = mappa[t] || []).push(d);
    });
    return Object.keys(mappa)
      .sort((a, b) => (ordine.indexOf(a) + 1 || 99) - (ordine.indexOf(b) + 1 || 99))
      .map((t) => [t, mappa[t]]);
  }, [documenti, storico]);

  async function scarica(d) {
    const { data } = await urlDocumento(d.storage_path);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>I tuoi documenti</h1>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: 0 }}>
              Contratto, allegati e documentazione amministrativa delle tue pratiche.
            </p>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: C.grafite }}>
            <input type="checkbox" checked={storico} onChange={(e) => setStorico(e.target.checked)} />
            Mostra anche le versioni precedenti
          </label>
        </div>

        {errore && <div style={{ color: C.red, fontSize: 13 }}>{errore}</div>}
        {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}
        {!caricamento && gruppi.length === 0 && (
          <div style={{ background: C.white, border: `1px dashed ${C.line}`, borderRadius: 12, padding: "28px 22px", textAlign: "center", color: C.grafite, fontSize: 14 }}>
            Non ci sono ancora documenti. Quando la Fondazione caricherà il contratto o altri documenti, li troverai qui.
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {gruppi.map(([tipologia, docs]) => (
            <section key={tipologia} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 18px" }}>
              <h2 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: "0 0 10px" }}>{tipologia}</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {docs.map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px", opacity: d.corrente ? 1 : 0.75 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <b style={{ fontSize: 13.5 }}>{d.nome}</b>
                        <Badge bg={C.greenSoft} fg={C.green}>v{d.versione}</Badge>
                        {!d.corrente && <Badge bg={C.paperWarm} fg={C.grafite}>versione precedente</Badge>}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 2 }}>
                        {d.pratica?.codice}
                        {d.pratica?.organizzazione?.denominazione ? ` · ${d.pratica.organizzazione.denominazione}` : ""}
                        {` · ${formatoData(d.creato_il)}`}
                      </div>
                    </div>
                    <button onClick={() => scarica(d)} style={{ background: "transparent", color: C.green, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Scarica
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
