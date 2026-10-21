#!/bin/zsh
# =========================================================================
#  installa_backup_mac.sh — installa sul Mac di Luca il backup giornaliero
#  del Portale CWP (ogni giorno alle 20:00 in Google Drive › Cwp › backup ›
#  <data>). Richiesta di Luca Moretti del 21/10/2026.
#
#  USO (una volta, nel Terminale del Mac):
#    curl -fsSL https://raw.githubusercontent.com/lucamorettioperate/portale-cwp/main/strumenti/backup/installa_backup_mac.sh | zsh
#
#  Cosa fa:
#   1. cerca la cartella «Cwp» di Google Drive per desktop
#      (~/Library/CloudStorage/GoogleDrive-…/Il mio Drive/Cwp) e crea «backup»;
#   2. chiede la chiave service_role di Supabase e la salva nel Portachiavi
#      del Mac (servizio «cwp-backup-supabase»): non finisce in nessun file;
#   3. scarica backup_cwp_mac.sh in ~/.cwp-backup/ con il file config;
#   4. crea il lavoro di launchd «it.operate.cwp-backup» alle 20:00
#      (~/Library/LaunchAgents/it.operate.cwp-backup.plist);
#   5. fa subito un backup di prova e ne mostra l'esito.
#  Si può rieseguire: aggiorna lo script e, se si vuole, la chiave.
#  Per togliere il backup:
#    launchctl bootout gui/$(id -u)/it.operate.cwp-backup
#    rm ~/Library/LaunchAgents/it.operate.cwp-backup.plist
#
#  Registro sviluppo e deploy: capitolo «Servizi e configurazione», backup.
# =========================================================================
setopt NO_NOMATCH
ETICHETTA="it.operate.cwp-backup"
CONF_DIR="$HOME/.cwp-backup"
PLIST="$HOME/Library/LaunchAgents/$ETICHETTA.plist"
RAW="https://raw.githubusercontent.com/lucamorettioperate/portale-cwp/main/strumenti/backup/backup_cwp_mac.sh"

print "\n=== Backup giornaliero del Portale CWP ===\n"

# 1. Cartella Cwp di Google Drive per desktop.
CANDIDATE=(~/Library/CloudStorage/GoogleDrive-*/*/Cwp(N/) ~/Library/CloudStorage/GoogleDrive-*/*/cwp(N/) ~/Library/CloudStorage/GoogleDrive-*/*/CWP(N/))
if (( ${#CANDIDATE} == 0 )); then
  print "Non trovo la cartella «Cwp» di Google Drive su questo Mac."
  print "Installa e apri «Google Drive per desktop» (https://www.google.com/drive/download/),"
  print "accedi con lucamoretti1968@gmail.com e riesegui questo comando."
  exit 1
fi
CWP="${CANDIDATE[1]}"
DEST="$CWP/backup"
mkdir -p "$DEST" || { print "Non riesco a creare $DEST"; exit 1; }
print "Cartella dei backup: $DEST\n"

# 2. Chiave di Supabase nel Portachiavi.
if /usr/bin/security find-generic-password -a cwp -s cwp-backup-supabase >/dev/null 2>&1; then
  print -n "La chiave di Supabase è già salvata. Vuoi sostituirla? (s/N) "
  read -r R < /dev/tty
  [[ "$R" == [sS]* ]] && NUOVA=1 || NUOVA=0
else
  NUOVA=1
fi
if (( NUOVA )); then
  print "Supabase › Project Settings › API Keys: copia la chiave «service_role» (o «secret»)."
  print "Incollala qui sotto e premi Invio (non si vede mentre la incolli):"
  read -rs KEY < /dev/tty
  print
  if [[ -z "$KEY" ]]; then print "Nessuna chiave inserita: installazione interrotta."; exit 1; fi
  /usr/bin/security add-generic-password -U -a cwp -s cwp-backup-supabase -l "Backup Portale CWP (Supabase)" -w "$KEY" \
    || { print "Non riesco a salvare la chiave nel Portachiavi."; exit 1; }
  unset KEY
  print "Chiave salvata nel Portachiavi.\n"
fi

# 3. Script e configurazione.
mkdir -p "$CONF_DIR"
curl -fsSL "$RAW" -o "$CONF_DIR/backup_cwp_mac.sh" || { print "Non riesco a scaricare lo script da GitHub."; exit 1; }
chmod 700 "$CONF_DIR/backup_cwp_mac.sh"
cat > "$CONF_DIR/config" <<CONFIG
DEST="$DEST"
SUPABASE_URL="https://ajxrnofgunynkynozmrn.supabase.co"
PORTALE_URL="https://portale-cwp.vercel.app"
GITHUB_REPO="lucamorettioperate/portale-cwp"
CONFIG
chmod 600 "$CONF_DIR/config"

# 4. Lavoro di launchd alle 20:00.
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTXML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETICHETTA</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$CONF_DIR/backup_cwp_mac.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$CONF_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$CONF_DIR/backup.log</string>
</dict>
</plist>
PLISTXML
launchctl bootout "gui/$(id -u)/$ETICHETTA" >/dev/null 2>&1
launchctl bootstrap "gui/$(id -u)" "$PLIST" || { print "Non riesco ad attivare il lavoro pianificato."; exit 1; }
print "Backup pianificato ogni giorno alle 20:00.\n"

# 5. Backup di prova adesso, dallo stesso lavoro pianificato.
print "Faccio subito un backup di prova (circa un minuto)…"
: >> "$CONF_DIR/backup.log"
RIGHE=$(wc -l < "$CONF_DIR/backup.log")
launchctl kickstart -k "gui/$(id -u)/$ETICHETTA"
for i in {1..60}; do
  sleep 3
  tail -n +$((RIGHE + 1)) "$CONF_DIR/backup.log" | grep -q "Fine" && break
done
print "\n--- Esito ---"
tail -n +$((RIGHE + 1)) "$CONF_DIR/backup.log"
print "\nSe macOS chiede di consentire l'accesso ai file di Google Drive, premi «Consenti»."
print "Installazione finita."
