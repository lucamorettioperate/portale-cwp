import React, { useEffect, useState } from "react";
import { COLORI as C, RUOLI } from "../lib/cwpProgram.js";
import { useAuth } from "../lib/AuthContext.jsx";
import Header from "../components/Header.jsx";
import Badge from "../components/Badge.jsx";
import {
  elencaUtenti,
  elencaOrganizzazioni,
  creaUtente,
  aggiornaUtente,
  impostaOrganizzazioniUtente,
} from "../lib/dati.js";

/* Gestione utenti — solo Admin.
   Elenco utenti, invito di nuovi (cliente/operatore), modifica
   ruolo e organizzazioni. Un utente cliente può essere associato
   a più organizzazioni (es. più comuni). */

// Organizzazioni associate a un utente (elenco completo, con fallback
// sul vecchio campo singolo).
function orgIdsUtente(u) {
  if (u.organizzazioni_ids && u.organizzazioni_ids.length) return u.organizzazioni_ids;
  return u.organizzazione_id ? [u.organizzazione_id] : [];
}
function orgNomiUtente(u) {
  if (u.organizzazioni_nomi && u.organizzazioni_nomi.length) return u.organizzazioni_nomi;
  return u.organizzazione ? [u.organizzazione] : [];
}
export default function GestioneUtenti() {
  const { ruolo } = useAuth();
  const [utenti, setUtenti] = useState([]);
  const [organizzazioni, setOrganizzazioni] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  const [invito, setInvito] = useState(false);

  async function carica() {
    setCaricamento(true);
    const [u, o] = await Promise.all([elencaUtenti(), elencaOrganizzazioni()]);
    if (u.error) setErrore(u.error.message);
    else setUtenti(u.data || []);
    setOrganizzazioni(o.data || []);
    setCaricamento(false);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: "'Archivo'", fontSize: 22, margin: "0 0 4px" }}>Gestione utenti</h1>
            <p style={{ fontSize: 13.5, color: C.grafite, margin: 0 }}>
              Invita operatori e clienti, assegna ruolo e organizzazioni.
            </p>
          </div>
          <button onClick={() => setInvito(true)} style={btnPrimario}>
            + Nuovo utente
          </button>
        </div>

        {errore && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{errore}</div>}
        {caricamento && <div style={{ color: C.grafite, fontSize: 13 }}>Caricamento…</div>}

        {!caricamento && (
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {utenti.map((u, i) => (
              <RigaUtente
                key={u.id}
                utente={u}
                organizzazioni={organizzazioni}
                ultimo={i === utenti.length - 1}
                onSalvato={carica}
              />
            ))}
          </div>
        )}
      </div>

      {invito && (
        <FormInvito
          organizzazioni={organizzazioni}
          onChiudi={() => setInvito(false)}
          onInvitato={() => {
            setInvito(false);
            carica();
          }}
        />
      )}
    </div>
  );
}

