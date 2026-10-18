# =========================================================================
# genera_esempi_tracciato.py — file di esempio del tracciato dati CWP.
#
# Scopo: genera i file di prova del tracciato dati per i test automatici
# (test/tracciato.test.mjs) e per il collaudo manuale (Manuale Test):
#  - test/dati/tracciato_esempio.xlsx  : tracciato compilato, Banca Dati con totali (foglio 5)
#  - test/dati/tracciato_letture.zip   : ZIP di CSV con le singole letture (foglio 6)
#  - test/dati/tracciato_privacy.xlsx  : tracciato con dati personali (deve essere bloccato)
# I dati sono inventati (Comune di Prova, utenze con codici fittizi).
#
# Usato da: nessun programma lo esegue in automatico; i file prodotti sono
# letti da test/tracciato.test.mjs (npm test) e servono per le prove a mano
# dell'import nel portale.
#
# Dati/servizi coinvolti: nessuno. Parte dal modello
# public/modelli/Tracciato_dati_CWP_v1.xlsx: rigenerare prima quello
# (strumenti/genera_tracciato_dati.py) se il tracciato è cambiato.
# Richiede Python 3 e openpyxl.
#
# Attenzione: i valori qui sotto sono quelli attesi da test/tracciato.test.mjs
# (es. 18 svuotamenti di U0001 nel 2025, PEF 65/35, peso CdR 12,5 kg).
# Se si cambiano, aggiornare anche i test.
#
# Uso: python3 strumenti/genera_esempi_tracciato.py   poi npm test
#
# Registro sviluppo e deploy: capitolo 6 «Portale (frontend)» (strumenti/,
# test/dati/); capitolo 8 «Procedure di rilascio».
# =========================================================================
import os, zipfile, io, csv
from openpyxl import load_workbook
from datetime import date

RADICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODELLO = os.path.join(RADICE, "public", "modelli", "Tracciato_dati_CWP_v1.xlsx")
OUT = os.path.join(RADICE, "test", "dati")
os.makedirs(OUT, exist_ok=True)

# Contenuto di prova. Le chiavi di ANAGRAFICA sono le voci della colonna A
# del foglio 1_Anagrafica del modello; le righe degli altri fogli seguono
# l'ordine delle colonne del modello (None = cella vuota).
ANAGRAFICA = {"Ente (Comune o Unione)": "Comune di Prova", "Anno di riferimento dei dati": "2025",
              "Tariffa puntuale attiva": "sì", "PEF % utenze domestiche": 65, "PEF % utenze non domestiche": 35}
RIFIUTI = [["200301", "Rifiuti urbani non differenziati", "indifferenziato", 1250.4, "no"],
           ["200108", "Rifiuti biodegradabili di cucine e mense", "organico", 860, "no"],
           ["200201", "Rifiuti biodegradabili (verde)", "verde", 210, "sì"],
           ["150101", "Imballaggi in carta e cartone", "carta", 400.5, "no"]]
CLASSI_UD = [["1 componente", 1200, 0.6], ["2 componenti", 1500, 1.4]]
CLASSI_UND = [["1 - Musei, biblioteche, scuole", 12, 5400, 2.6]]
CONFERIMENTI = [["U0001", "UD", "1 componente", "indifferenziato", 18, 40, None, None, None, None, None],
                ["U0001", "UD", "1 componente", "organico", 60, 25, None, None, None, None, None],
                ["U0002", "UD", "2 componenti", "indifferenziato", 30, 40, None, None, 12.5, None, None],
                ["N0042", "UnD", "1 - Musei, biblioteche, scuole", "indifferenziato", 52, 120, None, None, 35, None, None]]
RIUSO = [["U0001", "UD", "1 componente", "maglione", 3, None, None]]

