# Notifiche via email

Ogni notifica del portale (nuova fase, richiesta di integrazione, documento
caricato, consultazione aperta, scadenze…) arriva anche per email al
destinatario, con il pulsante "Apri nel portale".

## Come funziona

1. Il database crea la notifica interna (script `09`).
2. Un trigger (script `12`) chiama la Edge Function `invia-email-notifica`
   passando solo l'identificativo della notifica.
3. La funzione rilegge notifica e destinatario dal database, spedisce l'email
   con Resend e segna la notifica come inviata (una sola volta).
4. Ogni 15 minuti si riprovano le notifiche delle ultime 6 ore non spedite.

Senza la chiave di Resend la funzione non spedisce nulla e le notifiche
interne continuano a funzionare normalmente.

## Configurazione di Resend (una volta sola)

1. Crea un account su <https://resend.com> (gratuito fino a 3.000 email al
   mese, 100 al giorno).
2. **Domains → Add Domain**: inserisci il dominio da cui partiranno le email
   (ad esempio `carbonwasteprint.com` o un sottodominio come
   `notifiche.operate.it`). Resend mostra 3-4 record DNS (SPF, DKIM) da
   aggiungere presso il fornitore del dominio; dopo la verifica il dominio
   risulta "Verified".
   - Finché il dominio non è verificato si può provare con il mittente
     `onboarding@resend.dev`, che però consegna **solo** all'indirizzo con cui
     ti sei registrato su Resend.
3. **API Keys → Create API Key** (permesso "Sending access"): copia la chiave.
4. In Supabase: **Edge Functions → Secrets → Add new secret**:
   - `RESEND_API_KEY` = la chiave copiata
   - `EMAIL_MITTENTE` = ad esempio `Portale CWP <notifiche@carbonwasteprint.com>`
   - (facoltativo) `PORTALE_URL` = indirizzo del portale, se cambia dominio

Da quel momento le nuove notifiche partono anche per email.
