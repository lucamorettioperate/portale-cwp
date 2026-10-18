#!/usr/bin/env python3
# =========================================================================
# impagina_pdf.py — PDF tipografico di manuali e Registro.
# Scopo: impagina in PDF (WeasyPrint) Manuale Utente, Manuale Amministratore,
# Manuale Test e Registro, a partire dagli stessi Markdown del Word.
# (Uso, impaginazione e requisiti sono descritti nella docstring qui sotto.)
#
# Usato da: strumenti/genera_documenti.cjs, che lo chiama alla fine di ogni
# documento (python3 strumenti/impagina_pdf.py <chiave>); si può lanciare
# anche da solo. Senza argomenti impagina tutti e quattro i documenti.
#
# Dati/servizi coinvolti: nessuno (solo file locali): legge docs/*.md,
# strumenti/revisioni_documenti.json e i loghi in public/loghi/; scrive i
# PDF in public/manuali/ e public/documentazione/. Richiede anche Pillow
# (PIL) per i loghi e i caratteri Inter installati nel sistema (altrimenti
# WeasyPrint usa un carattere sostitutivo).
#
# Attenzione: le chiavi e i percorsi di DOCUMENTI devono coincidere con
# quelli di genera_documenti.cjs e con src/pages/Documentazione.jsx.
#
# Registro sviluppo e deploy: capitolo 8 «Procedure di rilascio»
# (Documenti in Word/PDF); capitolo 10 «Artefatti e documenti».
# =========================================================================
"""
Impaginazione tipografica in PDF dei documenti del portale (WeasyPrint).

Uso:  python3 strumenti/impagina_pdf.py manuale|amministratore|test|registro
Legge lo stesso testo e le stesse revisioni del Word (strumenti/genera_documenti.cjs)
e scrive il PDF accanto al .docx, sostituendo quello convertito da LibreOffice.

Impaginazione: copertina a tutta pagina con loghi, scheda del documento e
registro delle revisioni, sommario con numeri di pagina reali, apertura di
capitolo con numero grande, intestazioni correnti con il titolo del capitolo,
passi numerati, riquadri di nota, tabelle a righe alterne, piè di pagina con
revisione e numero di pagina.
Richiede:  pip install weasyprint markdown
"""
import html
import json
import re
import sys
from pathlib import Path

import markdown
import tempfile
from PIL import Image
from weasyprint import HTML

# Cartella principale del repository; revisioni di ogni documento (l'ultima è la corrente).
RADICE = Path(__file__).resolve().parent.parent
REVISIONI = json.loads((RADICE / "strumenti" / "revisioni_documenti.json").read_text(encoding="utf-8"))