# Compila un modello aperto: valori dell'anagrafica (righe 5-24, colonna B)
# e righe dei fogli dati dalla riga 2. conferimenti=False lascia vuoto il
# foglio 5 (oggi sempre True).
def compila(wb, conferimenti=True):
    an = wb["1_Anagrafica"]
    for r in range(5, 25):
        voce = an.cell(r, 1).value
        if voce in ANAGRAFICA: an.cell(r, 2).value = ANAGRAFICA[voce]
    for nome, righe in [("2_Rifiuti", RIFIUTI), ("3_Classi_domestiche", CLASSI_UD), ("4_Classi_non_domestiche", CLASSI_UND),
                        ("7_Riuso", RIUSO)] + ([("5_Conferimenti", CONFERIMENTI)] if conferimenti else []):
        ws = wb[nome]
        for i, riga in enumerate(righe):
            for j, v in enumerate(riga): ws.cell(2 + i, 1 + j).value = v

wb = load_workbook(MODELLO); compila(wb); wb.save(os.path.join(OUT, "tracciato_esempio.xlsx"))

# Dati personali: un nome al posto del codice utenza e un codice fiscale
wb = load_workbook(MODELLO); compila(wb)
wb["5_Conferimenti"].cell(2, 1).value = "RSSMRA80A01H501U"
wb["5_Conferimenti"].cell(3, 1).value = "Via Roma 12"
wb.save(os.path.join(OUT, "tracciato_privacy.xlsx"))

# ZIP di CSV con singole letture (anno 2025 + una lettura del 2024 da escludere)
# csv_testo: CSV come lo salva Excel in italiano (BOM, separatore ";",
# decimali con la virgola), per provare anche il lettore di csv.js.
def csv_testo(intest, righe):
    b = io.StringIO(); w = csv.writer(b, delimiter=";")
    w.writerow(intest); [w.writerow(["" if v is None else str(v).replace(".", ",") if isinstance(v, float) else v for v in r]) for r in righe]
    return "﻿" + b.getvalue()
# 18 svuotamenti 2025 di U0001 (date diverse, mesi da 1 a 9), più uno del
# 31/12/2024 che il portale deve escludere; U0002 ha un conferimento al
# centro di raccolta e uno domiciliare; N0042 uno a struttura informatizzata.
letture = []
for g in range(1, 19): letture.append(["U0001", "UD", "1 componente", "indifferenziato", f"{g:02d}/0{1 + g % 9}/2025", "domiciliare", 40, None])
letture.append(["U0001", "UD", "1 componente", "indifferenziato", "31/12/2024", "domiciliare", 40, None])
letture += [["U0002", "UD", "2 componenti", "indifferenziato", "10/03/2025", "centro_raccolta", None, 12.5],
            ["U0002", "UD", "2 componenti", "indifferenziato", "11/03/2025", "domiciliare", 40, None],
            ["N0042", "UnD", "1 - Musei, biblioteche, scuole", "indifferenziato", "05/05/2025", "struttura", None, 35]]
# I CSV stanno in una sottocartella "dati/" per provare che il portale li
# trova anche dentro una cartella dello ZIP. Il foglio 5 manca di proposito.
with zipfile.ZipFile(os.path.join(OUT, "tracciato_letture.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("dati/1_Anagrafica.csv", csv_testo(["Voce", "Valore"], [[k, v] for k, v in ANAGRAFICA.items()]))
    z.writestr("dati/2_Rifiuti.csv", csv_testo(["Codice EER", "Descrizione", "Tipologia", "Quantità (t/anno)", "Solo domestiche"], RIFIUTI))
    z.writestr("dati/3_Classi_domestiche.csv", csv_testo(["Classe", "N. utenze", "Kb"], CLASSI_UD))
    z.writestr("dati/4_Classi_non_domestiche.csv", csv_testo(["Categoria", "N. utenze", "Superficie (m²)", "Kd (kg/m²/anno)"], CLASSI_UND))
    z.writestr("dati/6_Letture.csv", csv_testo(["Utenza", "Macrocategoria", "Classe", "Tipologia rifiuto", "Data", "Punto di conferimento", "Volume contenitore (L)", "Peso (kg)"], letture))
print("file di prova generati in", OUT)
