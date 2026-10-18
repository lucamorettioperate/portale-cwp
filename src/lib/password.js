/* =========================================================================
   password.js — regole e strumenti per le password.

   Scopo: controllo delle regole della password prima dell'invio, generazione
   della password temporanea assegnata dall'Amministratore, traduzione in
   italiano degli errori di Supabase Auth.

   Usato da: src/pages/CambiaPassword.jsx (cambio obbligatorio, volontario,
   recupero) e src/pages/GestioneUtenti.jsx (nuovo utente, reimpostazione).
   Dati/servizi coinvolti: nessuna chiamata; i messaggi tradotti sono quelli
   di Supabase Auth.

   Sicurezza: il controllo qui è solo una comodità per l'utente. Supabase
   Auth applica comunque le proprie regole minime lato server. La password
   temporanea va comunicata all'utente per un canale separato e deve essere
   cambiata al primo accesso (flag profilo.password_temporanea, script 15).

   Registro sviluppo e deploy: capitolo 6 «Portale (frontend)»; capitolo 4
   «Database» (15_password.sql); capitolo 5 «Edge Functions»
   (crea-utente, reimposta-password).
   ========================================================================= */

// Testo delle regole, mostrato sotto i campi password.
export const REGOLE_PASSWORD = "Almeno 10 caratteri, con almeno una lettera e un numero.";

// Restituisce un messaggio d'errore oppure "" se la password va bene.
// Parametri: password; conferma (se undefined il confronto si salta);
// email dell'utente: la parte prima della @, se lunga almeno 4 caratteri,
// non può comparire nella password.
export function controllaPassword(password, conferma, email = "") {
  if (!password || password.length < 10) return "La password deve avere almeno 10 caratteri.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "La password deve contenere almeno una lettera e un numero.";
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4)
    return "La password non deve contenere il tuo indirizzo email.";
  if (conferma !== undefined && password !== conferma) return "Le due password non coincidono.";
  return "";
}

// Password temporanea leggibile e casuale (generatore crittografico).
// Restituisce 12 caratteri: 10 casuali + una lettera + una cifra finali.
// Usa crypto.getRandomValues, mai Math.random (non è sicuro).
export function generaPasswordTemporanea() {
  // Alfabeto senza caratteri che si confondono a voce o a vista
  // (I, O, l, o, 0, 1).
  const lettere = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const cifre = "23456789";
  const tutti = lettere + cifre;
  const casuali = new Uint32Array(12);
  crypto.getRandomValues(casuali);
  let p = "";
  for (let i = 0; i < 10; i++) p += tutti[casuali[i] % tutti.length];
  // garantisce almeno una lettera e una cifra
  p += lettere[casuali[10] % lettere.length] + cifre[casuali[11] % cifre.length];
  return p;
}

// Traduce i messaggi di Supabase Auth più comuni.
// Parametro: oggetto errore di Supabase. Restituisce un testo in italiano;
// se il messaggio non è riconosciuto, restituisce quello originale.
// I controlli si basano sul testo inglese di Supabase: se Supabase cambia
// i messaggi, aggiornare le espressioni regolari.
export function traduciErroreAuth(error) {
  const m = (error && error.message) || "";
  if (/same.*password|different from the old/i.test(m)) return "La nuova password deve essere diversa da quella attuale.";
  if (/weak|at least/i.test(m)) return "La password è troppo debole: " + REGOLE_PASSWORD;
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi ravvicinati: riprova tra qualche minuto.";
  if (/expired|invalid/i.test(m)) return "Il collegamento non è più valido: richiedine uno nuovo.";
  if (/reauthenticat/i.test(m)) return "Per sicurezza esci, rientra e riprova a cambiare la password.";
  return m || "Operazione non riuscita.";
}
