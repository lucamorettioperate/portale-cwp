# Controlli sui file caricati

Requisiti §13 "Upload": limite di dimensione, whitelist dei formati,
controllo MIME, scansione malware.

## Cosa è attivo

| Controllo | Dove | Dettaglio |
|---|---|---|
| Dimensione massima 50 MB | Portale, archivio (bucket), database | 50 MB è anche il massimo per file del piano Supabase gratuito |
| Formati ammessi | Portale, archivio, database | PDF, PDF firmato `.p7m`, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), OpenDocument (`.odt`, `.ods`), RTF, CSV, TXT, JPG, PNG |
| Tipo MIME | Archivio e database | il bucket accetta solo i tipi della lista; il database verifica che tipo ed estensione coincidano |
| Contenuto reale | Portale | i primi byte del file devono corrispondere al formato dichiarato: un `.exe` rinominato in `.pdf` viene rifiutato |
| Cartella della pratica | Database | un documento può riferirsi solo a un file presente nella cartella della propria pratica |
| Nome del file | Portale | accenti, spazi e simboli sostituiti nel nome d'archivio (il nome mostrato resta quello originale) |

Script: `supabase/14_controlli_file.sql`; codice del portale: `src/lib/file.js`.

Per cambiare i formati ammessi o il limite si modificano
`cwp_formati_ammessi()` e `cwp_dimensione_massima()` nello script 14 (e
`FORMATI` / `DIMENSIONE_MASSIMA` in `src/lib/file.js`), poi si riesegue lo
script.

## Scansione antivirus (non ancora attiva)

Supabase non ha un antivirus integrato. Serve un servizio esterno, chiamato
da una Edge Function a ogni nuovo file; un file infetto viene messo in
quarantena e lo staff avvisato. Opzioni:

1. **ClamAV su un piccolo server** (open source, nessun costo di licenza,
   circa 5-10 €/mese di hosting): i file restano in Europa e non passano da
   terzi. Richiede qualcuno che mantenga il server.
2. **API di scansione a consumo** (ad esempio Cloudmersive, Verisys): niente
   da mantenere, costo legato al numero di file; va verificato dove vengono
   trattati i file (privacy, GDPR).

Sconsigliato VirusTotal: i file caricati diventano consultabili da terzi.

Nel frattempo il rischio è contenuto: i file non vengono mai eseguiti dal
portale, l'archivio è privato, si scaricano solo con link temporanei e i
formati eseguibili sono esclusi.
