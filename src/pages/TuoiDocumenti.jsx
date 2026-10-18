/* =========================================================================
   I tuoi documenti — indirizzo «/documenti»
   Scopo: (requisiti §5) raccoglie i documenti GENERALI (non legati a una
     fase) di tutte le pratiche dell'organizzazione: contratto, allegati,
     documentazione amministrativa e altri documenti della Fondazione,
     raggruppati per tipologia, con download. Di base mostra solo la
     versione corrente; una casella mostra anche le versioni precedenti.
     Sotto: modelli generali da scaricare e Manuale del portale.
     La firma avviene fuori dalla piattaforma: qui si conserva il documento
     firmato.
   Chi la usa: cliente (Comune/azienda). La pagina non blocca altri ruoli:
     allo staff mostrerebbe i documenti generali di tutte le pratiche.
   Dati: elencaDocumentiOrganizzazione() e urlDocumento() (tabella
     "documento", archivio "documenti"), elencaModelli() e urlModello()
     (tabella "modello_documento", archivio "modelli") di src/lib/dati.js.
   Sicurezza: quali documenti si vedono lo decide il database (policy
     doc_select: pratica della propria organizzazione e documento visibile
     al cliente o pubblico). Lo scaricamento passa da un indirizzo firmato
     valido 60 secondi. I modelli disattivati sono nascosti da RLS
     (modello_select, script 17).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C, TIPOLOGIE_DOCUMENTO } from "../lib/cwpProgram.js";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import { elencaDocumentiOrganizzazione, urlDocumento, elencaModelli, urlModello } from "../lib/dati.js";
import { formatoData } from "../lib/date.js";
import { ElencoDocumenti } from "./Documentazione.jsx";

/* Pagina «I tuoi documenti». Nessuna prop, nessun caricamento di file:
   solo consultazione e download. */
export default function TuoiDocumenti() {
  const [documenti, setDocumenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  // Vero = mostra anche le versioni non più correnti.
  const [storico, setStorico] = useState(false);

  // Lettura una tantum all'apertura.
  useEffect(() => {
    elencaDocumentiOrganizzazione().then(({ data, error }) => {
      if (error) setErrore(error.message);
      setDocumenti(data || []);
      setCaricamento(false);
    });
  }, []);

  // Raggruppa per tipologia, nell'ordine standard (TIPOLOGIE_DOCUMENTO di
  // cwpProgram.js); le tipologie fuori elenco vanno in fondo.
  // Restituisce un array di coppie [tipologia, documenti].
  const gruppi = useMemo(() => {
    // Il flag "corrente" lo gestisce il database (script 07): un nuovo
    // caricamento con lo stesso nome nella stessa pratica diventa la
    // versione corrente e le precedenti restano nello storico.
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

  // Apre il documento in una nuova scheda con un indirizzo firmato
  // temporaneo. Se l'indirizzo non arriva non succede nulla.
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

        {/* Modelli generali da scaricare (caricati dalla Fondazione, backlog 12) */}
        <ModelliGenerali />

        {/* Manuale del portale, sempre disponibile anche qui */}
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: "26px 0 10px" }}>Manuale del portale</h2>
        <ElencoDocumenti compatto />
      </main>
    </div>
  );
}

/* Modelli di documento generali (non legati a una fase): moduli e
   fac-simile pubblicati dalla Fondazione in Impostazioni.
   Nessuna prop. Se non ci sono modelli la sezione non compare. I modelli
   legati a una fase (fase_numero valorizzato) sono mostrati nella fase
   della pratica, non qui. */
function ModelliGenerali() {
  const [modelli, setModelli] = useState([]);
  useEffect(() => {
    elencaModelli().then(({ data }) => setModelli((data || []).filter((m) => !m.fase_numero)));
  }, []);
  if (!modelli.length) return null;
  // Scarica il modello: l'indirizzo firmato è creato con download: true,
  // quindi basta navigarci (il browser salva il file).
  async function scarica(m) {
    const { data } = await urlModello(m.storage_path);
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }
  return (
    <>
      <h2 style={{ fontFamily: "'Archivo'", fontSize: 15, margin: "26px 0 10px" }}>Modelli da scaricare</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {modelli.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.white, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 12px" }}>
            <div>
              <b style={{ fontSize: 13.5 }}>{m.titolo}</b>
              {m.descrizione && <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 2 }}>{m.descrizione}</div>}
            </div>
            <button onClick={() => scarica(m)} style={{ background: "transparent", color: C.green, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Scarica
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