# Configurazione di ogni documento: sorgente, PDF prodotto, testi di
# copertina, numerazione automatica dei capitoli ("numera"; il Registro ha
# già i numeri nei titoli), fascia «Riservato» in copertina, introduzione.
DOCUMENTI = {
    "manuale": {
        "sorgente": "docs/manuale-utente.md",
        "uscita": "public/manuali/Manuale_Utente_Portale_CWP.pdf",
        "sopratitolo": "Manuale utente",
        "titolo": "Portale Carbon WastePrint®",
        "sottotitolo": "Guida passo per passo per Comuni, enti e soggetti gestori",
        "breve": "Manuale Utente",
        "destinatari": "Comuni, enti locali e soggetti gestori aderenti al Programma",
        "numera": True,
        "riservato": False,
        "intro": "Questo manuale accompagna i referenti di Comuni, enti e soggetti gestori nell'uso del portale: dall'accesso alla consultazione delle pratiche, dal caricamento dei documenti alla risposta alle richieste della Fondazione.",
    },
    "amministratore": {
        "sorgente": "docs/manuale-amministratore.md",
        "uscita": "public/documentazione/Manuale_Amministratore_Portale_CWP.pdf",
        "sopratitolo": "Manuale amministratore",
        "titolo": "Portale Carbon WastePrint®",
        "sottotitolo": "Funzioni della Fondazione e calcolo dei crediti CWP",
        "breve": "Manuale Amministratore",
        "destinatari": "Amministratori di Fondazione Operate — documento riservato",
        "numera": True,
        "riservato": True,
        "intro": "Questo manuale guida gli Amministratori di Fondazione Operate in tutte le funzioni del portale: gestione delle pratiche dei Comuni, amministrazione di utenti e impostazioni, audit e calcolo dei crediti CWP secondo la Metodologia v1.2.",
    },
    "test": {
        "sorgente": "docs/manuale-test.md",
        "uscita": "public/documentazione/Manuale_Test_Portale_CWP.pdf",
        "sopratitolo": "Manuale test",
        "titolo": "Portale Carbon WastePrint®",
        "sottotitolo": "Il metodo CWP, il portale e il percorso di prova delle funzionalità",
        "breve": "Manuale Test",
        "destinatari": "Collaudatori del portale (test-user) — documento riservato",
        "numera": True,
        "riservato": True,
        "intro": "Questa guida permette a chi non conosce il Programma Carbon WastePrint® di collaudare il portale con metodo: in poche pagine il metodo CWP, il ruolo del portale e un percorso di prova che va dall'adesione del Comune al calcolo dei crediti.",
    },
    "registro": {
        "sorgente": "docs/REGISTRO_DEV_DEPLOY.md",
        "uscita": "public/documentazione/Registro_Dev_Deploy_Portale_CWP.pdf",
        "sopratitolo": "Registro sviluppo e deploy",
        "titolo": "Portale Carbon WastePrint®",
        "sottotitolo": "Architettura, servizi, codice sorgente, cronologia dei rilasci",
        "breve": "Registro sviluppo e deploy",
        "destinatari": "Amministratori del portale — documento riservato",
        "numera": False,
        "riservato": True,
        "intro": "Il registro descrive com'è fatto il portale e come è cambiato nel tempo: architettura, servizi, database, codice sorgente, procedure di rilascio, decisioni e lavori ancora aperti.",
    },
}

