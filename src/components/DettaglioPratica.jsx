import React, { useEffect, useState } from "react";
import { COLORI as C, STATI_PRATICA, STATI_FASE, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Badge from "./Badge.jsx";
import Documenti from "./Documenti.jsx";
import { leggiPratica, aggiornaFase, registraAudit } from "../lib/dati.js";

/* Dettaglio di una pratica con le sue 7 fasi.
   L'Operatore/Admin può aprire e chiudere le fasi (azioni esplicite). */
export default function DettaglioPratica({ praticaId, onAggiornato }) {
  const { ruolo, utente } = useAuth();
  const [pratica, setPratica] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [azioneInCorso, setAzioneInCorso] = useState(false);

  const staff = ruolo === "operatore" || ruolo === "admin";

  async function carica() {
    setCaricamento(true);
    const { data } = await leggiPratica(praticaId);
    setPratica(data);
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticaId]);

  if (caricamento) return <Pannello>Caricamento…</Pannello>;
  if (!pratica) return <Pannello>Pratica non trovata.</Pannello>;

  const fasi = (pratica.fasi || []).sort((a, b) => a.numero - b.numero);
  const st = STATI_PRATICA[pratica.stato] || STATI_PRATICA.attiva;

  // Apre o chiude una fase e registra l'operazione nell'audit.
  async function cambiaFase(fase, nuovoStato) {
    if (!staff || azioneInCorso) return;
    setAzioneInCorso(true);
    const modifiche =
      nuovoStato === "in_corso"
        ? { stato: "in_corso", data_apertura: new Date().toISOString().slice(0, 10) }
        : { stato: "completata", data_effettiva_chiusura: new Date().toISOString().slice(0, 10) };
    const { error } = await aggiornaFase(fase.id, modifiche);
    if (!error) {
      await registraAudit({
        utente_id: utente?.id,
        ruolo,
        operazione: nuovoStato === "in_corso" ? "apertura fase" : "chiusura fase",
        oggetto_tipo: "pratica",
        oggetto_id: pratica.id,
        stato_precedente: `${fase.nome} / ${fase.stato}`,
        stato_successivo: `${fase.nome} / ${nuovoStato}`,
      });
      await carica();
      onAggiornato && onAggiornato();
    }
    setAzioneInCorso(false);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* Intestazione pratica */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: "22px 24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.grafite, fontWeight: 600 }}>
              {pratica.codice || "senza codice"}
            </div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 23, margin: "3px 0 4px", letterSpacing: -0.5 }}>
              {pratica.organizzazione?.denominazione || "—"}
            </h1>
            <div style={{ fontSize: 13, color: C.grafite }}>
              {pratica.titolo || "Progetto"} · {pratica.organizzazione?.tipo || ""}
            </div>
          </div>
          <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
        </div>
      </div>

      {/* Le 7 fasi */}
      <div style={{ display: "grid", gap: 10 }}>
        {fasi.map((f) => {
          const sf = STATI_FASE[f.stato] || STATI_FASE.non_iniziata;
          const resp = f.responsabile || "";
          return (
            <div
              key={f.id}
              style={{
                background: C.white,
                border: `1px solid ${f.stato === "in_corso" ? C.green : C.line}`,
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
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</span>
                  <Badge bg={sf.bg} fg={sf.fg}>{sf.label}</Badge>
                </div>
                {resp && (
                  <div style={{ fontSize: 11.5, color: C.grafite, marginTop: 5 }}>
                    Responsabile: {resp}
                  </div>
                )}
                {/* Azioni staff */}
                {staff && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {f.stato === "non_iniziata" && (
                      <button onClick={() => cambiaFase(f, "in_corso")} disabled={azioneInCorso} style={btnPrimario}>
                        Apri fase
                      </button>
                    )}
                    {f.stato === "in_corso" && (
                      <button onClick={() => cambiaFase(f, "completata")} disabled={azioneInCorso} style={btnPrimario}>
                        Chiudi fase
                      </button>
                    )}
                    {f.stato === "completata" && (
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>
                        ✓ Completata {f.data_effettiva_chiusura ? `il ${f.data_effettiva_chiusura}` : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Documenti della pratica */}
      <Documenti praticaId={pratica.id} />
    </div>
  );
}

function Pannello({ children }) {
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "40px 28px",
        textAlign: "center",
        color: C.grafite,
      }}
    >
      {children}
    </div>
  );
}

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
