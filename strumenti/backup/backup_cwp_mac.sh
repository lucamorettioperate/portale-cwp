#!/bin/zsh
# =========================================================================
#  backup_cwp_mac.sh — backup giornaliero del Portale CWP dal Mac di Luca
#  (richiesta di Luca Moretti del 21/10/2026: ogni giorno alle 20:00, una
#  sottocartella con la data nella cartella «Cwp/backup» di Google Drive).
#
#  PERCHÉ SUL MAC. Google blocca i programmi personali in Apps Script
#  sull'account di Luca, quindi nessun servizio esterno può scrivere nel
#  suo Drive. L'app Google Drive per desktop (di Google) invece sincronizza
#  la cartella «Cwp» del Mac: questo script scrive lì e Drive carica.
#
#  COSA SALVA in Cwp/backup/<aaaa-mm-gg>/ (se esiste già: <data>_<ora>):
#   - database_completo.json  tutte le tabelle, utenti senza password,
#                             elenco dei file e dei lavori pianificati
#                             (funzione backup_completo, script 38);
#   - file_caricati/<archivio>/<percorso>  tutti i file degli archivi
#                             Storage, con gli stessi percorsi;
#   - portale-cwp-main.zip    il codice da GitHub;
#   - Istruzioni_Ripristino_Portale_CWP.pdf  dal portale;
#   - LEGGIMI.txt e esito.txt (numeri, errori).
#  I backup vecchi non si cancellano: li toglie Luca a mano.
#
#  CHIAVE. La chiave service_role di Supabase sta nel Portachiavi del Mac
#  (servizio «cwp-backup-supabase», la inserisce Luca con l'installazione):
#  mai in un file.
#
#  QUANDO GIRA. launchd (it.operate.cwp-backup) alle 20:00; se a quell'ora
#  il Mac è spento o in stop, parte appena si riaccende. Installazione e
#  controllo: installa_backup_mac.sh. Registro: ~/.cwp-backup/backup.log.
#  Alla fine compare una notifica del Mac con l'esito.
#
#  Registro sviluppo e deploy: capitolo «Servizi e configurazione», backup;
#  Istruzioni di ripristino, capitolo «Backup automatico».
# =========================================================================
setopt NO_NOMATCH
CONF_DIR="$HOME/.cwp-backup"
source "$CONF_DIR/config" || { echo "Manca $CONF_DIR/config: eseguire l'installazione"; exit 1; }
# Nel file config: DEST (cartella Cwp/backup su Drive), SUPABASE_URL, PORTALE_URL, GITHUB_REPO.

ora() { date "+%Y-%m-%d %H:%M:%S"; }
log() { print -r -- "$(ora)  $*"; }
notifica() { /usr/bin/osascript -e "display notification \"$1\" with title \"Backup Portale CWP\"" >/dev/null 2>&1; }

log "Inizio backup"
KEY=$(/usr/bin/security find-generic-password -a cwp -s cwp-backup-supabase -w 2>/dev/null)
if [[ -z "$KEY" ]]; then
  log "ERRORE: chiave di Supabase non trovata nel Portachiavi"; notifica "Backup non riuscito: manca la chiave di Supabase"; exit 1
fi
# Le chiavi nuove (sb_secret_…) vanno solo nell'intestazione apikey; quelle
# vecchie (JWT) anche in Authorization.
INTESTAZIONI=(-H "apikey: $KEY")
[[ "$KEY" != sb_* ]] && INTESTAZIONI+=(-H "Authorization: Bearer $KEY")

if [[ ! -d "$DEST" ]]; then
  log "ERRORE: cartella di Drive non trovata: $DEST"; notifica "Backup non riuscito: cartella Drive non trovata (Google Drive è aperto?)"; exit 1
fi

DATA=$(date +%Y-%m-%d)
DIR="$DEST/$DATA"
[[ -e "$DIR" ]] && DIR="${DIR}_$(date +%H%M)"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/cwp-backup.XXXXXX")
ERRORI=()

# 1. Database (una chiamata: funzione backup_completo dello script 38).
if curl -sS -f --max-time 300 -X POST "$SUPABASE_URL/rest/v1/rpc/backup_completo" "${INTESTAZIONI[@]}" \
     -H "Content-Type: application/json" -d '{}' -o "$TMP/database_completo.json"; then
  log "Database: $(wc -c < "$TMP/database_completo.json" | tr -d ' ') byte"
else
  ERRORI+=("database non scaricato"); log "ERRORE: database non scaricato"
fi

