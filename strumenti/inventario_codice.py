# =========================================================================
#  Inventario del codice sorgente per il Registro sviluppo e deploy
#  Scopo: genera l'elenco di tutti i file del codice (cartella, righe,
#    descrizione presa dall'intestazione del file) e lo inserisce nel
#    capitolo «Codice sorgente» di docs/REGISTRO_DEV_DEPLOY.md, tra i
#    segnaposto INVENTARIO-INIZIO e INVENTARIO-FINE (commenti HTML).
#  Uso: python3 strumenti/inventario_codice.py   (da rieseguire a ogni rilascio,
#    prima di rigenerare Word e PDF con strumenti/genera_documenti.cjs)
#  La descrizione è la riga «Scopo:» dell'intestazione o, in mancanza, la
#    prima frase di commento del file: per questo ogni file nuovo deve avere
#    un'intestazione (regola del punto 31 del backlog).
#  Registro sviluppo e deploy: capitolo «Codice sorgente».
# =========================================================================
import os
import re
import subprocess

RADICE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REGISTRO = os.path.join(RADICE, "docs", "REGISTRO_DEV_DEPLOY.md")
INIZIO, FINE = "<!-- INVENTARIO-INIZIO -->", "<!-- INVENTARIO-FINE -->"

# Gruppi nell'ordine in cui compaiono nel registro: (titolo, prefisso, estensioni)
GRUPPI = [
    ("Avvio e instradamento", "src/", (".jsx", ".js"), lambda p: p.count("/") == 1),
    ("Pagine (src/pages)", "src/pages/", (".jsx",), None),
    ("Componenti (src/components)", "src/components/", (".jsx", ".js"), None),
    ("Librerie (src/lib)", "src/lib/", (".js", ".jsx"), None),
    ("Database: script SQL (supabase)", "supabase/", (".sql",), lambda p: p.count("/") == 1),
    ("Edge Functions (supabase/functions)", "supabase/functions/", (".ts",), None),
    ("Test (test)", "test/", (".mjs",), None),
    ("Strumenti (strumenti)", "strumenti/", (".py", ".cjs", ".json"), None),
]


def file_del_repository():
    out = subprocess.run(["git", "ls-files"], cwd=RADICE, capture_output=True, text=True, check=True).stdout
    return sorted(set(out.split()) | set(non_tracciati()))


def non_tracciati():
    out = subprocess.run(["git", "ls-files", "--others", "--exclude-standard"], cwd=RADICE, capture_output=True, text=True).stdout
    return out.split()


def pulisci(riga):
    """Toglie i segni di commento e gli spazi da una riga."""
    return re.sub(r"^\s*(/\*+|\*+/?|//+|--+|#+|<!--)\s?", "", riga).replace("*/", "").replace("-->", "").strip()


def descrizione(percorso):
    """Riga «Scopo:» dell'intestazione, oppure la prima frase di commento significativa."""
    with open(os.path.join(RADICE, percorso), encoding="utf-8", errors="replace") as f:
        testo = f.read(6000)
    righe = testo.splitlines()
    for i, r in enumerate(righe[:60]):
        m = re.search(r"Scopo:\s*(.*)", r)
        if m:
            parti = [m.group(1).strip()]
            # prosegue sulle righe successive finché non trova un'altra voce «Xxx:» o la fine del blocco
            for s in righe[i + 1:i + 6]:
                t = pulisci(s)
                if not t or re.match(r"^[A-ZÀ-Ý][\w '/()-]{1,40}:", t) or set(t) <= set("=-*"):
                    break
                parti.append(t)
            return accorcia(" ".join(parti))
    for r in righe[:40]:
        if re.match(r"^\s*(/\*|//|\*|--|#|<!--)", r):
            t = pulisci(r)
            if len(t) > 12 and not set(t) <= set("=-*") and not t.lower().startswith(("eseguire dopo", "uso:", "!/usr")):
                return accorcia(t)
    return "—"


def accorcia(t, n=230):
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def righe_codice(percorso):
    with open(os.path.join(RADICE, percorso), encoding="utf-8", errors="replace") as f:
        return sum(1 for _ in f)


def tabella():
    tutti = [p for p in file_del_repository() if os.path.isfile(os.path.join(RADICE, p))]
    usati = set()
    out = []
    totale = 0
    for titolo, prefisso, est, filtro in GRUPPI:
        sel = [p for p in tutti if p.startswith(prefisso) and p.endswith(est) and p not in usati and (filtro is None or filtro(p))
               and "/dati/" not in p and "__pycache__" not in p]
        if not sel:
            continue
        usati.update(sel)
        out.append(f"\n**{titolo}**\n\n| File | Righe | Cosa contiene |\n|---|---|---|")
        for p in sel:
            n = righe_codice(p)
            totale += n
            # niente «|» (romperebbe la tabella) né segnaposto HTML (romperebbero il prossimo aggiornamento)
            d = descrizione(p).replace("|", "/").replace("<!--", "‹!--").replace("-->", "--›")
            out.append(f"| `{p}` | {n} | {d} |")
    righe_it = f"{totale:,}".replace(",", ".")
    out.insert(0, f"Inventario generato da `strumenti/inventario_codice.py`: {len(usati)} file, {righe_it} righe in tutto.")
    return "\n".join(out) + "\n"


def main():
    with open(REGISTRO, encoding="utf-8") as f:
        reg = f.read()
    if INIZIO not in reg or FINE not in reg:
        raise SystemExit(f"Segnaposto {INIZIO} / {FINE} non trovati nel registro")
    a, resto = reg.split(INIZIO, 1)
    _, b = resto.split(FINE, 1)
    nuovo = a + INIZIO + "\n" + tabella() + FINE + b
    with open(REGISTRO, "w", encoding="utf-8") as f:
        f.write(nuovo)
    print("Inventario aggiornato in", os.path.relpath(REGISTRO, RADICE))


if __name__ == "__main__":
    main()