# Foglio di stile della stampa (CSS Paged Media di WeasyPrint): formato A4,
# margini, testatine e piè di pagina con string-set e counter(page), pagine
# speciali (copertina, iniziali, apertura dei capitoli), tabelle, riquadri,
# schema delle fasi. Non inserire commenti "#" qui dentro: è testo CSS.
CSS = r"""
@page {
  size: A4;
  margin: 24mm 20mm 22mm 20mm;
  @top-left { content: string(documento); font: 500 7.5pt Inter; color: #8a8d82; letter-spacing: .3pt; }
  @top-right { content: string(capitolo); font: 500 7.5pt Inter; color: #8a8d82; }
  @bottom-left { content: "Fondazione Operate · Programma Carbon WastePrint®  ·  " string(revisione); font: 400 7.5pt Inter; color: #8a8d82; }
  @bottom-right { content: counter(page); font: 700 9pt Inter; color: #2f5d3a; }
}
@page copertina { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-left { content: none } @bottom-right { content: none } }
@page iniziali { @top-right { content: none } }
@page apertura { @top-right { content: none } }

html { font-family: Inter, sans-serif; font-size: 9.6pt; line-height: 1.55; color: #1b2118; }
body { margin: 0; }
string-set-holder { display: none; }
.documento-stringa { string-set: documento content(); display: block; height: 0; overflow: hidden; }
.revisione-stringa { string-set: revisione content(); display: block; height: 0; overflow: hidden; }

/* ---------------- copertina ---------------- */
.copertina { page: copertina; width: 210mm; height: 297mm; position: relative; background: #f6f4ee; overflow: hidden; break-after: page; }
.copertina .alto { height: 118mm; display: flex; align-items: center; justify-content: center; position: relative; }
.copertina .alto img { width: 78mm; }
.copertina .cerchio { position: absolute; border-radius: 50%; }
.copertina .c1 { width: 120mm; height: 120mm; right: -42mm; top: -38mm; background: #e4ede1; }
.copertina .c2 { width: 46mm; height: 46mm; left: -14mm; top: 70mm; background: #efe3cc; }
.copertina .fascia { background: #2f5d3a; color: #fff; padding: 16mm 20mm 14mm 20mm; position: relative; }
.copertina .fascia .sopra { font: 600 10pt Inter; letter-spacing: 3pt; text-transform: uppercase; color: #cfe2cc; }
.copertina .fascia h1 { font: 700 30pt "Inter Display", Inter; margin: 4mm 0 3mm 0; line-height: 1.1; letter-spacing: -.4pt; }
.copertina .fascia .sotto { font: 400 12.5pt Inter; color: #e9f1e6; }
.copertina .fascia .linea { width: 26mm; height: 1.4mm; background: #c98a1a; margin-top: 8mm; }
.copertina .scheda { margin: 13mm 20mm 0 20mm; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
.copertina .scheda > div { border-left: 1.2pt solid #2f5d3a; padding: 1mm 0 1mm 4mm; margin-bottom: 6mm; }
.copertina .scheda .et { font: 600 7pt Inter; letter-spacing: 1.2pt; text-transform: uppercase; color: #5a5e54; }
.copertina .scheda .va { font: 600 10.5pt Inter; color: #1b2118; margin-top: 1mm; }
.copertina .piede { position: absolute; left: 20mm; right: 20mm; bottom: 16mm; display: flex; align-items: flex-end; justify-content: space-between; }
.copertina .piede .prog { font: 400 8pt Inter; color: #5a5e54; }
.copertina .piede .prog img { width: 44mm; display: block; margin-top: 2mm; }
.copertina .piede .riservato { font: 700 8pt Inter; color: #a23b2c; border: 1pt solid #a23b2c; padding: 1.5mm 3mm; letter-spacing: 1pt; text-transform: uppercase; }
.copertina .piede .url { font: 500 8.5pt Inter; color: #2f5d3a; text-align: right; }

/* ---------------- pagine iniziali ---------------- */
.iniziali { page: iniziali; }
.titoletto { font: 700 15pt "Inter Display", Inter; color: #2f5d3a; margin: 0 0 4mm 0; padding-bottom: 2.5mm; border-bottom: 1.2pt solid #2f5d3a; }
.intro { font-size: 10.5pt; color: #3a4036; margin: 0 0 7mm 0; }
.legenda { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 5mm; }
.sommario { break-before: page; page: iniziali; }
.sommario ol { list-style: none; padding: 0; margin: 4mm 0 0 0; }
.sommario li { display: flex; align-items: baseline; padding: 2.4mm 0; border-bottom: .5pt solid #e3dfd3; }
.sommario li .n { flex: 0 0 9mm; font: 700 9.5pt Inter; color: #2f5d3a; }
.sommario li a { flex: 1; color: #1b2118; text-decoration: none; font-size: 10.5pt; }
.sommario li a::after { content: leader(".") target-counter(attr(href), page); color: #8a8d82; font-weight: 600; }

/* ---------------- capitoli ---------------- */
.capitolo { break-before: page; }
.apertura { page: apertura; margin-bottom: 7mm; }
.apertura .num { font: 800 46pt "Inter Display", Inter; color: #dbe7d6; line-height: .9; letter-spacing: -1pt; }
.apertura h2 { string-set: capitolo content(text); font: 700 21pt "Inter Display", Inter; color: #2f5d3a; margin: 1mm 0 0 0; line-height: 1.15; letter-spacing: -.3pt; }
.apertura .filetto { width: 18mm; height: 1.2mm; background: #c98a1a; margin-top: 4mm; }
.capitolo > p:first-of-type { font-size: 10.6pt; color: #2f3529; }
h3 { font: 700 11.5pt "Inter Display", Inter; color: #2f5d3a; margin: 6mm 0 2mm 0; break-after: avoid; }
p { margin: 0 0 2.6mm 0; orphans: 3; widows: 3; }
strong { font-weight: 650; color: #14190f; }
a { color: #2f5d3a; text-decoration: none; border-bottom: .5pt solid #9fbf9a; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 8.2pt; background: #efece1; padding: .2mm 1mm; border-radius: 1mm; color: #2f5d3a; }
pre { background: #f6f4ee; border: .6pt solid #e3dfd3; border-radius: 2mm; padding: 3mm 4mm; font-size: 6.6pt; line-height: 1.35; overflow: hidden; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 6.6pt; color: #1b2118; }

ul { margin: 0 0 3mm 0; padding-left: 5mm; }
ul li { margin-bottom: 1.3mm; padding-left: 1mm; }
ul li::marker { color: #2f5d3a; }
ul ul { margin-top: 1.3mm; }
ul ul { list-style-type: circle; }
hr { display: none; }
del { color: #8a8d82; }

/* passi numerati */
ol.passi { list-style: none; counter-reset: passo; padding: 0; margin: 2mm 0 4mm 0; }
ol.passi > li { counter-increment: passo; position: relative; padding: 1.4mm 0 1.4mm 10mm; margin: 0; break-inside: avoid; }
ol.passi > li::before { content: counter(passo); position: absolute; left: 0; top: 1.1mm; width: 6.2mm; height: 6.2mm; border-radius: 50%; background: #2f5d3a; color: #fff; font: 700 8.2pt Inter; text-align: center; line-height: 6.2mm; }
ol.passi > li:not(:last-child)::after { content: ""; position: absolute; left: 3mm; top: 7.6mm; bottom: -1.2mm; width: .6pt; background: #b9cfb5; }

/* tabelle */
table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm 0; font-size: 8.6pt; break-inside: auto; }
thead { display: table-header-group; }
th { background: #2f5d3a; color: #fff; text-align: left; font-weight: 600; padding: 2mm 2.6mm; }
td { padding: 1.9mm 2.6mm; border-bottom: .5pt solid #e3dfd3; vertical-align: top; }
tr:nth-child(even) td { background: #f8f6f0; }
tr { break-inside: avoid; }
table.senza-testa td:first-child { font-weight: 600; width: 32%; color: #2f5d3a; }

/* riquadri */
.riquadro { border-radius: 2.2mm; padding: 3.4mm 4.5mm 2mm 4.5mm; margin: 3mm 0 5mm 0; break-inside: avoid; border-left: 1.4mm solid; }
.riquadro .etichetta { font: 700 7.4pt Inter; letter-spacing: 1.2pt; text-transform: uppercase; margin-bottom: 1.2mm; }
.riquadro.nota { background: #eef4ec; border-color: #2f5d3a; }
.riquadro.nota .etichetta { color: #2f5d3a; }
.riquadro.attenzione { background: #fbeee9; border-color: #a23b2c; }
.riquadro.attenzione .etichetta { color: #a23b2c; }
.riquadro.suggerimento { background: #f8f0e0; border-color: #c98a1a; }
.riquadro.suggerimento .etichetta { color: #9a6812; }

/* schema delle fasi */
.fasi { display: flex; justify-content: space-between; margin: 4mm 0 6mm 0; position: relative; }
.fasi::before { content: ""; position: absolute; left: 6%; right: 6%; top: 4.6mm; height: .8pt; background: #b9cfb5; }
.fasi div { width: 13.6%; text-align: center; position: relative; }
.fasi b { display: block; width: 9.2mm; height: 9.2mm; line-height: 9.2mm; margin: 0 auto 1.8mm auto; border-radius: 50%; background: #2f5d3a; color: #fff; font: 700 9pt Inter; }
.fasi span { font-size: 7.4pt; line-height: 1.25; color: #3a4036; display: block; }
"""