# 2. File degli archivi Storage, con gli stessi percorsi. L'elenco si legge
# dal JSON con JavaScript for Automation (incluso in macOS).
NFILE=0
if [[ -s "$TMP/database_completo.json" ]]; then
  ELENCO=$(/usr/bin/osascript -l JavaScript -e '
    function run(a) {
      var s = $.NSString.stringWithContentsOfFileEncodingError(a[0], 4, null).js;
      var d = JSON.parse(s);
      return (d.file_storage || []).map(function (f) {
        return f.bucket + "\t" + f.path + "\t" + f.path.split("/").map(encodeURIComponent).join("/");
      }).join("\n");
    }' "$TMP/database_completo.json" 2>&1)
  while IFS=$'\t' read -r B P E; do
    [[ -z "$B" || -z "$P" ]] && continue
    mkdir -p "$TMP/file_caricati/$B/${P:h}"
    if curl -sS -f --max-time 300 "$SUPABASE_URL/storage/v1/object/$B/$E" "${INTESTAZIONI[@]}" -o "$TMP/file_caricati/$B/$P"; then
      NFILE=$((NFILE + 1))
    else
      ERRORI+=("file non scaricato: $B/$P"); log "ERRORE: file non scaricato: $B/$P"
    fi
  done <<< "$ELENCO"
  log "File scaricati: $NFILE"
fi

# 3. Codice da GitHub e 4. istruzioni di ripristino.
curl -sS -f -L --max-time 300 "https://codeload.github.com/$GITHUB_REPO/zip/refs/heads/main" -o "$TMP/portale-cwp-main.zip" \
  || { ERRORI+=("codice non scaricato da GitHub"); log "ERRORE: codice non scaricato"; }
curl -sS -f --max-time 120 "$PORTALE_URL/documentazione/Istruzioni_Ripristino_Portale_CWP.pdf" -o "$TMP/Istruzioni_Ripristino_Portale_CWP.pdf" \
  || { ERRORI+=("istruzioni non scaricate"); log "ERRORE: istruzioni non scaricate"; }

# 5. LEGGIMI ed esito.
cat > "$TMP/LEGGIMI.txt" <<'TESTO'
BACKUP AUTOMATICO DEL PORTALE CARBON WASTEPRINT (CWP)
Fatto dal Mac di Luca alle 20:00 (strumenti/backup/backup_cwp_mac.sh), cartella Cwp/backup/<data>.

CONTENUTO
- database_completo.json   tutte le tabelle, gli utenti (SENZA password), l'elenco dei file e dei lavori
                           pianificati. CONTIENE DATI PERSONALI: la cartella non va condivisa.
- file_caricati/           i file degli archivi Storage (documenti, modelli, allegati-consultazione),
                           con gli stessi percorsi.
- portale-cwp-main.zip     il codice completo da GitHub (portale, script del database, funzioni, manuali).
- Istruzioni_Ripristino_Portale_CWP.pdf   come ricostruire tutto da zero.
- esito.txt                numeri ed eventuali errori di questo backup.

COSA NON C'È: le password degli utenti (al primo accesso «Password dimenticata?») e le chiavi segrete
(service_role di Supabase, RESEND_API_KEY, EMAIL_MITTENTE, ANTHROPIC_API_KEY, variabili di Vercel).

RIPRISTINO DA ZERO (dettagli nel PDF)
1. GitHub: nuovo repository con il contenuto dello ZIP.
2. Supabase: nuovo progetto, estensioni pg_cron e pg_net, script supabase/01… in ordine
   (prima dello script 25 caricare i PDF di file_caricati/modelli nell'archivio «modelli»).
3. Dati: node strumenti/backup/genera_sql_ripristino.mjs database_completo.json ripristino_dati.sql
   e poi ripristino_dati.sql nel SQL Editor del nuovo progetto.
4. File: ricaricare file_caricati/ negli archivi con gli stessi percorsi
   (strumenti/backup/carica_file_ripristino.mjs file_caricati).
5. Funzioni del server e chiavi; 6. Vercel; 7. Resend e Claude Console; 8. verifiche.
TESTO
{
  print "Backup del $(ora)"
  print "Database: $([[ -s $TMP/database_completo.json ]] && echo presente || echo MANCANTE)"
  print "File degli archivi scaricati: $NFILE"
  print "Codice: $([[ -s $TMP/portale-cwp-main.zip ]] && echo presente || echo MANCANTE)"
  print "Istruzioni: $([[ -s $TMP/Istruzioni_Ripristino_Portale_CWP.pdf ]] && echo presenti || echo MANCANTI)"
  if (( ${#ERRORI} )); then print "ERRORI:"; for e in "${ERRORI[@]}"; do print " - $e"; done; else print "Esito: completo, nessun errore"; fi
} > "$TMP/esito.txt"

# 6. Copia nella cartella di Drive (preparato in locale, poi copiato tutto insieme).
if mkdir -p "$DIR" && cp -R "$TMP/." "$DIR/"; then
  log "Copiato in $DIR"
else
  ERRORI+=("copia nella cartella Drive non riuscita"); log "ERRORE: copia in $DIR non riuscita"
fi
rm -rf "$TMP"

if (( ${#ERRORI} )); then
  log "Fine con ${#ERRORI} errori"; notifica "Backup del $DATA con ${#ERRORI} errori: vedi esito.txt"; exit 1
fi
log "Fine: backup completo in $DIR"
notifica "Backup del $DATA completato ($NFILE file)"
exit 0
