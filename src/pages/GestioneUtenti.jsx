/* =========================================================================
   Gestione utenti — indirizzo «/utenti»
   Scopo: elenco di tutti gli utenti (nome, email, organizzazioni, ruolo,
     stato) con, per ciascuno: modifica di ruolo e organizzazioni,
     reimpostazione della password temporanea, disattivazione/riattivazione.
     Pulsante «+ Nuovo utente» per creare un cliente o un operatore con
     password temporanea. Un utente cliente può essere associato a più
     organizzazioni (es. più comuni); la prima scelta è la principale.
   Chi la usa: solo Amministratori (gli altri vedono un messaggio).
   Dati (src/lib/dati.js): elencaUtenti (RPC admin_elenco_utenti),
     elencaOrganizzazioni (tabella "organizzazione"), creaUtente (Edge
     Function "crea-utente", che registra anche le organizzazioni),
     aggiornaUtente (RPC admin_aggiorna_utente_completo, script 20: ruolo e
     organizzazioni in un'unica operazione), impostaUtenteAttivo (RPC
     admin_imposta_attivo), reimpostaPassword (Edge Function
     "reimposta-password"). Password generate con generaPasswordTemporanea
     di src/lib/password.js.
   Sicurezza: ogni funzione del database e ogni Edge Function verifica da
     sé che il chiamante sia Amministratore con verifica a due fattori
     (app_is_admin / sono_admin). Garantito lato server: non si nominano
     amministratori (né in creazione né in modifica), non si reimposta la
     password di un amministratore, non si disattiva se stessi. Solo
     interfaccia: il fatto che le righe degli Amministratori non abbiano
     pulsanti «Modifica» e «Disattiva» (il database non impedisce a un
     admin di modificare il ruolo di un altro admin).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */
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
  impostaUtenteAttivo,
  reimpostaPassword,
} from "../lib/dati.js";
import { generaPasswordTemporanea } from "../lib/password.js";

// Organizzazioni associate a un utente (elenco completo, con fallback
// sul vecchio campo singolo).
// u: riga di admin_elenco_utenti. Restituisce un array di id.
// organizzazioni_ids viene dalla tabella molti-a-molti utente_organizzazione
// (script 06); organizzazione_id è il vecchio campo del profilo.
function orgIdsUtente(u) {
  if (u.organizzazioni_ids && u.organizzazioni_ids.length) return u.organizzazioni_ids;
  return u.organizzazione_id ? [u.organizzazione_id] : [];
}
// Come orgIdsUtente, ma restituisce le denominazioni (per le etichette).
function orgNomiUtente(u) {
  if (u.organizzazioni_nomi && u.organizzazioni_nomi.length) return u.organizzazioni_nomi;
  return u.organizzazione ? [u.organizzazione] : [];
}

/* Pagina «Gestione utenti». Nessuna prop.
   Contiene l'elenco (una RigaUtente per utente) e apre FormInvito per la
   creazione. Dopo ogni salvataggio rilegge tutto dal database. */
