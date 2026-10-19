/* =========================================================================
   Simulatore di scenari — indirizzo «/simulatore»
   Scopo: stima ex ante, non certificabile, dei crediti che un Comune
     potrebbe generare in 7, 10 o 21 anni (Registro, backlog punto 37).
     - Elenco degli scenari raggruppati per Comune, con confronto dei
       totali; «+ Nuovo scenario» (Comune censito o solo nome).
     - Editor dello scenario in quattro parti:
       1. Impostazioni: nome, note, durata (menu 7 / 10 / 21 anni), anno di
          inizio, buffer;
       2. Scenario di riferimento (Standard 4.8.1): l'anno in cui il
          Comune ha raggiunto il 65% di differenziata (a mano o, per gli
          Amministratori, da un calcolo esistente) oppure i valori medi del
          cluster SOSE (Tabella 3) × popolazione ISPRA 2022; avvisi di
          conformità (64-66%, scostamento ±30% dalla Tabella 3);
          più la situazione attuale facoltativa, punto di partenza degli
          obiettivi;
       3. Obiettivi anno per anno: popolazione, produzione totale (t) o pro
          capite, secco residuo pro capite; traiettoria lineare automatica;
       4. Risultati: % di differenziata e crediti stimati per anno e sul
          periodo, grafici, tabella, avvisi, export CSV e stampa;
       5. Simulazione economica: valore del credito digitato anno per anno
          (proposto 32 €, «Applica a tutti gli anni» con variazione annua);
          costi a carico del Comune: la pagina chiede se simulare in base al
          Caso 1 (progetto volontario) o al Caso 2 (progetto obbligatorio da
          bando), tabelle del 28/07/2026; in alternativa Schema tariffario
          (src/lib/tariffe.js) o nessuna tariffa; ente e altri costi;
          ricavi, costi e margine per anno, anno di rientro, per abitante.
     I risultati si ricalcolano a ogni modifica (motore nel browser,
     src/lib/crediti/simulatore.js); «Salva» li conserva nel database.
   Chi la usa: Operatori e Amministratori (il Comune non vede gli scenari:
     scelta provvisoria, Registro, decisioni aperte).
   Dati: scenari.js (tabella scenario_simulazione, script 28);
     elencaOrganizzazioni() di dati.js; per l'import, elencaCalcoli() e
     leggiCalcolo() di crediti/archivio.js (solo Amministratori).
   Sicurezza: policy scenario_staff (solo staff); audit di ogni modifica.
   Registro sviluppo e deploy: capitolo 15 «Calcolo crediti»; note in
     docs/crediti-cwp.md; uso passo per passo nel Manuale Amministratore.
   ========================================================================= */
import React, { useEffect, useMemo, useState } from "react";
import { COLORI as C } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import { elencaOrganizzazioni } from "../lib/dati.js";
import { elencaCalcoli, leggiCalcolo } from "../lib/crediti/archivio.js";
import { CLUSTER } from "../lib/crediti/qualita.js";
import { formatoData } from "../lib/date.js";
import {
  DURATE, TIPOLOGIE, datiIniziali, riepilogoAnnoBase, rifiutiDaCluster, rifiutiDaCalcolo,
  anniDelPeriodo, traiettoriaLineare, simula, righeCsv, puntoDiPartenza, RD_SOGLIA, simulaEconomia, economiaIniziale, prezziPerAnni, PREZZO_PROPOSTO, costiPerCaso, listinoDi, CASI_COSTI,
} from "../lib/crediti/simulatore.js";
import { elencaScenari, leggiScenario, creaScenario, salvaScenario, duplicaScenario, eliminaScenario } from "../lib/crediti/scenari.js";