# Paragrafi che diventano riquadri: inizio in grassetto → tipo e etichetta.
# (testo iniziale in grassetto, classe CSS, etichetta mostrata). Vale la prima
# voce che corrisponde; per un nuovo riquadro nei manuali aggiungere qui
# l'inizio del paragrafo (es. "**Attenzione.** …").
RIQUADRI = [
    (r"Protezione dei dati personali", "attenzione", "Attenzione"),
    (r"Chi vede cosa", "nota", "Da sapere"),
    (r"Versioni", "nota", "Da sapere"),
    (r"Regole per la password", "nota", "Da sapere"),
    (r"File molto grandi", "suggerimento", "Suggerimento"),
    (r"Cosa serve", "nota", "Prima di iniziare"),
    (r"Pagamenti", "nota", "Da sapere"),
    (r"Il manuale", "suggerimento", "Suggerimento"),
    (r"Attenzione", "attenzione", "Attenzione"),
    (r"Prima di confermare", "attenzione", "Prima di confermare"),
    (r"Cosa serve", "nota", "Prima di iniziare"),
    (r"Come annotare l'esito", "suggerimento", "Suggerimento"),
    (r"Limiti noti oggi", "attenzione", "Da sapere"),
    (r"Limite attuale", "nota", "Da sapere"),
    (r"Nuove versioni durante una fase", "nota", "Da sapere"),
]


