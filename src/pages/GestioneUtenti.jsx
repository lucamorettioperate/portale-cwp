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
} from "../lib/dati.js";

/* Gestione utenti — solo Admin.
   Elenco utenti, invito di nuovi (cliente/operatore), modifica
   ruolo e organizzazione. */
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
              Invita operatori e clienti, assegna ruolo e organizzazione.
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
  const [orgId, setOrgId] = useState(utente.organizzazione_id || "");
  const [salvataggio, setSalvataggio] = useState(false);
  const r = RUOLI[utente.ruolo];

  async function salva() {
    setSalvataggio(true);
    await aggiornaUtente(utente.id, ruolo, ruolo === "cliente" ? orgId || null : null);
    setSalvataggio(false);
    setModifica(false);
    onSalvato();
  }

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: ultimo ? "none" : `1px solid ${C.line}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{utente.nome_completo || utente.email}</div>
        <div style={{ fontSize: 12.5, color: C.grafite }}>
          {utente.email}
          {utente.organizzazione && <> · {utente.organizzazione}</>}
        </div>
      </div>

      {!modifica ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {r && <Badge bg={r.soft} fg={r.color}>{r.short}</Badge>}
          <button onClick={() => setModifica(true)} style={btnMini}>Modifica</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} style={campoMini}>
            <option value="cliente">Cliente</option>
            <option value="operatore">Operatore</option>
          </select>
          {ruolo === "cliente" && (
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={campoMini}>
              <option value="">— organizzazione —</option>
              {organizzazioni.map((o) => (
                <option key={o.id} value={o.id}>{o.denominazione}</option>
              ))}
            </select>
          )}
          <button onClick={salva} disabled={salvataggio} style={btnMiniPrimario}>
            {salvataggio ? "…" : "Salva"}
          </button>
          <button onClick={() => setModifica(false)} style={btnMini}>Annulla</button>
        </div>
      )}
    </div>
  );
}

function FormInvito({ organizzazioni, onChiudi, onInvitato }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState(generaPassword());
  const [ruolo, setRuolo] = useState("cliente");
  const [orgId, setOrgId] = useState(organizzazioni[0]?.id || "");
  const [errore, setErrore] = useState("");
  const [ok, setOk] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  async function invia(e) {
    e.preventDefault();
    setErrore("");
    if (ruolo === "cliente" && !orgId) {
      setErrore("Seleziona l'organizzazione per l'utente cliente.");
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
      organizzazioneId: ruolo === "cliente" ? orgId : null,
      nomeCompleto: nome.trim() || null,
    });
    setInCorso(false);
    if (error || data?.error) {
      setErrore("Creazione non riuscita: " + (data?.error || error.message));
    } else {
      setOk(true);
      setTimeout(onInvitato, 2500);
    }
  }

  return (
    <div style={overlay} onClick={onChiudi}>
      <div style={modale} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 19, margin: "0 0 16px" }}>Nuovo utente</h2>

        {ok ? (
          <div style={{ color: C.green, fontSize: 14, padding: "12px 0", lineHeight: 1.6 }}>
            ✓ Utente creato: <b>{email}</b>
            <br />
            Comunica all'utente la password temporanea: <b style={{ fontFamily: "monospace" }}>{password}</b>
            <br />
            Potrà cambiarla dopo il primo accesso.
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
              <label style={lbl}>
                Organizzazione
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={campo}>
                  <option value="">— seleziona —</option>
                  {organizzazioni.map((o) => (
                    <option key={o.id} value={o.id}>{o.denominazione}</option>
                  ))}
                </select>
              </label>
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
  maxWidth: 440,
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