// Numero in formato italiano; "—" se manca.
const fmt = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function Simulatore() {
  const { ruolo } = useAuth();
  const staff = ruolo === "admin" || ruolo === "operatore";
  const [scenari, setScenari] = useState([]);
  const [organizzazioni, setOrganizzazioni] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [nuovo, setNuovo] = useState(null);
  const [aperto, setAperto] = useState(null); // scenario completo in modifica
  const [modificato, setModificato] = useState(false);
  const [messaggio, setMessaggio] = useState("");

  async function ricarica() {
    const { data, error } = await elencaScenari();
    if (error) setErrore(traduci(error));
    setScenari(data || []);
    setCaricamento(false);
  }

  useEffect(() => {
    if (!staff) return;
    ricarica();
    elencaOrganizzazioni().then(({ data }) => setOrganizzazioni(data || []));
  }, [staff]);

  // Apre uno scenario (chiede conferma se ci sono modifiche non salvate).
  async function apri(id) {
    if (modificato && !window.confirm("Ci sono modifiche non salvate. Aprire comunque un altro scenario?")) return;
    setErrore("");
    setMessaggio("");
    const { data, error } = await leggiScenario(id);
    if (error) return setErrore(traduci(error));
    setAperto(data);
    setModificato(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function crea() {
    setErrore("");
    const org = organizzazioni.find((o) => o.id === nuovo.organizzazioneId);
    const comune = (org?.denominazione || nuovo.comune).trim();
    if (!comune) return setErrore("Indica il Comune.");
    if (!nuovo.nome.trim()) return setErrore("Dai un nome allo scenario.");
    const { data, error } = await creaScenario({
      comune,
      organizzazioneId: org?.id || null,
      nome: nuovo.nome.trim(),
      durata: Number(nuovo.durata),
      annoInizio: Number(nuovo.annoInizio),
      dati: datiIniziali(Number(nuovo.annoInizio)),
    });
    if (error) return setErrore(traduci(error));
    setNuovo(null);
    await ricarica();
    setAperto(data);
    setModificato(false);
  }

  if (!staff) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh" }}>
        <Header />
        <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 24px", color: C.grafite }}>Questa sezione è riservata alla Fondazione (Operatori e Amministratori).</div>
      </div>
    );
  }

  // Scenari raggruppati per Comune (per l'elenco e il confronto).
  const perComune = {};
  scenari.forEach((s) => {
    (perComune[s.comune] = perComune[s.comune] || []).push(s);
  });
  const annoCorrente = new Date().getFullYear();

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px" }} className="simulatore">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Simulatore di scenari</h1>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: 0, maxWidth: 720 }}>
              Quanti crediti potrebbe generare un Comune in 7, 10 o 21 anni? Dallo scenario di riferimento del Programma (Standard 4.8.1) e dagli obiettivi annui di produzione dei
              rifiuti e di secco residuo, il simulatore ricalcola la % di raccolta differenziata e stima i crediti anno per anno.
              <strong> Stima ex ante, non certificabile.</strong>
            </p>
          </div>
          {!nuovo && (
            <button className="no-stampa" style={btnPrimario} onClick={() => setNuovo({ organizzazioneId: "", comune: "", nome: "Scenario obiettivo", durata: 10, annoInizio: annoCorrente + 1 })}>
              + Nuovo scenario
            </button>
          )}
        </div>

        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{errore}</div>}

        {nuovo && (
          <section style={{ ...riquadro, marginBottom: 16 }} className="no-stampa">
            <h2 style={h2}>Nuovo scenario</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              <label style={lbl}>
                Comune censito nel portale
                <select style={campo} value={nuovo.organizzazioneId} onChange={(e) => setNuovo({ ...nuovo, organizzazioneId: e.target.value })}>
                  <option value="">— nessuno: scrivo il nome —</option>
                  {organizzazioni.map((o) => (
                    <option key={o.id} value={o.id}>{o.denominazione}</option>
                  ))}
                </select>
              </label>
              {!nuovo.organizzazioneId && (
                <label style={lbl}>
                  Nome del Comune
                  <input style={campo} value={nuovo.comune} placeholder="Comune di …" onChange={(e) => setNuovo({ ...nuovo, comune: e.target.value })} />
                </label>
              )}
              <label style={lbl}>
                Nome dello scenario
                <input style={campo} value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
              </label>
              <label style={lbl}>
                Durata
                <select style={campo} value={nuovo.durata} onChange={(e) => setNuovo({ ...nuovo, durata: Number(e.target.value) })}>
                  {DURATE.map((d) => (
                    <option key={d} value={d}>{d} anni</option>
                  ))}
                </select>
              </label>
              <label style={lbl}>
                Primo anno
                <input style={campo} type="number" value={nuovo.annoInizio} onChange={(e) => setNuovo({ ...nuovo, annoInizio: e.target.value })} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={btnPrimario} onClick={crea}>Crea scenario</button>
              <button style={btnMini} onClick={() => setNuovo(null)}>Annulla</button>
            </div>
          </section>
        )}

        {aperto && (
          <Editor
            key={aperto.id}
            scenario={aperto}
            ruolo={ruolo}
            onCambia={(s) => {
              setAperto(s);
              setModificato(true);
              setMessaggio("");
            }}
            modificato={modificato}
            messaggio={messaggio}
            onSalva={async (risultato) => {
              setErrore("");
              const t = risultato.totali;
              const { data, error } = await salvaScenario(aperto.id, {
                nome: aperto.nome,
                note: aperto.note || null,
                durata: aperto.durata,
                anno_inizio: aperto.anno_inizio,
                dati: aperto.dati,
                crediti_netti_totali: t ? Math.round(t.netti * 10) / 10 : null,
                rd_finale: t ? Math.round(t.rdFinale * 10) / 10 : null,
                simulato_il: t ? new Date().toISOString() : null,
              });
              if (error) return setErrore(traduci(error));
              setAperto(data);
              setModificato(false);
              setMessaggio("Scenario salvato.");
              ricarica();
            }}
            onDuplica={async () => {
              const nome = window.prompt("Nome della copia dello scenario:", `${aperto.nome} (copia)`);
              if (!nome) return;
              const { data, error } = await duplicaScenario(aperto, nome.trim());
              if (error) return setErrore(traduci(error));
              await ricarica();
              setAperto(data);
              setModificato(false);
              setMessaggio("Copia creata: ora stai modificando la copia.");
            }}
            onElimina={async () => {
              if (!window.confirm(`Cancellare lo scenario «${aperto.nome}»? Resta traccia nell'audit.`)) return;
              const { error } = await eliminaScenario(aperto.id);
              if (error) return setErrore(traduci(error));
              setAperto(null);
              setModificato(false);
              ricarica();
            }}
            onChiudi={() => {
              if (modificato && !window.confirm("Ci sono modifiche non salvate. Chiudere comunque?")) return;
              setAperto(null);
              setModificato(false);
            }}
          />
        )}

        <section style={{ marginTop: aperto ? 22 : 0 }} className="no-stampa">
          <h2 style={{ ...h2, marginBottom: 10 }}>Scenari per Comune</h2>
          {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}
          {!caricamento && scenari.length === 0 && (
            <div style={{ ...riquadro, color: C.grafite, fontSize: 13.5 }}>Nessuno scenario ancora. Crea il primo con «+ Nuovo scenario».</div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(perComune).map(([comune, lista]) => (
              <div key={comune} style={riquadro}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{comune}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: C.grafite, fontSize: 12 }}>
                      <th style={th}>Scenario</th>
                      <th style={th}>Periodo</th>
                      <th style={{ ...th, textAlign: "right" }}>% differenziata a fine periodo</th>
                      <th style={{ ...th, textAlign: "right" }}>Crediti netti stimati (tCO₂eq)</th>
                      <th style={th}>Aggiornato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((s) => (
                      <tr key={s.id} onClick={() => apri(s.id)} style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer", background: aperto?.id === s.id ? C.greenSoft : "transparent" }}>
                        <td style={{ ...td, fontWeight: 700 }}>{s.nome}</td>
                        <td style={td}>{s.durata} anni · {s.anno_inizio}–{s.anno_inizio + s.durata - 1}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.rd_finale == null ? "—" : `${fmt(s.rd_finale)}%`}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(s.crediti_netti_totali)}</td>
                        <td style={{ ...td, color: C.grafite }}>{formatoData(s.aggiornato_il)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      </main>
      <style>{`@media print { header, .no-stampa { display: none !important; } .simulatore { padding: 0 !important; } }`}</style>
    </div>
  );
}

/* Editor di uno scenario. Props: scenario (riga completa), ruolo,
   onCambia(scenario aggiornato), onSalva(risultato), onDuplica, onElimina,
   onChiudi, modificato, messaggio. */
export function Editor({ scenario, ruolo, onCambia, onSalva, onDuplica, onElimina, onChiudi, modificato, messaggio }) {
  const dati = scenario.dati || {};
  const annoBase = dati.annoBase || { rifiuti: {} };
  const base = useMemo(() => riepilogoAnnoBase(annoBase), [annoBase]);
  const attuale = dati.attuale || {};
  // Punto di partenza degli obiettivi: situazione attuale o riferimento.
  const partenza = useMemo(() => puntoDiPartenza(base, attuale), [base, attuale]);
  const metodo = annoBase.metodo || "anno";
  const [traiettoria, setTraiettoria] = useState({ proCapiteFinale: "", seccoProCapiteFinale: "" });
  const [calcoli, setCalcoli] = useState(null);
  const [calcoloScelto, setCalcoloScelto] = useState("");

  // Anni del periodo allineati a durata e primo anno (senza perdere i valori).
  const anni = useMemo(
    () => anniDelPeriodo({ durata: scenario.durata, annoInizio: scenario.anno_inizio, anni: dati.anni || [], base: partenza }),
    [scenario.durata, scenario.anno_inizio, dati.anni, partenza]
  );
  const risultato = useMemo(() => simula({ ...dati, anni }), [dati, anni]);
  // Parte economica: valore unitario del credito, tariffe del Programma e costi.
  const economia = { ...economiaIniziale(), ...(dati.economia || {}) };
  const popEconomia = num(attuale.popolazione) || base.popolazione;
  const eco = useMemo(() => simulaEconomia(risultato.righe, economia, popEconomia), [risultato, dati.economia, popEconomia]);
  const cambiaEconomia = (campi) => cambiaDati({ economia: { ...economia, ...campi } });

  const cambiaDati = (campi) => onCambia({ ...scenario, dati: { ...dati, anni, ...campi } });
  const cambiaBase = (campi) => cambiaDati({ annoBase: { ...annoBase, ...campi } });
  const cambiaAttuale = (campi) => cambiaDati({ attuale: { ...attuale, ...campi } });
  const cambiaRifiuto = (t, v) => cambiaBase({ rifiuti: { ...(annoBase.rifiuti || {}), [t]: v } });
  const cambiaAnno = (i, campi) => cambiaDati({ anni: anni.map((a, j) => (j === i ? { ...a, ...campi } : a)) });

  async function caricaCalcoli() {
    const { data } = await elencaCalcoli();
    setCalcoli(data || []);
  }
  async function importaCalcolo() {
    if (!calcoloScelto) return;
    const { data } = await leggiCalcolo(calcoloScelto);
    if (!data) return;
    cambiaBase({ anno: data.anno, rifiuti: rifiutiDaCalcolo(data.dati) });
  }

  function esportaCsv() {
    const blob = new Blob(["﻿" + righeCsv(scenario, risultato, eco)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Simulazione_${scenario.comune}_${scenario.nome}.csv`.replace(/[^\w.\-àèéìòù]+/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const t = risultato.totali;
  const unTonnellata = base.feSecco != null ? -base.feSecco : null;

  return (
    <section style={{ display: "grid", gap: 14 }}>
      {/* Barra dello scenario aperto */}
      <div style={{ ...riquadro, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.white, position: "sticky", top: 0, zIndex: 5 }}>
        <div>
          <div style={{ fontSize: 12, color: C.grafite }}>{scenario.comune}</div>
          <div style={{ fontFamily: "'Archivo'", fontSize: 18, fontWeight: 700 }}>{scenario.nome}</div>
        </div>
        <div className="no-stampa" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {messaggio && <span style={{ fontSize: 12.5, color: C.green, fontWeight: 600 }}>{messaggio}</span>}
          {modificato && <span style={{ fontSize: 12.5, color: C.ocra, fontWeight: 600 }}>Modifiche non salvate</span>}
          <button style={btnPrimario} onClick={() => onSalva(risultato)}>Salva</button>
          <button style={btnMini} onClick={onDuplica}>Duplica</button>
          <button style={btnMini} onClick={esportaCsv} disabled={!risultato.righe.length}>Esporta CSV</button>
          <button style={btnMini} onClick={() => window.print()}>Stampa</button>
          <button style={btnMini} onClick={onElimina}>Cancella</button>
          <button style={btnMini} onClick={onChiudi}>Chiudi</button>
        </div>
      </div>

      {/* 1. Impostazioni */}
      <div style={riquadro}>
        <h2 style={h2}>1. Impostazioni</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <label style={lbl}>
            Nome dello scenario
            <input style={campo} value={scenario.nome} onChange={(e) => onCambia({ ...scenario, nome: e.target.value })} />
          </label>
          <label style={lbl}>
            Durata del periodo
            <select style={{ ...campo, fontWeight: 700 }} value={scenario.durata} onChange={(e) => onCambia({ ...scenario, durata: Number(e.target.value), dati: { ...dati, anni } })}>
              {DURATE.map((d) => (
                <option key={d} value={d}>{d} anni</option>
              ))}
            </select>
          </label>
          <label style={lbl}>
            Primo anno
            <input style={campo} type="number" value={scenario.anno_inizio} onChange={(e) => onCambia({ ...scenario, anno_inizio: Number(e.target.value) || scenario.anno_inizio, dati: { ...dati, anni: [] } })} />
          </label>
          <label style={lbl}>
            Buffer previsto (%)
            <input style={campo} type="number" min="0" max="80" value={dati.bufferPct ?? 20} onChange={(e) => cambiaDati({ bufferPct: e.target.value })} />
          </label>
        </div>
        <label style={{ ...lbl, marginTop: 10 }}>
          Note
          <textarea style={{ ...campo, minHeight: 50 }} value={scenario.note || ""} onChange={(e) => onCambia({ ...scenario, note: e.target.value })} placeholder="Ipotesi, fonti dei dati, azioni previste (es. tariffa puntuale, porta a porta)…" />
        </label>
        <p style={nota}>Durata: 10 anni, oppure 7 rinnovabili fino a 21 (Standard 4.3.8). Buffer: quota trattenuta dai crediti lordi (Capitolo 7 e Tabelle 15-16 della Metodologia); 20% è un valore cautelativo.</p>
      </div>

      {/* 2. Scenario di riferimento (Standard 4.8.1) */}
      <div style={riquadro}>
        <h2 style={h2}>2. Scenario di riferimento (Standard 4.8.1)</h2>
        <p style={{ ...nota, margin: "0 0 10px" }}>
          È la situazione «senza progetto» con cui si confrontano gli obiettivi. Lo Standard chiede l'<strong>anno in cui il Comune ha raggiunto
          il 65% di raccolta differenziata</strong> (tra 64% e 66%, dati Catasto ISPRA); se non esiste, i <strong>valori medi pro capite del cluster
          SOSE</strong> (Tabella 3) × la popolazione ISPRA 2022.
        </p>
        <div className="no-stampa" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[["anno", "Anno con il 65% di differenziata"], ["cluster", "Valori medi del cluster (Tabella 3)"]].map(([v, l]) => (
            <button key={v} onClick={() => cambiaBase({ metodo: v })} style={{ ...btnMini, ...(metodo === v ? { background: C.green, color: C.white, borderColor: C.green } : {}) }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {metodo === "anno" && (
            <label style={lbl}>
              Anno di riferimento
              <input style={campo} type="number" value={annoBase.anno ?? ""} onChange={(e) => cambiaBase({ anno: e.target.value })} />
            </label>
          )}
          <label style={lbl}>
            {metodo === "cluster" ? "Popolazione (Catasto ISPRA 2022)" : "Popolazione nell'anno di riferimento"}
            <input style={campo} inputMode="numeric" value={annoBase.popolazione ?? ""} onChange={(e) => cambiaBase({ popolazione: e.target.value })} />
          </label>
          <label style={lbl}>
            Cluster SOSE (Tabella 2 dello Standard)
            <select style={campo} value={annoBase.cluster ?? ""} onChange={(e) => cambiaBase({ cluster: e.target.value })}>
              <option value="">—</option>
              {CLUSTER.map((c, i) => (
                <option key={i} value={i + 1}>{i + 1} · {c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="no-stampa" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 12px" }}>
          {metodo === "cluster" && (
            <button
              style={btnPrimario}
              disabled={!annoBase.cluster || !num(annoBase.popolazione)}
              title="Riempie i rifiuti con i valori medi pro capite del cluster × popolazione"
              onClick={() => cambiaBase({ anno: 2022, rifiuti: rifiutiDaCluster(annoBase.cluster, annoBase.popolazione) })}
            >
              Calcola dai valori medi del cluster
            </button>
          )}
          {metodo === "anno" && ruolo === "admin" && calcoli === null && <button style={btnMini} onClick={caricaCalcoli}>Importa da un calcolo dei crediti…</button>}
          {metodo === "anno" && ruolo === "admin" && calcoli !== null && (
            <>
              <select style={{ ...campo, width: "auto", minWidth: 260 }} value={calcoloScelto} onChange={(e) => setCalcoloScelto(e.target.value)}>
                <option value="">— scegli un calcolo —</option>
                {calcoli.map((c) => (
                  <option key={c.id} value={c.id}>{c.titolo} · {c.pratica?.organizzazione?.denominazione} · {c.anno}</option>
                ))}
              </select>
              <button style={btnMini} disabled={!calcoloScelto} onClick={importaCalcolo}>Importa i rifiuti</button>
            </>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 16 }} className="griglia-base">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.grafite, fontSize: 12 }}>
                <th style={th}>Tipologia</th>
                <th style={{ ...th, textAlign: "right" }}>Tonnellate</th>
                <th style={{ ...th, textAlign: "right" }}>kg/ab</th>
              </tr>
            </thead>
            <tbody>
              {TIPOLOGIE.map((tp) => {
                const q = annoBase.rifiuti?.[tp.id] ?? "";
                return (
                  <tr key={tp.id} style={{ borderTop: `1px solid ${C.line}`, background: tp.id === "indifferenziato" ? C.paperWarm : "transparent" }}>
                    <td style={td}>{tp.id === "indifferenziato" ? <strong>Secco residuo (indifferenziato)</strong> : tp.nome}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input style={{ ...campo, width: 110, textAlign: "right", padding: "5px 8px" }} inputMode="decimal" value={q} onChange={(e) => cambiaRifiuto(tp.id, e.target.value)} />
                    </td>
                    <td style={{ ...td, textAlign: "right", color: C.grafite, fontVariantNumeric: "tabular-nums" }}>{base.popolazione && num(q) ? fmt((num(q) * 1000) / base.popolazione) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <Cifra etichetta="Produzione totale" valore={`${fmt(base.totale)} t`} />
            <Cifra etichetta="Produzione pro capite" valore={`${fmt(base.proCapite)} kg/ab`} />
            <Cifra etichetta="Secco residuo pro capite" valore={`${fmt(base.seccoProCapite)} kg/ab`} />
            <Cifra etichetta="Raccolta differenziata" valore={`${fmt(base.rd)}%`} forte />
            {base.totale > 0 && (
              <div style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: C.greenSoft, lineHeight: 1.45 }}>
                <strong>Nel calcolo il riferimento è sempre alla soglia del {RD_SOGLIA}%</strong> (Standard 4.8.1): stessa produzione totale, secco al{" "}
                {100 - RD_SOGLIA}% ({fmt((base.proCapite * (100 - RD_SOGLIA)) / 100)} kg/ab). Ogni anno i risultati si calcolano per differenza da questa soglia.
              </div>
            )}
            <Cifra etichetta="Fattore del secco (formule 16-17)" valore={base.feSecco == null ? "—" : `${fmt(base.feSecco, 2)} kgCO₂eq/kg`} />
          </div>
        </div>
      </div>

      {/* 2b. Situazione attuale (facoltativa) */}
      <div style={riquadro}>
        <h2 style={h2}>Situazione attuale (facoltativa)</h2>
        <p style={{ ...nota, margin: "0 0 10px" }}>
          L'ultimo anno con dati disponibili: è il punto di partenza degli obiettivi e della traiettoria. I crediti si calcolano sempre rispetto
          allo scenario di riferimento. Se lasciate vuoto, gli obiettivi partono dal riferimento.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <label style={lbl}>
            Anno
            <input style={campo} type="number" value={attuale.anno ?? ""} onChange={(e) => cambiaAttuale({ anno: e.target.value })} />
          </label>
          <label style={lbl}>
            Popolazione
            <input style={campo} inputMode="numeric" value={attuale.popolazione ?? ""} placeholder={base.popolazione ? String(base.popolazione) : ""} onChange={(e) => cambiaAttuale({ popolazione: e.target.value })} />
          </label>
          <label style={lbl}>
            Produzione pro capite (kg/ab)
            <input style={campo} inputMode="decimal" value={attuale.proCapite ?? ""} onChange={(e) => cambiaAttuale({ proCapite: e.target.value })} />
          </label>
          <label style={lbl}>
            Secco residuo pro capite (kg/ab)
            <input style={campo} inputMode="decimal" value={attuale.seccoProCapite ?? ""} onChange={(e) => cambiaAttuale({ seccoProCapite: e.target.value })} />
          </label>
        </div>
        {partenza.fonte === "attuale" && (
          <p style={nota}>
            Differenziata attuale: <strong>{partenza.proCapite ? fmt(((partenza.proCapite - partenza.seccoProCapite) / partenza.proCapite) * 100) : "—"}%</strong>.
            {" "}I nuovi anni degli obiettivi e la traiettoria partono da questi valori.
          </p>
        )}
      </div>

      {/* 3. Obiettivi anno per anno */}
      <div style={riquadro}>
        <h2 style={h2}>3. Obiettivi anno per anno</h2>
        <div className="no-stampa" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", background: C.paper, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: C.grafite, maxWidth: 280 }}>Traiettoria lineare dalla {partenza.fonte === "attuale" ? "situazione attuale" : "situazione di riferimento"} agli obiettivi dell'ultimo anno ({scenario.anno_inizio + scenario.durata - 1}):</div>
          <label style={{ ...lbl, marginBottom: 0 }}>
            Produzione pro capite finale (kg/ab)
            <input style={{ ...campo, width: 150 }} inputMode="decimal" placeholder={fmt(partenza.proCapite)} value={traiettoria.proCapiteFinale} onChange={(e) => setTraiettoria({ ...traiettoria, proCapiteFinale: e.target.value })} />
          </label>
          <label style={{ ...lbl, marginBottom: 0 }}>
            Secco pro capite finale (kg/ab)
            <input style={{ ...campo, width: 150 }} inputMode="decimal" placeholder={fmt(partenza.seccoProCapite)} value={traiettoria.seccoProCapiteFinale} onChange={(e) => setTraiettoria({ ...traiettoria, seccoProCapiteFinale: e.target.value })} />
          </label>
          <button style={btnMini} disabled={!base.totale || !base.popolazione} onClick={() => cambiaDati({ anni: traiettoriaLineare({ anni, base: partenza, proCapiteFinale: traiettoria.proCapiteFinale, seccoProCapiteFinale: traiettoria.seccoProCapiteFinale }) })}>
            Applica la traiettoria
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: "right", color: C.grafite, fontSize: 11.5 }}>
                <th style={{ ...th, textAlign: "left" }}>Anno</th>
                <th style={th}>Popolazione</th>
                <th style={th}>Produzione totale (t)</th>
                <th style={th}>Pro capite (kg/ab)</th>
                <th style={th}>Secco pro capite (kg/ab)</th>
                <th style={th}>Secco (t)</th>
                <th style={th}>% differenziata</th>
              </tr>
            </thead>
            <tbody>
              {anni.map((a, i) => {
                const r = risultato.righe[i];
                const pop = num(a.popolazione) || base.popolazione;
                return (
                  <tr key={a.anno} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ ...td, fontWeight: 700 }}>{a.anno}</td>
                    <td style={tdN}><input style={inNum} inputMode="numeric" value={a.popolazione ?? ""} onChange={(e) => cambiaAnno(i, { popolazione: e.target.value })} /></td>
                    <td style={tdN}><input style={inNum} inputMode="decimal" value={a.totale ?? ""} onChange={(e) => cambiaAnno(i, { totale: e.target.value })} /></td>
                    <td style={tdN}>
                      <input
                        style={inNum}
                        inputMode="decimal"
                        title="Modificando il pro capite si ricalcola la produzione totale"
                        value={pop && a.totale !== "" ? Math.round(((num(a.totale) * 1000) / pop) * 10) / 10 : ""}
                        onChange={(e) => cambiaAnno(i, { totale: Math.round(((num(e.target.value) * pop) / 1000) * 10) / 10 })}
                      />
                    </td>
                    <td style={tdN}><input style={inNum} inputMode="decimal" value={a.seccoProCapite ?? ""} onChange={(e) => cambiaAnno(i, { seccoProCapite: e.target.value })} /></td>
                    <td style={{ ...tdN, color: C.grafite }}>{r ? fmt(r.secco) : "—"}</td>
                    <td style={{ ...tdN, fontWeight: 700 }}>{r ? `${fmt(r.rd)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Risultati */}
      <div style={riquadro}>
        <h2 style={h2}>4. Risultati: crediti stimati</h2>
        {risultato.avvisi.length > 0 && (
          <ul style={{ margin: "0 0 12px", padding: "10px 14px 10px 30px", background: C.ocraSoft, borderRadius: 10, fontSize: 12.5, color: C.ink }}>
            {risultato.avvisi.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {t && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Tile etichetta={`Crediti netti in ${t.anni} anni`} valore={fmt(t.netti, 0)} unita="tCO₂eq" principale />
              <Tile etichetta="Media annua" valore={fmt(t.mediaAnnuaNetti, 0)} unita="tCO₂eq/anno" />
              <Tile etichetta={`Differenziata nel ${risultato.righe[risultato.righe.length - 1].anno}`} valore={`${fmt(t.rdFinale)}%`} unita={`soglia di riferimento: ${RD_SOGLIA}%`} />
              <Tile etichetta="Rifiuti evitati nel periodo" valore={fmt(t.riduzione, 0)} unita="t rispetto al riferimento" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
              <GraficoBarre titolo="Crediti netti stimati per anno (tCO₂eq)" righe={risultato.righe} valore={(r) => r.netti} formato={(v) => fmt(v, 0)} />
              <GraficoLinea titolo="Raccolta differenziata (%)" righe={risultato.righe} valore={(r) => r.rd} formato={(v) => `${fmt(v)}%`} iniziale={RD_SOGLIA} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 860 }}>
                <thead>
                  <tr style={{ textAlign: "right", color: C.grafite, fontSize: 11.5 }}>
                    <th style={{ ...th, textAlign: "left" }}>Anno</th>
                    <th style={th}>Totale (t)</th>
                    <th style={th}>Riferimento (t)</th>
                    <th style={th}>Rifiuti evitati (t)</th>
                    <th style={th}>% differenziata</th>
                    <th style={th}>Punti oltre il {RD_SOGLIA}%</th>
                    <th style={th}>Crediti lordi</th>
                    <th style={th}>Buffer</th>
                    <th style={th}>Crediti netti</th>
                    <th style={th}>Netti cumulati</th>
                  </tr>
                </thead>
                <tbody>
                  {risultato.righe.map((r) => (
                    <tr key={r.anno} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ ...td, fontWeight: 700 }}>{r.anno}</td>
                      <td style={tdN}>{fmt(r.totale)}</td>
                      <td style={{ ...tdN, color: C.grafite }}>{fmt(r.riferimento)}</td>
                      <td style={tdN}>{fmt(r.riduzione)}</td>
                      <td style={tdN}>{fmt(r.rd)}%</td>
                      <td style={{ ...tdN, color: r.rdOltreSoglia >= 0 ? C.green : C.red }}>{r.rdOltreSoglia >= 0 ? "+" : ""}{fmt(r.rdOltreSoglia)}</td>
                      <td style={tdN}>{fmt(r.lordi)}</td>
                      <td style={{ ...tdN, color: C.grafite }}>{fmt(r.buffer)}</td>
                      <td style={{ ...tdN, fontWeight: 700 }}>{r.debito > 0 ? <span style={{ color: C.red }}>debito {fmt(r.debito)}</span> : fmt(r.netti)}</td>
                      <td style={tdN}>{fmt(r.cumulatoNetti)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.ink}`, fontWeight: 700 }}>
                    <td style={td}>Totale</td>
                    <td style={tdN} colSpan={2}></td>
                    <td style={tdN}>{fmt(t.riduzione)}</td>
                    <td style={tdN}></td>
                    <td style={tdN}></td>
                    <td style={tdN}>{fmt(t.lordi)}</td>
                    <td style={tdN}>{fmt(t.buffer)}</td>
                    <td style={tdN}>{fmt(t.netti)}</td>
                    <td style={tdN}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <div style={{ marginTop: 14, padding: "12px 14px", background: C.greenSoft, borderRadius: 10, fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>Da dove vengono i crediti.</strong> Il simulatore applica le formule della Metodologia CWP v1.2: ogni tonnellata di rifiuti
          prodotta pesa con il suo fattore di emissione e il secco con la media dei fattori della differenziata (formule 16-17). Perciò i crediti
          nascono dai <strong>rifiuti evitati</strong> rispetto allo scenario di riferimento, portato alla soglia del {RD_SOGLIA}% di differenziata (produzione pro capite del riferimento × popolazione):
          {unTonnellata != null && <> con i dati di questo Comune, <strong>1 t in meno ≈ {fmt(unTonnellata, 2)} tCO₂eq</strong> prima del buffer.</>} Spostare
          rifiuti dal secco alla differenziata alza la percentuale di raccolta differenziata ma, a parità di produzione totale, non genera crediti.
          <br />
          <span style={{ color: C.grafite }}>
            Stima ex ante a scopo di pianificazione, con un modello semplificato a livello di Comune da confermare con la Fondazione: i crediti
            veri si calcolano ex post con la Banca Dati Utenze e la verifica dell'ente.
          </span>
        </div>
      </div>

      {/* 5. Simulazione economica: ricavi e costi a carico del Comune o del gestore */}
      <div style={riquadro}>
        <h2 style={h2}>5. Simulazione economica: ricavi e costi per il Comune</h2>
        <h3 style={h3}>Ricavi dalla vendita dei crediti</h3>
        <p style={{ ...nota, margin: "0 0 8px" }}>
          Il valore del credito si digita <strong>anno per anno</strong> nella colonna «Valore» della tabella qui sotto. Per compilare tutti gli anni in
          una volta indicate il valore proposto (e, se volete, una variazione annua) e premete «Applica a tutti gli anni».
        </p>
        <div className="no-stampa" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ ...lbl, marginBottom: 0 }}>
            Valore proposto (€ per credito)
            <input style={{ ...campo, width: 170, fontWeight: 700 }} inputMode="decimal" value={economia.prezzo ?? ""} placeholder={String(PREZZO_PROPOSTO)} onChange={(e) => cambiaEconomia({ prezzo: e.target.value })} />
          </label>
          <label style={{ ...lbl, marginBottom: 0 }}>
            Variazione annua (%)
            <input style={{ ...campo, width: 130 }} inputMode="decimal" value={economia.crescitaPrezzo ?? 0} onChange={(e) => cambiaEconomia({ crescitaPrezzo: e.target.value })} />
          </label>
          <button style={btnMini} onClick={() => cambiaEconomia({ prezzi: prezziPerAnni(risultato.righe.map((r) => r.anno), economia.prezzo || PREZZO_PROPOSTO, economia.crescitaPrezzo) })}>
            Applica a tutti gli anni
          </button>
        </div>

        <h3 style={h3}>Costi a carico del Comune o del gestore (IVA esclusa)</h3>
        <div style={{ background: listinoDi(economia) ? C.paper : C.ocraSoft, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Simulare i costi in base al Caso 1 o al Caso 2?</div>
          <div className="no-stampa" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["caso1", "Caso 1 – Progetto volontario"],
              ["caso2", "Caso 2 – Progetto obbligatorio (da bando)"],
            ].map(([v, l]) => (
              <button key={v} onClick={() => cambiaEconomia({ listino: v })} style={{ ...btnMini, fontWeight: 700, ...(listinoDi(economia) === v ? { background: C.green, color: C.white, borderColor: C.green } : {}) }}>
                {l}
              </button>
            ))}
            {[["schema", "Schema tariffario"], ["nessuno", "Nessuna tariffa"]].map(([v, l]) => (
              <button key={v} onClick={() => cambiaEconomia({ listino: v })} style={{ ...btnMini, fontSize: 12, ...(listinoDi(economia) === v ? { background: C.green, color: C.white, borderColor: C.green } : {}) }}>
                {l}
              </button>
            ))}
          </div>
          <p style={{ ...nota, margin: "8px 0 0" }}>
            Caso 1: progetti volontari del Comune o del gestore. Caso 2: progetti obbligatori, per esempio nei bandi di gara dei Comuni che hanno
            inserito il CWP come metodo. Tabelle «Costi per il Soggetto Promotore» di Fondazione Operate (28/07/2026), progetti di 10 anni; non
            comprendono la validazione dell'ente.
          </p>
        </div>
        {(listinoDi(economia) === "caso1" || listinoDi(economia) === "caso2") && (
          <div style={{ overflowX: "auto", marginBottom: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 620 }}>
              <thead>
                <tr style={{ textAlign: "right", color: C.grafite, fontSize: 11.5 }}>
                  <th style={{ ...th, textAlign: "left" }}>{CASI_COSTI[listinoDi(economia)]} · {popEconomia ? popEconomia.toLocaleString("it-IT") : "—"} abitanti</th>
                  <th style={th}>€ per abitante all'anno</th>
                  <th style={th}>€ all'anno</th>
                  <th style={{ ...th, textAlign: "left" }}>Contratto</th>
                </tr>
              </thead>
              <tbody>
                {costiPerCaso(listinoDi(economia), popEconomia).map((c) => (
                  <tr key={c.voce} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={td}>{c.nome}{c.limite && <span style={{ color: C.grafite, fontSize: 11.5 }}> · {c.limite === "minimo" ? "costo minimo" : "costo massimo"}</span>}</td>
                    <td style={tdN}>{fmt(c.unitario, 2)}</td>
                    <td style={{ ...tdN, fontWeight: 700 }}>{fmt(c.importo, 2)}</td>
                    <td style={{ ...td, color: C.grafite }}>{c.tipo === "consulenza" ? "consulenza" : "partecipazione al Programma"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.ink}`, fontWeight: 700 }}>
                  <td style={td}>Totale annuo</td>
                  <td style={tdN}>{popEconomia ? fmt(costiPerCaso(listinoDi(economia), popEconomia).reduce((x, c) => x + c.importo, 0) / popEconomia, 2) : "—"}</td>
                  <td style={tdN}>{fmt(costiPerCaso(listinoDi(economia), popEconomia).reduce((x, c) => x + c.importo, 0), 2)}</td>
                  <td style={td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {listinoDi(economia) === "schema" && (
          <p style={nota}>Tariffe massime dello Schema tariffario v1.2: registrazione del Progetto nel primo anno, registrazione di ogni Rapporto annuale, emissione dei crediti a scaglioni e vendita (20% del valore, con il minimo a scaglioni).</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 6 }}>
          <label style={lbl}>
            Ente di validazione, una tantum (€)
            <input style={campo} inputMode="decimal" value={economia.costoValidazione ?? ""} onChange={(e) => cambiaEconomia({ costoValidazione: e.target.value })} />
          </label>
          <label style={lbl}>
            Ente di verifica, ogni anno (€)
            <input style={campo} inputMode="decimal" value={economia.costoVerificaAnnua ?? ""} onChange={(e) => cambiaEconomia({ costoVerificaAnnua: e.target.value })} />
          </label>
          <label style={lbl}>
            Altri costi annui: registro, gestione (€)
            <input style={campo} inputMode="decimal" value={economia.altriCostiAnnui ?? ""} onChange={(e) => cambiaEconomia({ altriCostiAnnui: e.target.value })} />
          </label>
        </div>

        {!eco && <div style={{ marginTop: 12, fontSize: 13, color: C.grafite }}>Indicate il <strong>valore del credito</strong> (proposto {PREZZO_PROPOSTO} €) per vedere ricavi, costi e margine anno per anno.</div>}
        {eco && (
          <>
            {eco.avvisi.length > 0 && (
              <ul style={{ margin: "12px 0", padding: "10px 14px 10px 30px", background: C.ocraSoft, borderRadius: 10, fontSize: 12.5 }}>
                {eco.avvisi.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, margin: "14px 0" }}>
              <Tile etichetta={`Ricavi in ${eco.righe.length} anni`} valore={`€ ${fmt(eco.totali.ricavi, 0)}`} unita={`${fmt(eco.totali.crediti, 0)} crediti × ${fmt(eco.totali.prezzoMedio, 2)} € in media`} />
              <Tile etichetta="Costi per il Comune nel periodo" valore={`€ ${fmt(eco.totali.costi, 0)}`} unita={`€ ${fmt(eco.totali.costoAnnuoMedio, 0)} all'anno in media`} />
              <Tile etichetta="Margine netto" valore={`€ ${fmt(eco.totali.margine, 0)}`} unita={eco.totali.primoAnnoPositivo ? `costi rientrati nel ${eco.totali.primoAnnoPositivo}` : "i costi non rientrano nel periodo"} principale />
              <Tile etichetta="Per abitante nel periodo" valore={eco.totali.costoProCapite != null ? `€ ${fmt(eco.totali.costoProCapite, 2)}` : "—"} unita={eco.totali.ricavoProCapite != null ? `di costo; ricavo € ${fmt(eco.totali.ricavoProCapite, 2)}` : ""} />
            </div>
            <div style={{ marginBottom: 14, maxWidth: 640 }}>
              <GraficoBarre titolo="Margine netto per anno (€)" righe={eco.righe} valore={(r) => r.margine} formato={(v) => fmt(v, 0)} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 980 }}>
                <thead>
                  <tr style={{ textAlign: "right", color: C.grafite, fontSize: 11.5 }}>
                    <th style={{ ...th, textAlign: "left" }}>Anno</th>
                    <th style={th}>Crediti</th>
                    <th style={th}>Valore (€)</th>
                    <th style={th}>Ricavi (€)</th>
                    <th style={th}>Partecipazione al Programma (€)</th>
                    <th style={th}>Consulenza (€)</th>
                    <th style={th}>Ente (€)</th>
                    <th style={th}>Altri (€)</th>
                    <th style={th}>Costi totali (€)</th>
                    <th style={th}>Margine (€)</th>
                    <th style={th}>Cumulato (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {eco.righe.map((r) => (
                    <tr key={r.anno} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ ...td, fontWeight: 700 }}>{r.anno}</td>
                      <td style={tdN}>{fmt(r.crediti, 0)}</td>
                      <td style={tdN}>
                        <input
                          style={{ ...inNum, width: 82, fontWeight: r.prezzoDigitato ? 700 : 400 }}
                          inputMode="decimal"
                          title="Valore del credito per questo anno (€)"
                          value={(economia.prezzi || {})[r.anno] ?? ""}
                          placeholder={fmt(r.prezzo, 2)}
                          onChange={(e) => cambiaEconomia({ prezzi: { ...(economia.prezzi || {}), [r.anno]: e.target.value } })}
                        />
                      </td>
                      <td style={tdN}>{fmt(r.ricavi, 0)}</td>
                      <td style={{ ...tdN, color: C.grafite }} title={Object.entries(r.voci).map(([k, v]) => `${k}: ${fmt(v, 0)}`).join(" · ")}>{fmt(r.partecipazione, 0)}</td>
                      <td style={{ ...tdN, color: C.grafite }}>{fmt(r.consulenza, 0)}</td>
                      <td style={{ ...tdN, color: C.grafite }}>{fmt(r.costiEnte, 0)}</td>
                      <td style={{ ...tdN, color: C.grafite }}>{fmt(r.altriCosti, 0)}</td>
                      <td style={tdN}>{fmt(r.costi, 0)}</td>
                      <td style={{ ...tdN, fontWeight: 700, color: r.margine < 0 ? C.red : C.ink }}>{fmt(r.margine, 0)}</td>
                      <td style={{ ...tdN, color: r.cumulato < 0 ? C.red : C.ink }}>{fmt(r.cumulato, 0)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.ink}`, fontWeight: 700 }}>
                    <td style={td}>Totale</td>
                    <td style={tdN}>{fmt(eco.totali.crediti, 0)}</td>
                    <td style={tdN}></td>
                    <td style={tdN}>{fmt(eco.totali.ricavi, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.partecipazione, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.consulenza, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.costiEnte, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.altriCosti, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.costi, 0)}</td>
                    <td style={tdN}>{fmt(eco.totali.margine, 0)}</td>
                    <td style={tdN}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={nota}>Stima indicativa, non un piano finanziario né una garanzia: il valore del credito dipende dal mercato volontario e dal registro scelto; i costi sono IVA esclusa.</p>
          </>
        )}
      </div>
    </section>
  );
}

// Cifra di riepilogo dello scenario di riferimento.
function Cifra({ etichetta, valore, forte = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", background: forte ? C.greenSoft : C.paper, borderRadius: 8 }}>
      <span style={{ fontSize: 12.5, color: C.grafite }}>{etichetta}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{valore}</span>
    </div>
  );
}

// Riquadro con un numero in evidenza.
function Tile({ etichetta, valore, unita, principale = false }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: principale ? C.green : C.paper, color: principale ? C.white : C.ink }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{etichetta}</div>
      <div style={{ fontFamily: "'Archivo'", fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{valore}</div>
      <div style={{ fontSize: 11.5, opacity: 0.85 }}>{unita}</div>
    </div>
  );
}

// Grafico a barre (una serie, un asse). Il valore di ogni barra compare
// al passaggio del mouse; la tabella sotto riporta tutti i numeri.
function GraficoBarre({ titolo, righe, valore, formato }) {
  const W = 520, H = 210, sx = 56, sy = 14, gh = H - sy - 28;
  // Asse che comprende anche i valori negativi (es. margine del primo anno).
  const max = Math.max(0, ...righe.map(valore));
  const min = Math.min(0, ...righe.map(valore));
  const ampiezza = max - min || 1;
  const scala = (v) => sy + gh - ((v - min) / ampiezza) * gh;
  const y0 = scala(0);
  const passo = (W - sx - 6) / Math.max(righe.length, 1);
  const larg = Math.max(4, Math.min(28, passo - 4));
  const tacche = min < 0 ? (max > 0 ? [min, 0, max] : [min, min / 2, 0]) : [0, max / 2, max || 1];
  const ogni = righe.length > 12 ? 3 : 1;
  return (
    <figure style={{ margin: 0, background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <figcaption style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{titolo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titolo}>
        {tacche.map((v) => (
          <g key={v}>
            <line x1={sx} x2={W - 4} y1={scala(v)} y2={scala(v)} stroke={v === 0 ? C.grafite : C.line} strokeWidth="1" />
            <text x={sx - 6} y={scala(v) + 4} textAnchor="end" fontSize="10" fill={C.grafite}>{formato(v)}</text>
          </g>
        ))}
        {righe.map((r, i) => {
          const v = valore(r);
          const h = Math.abs(scala(v) - y0);
          const x = sx + i * passo + (passo - larg) / 2;
          return (
            <g key={r.anno}>
              <path d={v >= 0 ? barra(x, y0, larg, h) : barraGiu(x, y0, larg, h)} fill={v >= 0 ? C.green : C.red}>
                <title>{`${r.anno}: ${formato(v)}`}</title>
              </path>
              <rect x={sx + i * passo} y={sy} width={passo} height={gh} fill="transparent">
                <title>{`${r.anno}: ${formato(v)}`}</title>
              </rect>
              {i % ogni === 0 && <text x={x + larg / 2} y={H - 10} textAnchor="middle" fontSize="10" fill={C.grafite}>{r.anno}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

// Barra verso il basso (valore negativo), estremità arrotondata in basso.
function barraGiu(x, y0, w, h) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y0} V${y0 + h - r} Q${x},${y0 + h} ${x + r},${y0 + h} H${x + w - r} Q${x + w},${y0 + h} ${x + w},${y0 + h - r} V${y0} Z`;
}

// Barra con estremità arrotondata (4px) e base piatta sull'asse.
function barra(x, y0, w, h) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y0} V${y0 - h + r} Q${x},${y0 - h} ${x + r},${y0 - h} H${x + w - r} Q${x + w},${y0 - h} ${x + w},${y0 - h + r} V${y0} Z`;
}

// Grafico a linea (una serie, un asse) con il livello dello scenario di riferimento.
function GraficoLinea({ titolo, righe, valore, formato, iniziale }) {
  const W = 520, H = 210, sx = 46, sy = 14, gh = H - sy - 28;
  const valori = righe.map(valore);
  const min = Math.max(0, Math.floor((Math.min(iniziale, ...valori) - 5) / 10) * 10);
  const max = Math.min(100, Math.ceil((Math.max(iniziale, ...valori) + 5) / 10) * 10);
  const scala = (v) => sy + gh - ((v - min) / Math.max(max - min, 1)) * gh;
  const passo = (W - sx - 16) / Math.max(righe.length, 1);
  const px = (i) => sx + 10 + i * passo + passo / 2;
  const punti = righe.map((r, i) => `${px(i)},${scala(valore(r))}`).join(" ");
  const ogni = righe.length > 12 ? 3 : 1;
  return (
    <figure style={{ margin: 0, background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <figcaption style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{titolo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titolo}>
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line x1={sx} x2={W - 4} y1={scala(v)} y2={scala(v)} stroke={C.line} strokeWidth="1" />
            <text x={sx - 6} y={scala(v) + 4} textAnchor="end" fontSize="10" fill={C.grafite}>{formato(v)}</text>
          </g>
        ))}
        <line x1={sx} x2={W - 4} y1={scala(iniziale)} y2={scala(iniziale)} stroke={C.ocra} strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={W - 6} y={scala(iniziale) - 5} textAnchor="end" fontSize="10" fill={C.grafite}>soglia {formato(iniziale)}</text>
        <polyline points={punti} fill="none" stroke={C.green} strokeWidth="2" />
        {righe.map((r, i) => (
          <g key={r.anno}>
            <circle cx={px(i)} cy={scala(valore(r))} r="4" fill={C.green} stroke={C.white} strokeWidth="2">
              <title>{`${r.anno}: ${formato(valore(r))}`}</title>
            </circle>
            {i % ogni === 0 && <text x={px(i)} y={H - 10} textAnchor="middle" fontSize="10" fill={C.grafite}>{r.anno}</text>}
          </g>
        ))}
      </svg>
    </figure>
  );
}

// Messaggi di errore più chiari per i casi noti.
function traduci(error) {
  const m = error?.message || String(error);
  if (/scenario_simulazione/.test(m) && /(does not exist|schema cache|not find)/i.test(m)) {
    return "Il database non ha ancora la tabella degli scenari: va eseguito lo script supabase/28_simulatore.sql nel SQL Editor di Supabase.";
  }
  if (/row-level security/i.test(m)) return "Operazione non permessa: il simulatore è riservato a Operatori e Amministratori.";
  if (/durata_check/.test(m)) return "La durata deve essere 7, 10 o 21 anni.";
  return m;
}

// Stili della pagina.
const riquadro = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 18px" };
const h3 = { fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px", color: C.green };
const h2 = { fontFamily: "'Archivo'", fontSize: 16, margin: "0 0 12px" };
const lbl = { display: "grid", gap: 4, fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 8 };
const campo = { width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif", background: C.white };
const inNum = { ...campo, width: 110, textAlign: "right", padding: "5px 8px" };
const btnPrimario = { background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnMini = { background: C.white, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const th = { padding: "8px 10px", fontWeight: 700 };
const td = { padding: "7px 10px", verticalAlign: "middle" };
const tdN = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const nota = { fontSize: 12, color: C.grafite, margin: "6px 0 0" };