# Restituisce l'indirizzo file:// di una cartella temporanea con i loghi
# modificati (i pixel quasi bianchi, sopra 245 su 255, diventano trasparenti).
# I file originali in public/loghi/ non vengono toccati.
def loghi_trasparenti():
    """Copie dei loghi con lo sfondo bianco reso trasparente (per la copertina colorata)."""
    cartella = Path(tempfile.mkdtemp(prefix="loghi_cwp_"))
    for nome in ("carbonwasteprint.png", "fondazione-operate.png"):
        im = Image.open(RADICE / "public" / "loghi" / nome).convert("RGBA")
        dati = [(r, g, b, 0) if r > 245 and g > 245 and b > 245 else (r, g, b, a) for r, g, b, a in im.getdata()]
        im.putdata(dati)
        im.save(cartella / nome)
    return cartella.as_uri()


# Divide il Markdown in premessa (righe prima del primo "## ") e capitoli
# [{titolo, righe}]; toglie i commenti HTML e ignora il titolo "# ".
# Stessa logica di leggi() in genera_documenti.cjs.
def leggi(file):
    testo = re.sub(r"<!--[\s\S]*?-->", "", (RADICE / file).read_text(encoding="utf-8"))
    premessa, capitoli, corrente = [], [], None
    for riga in testo.split("\n"):
        m = re.match(r"^## (.+)$", riga)
        if m:
            corrente = {"titolo": m.group(1).strip(), "righe": []}
            capitoli.append(corrente)
        elif corrente is not None:
            corrente["righe"].append(riga)
        elif not riga.startswith("# "):
            premessa.append(riga)
    return premessa, capitoli


# I documenti sono scritti con gli elenchi subito sotto il testo; la libreria
# markdown li riconosce solo dopo una riga vuota. Dentro i blocchi ``` non si
# tocca nulla; nelle citazioni "> " la riga vuota aggiunta è ">".
def prepara(testo):
    """Riga vuota prima di ogni elenco che segue del testo (il markdown la richiede)."""
    righe, out, in_codice = testo.split("\n"), [], False
    for r in righe:
        if r.startswith("```"):
            in_codice = not in_codice
        lista = re.match(r"^(> )?(- |\d+\. )", r)
        prec = out[-1] if out else ""
        prec_lista = re.match(r"^(> )?(\s*- |\s*\d+\. |\s{2,}\S)", prec)
        if not in_codice and lista and prec.strip() and prec.strip() != ">" and not prec_lista:
            out.append(">" if r.startswith(">") else "")
        out.append(r)
    return "\n".join(out)


