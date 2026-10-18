/* =========================================================================
   Regole e strumenti per le password.
   ========================================================================= */

export const REGOLE_PASSWORD = "Almeno 10 caratteri, con almeno una lettera e un numero.";

// Restituisce un messaggio d'errore oppure "" se la password va bene.
export function controllaPassword(password, conferma, email = "") {
  if (!password || password.length < 10) return "La password deve avere almeno 10 caratteri.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "La password deve contenere almeno una lettera e un numero.";
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4)
    return "La password non deve contenere il tuo indirizzo email.";
  if (conferma !== undefined && password !== conferma) return "Le due password non coincidono.";
  return "";
}

// Password temporanea leggibile e casuale (generatore crittografico).
export function generaPasswordTemporanea() {
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
export function traduciErroreAuth(error) {
  const m = (error && error.message) || "";
  if (/same.*password|different from the old/i.test(m)) return "La nuova password deve essere diversa da quella attuale.";
  if (/weak|at least/i.test(m)) return "La password è troppo debole: " + REGOLE_PASSWORD;
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi ravvicinati: riprova tra qualche minuto.";
  if (/expired|invalid/i.test(m)) return "Il collegamento non è più valido: richiedine uno nuovo.";
  if (/reauthenticat/i.test(m)) return "Per sicurezza esci, rientra e riprova a cambiare la password.";
  return m || "Operazione non riuscita.";
}
