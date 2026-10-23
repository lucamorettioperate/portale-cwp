#!/usr/bin/env python3
"""
Arricchimento dei gestori della sezione Marketing (richiesta di Luca Moretti
del 23/10/2026): trasforma i risultati della verifica sui siti delle imprese
(file JSON, uno per lotto) nello script SQL da eseguire nel SQL Editor di
Supabase.

Ogni risultato: { id, sito, attivita_raccolta, attivita_tariffa, email, pec,
telefono, referenti: [{ ruolo, nome, cognome, fonte }], fonti: [url], note }.

Regole:
- si aggiornano solo i campi trovati (coalesce: un valore già presente non
  viene cancellato da un null);
- l'email generica entra solo se non è una PEC (stessa regola del database,
  mkt_sembra_pec, e del vincolo mkt_email_non_pec);
- verificato_il = data della verifica; fonti += «siti web»; note = evidenze
  (con le URL consultate);
- referenti: solo direttore generale, direttore tecnico, amministratore, con
  la fonte; chiave «web:<cognome>» per aggiornare la stessa riga.

Uso:
  python3 strumenti/marketing_arricchimento_sql.py risultati_*.json > arricchimento.sql
Registro sviluppo e deploy: capitolo 16 «Marketing».
"""
import json
import re
import sys
from datetime import date

PEC = re.compile(r"@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura))", re.I)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RUOLI = {"direttore_generale", "direttore_tecnico", "amministratore"}


def q(v):
    """Valore SQL tra apici (o null)."""
    if v is None or (isinstance(v, str) and not v.strip()):
        return "null"
    return "'" + str(v).strip().replace("'", "''") + "'"


def b(v):
    return "null" if v is None else ("true" if v else "false")


def email_ok(e):
    return bool(e) and bool(EMAIL.match(e.strip())) and not PEC.search(e.lower())


def sql(righe, giorno):
    out = ["-- Arricchimento dei gestori (Marketing), generato da strumenti/marketing_arricchimento_sql.py",
           "begin;"]
    for r in righe:
        eid = int(r["id"])
        email = r.get("email") if email_ok(r.get("email")) else None
        pec = r.get("pec") if r.get("pec") and EMAIL.match(r["pec"].strip()) else None
        sito = r.get("sito")
        if sito and not sito.startswith("http"):
            sito = "https://" + sito
        fonti_url = [f for f in (r.get("fonti") or []) if isinstance(f, str)][:6]
        nota = (r.get("note") or "").strip()
        if fonti_url:
            nota = (nota + " · Fonti: " + " ".join(fonti_url)).strip(" ·")
        out.append(
            "update mkt_ente set "
            f"sito = coalesce({q(sito)}, sito), "
            f"email = coalesce({q(email.lower() if email else None)}, email), "
            f"pec = coalesce({q(pec.lower() if pec else None)}, pec), "
            f"telefono = coalesce({q(r.get('telefono'))}, telefono), "
            f"attivita_raccolta = coalesce({b(r.get('attivita_raccolta'))}, attivita_raccolta), "
            f"attivita_tariffa = coalesce({b(r.get('attivita_tariffa'))}, attivita_tariffa), "
            f"verificato_il = '{giorno}', "
            "fonti = (select array(select distinct x from unnest(fonti || array['siti web']) x)), "
            f"note = coalesce({q(nota[:1500] if nota else None)}, note) "
            f"where id = {eid} and tipo = 'gestore';"
        )
        visti = set()
        for p in r.get("referenti") or []:
            ruolo = p.get("ruolo")
            cognome = (p.get("cognome") or "").strip()
            if ruolo not in RUOLI or not cognome or not p.get("fonte"):
                continue
            chiave = "web:" + re.sub(r"[^a-z]", "", cognome.lower())
            if (ruolo, chiave) in visti:
                continue
            visti.add((ruolo, chiave))
            out.append(
                "insert into mkt_referente (ente_id, ruolo, chiave, nome, cognome, fonte) "
                f"select {eid}, {q(ruolo)}, {q(chiave)}, {q(p.get('nome'))}, {q(cognome)}, {q(p.get('fonte'))} "
                f"where exists (select 1 from mkt_ente where id = {eid} and tipo = 'gestore') "
                "on conflict (ente_id, ruolo, chiave) do update set nome = excluded.nome, cognome = excluded.cognome, "
                "fonte = excluded.fonte, aggiornato_il = now();"
            )
    out.append("commit;")
    out.append("select count(*) filter (where verificato_il is not null) verificati, "
               "count(*) filter (where email is not null) con_email, "
               "count(*) filter (where attivita_raccolta) raccolta, "
               "count(*) filter (where attivita_tariffa) tariffa "
               "from mkt_ente where tipo = 'gestore';")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    righe = []
    for f in sys.argv[1:]:
        righe.extend(json.load(open(f, encoding="utf-8")))
    sys.stdout.write(sql(righe, date.today().isoformat()))