# Converte un capitolo da Markdown in HTML e applica le classi
# dell'impaginazione: elenchi numerati come "passi", tabelle senza
# intestazione come schede, paragrafi di RIQUADRI e citazioni come riquadri.
def md_html(testo):
    # elenchi rientrati di 4 spazi come sottoliste; tabelle e blocchi di codice
    testo = re.sub(r"~~(.+?)~~", r"<del>\1</del>", prepara(testo))
    h = markdown.markdown(testo, extensions=["tables", "fenced_code", "sane_lists"])
    h = h.replace("<ol>", '<ol class="passi">')
    # tabelle senza intestazione (prima riga vuota) → schede chiave/valore
    h = re.sub(r"<table>\s*<thead>\s*<tr>\s*(<th>\s*</th>\s*)+</tr>\s*</thead>", '<table class="senza-testa">', h)
    # riquadri: paragrafi che iniziano con un'etichetta in grassetto prevista
    def riquadro(m):
        corpo = m.group(1)
        for chiave, tipo, etichetta in RIQUADRI:
            if re.match(rf"<strong>{chiave}[.:]?</strong>", corpo):
                return f'<div class="riquadro {tipo}"><div class="etichetta">{etichetta}</div><p>{corpo}</p></div>'
        return m.group(0)
    h = re.sub(r"<p>(<strong>.*?)</p>", riquadro, h, flags=re.S)
    # blockquote markdown → riquadro nota
    h = h.replace("<blockquote>", '<div class="riquadro nota"><div class="etichetta">Da sapere</div>').replace("</blockquote>", "</div>")
    return h


# Schema grafico delle 7 fasi (cerchi numerati), usato nel Manuale Utente.
# I nomi devono restare uguali a FASI di src/lib/cwpProgram.js.
def schema_fasi():
    fasi = ["Adesione", "Prima verifica documentale", "Consultazione pubblica", "Risposta ai commenti / pubblicazione",
            "Validazione e verifica", "Seconda verifica documentale", "Chiusura"]
    celle = "".join(f"<div><b>{i}</b><span>{html.escape(f)}</span></div>" for i, f in enumerate(fasi, 1))
    return f'<div class="fasi">{celle}</div>'


