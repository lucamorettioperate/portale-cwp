/* =========================================================================
   ProxyGoogleNews.gs — lettura di Google News per «Notizie CO2»
   (ISS-036, 21/10/2026).

   PERCHÉ SERVE. Google News blocca le richieste che arrivano dai server di
   Supabase: a ogni indirizzo risponde 503 con la pagina «Sorry…» (traffico
   insolito da un centro dati), qualunque intestazione si usi (prova del
   21/10 con la diagnosi della funzione «notizie»). Dai server di Google,
   invece, la lettura funziona. Questo piccolo programma gira in Google Apps
   Script con l'account di Luca e fa da tramite: la funzione «notizie» gli
   chiede un feed di Google News e lui lo restituisce così com'è.

   SICUREZZA. Legge SOLO indirizzi https://news.google.com/rss/… (qualunque
   altro indirizzo viene rifiutato): non è un tramite aperto verso altri
   siti. Non legge né scrive nulla del portale o del Drive. I feed di
   Google News sono pubblici: l'indirizzo dell'applicazione non è segreto.

   INSTALLAZIONE (una volta, circa 5 minuti):
     1. script.google.com → Nuovo progetto «Notizie CO2 – Google News» →
        incollare questo file al posto del contenuto → Salva.
     2. Esegui il deploy → Nuovo deployment → tipo «Applicazione web»:
        «Esegui come: me», «Chi ha accesso: Chiunque» → Esegui il deploy →
        autorizzare (accesso a servizi esterni) → copiare l'«URL
        dell'applicazione web» (finisce con /exec).
     3. Nel SQL Editor di Supabase:
          insert into impostazione (chiave, valore)
          values ('url_proxy_google_news', '<URL copiato>')
          on conflict (chiave) do update set valore = excluded.valore;
     Dalla ricerca successiva le notizie di Google News si aggiungono a
     quelle di Bing News e dei siti specializzati.

   Registro sviluppo e deploy: capitolo 5 «Edge Functions» (notizie).
   ========================================================================= */

// Risponde a GET ?url=<feed di Google News> con il testo del feed.
function doGet(e) {
  var url = (e && e.parameter && e.parameter.url) || "";
  if (!/^https:\/\/news\.google\.com\/rss(\/|\?)/.test(url)) return testo("indirizzo non ammesso");
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) return testo("Google News: " + r.getResponseCode());
    return ContentService.createTextOutput(r.getContentText("UTF-8")).setMimeType(ContentService.MimeType.RSS);
  } catch (err) {
    return testo("errore: " + err);
  }
}

// Messaggio semplice (la funzione «notizie» lo scrive nei log se non è un feed).
function testo(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

// Prova dall'editor: Esegui → provaGoogleNews; nei log il numero di notizie.
function provaGoogleNews() {
  var r = doGet({ parameter: { url: "https://news.google.com/rss/search?q=%22crediti%20di%20carbonio%22&hl=it&gl=IT&ceid=IT:it" } });
  var t = r.getContent();
  Logger.log("Notizie lette: " + ((t.match(/<item>/g) || []).length));
}