function RigaUtente({ utente, organizzazioni, ultimo, onSalvato }) {
  const [modifica, setModifica] = useState(false);
  const [ruolo, setRuolo] = useState(utente.ruolo);
  const [orgIds, setOrgIds] = useState(orgIdsUtente(utente));
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");
  const r = RUOLI[utente.ruolo];
  const nomiOrg = orgNomiUtente(utente);
  const modificabile = utente.ruolo !== "admin";

  function apri() {
    setRuolo(utente.ruolo);
    setOrgIds(orgIdsUtente(utente));
    setErrore("");
    setModifica(true);
  }

  async function salva() {
    setErrore("");
    if (ruolo === "cliente" && orgIds.length === 0) {
      setErrore("Seleziona almeno un'organizzazione per l'utente cliente.");
      return;
    }
    setSalvataggio(true);
    const { error } = await aggiornaUtente(utente.id, ruolo, orgIds);
    setSalvataggio(false);
    if (error) {
      setErrore("Salvataggio non riuscito: " + error.message);
      return;
    }
    setModifica(false);
    onSalvato();
  }

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: ultimo ? "none" : `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{utente.nome_completo || utente.email}</div>
          <div style={{ fontSize: 12.5, color: C.grafite }}>{utente.email}</div>
          {nomiOrg.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {nomiOrg.map((n) => (
                <span key={n} style={chipOrg}>{n}</span>
              ))}
            </div>
          )}
        </div>

        {!modifica && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {r && <Badge bg={r.soft} fg={r.color}>{r.short}</Badge>}
            {modificabile && <button onClick={apri} style={btnMini}>Modifica</button>}
          </div>
        )}
      </div>

      {modifica && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            background: C.paper,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
          }}
        >
          <label style={lbl}>
            Ruolo
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} style={{ ...campo, maxWidth: 260 }}>
              <option value="cliente">Cliente (comune / azienda)</option>
              <option value="operatore">Operatore di back-office</option>
            </select>
          </label>
          {ruolo === "cliente" && (
            <SceltaOrganizzazioni
              organizzazioni={organizzazioni}
              selezionate={orgIds}
              onChange={setOrgIds}
            />
          )}
          {errore && <div style={{ color: C.red, fontSize: 13, margin: "4px 0 10px" }}>{errore}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setModifica(false)} style={btnMini}>Annulla</button>
            <button onClick={salva} disabled={salvataggio} style={btnMiniPrimario}>
              {salvataggio ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Selezione multipla delle organizzazioni (con ricerca).
   L'ordine di selezione conta: la prima scelta è l'organizzazione
   principale dell'utente. */
function SceltaOrganizzazioni({ organizzazioni, selezionate, onChange }) {
  const [filtro, setFiltro] = useState("");
  const f = filtro.trim().toLowerCase();
  const visibili = f
    ? organizzazioni.filter((o) => (o.denominazione || "").toLowerCase().includes(f))
    : organizzazioni;

  function commuta(id) {
    if (selezionate.includes(id)) onChange(selezionate.filter((x) => x !== id));
    else onChange([...selezionate, id]);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...lbl, marginBottom: 6 }}>
        Organizzazioni associate{" "}
        <span style={{ fontWeight: 400 }}>
          ({selezionate.length} selezionat{selezionate.length === 1 ? "a" : "e"})
        </span>
      </div>
      {organizzazioni.length > 6 && (
        <input
          placeholder="Cerca organizzazione…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ ...campo, marginBottom: 6 }}
        />
      )}
      <div
        style={{
          maxHeight: 200,
          overflowY: "auto",
          border: `1px solid ${C.line}`,
          borderRadius: 9,
          background: C.white,
        }}
      >
        {visibili.length === 0 && (
          <div style={{ padding: "10px 12px", fontSize: 13, color: C.grafite }}>Nessuna organizzazione trovata.</div>
        )}
        {visibili.map((o) => {
          const pos = selezionate.indexOf(o.id);
          return (
            <label
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                fontSize: 13.5,
                cursor: "pointer",
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <input type="checkbox" checked={pos >= 0} onChange={() => commuta(o.id)} />
              <span style={{ flex: 1 }}>{o.denominazione}</span>
              {pos === 0 && selezionate.length > 1 && (
                <span style={{ fontSize: 11, color: C.grafite }}>principale</span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function FormInvito({ organizzazioni, onChiudi, onInvitato }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState(generaPassword());
  const [ruolo, setRuolo] = useState("cliente");
  const [orgIds, setOrgIds] = useState([]);
  const [errore, setErrore] = useState("");
  const [avviso, setAvviso] = useState("");
  const [ok, setOk] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  async function invia(e) {
    e.preventDefault();
    setErrore("");
    if (ruolo === "cliente" && orgIds.length === 0) {
      setErrore("Seleziona almeno un'organizzazione per l'utente cliente.");
      return;
    }
    if (password.length < 8) {
      setErrore("La password deve avere almeno 8 caratteri.");
      return;
    }
    setInCorso(true);
    const { data, error } = await creaUtente({
      email: email.trim(),
      password,
      ruolo,
      organizzazioneId: ruolo === "cliente" ? orgIds[0] : null,
      nomeCompleto: nome.trim() || null,
    });
    if (error || data?.error) {
      setInCorso(false);
      setErrore("Creazione non riuscita: " + (data?.error || error.message));
      return;
    }

    // Registra tutte le organizzazioni selezionate (anche quando è una sola,
    // così l'associazione è sempre nella tabella molti-a-molti).
    if (ruolo === "cliente") {
      const { data: elenco } = await elencaUtenti();
      const nuovo = (elenco || []).find(
        (u) => (u.email || "").toLowerCase() === email.trim().toLowerCase()
      );
      const res = nuovo
        ? await impostaOrganizzazioniUtente(nuovo.id, orgIds)
        : { error: { message: "utente non trovato" } };
      if (res.error) {
        setAvviso(
          "Utente creato, ma le organizzazioni aggiuntive non sono state salvate (" +
            res.error.message +
            "). Aggiungile da «Modifica»."
        );
      }
    }
    setInCorso(false);
    setOk(true);
  }

  return (
    <div style={overlay} onClick={ok ? onInvitato : onChiudi}>
      <div style={modale} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 19, margin: "0 0 16px" }}>Nuovo utente</h2>

        {ok ? (
          <div style={{ color: C.green, fontSize: 14, padding: "12px 0", lineHeight: 1.6 }}>
            ✓ Utente creato: <b>{email}</b>
            <br />
            Comunica all'utente la password temporanea: <b style={{ fontFamily: "monospace" }}>{password}</b>
            <br />
            Potrà cambiarla dopo il primo accesso.
            {avviso && <div style={{ color: C.red, marginTop: 10, fontSize: 13 }}>{avviso}</div>}
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={onInvitato} style={btnPrimario}>Chiudi</button>
            </div>
          </div>
        ) : (
          <form onSubmit={invia}>
            <label style={lbl}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={campo} />
            </label>
            <label style={lbl}>
              Nome e cognome (facoltativo)
              <input value={nome} onChange={(e) => setNome(e.target.value)} style={campo} />
            </label>
            <label style={lbl}>
              Password temporanea
              <div style={{ display: "flex", gap: 8 }}>
                <input value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...campo, flex: 1 }} />
                <button type="button" onClick={() => setPassword(generaPassword())} style={btnSecondario}>
                  Genera
                </button>
              </div>
            </label>
            <label style={lbl}>
              Ruolo
              <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} style={campo}>
                <option value="cliente">Cliente (comune / azienda)</option>
                <option value="operatore">Operatore di back-office</option>
              </select>
            </label>
            {ruolo === "cliente" && (
              <SceltaOrganizzazioni
                organizzazioni={organizzazioni}
                selezionate={orgIds}
                onChange={setOrgIds}
              />
            )}

            {errore && <div style={{ color: C.red, fontSize: 13, margin: "4px 0 12px" }}>{errore}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="button" onClick={onChiudi} style={btnSecondario}>Annulla</button>
              <button type="submit" disabled={inCorso} style={{ ...btnPrimario, flex: 1 }}>
                {inCorso ? "Creazione…" : "Crea utente"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Genera una password temporanea leggibile.
function generaPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(27,33,24,0.45)",
  display: "grid",
  placeItems: "center",
  padding: 20,
  zIndex: 50,
};
const modale = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "92vh",
  overflowY: "auto",
  background: C.white,
  borderRadius: 16,
  padding: "26px",
};
const campo = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
  background: C.white,
};
const campoMini = { ...campo, width: "auto", padding: "7px 10px", fontSize: 13 };
const chipOrg = {
  display: "inline-block",
  fontSize: 11.5,
  padding: "2px 8px",
  borderRadius: 999,
  background: C.paper,
  border: `1px solid ${C.line}`,
  color: C.grafite,
};
const lbl = { display: "block", fontSize: 12, color: C.grafite, fontWeight: 600, marginBottom: 14 };
const btnPrimario = {
  background: C.green, color: C.white, border: "none", borderRadius: 9,
  padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
};
const btnSecondario = {
  background: C.white, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 9,
  padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
};
const btnMini = {
  background: C.white, color: C.grafite, border: `1px solid ${C.line}`, borderRadius: 7,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};
const btnMiniPrimario = {
  background: C.green, color: C.white, border: "none", borderRadius: 7,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};
