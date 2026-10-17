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

  // Carica il profilo applicativo (ruolo, organizzazione) dell'utente.
  async function caricaProfilo(userId) {
    if (!supabase || !userId) {
      setProfilo(null);
      return;
    }
    const { data, error } = await supabase
      .from("profilo")
      .select("id, ruolo, nome_completo, organizzazione_id, attivo")
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
      if (data.session?.user) await caricaProfilo(data.session.user.id);
      setCaricamento(false);
    });

    // Ascolta i cambi di stato (login, logout, refresh).
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, sess) => {
      setSessione(sess);
      if (sess?.user) await caricaProfilo(sess.user.id);
      else setProfilo(null);
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
  };

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
