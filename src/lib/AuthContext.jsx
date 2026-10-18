import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigurato } from "./supabase.js";

/* =========================================================================
   Contesto di autenticazione.
   Espone: utente, profilo (con ruolo), stato di caricamento, e le funzioni
   accedi / esci. Il profilo (ruolo, organizzazione) viene letto dal database.
   ========================================================================= */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessione, setSessione] = useState(null);
  const [profilo, setProfilo] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  // Verifica a due fattori: richiesta per lo staff (script 10).
  const [mfa, setMfa] = useState({ richiesta: false, verificata: false });
  // Sessione aperta da un link "password dimenticata" (script 15).
  const [recupero, setRecupero] = useState(false);

  async function caricaMfa() {
    if (!supabase) return;
    const { data } = await supabase.rpc("mio_stato_mfa");
    const riga = Array.isArray(data) ? data[0] : data;
    setMfa({ richiesta: !!riga?.richiesta, verificata: !!riga?.verificata });
  }

  // Carica il profilo applicativo (ruolo, organizzazione) dell'utente.
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

  async function accedi(email, password) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    return await supabase.auth.signInWithPassword({ email, password });
  }

  async function esci() {
    if (supabase) await supabase.auth.signOut();
    setProfilo(null);
    setRecupero(false);
  }

  // Invia l'email con il collegamento per scegliere una nuova password.
  async function richiediRecuperoPassword(email) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reimposta-password`,
    });
  }

  // Cambia la password dell'utente collegato. Se è indicata la password
  // attuale, prima la verifica (cambio volontario). Poi toglie l'obbligo di
  // cambio e registra l'operazione nell'audit (funzione password_cambiata).
  async function cambiaPassword(nuova, attuale = null) {
    if (!supabase) return { error: { message: "Backend non configurato." } };
    const email = sessione?.user?.email;
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
