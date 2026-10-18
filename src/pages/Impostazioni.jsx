import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { elencaDurateFasi, impostaDurataFase } from "../lib/dati.js";

/* Impostazioni del Programma — solo Amministratori.
   Durata delle 7 fasi: la modifica vale per le fasi aperte da quel momento;
   le scadenze già fissate restano invariate. Ogni modifica richiede una
   motivazione ed è registrata nell'audit trail. */
export default function Impostazioni() {
  const { ruolo } = useAuth();
  const [fasi, setFasi] = useState([]);
  const [bozza, setBozza] = useState({});
  const [motivazione, setMotivazione] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");
  const [esito, setEsito] = useState("");

  async function carica() {
    setCaricamento(true);
    const { data, error } = await elencaDurateFasi();
    if (error) setErrore(error.message);
    setFasi(data || []);
    setBozza(Object.fromEntries((data || []).map((f) => [f.numero, String(f.giorni)])));
    setCaricamento(false);
  }

  useEffect(() => {
    if (ruolo === "admin") carica();
  }, [ruolo]);

  // Giorno di inizio e fine di ciascuna fase, calcolati sulle durate in bozza.
  const righe = useMemo(() => {
    let giorno = 0;
    return fasi.map((f) => {
      const valore = bozza[f.numero];
      const n = Number(valore);
      const valido = valore !== "" && Number.isInteger(n) && n >= 0 && n <= 365;
      const durata = valido ? n : f.giorni;
      const riga = { ...f, inizio: giorno, fine: giorno + durata, valido, cambiata: valido && n !== f.giorni };
      giorno += durata;
      return riga;
    });
  }, [fasi, bozza]);

  const cambiate = righe.filter((r) => r.cambiata);
  const nonValide = righe.filter((r) => !r.valido);
  const totale = righe.length ? righe[righe.length - 1].fine : 0;

  async function salva() {
    setErrore("");
    setEsito("");
    if (nonValide.length) return setErrore("Ogni durata deve essere un numero intero di giorni tra 0 e 365.");
    if (motivazione.trim().length < 3) return setErrore("Scrivi la motivazione della modifica (ad esempio la decisione della Fondazione).");
    setSalvataggio(true);
    for (const r of cambiate) {
      const { error } = await impostaDurataFase(r.numero, Number(bozza[r.numero]), motivazione.trim());
      if (error) {
        setErrore(`${r.nome}: ${error.message}`);
        setSalvataggio(false);
        await carica();
        return;
      }
    }
    setSalvataggio(false);
    setMotivazione("");
    setEsito(cambiate.length === 1 ? "Durata aggiornata." : `${cambiate.length} durate aggiornate.`);
    await carica();
  }

  if (ruolo !== "admin") {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>
          Questa sezione è riservata agli amministratori.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "22px 24px" }}>
        <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Impostazioni</h1>
        <p style={{ fontSize: 13.5, color: C.grafite, margin: "0 0 18px" }}>
          Parametri del Programma Carbon WastePrint modificabili dagli amministratori.
        </p>

        <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px" }}>
          <h2 style={{ fontFamily: "'Archivo'", fontSize: 17, margin: "0 0 4px" }}>Durata delle fasi</h2>
          <p style={{ fontSize: 13, color: C.grafite, margin: "0 0 14px", lineHeight: 1.5 }}>
            Quando un operatore apre una fase, la scadenza è calcolata con questi giorni. Una modifica vale
            per le fasi aperte da quel momento: le scadenze già fissate restano come sono e si possono
            cambiare pratica per pratica con "Modifica scadenza".
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.grafite, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  <th style={th}>Fase</th>
                  <th style={{ ...th, textAlign: "right" }}>Durata (giorni)</th>
                  <th style={{ ...th, textAlign: "right" }}>Dal giorno</th>
                  <th style={{ ...th, textAlign: "right" }}>Al giorno</th>
                  <th style={th}>Ultima modifica</th>
                </tr>
              </thead>
              <tbody>
                {caricamento && <tr><td colSpan={5} style={{ ...td, color: C.grafite }}>Caricamento…</td></tr>}
                {!caricamento && righe.map((r) => (
                  <tr key={r.numero} style={{ borderTop: `1px solid ${C.line}`, background: r.cambiata ? C.greenSoft : "transparent" }}>
                    <td style={td}>
                      <span style={{ color: C.grafite, marginRight: 6 }}>{r.numero}.</span>
                      {r.nome}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {r.numero === 1 ? (
                        <span style={{ color: C.grafite, fontSize: 12 }}>avvio</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={365}
                          step={1}
                          inputMode="numeric"
                          value={bozza[r.numero] ?? ""}
                          onChange={(e) => setBozza((b) => ({ ...b, [r.numero]: e.target.value }))}
                          aria-label={`Durata in giorni: ${r.nome}`}
                          style={{
                            width: 72,
                            padding: "6px 8px",
                            textAlign: "right",
                            fontSize: 13,
                            border: `1px solid ${r.valido ? C.line : C.red}`,
                            borderRadius: 8,
                          }}
                        />
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{r.inizio}</td>
                    <td style={{ ...td, textAlign: "right" }}>{r.fine}</td>
                    <td style={{ ...td, color: C.grafite, fontSize: 12 }}>
                      {r.aggiornato_da ? new Date(r.aggiornato_il).toLocaleDateString("it-IT") : "valore iniziale"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!caricamento && (
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${C.line}`, fontWeight: 700 }}>
                    <td style={td}>Durata complessiva</td>
                    <td style={{ ...td, textAlign: "right" }}>{totale} giorni</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {cambiate.length > 0 && (
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }} htmlFor="motivazione-durate">
                Motivazione della modifica (obbligatoria, finisce nell'audit)
              </label>
              <input
                id="motivazione-durate"
                value={motivazione}
                onChange={(e) => setMotivazione(e.target.value)}
                placeholder="Es. delibera della Fondazione del 18/10/2026"
                style={{ padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={salva}
                  disabled={salvataggio}
                  style={{ background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: salvataggio ? 0.6 : 1 }}
                >
                  {salvataggio ? "Salvataggio…" : `Salva ${cambiate.length === 1 ? "la modifica" : `${cambiate.length} modifiche`}`}
                </button>
                <button
                  onClick={() => { setBozza(Object.fromEntries(fasi.map((f) => [f.numero, String(f.giorni)]))); setErrore(""); }}
                  disabled={salvataggio}
                  style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
          {errore && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{errore}</div>}
          {esito && <div style={{ color: C.green, fontSize: 13, marginTop: 10, fontWeight: 600 }}>{esito}</div>}
        </section>
      </main>
    </div>
  );
}

const th = { padding: "8px 10px", fontWeight: 700 };
const td = { padding: "8px 10px", verticalAlign: "middle" };