export default function GestioneUtenti() {
  const { ruolo } = useAuth();
  const [utenti, setUtenti] = useState([]);
  const [organizzazioni, setOrganizzazioni] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");
  // Vero quando la finestra «Nuovo utente» è aperta.
  const [invito, setInvito] = useState(false);

  // Legge utenti e organizzazioni insieme. Per un non Amministratore
  // admin_elenco_utenti risponde con un errore (la pagina comunque non
  // mostra l'elenco).
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

/* Una riga dell'elenco utenti, con le azioni sull'utente.
   Props:
   - utente: riga di admin_elenco_utenti (id, email, nome_completo, ruolo,
     attivo, organizzazioni…)
   - organizzazioni: tutte le organizzazioni, per la scelta
   - ultimo: vero per l'ultima riga (niente bordo inferiore)
   - onSalvato: richiamata dopo un salvataggio riuscito (rilettura elenco).
   Tre pannelli alternativi: nessuno, «modifica» (ruolo e organizzazioni),
   «reimposta» (nuova password temporanea). */
function RigaUtente({ utente, organizzazioni, ultimo, onSalvato }) {
  const [modifica, setModifica] = useState(false);
  // Valori in modifica (ruolo e organizzazioni scelte), copiati dall'utente.
  const [ruolo, setRuolo] = useState(utente.ruolo);
  const [orgIds, setOrgIds] = useState(orgIdsUtente(utente));
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");
  const r = RUOLI[utente.ruolo];
  const nomiOrg = orgNomiUtente(utente);
  // Gli Amministratori non si gestiscono da qui (vedi «Sicurezza» in testa).
  const modificabile = utente.ruolo !== "admin";
  // Reimpostazione password: null = chiuso; { password } = conferma; { fatta } = esito.
  const [reimposta, setReimposta] = useState(null);

  // Assegna la password temporanea proposta (Edge Function). In caso di
  // successo la password resta a schermo per comunicarla all'utente; al
  // prossimo accesso dovrà cambiarla (password_temporanea = true).
  async function confermaReimposta() {
    setErrore("");
    setSalvataggio(true);
    const { error } = await reimpostaPassword(utente.id, reimposta.password);
    setSalvataggio(false);
    if (error) setErrore("Reimpostazione non riuscita: " + error.message);
    else setReimposta({ ...reimposta, fatta: true });
  }

  // Apre il pannello di modifica ripartendo dai valori salvati.
  function apri() {
    setRuolo(utente.ruolo);
    setOrgIds(orgIdsUtente(utente));
    setErrore("");
    setModifica(true);
  }

  // Disattiva o riattiva l'utente. Un profilo disattivato non ha più alcun
  // ruolo per il database (app_ruolo restituisce null): nessun accesso ai dati.
  async function commutaAttivo() {
    setErrore("");
    setSalvataggio(true);
    const { error } = await impostaUtenteAttivo(utente.id, !utente.attivo);
    setSalvataggio(false);
    if (error) setErrore(error.message);
    else onSalvato();
  }

  // Salva ruolo e organizzazioni. Un cliente deve avere almeno
  // un'organizzazione; per un operatore aggiornaUtente azzera le associazioni.
  // Sono due chiamate in sequenza (ruolo, poi organizzazioni): se la seconda
  // fallisce il ruolo resta comunque cambiato.
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
            {!utente.attivo && <Badge bg="#f6dcd6" fg={C.red}>Disattivato</Badge>}
            {r && <Badge bg={r.soft} fg={r.color}>{r.short}</Badge>}
            {modificabile && <button onClick={apri} style={btnMini}>Modifica</button>}
            {/* La password si propone subito ma si applica solo con «Conferma». */}
            {modificabile && utente.attivo && (
              <button onClick={() => { setErrore(""); setReimposta({ password: generaPasswordTemporanea() }); }} style={btnMini}>
                Reimposta password
              </button>
            )}
            {modificabile && (
              <button onClick={commutaAttivo} disabled={salvataggio} style={{ ...btnMini, color: utente.attivo ? C.red : C.green }}>
                {utente.attivo ? "Disattiva" : "Riattiva"}
              </button>
            )}
          </div>
        )}
      </div>

      {reimposta && !modifica && (
        <div style={{ marginTop: 12, padding: 14, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13 }}>
          {reimposta.fatta ? (
            <>
              <div style={{ color: C.green, fontWeight: 600, marginBottom: 6 }}>✓ Password reimpostata.</div>
              <div style={{ marginBottom: 10 }}>
                Comunica a {utente.email} la password temporanea <code style={{ fontSize: 14, fontWeight: 700 }}>{reimposta.password}</code> con un
                canale sicuro (ad esempio per telefono). Al primo accesso il portale gli chiederà di sceglierne una personale.
              </div>
              <button onClick={() => setReimposta(null)} style={btnMini}>Chiudi</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                Assegnare a <b>{utente.email}</b> la nuova password temporanea{" "}
                <code style={{ fontSize: 14, fontWeight: 700 }}>{reimposta.password}</code>? La password attuale smetterà di funzionare e al
                primo accesso l'utente dovrà sceglierne una personale.
              </div>
              {errore && <div style={{ color: C.red, marginBottom: 8 }}>{errore}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={confermaReimposta} disabled={salvataggio} style={btnMiniPrimario}>
                  {salvataggio ? "Reimpostazione…" : "Conferma"}
                </button>
                <button onClick={() => setReimposta({ password: generaPasswordTemporanea() })} disabled={salvataggio} style={btnMini}>Genera un'altra</button>
                <button onClick={() => { setReimposta(null); setErrore(""); }} disabled={salvataggio} style={btnMini}>Annulla</button>
              </div>
            </>
          )}
        </div>
      )}

      {!modifica && !reimposta && errore && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{errore}</div>}
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
          {/* Niente opzione «admin»: la nomina di amministratori non si fa
              dal portale (la rifiuta anche il database). */}
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
   principale dell'utente.
   Props: organizzazioni (tutte), selezionate (array di id, in ordine di
   scelta), onChange(nuovoArray). La casella di ricerca compare solo con
   più di 6 organizzazioni. */
function SceltaOrganizzazioni({ organizzazioni, selezionate, onChange }) {
  const [filtro, setFiltro] = useState("");
  const f = filtro.trim().toLowerCase();
  const visibili = f
    ? organizzazioni.filter((o) => (o.denominazione || "").toLowerCase().includes(f))
    : organizzazioni;

  // Aggiunge in fondo o toglie un'organizzazione, mantenendo l'ordine.
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

/* Finestra «Nuovo utente»: crea un cliente o un operatore con password
   temporanea (Edge Function "crea-utente"). Al termine mostra la password
   da comunicare all'utente, che al primo accesso dovrà cambiarla.
   Props: organizzazioni (per la scelta), onChiudi (annulla, o clic fuori
   prima della creazione), onInvitato (chiusura dopo la creazione: la
   pagina rilegge l'elenco). */
function FormInvito({ organizzazioni, onChiudi, onInvitato }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState(generaPassword());
  const [ruolo, setRuolo] = useState("cliente");
  const [orgIds, setOrgIds] = useState([]);
  const [errore, setErrore] = useState("");
  // Vero dopo la creazione riuscita: la finestra mostra l'esito.
  const [ok, setOk] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  // Creazione in un solo passo: la Edge Function crea-utente crea l'account,
  // completa il profilo e registra tutte le organizzazioni; se qualcosa non
  // riesce l'account viene eliminato e si mostra l'errore.
  async function invia(e) {
    e.preventDefault();
    setErrore("");
    if (ruolo === "cliente" && orgIds.length === 0) {
      setErrore("Seleziona almeno un'organizzazione per l'utente cliente.");
      return;
    }
    // Stessa regola delle password scelte dagli utenti e della Edge
    // Function crea-utente: almeno 10 caratteri con lettere e numeri
    // (REGOLE_PASSWORD, src/lib/password.js). La password generata ne ha 12.
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrore("La password temporanea deve avere almeno 10 caratteri, con lettere e numeri.");
      return;
    }
    setInCorso(true);
    const { data, error } = await creaUtente({
      email: email.trim(),
      password,
      ruolo,
      organizzazioniIds: ruolo === "cliente" ? orgIds : [],
      nomeCompleto: nome.trim() || null,
    });
    // La Edge Function può riportare l'errore anche nel corpo (data.error).
    if (error || data?.error) {
      setInCorso(false);
      setErrore("Creazione non riuscita: " + (data?.error || error.message));
      return;
    }
    setInCorso(false);
    setOk(true);
  }

  return (
    // Clic sullo sfondo scuro = chiudi; i clic dentro la finestra non arrivano
    // allo sfondo (stopPropagation).
    <div style={overlay} onClick={ok ? onInvitato : onChiudi}>
      <div style={modale} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "'Archivo'", fontSize: 19, margin: "0 0 16px" }}>Nuovo utente</h2>

        {ok ? (
          <div style={{ color: C.green, fontSize: 14, padding: "12px 0", lineHeight: 1.6 }}>
            ✓ Utente creato: <b>{email}</b>
            <br />
            Comunica all'utente la password temporanea: <b style={{ fontFamily: "monospace" }}>{password}</b>
            <br />
            Al primo accesso il portale gli chiederà di sceglierne una personale.
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

// Genera una password temporanea leggibile (12 caratteri casuali con
// almeno una lettera e una cifra, src/lib/password.js).
function generaPassword() {
  return generaPasswordTemporanea();
}

// Stili: sfondo e finestra modale, campi, etichette, pulsanti.
// (campoMini non è usato.)
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
