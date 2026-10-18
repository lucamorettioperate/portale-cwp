/* =========================================================================
   AuthContext.jsx — contesto di autenticazione del portale.

   Scopo: tiene in memoria la sessione Supabase Auth, il profilo applicativo
   (ruolo, organizzazione, flag password temporanea) e lo stato MFA.
   Espone le funzioni accedi, esci, richiediRecuperoPassword, cambiaPassword
   e caricaMfa. Ogni pagina lo legge con l'hook useAuth().

   Usato da: src/main.jsx (AuthProvider), src/App.jsx (rotte protette) e
   quasi tutte le pagine e i componenti (useAuth).

   Dati/servizi coinvolti:
   - Supabase Auth: getSession, onAuthStateChange, signInWithPassword,
     updateUser, signOut;
   - tabella `profilo` (01_schema.sql; colonne `attivo` e
     `password_temporanea` da 10_mfa_profilo.sql e 15_password.sql);
   - RPC `mio_stato_mfa` (10_mfa_profilo.sql) e `password_cambiata`
     (15_password.sql);
   - Edge Function `recupera-password` (email di recupero con Resend).

   Sicurezza: il ruolo letto qui serve solo a decidere cosa mostrare.
   I permessi veri li applica il database (RLS e funzioni con controllo del
   ruolo): modificare questo file non dà accesso a dati in più.

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; per MFA e
   password capitolo 4 «Database» (script 10, 15, 16) e capitolo 5
   «Edge Functions» (recupera-password).
   ========================================================================= */
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigurato } from "./supabase.js";

// Contesto React condiviso; vale null fuori da AuthProvider (vedi useAuth).
const AuthContext = createContext(null);

// Fornitore del contesto: avvolge l'intera applicazione (src/main.jsx).
// Al primo avvio legge la sessione salvata dal client Supabase, poi resta in
// ascolto dei cambi (accesso, uscita, rinnovo del token, link di recupero).
export function AuthProvider({ children }) {
  const [sessione, setSessione] = useState(null);
  const [profilo, setProfilo] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  // Verifica a due fattori: richiesta per lo staff (script 10).
  const [mfa, setMfa] = useState({ richiesta: false, verificata: false });
  // Sessione aperta da un link "password dimenticata" (script 15).
  const [recupero, setRecupero] = useState(false);

  // Legge dal database se all'utente serve la verifica a due fattori
  // (`richiesta`: staff con mfa_obbligatoria accesa) e se la sessione
  // l'ha già superata (`verificata`, livello aal2). RPC mio_stato_mfa.
  async function caricaMfa() {
    if (!supabase) return;
    const { data } = await supabase.rpc("mio_stato_mfa");
    const riga = Array.isArray(data) ? data[0] : data;
    setMfa({ richiesta: !!riga?.richiesta, verificata: !!riga?.verificata });
  }

  // Carica il profilo applicativo (ruolo, organizzazione) dell'utente dalla
  // tabella `profilo`. La RLS consente a ciascuno di leggere il proprio.
  // In caso di errore il profilo resta null (il portale mostra la vista cliente).
  async function caricaProfilo(userId) {
    if (!supabase || !userId) {
      setProfilo(null);
      return;
    }
    const { data, error } = await supabase
      .from("profilo")
      .select("id, ruolo, nome_completo, organizzazione_id, attivo, password_temporanea")
      .eq("id", userId)
      .single();
    if (error) {
      setProfilo(null);
    } else {
      setProfilo(data);
    }
  }

  useEffect(() => {
    if (!supabaseConfigurato) {
      setCaricamento(false);
      return;
    }
    // Sessione iniziale.
    supabase.auth.getSession().then(async ({ data }) => {
      setSessione(data.session);
      if (data.session?.user) {
        await caricaProfilo(data.session.user.id);
        await caricaMfa();
      }
      setCaricamento(false);
    });

    // Ascolta i cambi di stato (login, logout, refresh).
    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, sess) => {
      // PASSWORD_RECOVERY: la sessione nasce dal link dell'email di recupero.
      // App.jsx manda l'utente a /reimposta-password prima di ogni altra pagina.
      if (evento === "PASSWORD_RECOVERY") setRecupero(true);
      setSessione(sess);
      if (sess?.user) {
        await caricaProfilo(sess.user.id);
        await caricaMfa();
      } else {
        setProfilo(null);
        setMfa({ richiesta: false, verificata: false });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Accesso con email e password (Supabase Auth). Restituisce { data, error }
  // così come li dà Supabase; il profilo si carica da onAuthStateChange.
  async function accedi(email, password) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    return await supabase.auth.signInWithPassword({ email, password });
  }

  // Chiude la sessione e azzera profilo e stato di recupero.
  async function esci() {
    if (supabase) await supabase.auth.signOut();
    setProfilo(null);
    setRecupero(false);
  }

  // Invia l'email con il collegamento per scegliere una nuova password.
  // L'email la spedisce il portale (Edge Function "recupera-password", testo
  // italiano con Resend), non il modello predefinito di Supabase.
  // La funzione risponde sempre "ok" (non rivela se l'indirizzo esiste):
  // qui si segnala solo l'errore di rete o di servizio.
  async function richiediRecuperoPassword(email) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    const { data, error } = await supabase.functions.invoke("recupera-password", { body: { email } });
    if (error) return { error: { message: "Invio non riuscito: riprova tra qualche minuto." } };
    return { data, error: null };
  }

  // Cambia la password dell'utente collegato. Se è indicata la password
  // attuale, prima la verifica (cambio volontario). Poi toglie l'obbligo di
  // cambio e registra l'operazione nell'audit (funzione password_cambiata).
  // Parametri: nuova password; attuale = null nei modi "obbligatorio" e
  // "recupero" (nessuna verifica). Restituisce { error }.
  // Effetti: aggiorna la password in Supabase Auth, azzera
  // profilo.password_temporanea, scrive un evento di audit.
  async function cambiaPassword(nuova, attuale = null) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    const email = sessione?.user?.email;
    // Verifica della password attuale: un nuovo accesso con le stesse
    // credenziali; se fallisce non si cambia nulla.
    if (attuale !== null) {
      const { error: errVerifica } = await supabase.auth.signInWithPassword({ email, password: attuale });
      if (errVerifica) return { error: { message: "La password attuale non è corretta." } };
    }
    const { error } = await supabase.auth.updateUser({ password: nuova });
    if (error) return { error };
    await supabase.rpc("password_cambiata");
    setRecupero(false);
    await caricaProfilo(sessione?.user?.id);
    return { error: null };
  }

  // Valori esposti a useAuth(). backendPronto = false quando mancano le
  // variabili VITE_SUPABASE_*: in quel caso App.jsx non blocca le pagine.
  const valore = {
    sessione,
    utente: sessione?.user ?? null,
    profilo,
    ruolo: profilo?.ruolo ?? null,
    caricamento,
    autenticato: Boolean(sessione?.user),
    backendPronto: supabaseConfigurato,
    accedi,
    esci,
    recupero,
    richiediRecuperoPassword,
    cambiaPassword,
    passwordDaCambiare: Boolean(profilo?.password_temporanea),
    mfa,
    caricaMfa,
  };

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>;
}

// Hook per leggere il contesto da un componente. Lancia un errore se usato
// fuori da AuthProvider (errore di programmazione, non di runtime utente).
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