# Costruisce l'HTML completo di un documento (copertina, pagine iniziali con
# scheda e revisioni, sommario, capitoli) e lo scrive in PDF con WeasyPrint.
# Parametro: chiave di DOCUMENTI. Effetto: sovrascrive il PDF in cfg["uscita"].
def costruisci(chiave):
    cfg = DOCUMENTI[chiave]
    rev = REVISIONI[chiave][-1]
    premessa, capitoli = leggi(cfg["sorgente"])
    loghi = loghi_trasparenti()

    titoli = [(i + 1, c["titolo"]) for i, c in enumerate(capitoli)]
    # numero(): numero a due cifre del capitolo, progressivo se "numera",
    # altrimenti preso dal titolo ("3. Servizi" → "03").
    # titolo_pulito(): titolo senza il numero iniziale.
    def numero(n, t):
        if cfg["numera"]:
            return f"{n:02d}"
        m = re.match(r"^(\d+)\.\s*(.*)$", t)
        return f"{int(m.group(1)):02d}" if m else ""
    def titolo_pulito(t):
        return re.sub(r"^\d+\.\s*", "", t)

    scheda = [
        ("Documento", cfg["breve"]),
        ("Revisione", f"Rev. {rev['rev']}"),
        ("Data di revisione", rev["data"]),
    ]
    revisioni = "".join(
        f"<tr><td>{html.escape(r['rev'])}</td><td>{html.escape(r['data'])}</td><td>{html.escape(r['descrizione'])}</td><td>{html.escape(r['autore'])}</td></tr>"
        for r in reversed(REVISIONI[chiave])
    )
    sommario = "".join(
        f'<li><span class="n">{numero(n, t)}</span><a href="#cap{n}">{html.escape(titolo_pulito(t))}</a></li>' for n, t in titoli
    )
    corpo = []
    for n, c in enumerate(capitoli, 1):
        contenuto = md_html("\n".join(c["righe"]))
        # Nel capitolo sulle fasi del Manuale Utente il primo elenco numerato
        # è sostituito dallo schema grafico (l'elenco resta nascosto).
        if chiave == "manuale" and "fasi" in c["titolo"].lower():
            contenuto = contenuto.replace('<ol class="passi">', schema_fasi() + '<ol class="passi" style="display:none">', 1)
        corpo.append(
            f'<section class="capitolo" id="cap{n}"><div class="apertura"><div class="num">{numero(n, c["titolo"])}</div>'
            f'<h2>{html.escape(titolo_pulito(c["titolo"]))}</h2><div class="filetto"></div></div>{contenuto}</section>'
        )
    premessa_html = md_html("\n".join(premessa))
    premessa_html = re.sub(r'<table class="senza-testa">[\s\S]*?</table>', "", premessa_html)  # già nella scheda

    pagina = f"""<!doctype html><html lang="it"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<section class="copertina">
  <div class="cerchio c1"></div><div class="cerchio c2"></div>
  <div class="alto"><img src="{loghi}/carbonwasteprint.png" alt="Carbon WastePrint"></div>
  <div class="fascia">
    <div class="sopra">{html.escape(cfg['sopratitolo'])}</div>
    <h1>{html.escape(cfg['titolo'])}</h1>
    <div class="sotto">{html.escape(cfg['sottotitolo'])}</div>
    <div class="linea"></div>
  </div>
  <div class="scheda">{''.join(f'<div><div class="et">{html.escape(a)}</div><div class="va">{html.escape(b)}</div></div>' for a, b in scheda)}</div>
  <div class="piede">
    <div class="prog">Programma di<img src="{loghi}/fondazione-operate.png" alt="Fondazione Operate"></div>
    {'<div class="riservato">Riservato agli Amministratori</div>' if cfg['riservato'] else '<div class="url">portale-cwp.vercel.app</div>'}
  </div>
</section>
<section class="iniziali">
  <span class="documento-stringa">{html.escape(cfg['breve'].upper())} · PORTALE CARBON WASTEPRINT</span>
  <span class="revisione-stringa">Rev. {html.escape(rev['rev'])} del {html.escape(rev['data'])}</span>
  <div class="titoletto">Il documento</div>
  <p class="intro">{html.escape(cfg['intro'])}</p>
  <table class="senza-testa">
    <tr><td>Destinatari</td><td>{html.escape(cfg['destinatari'])}</td></tr>
    <tr><td>Revisione corrente</td><td>Rev. {html.escape(rev['rev'])} del {html.escape(rev['data'])}</td></tr>
    <tr><td>Redatto da</td><td>Fondazione Operate</td></tr>
    <tr><td>Versione sempre aggiornata</td><td>{'Area Documentazione del portale (solo Amministratori)' if cfg['riservato'] else 'Voce «Manuale» del portale (PDF)'}</td></tr>
  </table>
  <div class="titoletto" style="margin-top:8mm">Registro delle revisioni</div>
  <table><thead><tr><th style="width:11%">Rev.</th><th style="width:15%">Data</th><th>Descrizione</th><th style="width:22%">Autore</th></tr></thead><tbody>{revisioni}</tbody></table>
  {premessa_html}
</section>
<section class="sommario"><div class="titoletto">Sommario</div><ol>{sommario}</ol></section>
{''.join(corpo)}
</body></html>"""
    # base_url = radice del repository: i percorsi relativi nell'HTML partono da lì.
    uscita = RADICE / cfg["uscita"]
    uscita.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=pagina, base_url=str(RADICE)).write_pdf(uscita)
    print(f"{cfg['breve']}: PDF impaginato Rev. {rev['rev']} → {cfg['uscita']}")


# Avvio da riga di comando: documenti indicati come argomenti, oppure tutti.
if __name__ == "__main__":
    for k in sys.argv[1:] or list(DOCUMENTI):
        costruisci(k)
