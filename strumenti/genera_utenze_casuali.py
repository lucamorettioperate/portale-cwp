# =========================================================================
# genera_utenze_casuali.py — Banca Dati Utenze di PROVA con dati casuali.
#
# Scopo: riempie il modello public/modelli/Banca_dati_utenze_CWP_v1.xlsx
# con 20 utenze domestiche e 20 non domestiche inventate (richiesta di Luca
# Moretti del 22/10/2026: provare il caricamento e i moduli della Banca
# Dati Utenze su un Comune esistente). Codici «PROVA-…», nomi e indirizzi di
# fantasia, quantità plausibili; due utenze per tipo senza categoria
# tariffaria (da assegnare nel portale) e una con la produzione totale
# diversa dalla somma delle frazioni (avviso).
#
# Uscita: test/dati/Banca_dati_utenze_prova_40.xlsx (usato anche da
# test/bancaDatiUtenze.test.mjs). Sempre lo stesso file: seme fisso.
#
# Uso: python3 strumenti/genera_banca_dati_utenze.py (prima il modello),
#      poi python3 strumenti/genera_utenze_casuali.py
# Registro sviluppo e deploy: capitolo 15 «Calcolo crediti».
# =========================================================================
import os, random
from openpyxl import load_workbook

QUI = os.path.dirname(os.path.abspath(__file__))
MODELLO = os.path.join(QUI, "..", "public", "modelli", "Banca_dati_utenze_CWP_v1.xlsx")
OUT = os.path.join(QUI, "..", "test", "dati", "Banca_dati_utenze_prova_40.xlsx")
random.seed(2026)

NOMI = ["Marco", "Giulia", "Luca", "Francesca", "Andrea", "Chiara", "Matteo", "Sara", "Davide", "Elena",
        "Simone", "Martina", "Alessandro", "Valentina", "Federico", "Laura", "Stefano", "Silvia", "Paolo", "Anna"]
COGNOMI = ["Brambilla", "Colombo", "Ferrari", "Galli", "Mauri", "Riva", "Sala", "Villa", "Cattaneo", "Fumagalli",
           "Longoni", "Mariani", "Meroni", "Pirovano", "Ratti", "Spinelli", "Tagliabue", "Viganò", "Zanetti", "Bonfanti"]
VIE = ["Via Garibaldi", "Via Mazzini", "Via Cavour", "Via Manzoni", "Via Dante", "Corso Italia", "Via Verdi",
       "Via XXV Aprile", "Via Roma", "Via Matteotti", "Piazza della Repubblica", "Via dei Mille"]
# Non domestiche: (categoria DPR 158/1999, ragione sociale, mq minimi e massimi, kg/m²/anno indicativi)
ATTIVITA = [
    ("11", "Studio Tecnico Associato {c}", (60, 200), 8),
    ("13", "Calzature {c} s.r.l.", (80, 300), 7),
    ("14", "Farmacia {c}", (60, 150), 9),
    ("17", "Parrucchiera {n}", (40, 90), 8),
    ("18", "Idraulica {c} s.n.c.", (80, 250), 6),
    ("19", "Autofficina {c}", (150, 500), 8),
    ("21", "Laboratorio Artigiano {c}", (100, 400), 7),
    ("22", "Trattoria da {n}", (80, 250), 40),
    ("24", "Bar Pasticceria {c}", (50, 150), 35),
    ("25", "Alimentari {c}", (60, 300), 18),
    ("27", "Ortofrutta {n}", (40, 120), 45),
    ("12", "Banca di Credito Locale - filiale {k}", (150, 400), 6),
    ("1", "Associazione Culturale {c}", (100, 300), 3),
    ("9", "Residenza per Anziani {c}", (600, 1500), 9),
    ("20", "{c} Industrie s.p.a.", (800, 3000), 5),
    ("23", "Pizzeria {n}", (70, 200), 30),
    ("26", "Minimarket {c}", (100, 400), 15),
    ("3", "Magazzino {c} Logistica", (300, 1200), 2),
    ("16", "Banco Mercato {n} {c}", (20, 40), 10),
    ("8", "Albergo {c}", (400, 1200), 10),
]
# Ripartizione indicativa dei kg tra le frazioni (differenziata ~70%).
QUOTE = {"indifferenziato": 0.28, "organico": 0.32, "carta": 0.18, "plastica": 0.11, "vetro": 0.09, "metallo": 0.02}
ORDINE = ["indifferenziato", "organico", "carta", "plastica", "vetro", "metallo", "verde", "legno", "tessili", "raee", "ingombranti", "inerti"]
# Svuotamenti all'anno indicativi per frazione (porta a porta).
SVUOTAMENTI = {"indifferenziato": (12, 52), "organico": (52, 104), "carta": (13, 26), "plastica": (26, 52), "vetro": (13, 26), "metallo": (6, 13)}

def frazioni(totale):
    kg = {f: round(totale * q * random.uniform(0.8, 1.2)) for f, q in QUOTE.items()}
    if random.random() < 0.3:
        kg.pop("metallo")
    if random.random() < 0.25:
        kg["verde"] = random.randint(20, 120)
    sv = {f: random.randint(*SVUOTAMENTI[f]) for f in kg if f in SVUOTAMENTI and random.random() < 0.8}
    return kg, sv

# Il modello ha le prime 500 righe già formattate: append() scriverebbe dopo
# la 501, quindi si scrive dalla riga 2.
def scrivi(ws, n, valori):
    for j, v in enumerate(valori, start=1):
        ws.cell(n + 2, j, v)

def riga_frazioni(kg, sv):
    return [kg.get(f) for f in ORDINE] + [sv.get(f) for f in ORDINE]

wb = load_workbook(MODELLO)
ud = wb["Utenze_domestiche"]
for i in range(20):
    comp = random.choices([1, 2, 3, 4, 5, 6], weights=[30, 30, 18, 14, 5, 3])[0]
    cat = None if i in (7, 15) else str(min(comp, 6))
    mq = random.randint(40 + comp * 10, 90 + comp * 25) if random.random() < 0.8 else None
    kg, sv = frazioni(random.randint(250, 420) * comp ** 0.7)
    totale = sum(kg.values())
    if i == 4:
        totale = round(totale * 1.05)  # differenza voluta: avviso nel portale
    scrivi(ud, i, [f"PROVA-UD-{i + 1:03d}", f"{random.choice(NOMI)} {random.choice(COGNOMI)}",
               f"{random.choice(VIE)} {random.randint(1, 120)}", cat, comp if random.random() < 0.9 else None, mq, totale]
              + riga_frazioni(kg, sv))
und = wb["Utenze_non_domestiche"]
for i, (cat, ragione, (mmin, mmax), kgmq) in enumerate(ATTIVITA):
    mq = random.randint(mmin, mmax)
    kg, sv = frazioni(mq * kgmq * random.uniform(0.7, 1.3))
    # Organico solo per le attività alimentari, ricettive e di cura.
    if cat not in ("8", "9", "22", "23", "24", "25", "26", "27"):
        kg.pop("organico", None); sv.pop("organico", None)
    nome = ragione.format(c=random.choice(COGNOMI), n=random.choice(NOMI), k=random.choice(["Centro", "Nord", "Sud"]))
    scrivi(und, i, [f"PROVA-UND-{i + 1:03d}", nome, f"{random.choice(VIE)} {random.randint(1, 120)}",
                None if i in (5, 12) else cat, mq if random.random() < 0.9 else None, sum(kg.values())] + riga_frazioni(kg, sv))
wb.save(OUT)
print("ok", OUT)
