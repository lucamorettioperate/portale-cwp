// =========================================================================
//  marketing — funzione del server dello strumento di marketing
//  (richiesta di Luca Moretti del 23/10/2026; tabelle dello script 44).
//
//  Azioni riservate agli AMMINISTRATORI (token dell'utente, app_is_admin):
//   - importa_comuni  { fase: "base" | "ipa" | "uo", da? }
//       base: tutti i Comuni ISTAT (public/marketing/dati/comuni_istat.json)
//             con regione, provincia, popolazione;
//       ipa:  da IndicePA (open data, CC-BY 4.0) PEC, email generica, sito,
//             codice fiscale, indirizzo e sindaco di ogni Comune;
//       uo:   unità organizzative dei Comuni (a blocchi, parametro «da»):
//             responsabili di tributi, ambiente, finanziario, tecnico con
//             le loro email; email generica (protocollo, segreteria) se
//             manca. Restituisce { fatti, prossimo } per il blocco seguente.
//   - importa_albo { sezione, indice }: imprese di una provincia (indice
//       nella sezione regionale; risponde con «prossimo») dell'Albo
//       Nazionale Gestori Ambientali con categoria 1 ordinaria («1o»),
//       dall'elenco pubblico degli iscritti; poi PEC, email e sito dei
//       gestori pubblici registrati in IndicePA (stesso codice fiscale).
//   - prova_campagna { campagna }: spedisce la campagna solo all'indirizzo
//       dell'Amministratore che la prova.
//   - invia_campagna { campagna, quanti? }: spedisce un blocco di invii
//       «da_inviare» (al massimo 50 per chiamata, uno al secondo verso
//       Resend) e restituisce quanti ne restano.
//  Azioni PUBBLICHE (landing page, nessun accesso richiesto; si conosce
//  solo il codice casuale dell'invio):
//   - visita { token }: nome dell'ente e popolazione per la pagina; segna
//       la prima visita;
//   - simulata { token }: segna che il Comune ha fatto la simulazione;
//   - richiesta { token?, ente, referente, ruolo, email, telefono,
//       messaggio, simulazione, sito_web (campo trappola) }: salva la
//       richiesta di registrazione e la manda a tutti gli Amministratori
//       (notifica nel portale con email, cwp_notifica dello script 09);
//       limiti: 3 richieste all'ora per email, 30 all'ora in tutto;
//   - disiscrivi { token }: l'indirizzo non riceve più campagne.
//
//  Verify JWT DISATTIVATO di proposito (la landing page è pubblica): le
//  azioni riservate controllano da sole il token e il ruolo.
//  Segreti: RESEND_API_KEY, EMAIL_MITTENTE (facoltativo), PORTALE_URL
//  (facoltativo); automatici SUPABASE_URL, SUPABASE_ANON_KEY,
//  SUPABASE_SERVICE_ROLE_KEY.
//  Le funzioni tra INIZIO-… e FINE-… sono copie IDENTICHE di
//  src/lib/marketing.js (prova test/marketing.test.mjs).
//  Registro sviluppo e deploy: capitolo «Marketing».
// =========================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const MITTENTE = Deno.env.get("EMAIL_MITTENTE") || "Fondazione Operate - Programma CWP <onboarding@resend.dev>";
const PORTALE = (Deno.env.get("PORTALE_URL") || "https://portale-cwp.vercel.app").replace(/\/$/, "");

const IPA = "https://indicepa.gov.it/ipa-dati/api/3/action/datastore_search_sql";
const IPA_ENTI = "d09adf99-dc10-4349-8c53-27b1e5aa97b6";
const IPA_UO = "b0aa1f6c-f135-4c8a-b416-396fed4e1a5d";
const ALBO = "https://www.albonazionalegestoriambientali.it/Public/Api/ElenchiIscritti/GetImpresePerSezioneProvincia";
// Sezioni regionali dell'Albo: id, nome della regione, province.
const SEZIONI_ALBO: Record<string, [string, string[]]> = {
  "13": ["Abruzzo", ["AQ", "CH", "PE", "TE"]], "21": ["Trentino-Alto Adige/Südtirol", ["BZ"]], "17": ["Basilicata", ["MT", "PZ"]],
  "18": ["Calabria", ["CS", "CZ", "KR", "RC", "VV"]], "15": ["Campania", ["AV", "BN", "CE", "NA", "SA"]],
  "8": ["Emilia-Romagna", ["BO", "FC", "FE", "MO", "PC", "PR", "RA", "RE", "RN"]], "6": ["Friuli-Venezia Giulia", ["GO", "PN", "TS", "UD"]],
  "12": ["Lazio", ["FR", "LT", "RI", "RM", "VT"]], "7": ["Liguria", ["GE", "IM", "SP", "SV"]],
  "3": ["Lombardia", ["BG", "BS", "CO", "CR", "LC", "LO", "MB", "MI", "MN", "PV", "SO", "VA"]],
  "11": ["Marche", ["AN", "AP", "FM", "MC", "PU"]], "14": ["Molise", ["CB", "IS"]],
  "1": ["Piemonte", ["AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC"]], "16": ["Puglia", ["BA", "BR", "BT", "FG", "LE", "TA"]],
  "20": ["Sardegna", ["CA", "CI", "NU", "OG", "OR", "OT", "SS", "SU", "VS"]], "19": ["Sicilia", ["AG", "CL", "CT", "EN", "ME", "PA", "RG", "SR", "TP"]],
  "9": ["Toscana", ["AR", "FI", "GR", "LI", "LU", "MS", "PI", "PO", "PT", "SI"]], "4": ["Trentino-Alto Adige/Südtirol", ["TN"]],
  "10": ["Umbria", ["PG", "TR"]], "2": ["Valle d'Aosta/Vallée d'Aoste", ["AO"]], "5": ["Veneto", ["BL", "PD", "RO", "TV", "VE", "VI", "VR"]],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// INIZIO-EMAIL-CAMPAGNA
// Grafiche disponibili per l'intestazione (immagini in public/marketing/).
export const GRAFICHE_CAMPAGNA = {
  risorse: { nome: "Risorse per il Comune", file: "banner-risorse.png" },
  territorio: { nome: "Territorio e ambiente", file: "banner-territorio.png" },
};

// Sostituisce i caratteri speciali HTML.
function escCampagna(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Parametri: { portale (indirizzo del portale, senza / finale), grafica,
// oggetto, testo (paragrafi separati da una riga vuota), ente (nome del
// destinatario), token (codice dell'invio) }. Restituisce l'HTML completo.
export function htmlCampagna({ portale, grafica, oggetto, testo, ente, token }) {
  const g = GRAFICHE_CAMPAGNA[grafica] || GRAFICHE_CAMPAGNA.risorse;
  const link = `${portale}/scopri?c=${encodeURIComponent(token)}`;
  const esci = `${portale}/scopri/disiscrizione?c=${encodeURIComponent(token)}`;
  const paragrafi = String(testo || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1b2118">${escCampagna(p).replace(/\n/g, "<br>")}</p>`).join("");
  const anni = [7, 10, 21].map((a) => `<td align="center" style="padding:10px 6px;background:#ffffff;border:1px solid #d9d4c5;border-radius:10px"><div style="font-size:26px;font-weight:bold;color:#2f5d3a">${a}</div><div style="font-size:12px;color:#5a5e54">anni</div></td>`).join('<td style="width:8px"></td>');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"><title>${escCampagna(oggetto)}</title></head>
<body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#1b2118">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #d9d4c5;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td><img src="${portale}/marketing/${g.file}" width="600" alt="Programma Carbon WastePrint: i rifiuti evitati diventano risorse per il Comune" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:22px 26px 4px">
<div style="font-size:13px;color:#5a5e54;margin-bottom:10px">All'attenzione di ${escCampagna(ente)}</div>
${paragrafi}
</td></tr>
<tr><td style="padding:4px 26px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e4ede1;border-radius:12px"><tr><td style="padding:16px 16px 8px;font-size:15px;font-weight:bold;color:#2f5d3a">Risorse economiche per il Comune, per tutta la durata del progetto</td></tr>
<tr><td style="padding:0 16px 10px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>${anni}</tr></table></td></tr>
<tr><td style="padding:0 16px 16px;font-size:13px;line-height:1.5;color:#1b2118">I rifiuti che il territorio evita diventano crediti di carbonio certificati (Metodologia Carbon WastePrint&reg;, UNI EN ISO 14064-2), venduti sul mercato volontario: ricavi ogni anno, tariffa più equa per i cittadini, dati misurati e un percorso seguito dalla Fondazione.</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:14px 26px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2f5d3a" style="background-color:#2f5d3a;border-radius:10px">
<a href="${link}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none"><span style="color:#ffffff">Approfondisci e simula il tuo Comune &rarr;</span></a>
</td></tr></table>
<div style="font-size:12px;color:#8a8d82;padding-top:8px">In due minuti: abitanti, secco e rifiuti totali, durata. Ricevi costi e ricavi anno per anno.</div>
</td></tr>
<tr><td style="padding:16px 26px 22px;border-top:1px solid #d9d4c5;font-size:11px;line-height:1.5;color:#8a8d82">
Fondazione Operate &middot; Programma Carbon WastePrint&reg; &middot; info@carbonwasteprint.com<br>
Ricevete questo messaggio all'indirizzo pubblicato dall'ente (IndicePA o sito istituzionale/aziendale). Titolare del trattamento: Fondazione Operate; dati usati solo per presentare il Programma.
<a href="${esci}" style="color:#5a5e54">Non desidero ricevere altre comunicazioni</a>.
</td></tr>
</table></td></tr></table></body></html>`;
}

// Versione in testo semplice della stessa email.
export function testoCampagna({ portale, testo, ente, token }) {
  return [
    `All'attenzione di ${ente}`,
    "",
    String(testo || "").trim(),
    "",
    "Risorse economiche per il Comune per 7, 10 o 21 anni: i rifiuti evitati diventano crediti di carbonio certificati.",
    "",
    `Approfondisci e simula il tuo Comune: ${portale}/scopri?c=${token}`,
    "",
    "Fondazione Operate · Programma Carbon WastePrint® · info@carbonwasteprint.com",
    `Non desidero ricevere altre comunicazioni: ${portale}/scopri/disiscrizione?c=${token}`,
  ].join("\n");
}
// FINE-EMAIL-CAMPAGNA

// INIZIO-REGOLE-IPA
// Ruolo del referente dalla descrizione dell'unità organizzativa
// (ufficio) di un Comune; null se l'ufficio non interessa.
export function ruoloUfficio(descrizione) {
  const d = String(descrizione || "").toLowerCase();
  if (/tribut|entrate|\btari\b|fiscal/.test(d)) return "tributi";
  if (/ambient|ecolog|rifiut|igiene urbana|nettezza/.test(d)) return "ambiente";
  if (/finanz|ragioneri|bilancio|contabil/.test(d)) return "finanziario";
  if (/tecnic|lavori pubblici|urbanistic|manutenzion/.test(d)) return "tecnico";
  return null;
}
// Ufficio da cui prendere l'email generica dell'ente, se manca.
export function ufficioGenerico(descrizione) {
  return /protocollo|segreteria|affari generali|\burp\b|relazioni con il pubblico/.test(String(descrizione || "").toLowerCase());
}
// Vero se l'indirizzo sembra una PEC dal dominio (stessa regola del
// database, mkt_sembra_pec dello script 44).
export function sembraPec(email) {
  return /@(([^@]*[.-])?(pec|cert[.]|legalmail|postacert|arubapec|pecsicura))/.test(String(email || "").toLowerCase());
}
// FINE-REGOLE-IPA

// Pulizia di un testo (null se vuoto) e di un indirizzo email.
const t = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
const mail = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
};

// Query SQL sugli open data di IndicePA. Restituisce le righe.
async function ipa(sql: string) {
  const r = await fetch(`${IPA}?sql=${encodeURIComponent(sql)}`);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success) throw new Error(`IndicePA non risponde (${r.status}): ${JSON.stringify(j?.error || "").slice(0, 200)}`);
  return j.result.records as Record<string, string | null>[];
}

// Tutte le righe di una lettura (le API restituiscono al massimo 1.000
// righe per volta): crea(da, a) costruisce la lettura di un intervallo.
// deno-lint-ignore no-explicit-any
async function tutte(crea: (da: number, a: number) => any) {
  const out: Record<string, unknown>[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await crea(da, da + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

// Upsert a blocchi (chiave unica onConflict).
async function upsert(admin: ReturnType<typeof createClient>, tabella: string, righe: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < righe.length; i += 500) {
    const { error } = await admin.from(tabella).upsert(righe.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${tabella}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const azione = String(body.azione || "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---------------- Azioni pubbliche (landing page) ----------------
    if (["visita", "simulata", "richiesta", "disiscrivi"].includes(azione)) {
      return await pubblica(admin, azione, body);
    }

    // ---------------- Azioni degli Amministratori ----------------
    const autorizzazione = req.headers.get("Authorization") || "";
    const chiamante = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: autorizzazione } } });
    const { data: u } = await chiamante.auth.getUser();
    const { data: eAdmin } = u?.user ? await chiamante.rpc("app_is_admin") : { data: false };
    if (!u?.user || eAdmin !== true) return json({ errore: "Operazione riservata agli amministratori" }, 403);

    if (azione === "importa_comuni") return json(await importaComuni(admin, String(body.fase || "base"), Number(body.da || 0)));
    if (azione === "importa_albo") return json(await importaAlbo(admin, String(body.sezione || ""), Number(body.indice || 0)));
    if (azione === "prova_campagna") return json(await provaCampagna(admin, String(body.campagna || ""), u.user.email || ""));
    if (azione === "invia_campagna") return json(await inviaCampagna(admin, String(body.campagna || ""), Number(body.quanti || 50)));
    return json({ errore: "Azione sconosciuta" }, 400);
  } catch (e) {
    return json({ errore: String((e as Error)?.message || e) }, 500);
  }
});

// ---------------------------------------------------------------------
// Importazione dei Comuni
// ---------------------------------------------------------------------
async function importaComuni(admin: ReturnType<typeof createClient>, fase: string, da: number) {
  if (fase === "base") {
    const r = await fetch(`${PORTALE}/marketing/dati/comuni_istat.json`);
    if (!r.ok) throw new Error(`Elenco ISTAT non raggiungibile (${r.status})`);
    const dati = await r.json();
    const righe = (dati.comuni as [string, string, string, string, string, string, number | null][]).map(([codice, nome, regione, provincia, sigla, cap, pop]) => ({
      tipo: "comune", chiave: `istat:${codice}`, denominazione: `Comune di ${nome}`, codice_istat: codice,
      regione, provincia, sigla, comune_sede: nome, cap: cap || null, popolazione: pop ?? null, fonti: ["ISTAT"],
    }));
    await upsert(admin, "mkt_ente", righe, "chiave");
    return { fatti: righe.length, prossimo: null };
  }

  if (fase === "ipa") {
    const righe = await ipa(`SELECT "Codice_IPA","Denominazione_ente","Codice_fiscale_ente","Nome_responsabile","Cognome_responsabile","Titolo_responsabile","Codice_comune_ISTAT","Indirizzo","Mail1","Tipo_Mail1","Mail2","Tipo_Mail2","Mail3","Tipo_Mail3","Mail4","Tipo_Mail4","Mail5","Tipo_Mail5","Sito_istituzionale" FROM "${IPA_ENTI}" WHERE "Codice_Categoria" = 'L6' LIMIT 20000`);
    const esistenti = await tutte((da, a) => admin.from("mkt_ente").select("id, chiave").eq("tipo", "comune").order("id").range(da, a));
    const perChiave = new Map(esistenti.map((e) => [e.chiave as string, e.id as number]));
    const enti: Record<string, unknown>[] = [];
    const sindaci: Record<string, unknown>[] = [];
    // Nella categoria L6 ci sono anche Unioni, Consorzi e Comunità con il
    // codice ISTAT del Comune sede: per ogni Comune si tiene una sola riga,
    // solo quella dell'ente «Comune …» (o «Città …», «Roma Capitale»): il
    // 23/10/2026 sono 7.891 codici su 8.046 righe L6.
    const eComune = (r: Record<string, unknown>) => /^(comune|citta|città|roma capitale)\b/i.test(String(r.Denominazione_ente || "").trim());
    const perCodice = new Map<string, Record<string, unknown>[]>();
    for (const r of righe) {
      const c = String(r.Codice_comune_ISTAT || "");
      if (!c) continue;
      if (!perCodice.has(c)) perCodice.set(c, []);
      perCodice.get(c)!.push(r);
    }
    const scelte: Record<string, unknown>[] = [];
    for (const gruppo of perCodice.values()) {
      const r = gruppo.find(eComune);
      if (r) scelte.push(r);
    }
    for (const r of scelte) {
      const chiave = `istat:${r.Codice_comune_ISTAT}`;
      const id = perChiave.get(chiave);
      if (!id) continue; // Comune non più esistente nell'elenco ISTAT
      const indirizzi = [1, 2, 3, 4, 5].map((i) => ({ m: mail(r[`Mail${i}`]), tipo: String(r[`Tipo_Mail${i}`] || "") }));
      const pec = indirizzi.find((x) => x.m && /pec/i.test(x.tipo))?.m || null;
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const sito = t(r.Sito_istituzionale);
      enti.push({
        chiave, tipo: "comune", denominazione: t(r.Denominazione_ente) || "Comune", codice_ipa: t(r.Codice_IPA),
        codice_fiscale: t(r.Codice_fiscale_ente), indirizzo: t(r.Indirizzo), pec, email: generica,
        sito: sito ? (sito.startsWith("http") ? sito : `https://${sito}`) : null, fonti: ["ISTAT", "IndicePA"],
      });
      if (t(r.Cognome_responsabile)) {
        sindaci.push({ ente_id: id, ruolo: "sindaco", chiave: "ipa", nome: t(r.Nome_responsabile), cognome: t(r.Cognome_responsabile), ufficio: t(r.Titolo_responsabile), fonte: "IndicePA" });
      }
    }
    // Upsert parziale: solo i campi di IndicePA (la riga ISTAT esiste già).
    for (let i = 0; i < enti.length; i += 500) {
      const blocco = enti.slice(i, i + 500);
      const { error } = await admin.from("mkt_ente").upsert(blocco, { onConflict: "chiave" });
      if (error) throw new Error(`mkt_ente: ${error.message}`);
    }
    await upsert(admin, "mkt_referente", sindaci, "ente_id,ruolo,chiave");
    return { fatti: enti.length, prossimo: null };
  }

  if (fase === "uo") {
    // A blocchi di 400 Comuni (codici IPA già importati), una lettura leggera
    // per blocco: la lettura unica di tutti gli uffici mandava IndicePA in
    // errore. «da» = posizione nell'elenco dei Comuni con codice IPA.
    const BLOCCO = 400;
    const enti = await tutte((da, a) => admin.from("mkt_ente").select("id, codice_ipa, email").eq("tipo", "comune").not("codice_ipa", "is", null).order("id").range(da, a));
    const blocco = enti.slice(da, da + BLOCCO);
    if (!blocco.length) return { fatti: 0, referenti: 0, prossimo: null };
    const codici = blocco.map((e) => `'${String(e.codice_ipa).replace(/'/g, "")}'`).join(",");
    const righe = await ipa(`SELECT u."Codice_IPA",u."Codice_uni_uo",u."Descrizione_uo",u."Nome_responsabile",u."Cognome_responsabile",u."Mail_responsabile",u."Telefono_responsabile",u."Telefono",u."Mail1",u."Tipo_Mail1",u."Mail2",u."Tipo_Mail2",u."Mail3",u."Tipo_Mail3" FROM "${IPA_UO}" u WHERE u."Codice_IPA" IN (${codici}) LIMIT 32000`);
    // deno-lint-ignore no-explicit-any
    const perIpa = new Map(blocco.map((e: any) => [e.codice_ipa as string, e as { id: number; email: string | null }]));
    const referenti: Record<string, unknown>[] = [];
    const emailGeneriche = new Map<number, string>();
    for (const r of righe) {
      const ente = perIpa.get(r.Codice_IPA as string);
      if (!ente) continue;
      const indirizzi = [1, 2, 3].map((i) => ({ m: mail(r[`Mail${i}`]), tipo: String(r[`Tipo_Mail${i}`] || "") }));
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const ruolo = ruoloUfficio(r.Descrizione_uo);
      if (ruolo) {
        const mr = mail(r.Mail_responsabile);
        referenti.push({
          ente_id: ente.id, ruolo, chiave: String(r.Codice_uni_uo || ""), nome: t(r.Nome_responsabile), cognome: t(r.Cognome_responsabile),
          ufficio: t(r.Descrizione_uo), email: mr && !sembraPec(mr) ? mr : generica, telefono: t(r.Telefono_responsabile) || t(r.Telefono), fonte: "IndicePA",
        });
      }
      if (!ente.email && generica && ufficioGenerico(r.Descrizione_uo) && !emailGeneriche.has(ente.id)) emailGeneriche.set(ente.id, generica);
    }
    await upsert(admin, "mkt_referente", referenti, "ente_id,ruolo,chiave");
    for (const [id, email] of emailGeneriche) {
      await admin.from("mkt_ente").update({ email }).eq("id", id).is("email", null);
    }
    return { fatti: righe.length, referenti: referenti.length, prossimo: da + BLOCCO < enti.length ? da + BLOCCO : null };
  }
  throw new Error("Fase sconosciuta");
}

// ---------------------------------------------------------------------
// Importazione dei gestori dall'Albo (categoria 1 ordinaria)
// ---------------------------------------------------------------------
// Una provincia per chiamata (indice nella sezione), per restare nei tempi
// della funzione: la pagina Importazioni ripete finché «prossimo» è null.
async function importaAlbo(admin: ReturnType<typeof createClient>, sezione: string, indice: number) {
  const s = SEZIONI_ALBO[sezione];
  if (!s) throw new Error("Sezione dell'Albo sconosciuta");
  const [regione, tutteLeProvince] = s;
  if (!(indice >= 0 && indice < tutteLeProvince.length)) throw new Error("Provincia fuori elenco");
  const province = [tutteLeProvince[indice]];
  const imprese: Record<string, unknown>[] = [];
  let lette = 0;
  for (const provincia of province) {
    for (let pagina = 1; pagina < 200; pagina++) {
      const r = await fetch(ALBO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: "it", siglaProvincia: provincia, idRegione: Number(sezione), includiCP: false, paginaCorrente: pagina, risultatiPerPagina: 100 }),
      });
      if (!r.ok) throw new Error(`Albo non raggiungibile (${r.status}) per ${provincia}`);
      const j = await r.json();
      const lista = (j.ListaImprese || []) as Record<string, string>[];
      lette += lista.length;
      for (const i of lista) {
        const categorie = String(i.Categorie || "");
        if (!categorie.split(",").some((c) => /^1o(\s|$)/i.test(c.trim()))) continue;
        imprese.push({
          tipo: "gestore", chiave: `albo:${i.Sezione}/${i.NumeroIscrizione}`, denominazione: t(i.Denominazione) || "Impresa",
          codice_fiscale: t(i.CodiceFiscale), comune_sede: t(i.Comune), indirizzo: t(i.Via), cap: t(i.Cap), sigla: t(i.SiglaProvincia),
          regione, provincia: provincia, albo_numero: `${i.Sezione}/${i.NumeroIscrizione}`, albo_categorie: categorie, fonti: ["Albo Gestori Ambientali"],
        });
      }
      if (lista.length < 100) break;
    }
  }
  await upsert(admin, "mkt_ente", imprese, "chiave");
  // Gestori pubblici in IndicePA (stesso codice fiscale): PEC, email, sito.
  const cf = [...new Set(imprese.map((i) => i.codice_fiscale).filter(Boolean))] as string[];
  let daIpa = 0;
  let ipaAssente = false;
  for (let i = 0; i < cf.length && !ipaAssente; i += 300) {
    const elenco = cf.slice(i, i + 300).map((c) => `'${c.replace(/'/g, "")}'`).join(",");
    // IndicePA a volte risponde «App offline»: le imprese restano salvate e
    // i dati pubblici si aggiungono ripetendo l'importazione più tardi.
    let righe: Record<string, string | null>[] = [];
    try {
      righe = await ipa(`SELECT "Codice_fiscale_ente","Mail1","Tipo_Mail1","Mail2","Tipo_Mail2","Mail3","Tipo_Mail3","Sito_istituzionale" FROM "${IPA_ENTI}" WHERE "Codice_fiscale_ente" IN (${elenco})`);
    } catch {
      ipaAssente = true;
    }
    for (const r of righe) {
      const indirizzi = [1, 2, 3].map((k) => ({ m: mail(r[`Mail${k}`]), tipo: String(r[`Tipo_Mail${k}`] || "") }));
      const pec = indirizzi.find((x) => x.m && /pec/i.test(x.tipo))?.m || null;
      const generica = indirizzi.find((x) => x.m && !/pec/i.test(x.tipo) && !sembraPec(x.m))?.m || null;
      const sito = t(r.Sito_istituzionale);
      const { error } = await admin.from("mkt_ente").update({
        pec, ...(generica ? { email: generica } : {}), ...(sito ? { sito: sito.startsWith("http") ? sito : `https://${sito}` } : {}),
        natura: "pubblico", fonti: ["Albo Gestori Ambientali", "IndicePA"],
      }).eq("tipo", "gestore").eq("codice_fiscale", r.Codice_fiscale_ente as string);
      if (!error) daIpa++;
    }
  }
  return {
    regione, provincia: province[0], lette, categoria_1o: imprese.length, con_dati_ipa: daIpa, ipa_non_disponibile: ipaAssente,
    prossimo: indice + 1 < tutteLeProvince.length ? indice + 1 : null, province: tutteLeProvince.length,
  };
}

// ---------------------------------------------------------------------
// Campagne
// ---------------------------------------------------------------------
async function spedisci(a: { to: string; oggetto: string; html: string; testo: string; token: string }) {
  if (!RESEND_API_KEY) return { ok: false, errore: "RESEND_API_KEY non impostata" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MITTENTE, to: [a.to], subject: a.oggetto, html: a.html, text: a.testo,
      headers: { "List-Unsubscribe": `<${PORTALE}/scopri/disiscrizione?c=${a.token}>` },
    }),
  });
  const esito = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, errore: esito?.message || `errore ${r.status}` };
}

async function provaCampagna(admin: ReturnType<typeof createClient>, id: string, email: string) {
  const { data: c } = await admin.from("mkt_campagna").select("*").eq("id", id).single();
  if (!c) throw new Error("Campagna non trovata");
  const dati = { portale: PORTALE, grafica: c.grafica, oggetto: c.oggetto, testo: c.testo, ente: "Comune di Prova (email di prova)", token: "prova" };
  const esito = await spedisci({ to: email, oggetto: `[PROVA] ${c.oggetto}`, html: htmlCampagna(dati), testo: testoCampagna(dati), token: "prova" });
  return { ...esito, a: email };
}

async function inviaCampagna(admin: ReturnType<typeof createClient>, id: string, quanti: number) {
  const { data: c } = await admin.from("mkt_campagna").select("*").eq("id", id).single();
  if (!c) throw new Error("Campagna non trovata");
  if (c.stato === "inviata") return { inviati: 0, errori: 0, restano: 0 };
  if (c.stato === "bozza") await admin.from("mkt_campagna").update({ stato: "in_invio" }).eq("id", id);
  const { data: invii } = await admin.from("mkt_invio").select("id, email, token, ente:ente_id (denominazione)")
    .eq("campagna_id", id).eq("stato", "da_inviare").limit(Math.min(Math.max(quanti, 1), 50));
  const { data: disiscritti } = await admin.from("mkt_disiscrizione").select("email").in("email", (invii || []).map((i) => i.email));
  const esclusi = new Set((disiscritti || []).map((d) => d.email));
  let inviati = 0, errori = 0;
  for (const i of invii || []) {
    if (esclusi.has(i.email) || sembraPec(i.email)) {
      await admin.from("mkt_invio").update({ stato: "escluso", errore: sembraPec(i.email) ? "indirizzo PEC" : "disiscritto" }).eq("id", i.id);
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const ente = (i as any).ente?.denominazione || "Ente";
    const dati = { portale: PORTALE, grafica: c.grafica, oggetto: c.oggetto, testo: c.testo, ente, token: i.token };
    const esito = await spedisci({ to: i.email, oggetto: c.oggetto, html: htmlCampagna(dati), testo: testoCampagna(dati), token: i.token });
    if (esito.ok) inviati++; else errori++;
    await admin.from("mkt_invio").update(esito.ok ? { stato: "inviato", inviato_il: new Date().toISOString(), errore: null } : { stato: "errore", errore: esito.errore }).eq("id", i.id);
    await new Promise((r) => setTimeout(r, 600)); // limite di Resend: 2 richieste al secondo
  }
  const { count } = await admin.from("mkt_invio").select("id", { count: "exact", head: true }).eq("campagna_id", id).eq("stato", "da_inviare");
  if (!count) await admin.from("mkt_campagna").update({ stato: "inviata", inviata_il: new Date().toISOString() }).eq("id", id);
  return { inviati, errori, restano: count || 0 };
}

// ---------------------------------------------------------------------
// Azioni pubbliche della landing page
// ---------------------------------------------------------------------
async function pubblica(admin: ReturnType<typeof createClient>, azione: string, body: Record<string, unknown>) {
  const token = String(body.token || "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? token : null;
  const invio = uuid
    ? (await admin.from("mkt_invio").select("id, email, ente_id, visitato_il, simulato_il, ente:ente_id (denominazione, tipo, popolazione)").eq("token", uuid).maybeSingle()).data
    : null;

  if (azione === "visita") {
    if (invio && !invio.visitato_il) await admin.from("mkt_invio").update({ visitato_il: new Date().toISOString() }).eq("id", invio.id);
    // deno-lint-ignore no-explicit-any
    const e = (invio as any)?.ente;
    return json({ ente: e?.denominazione || null, tipo: e?.tipo || null, popolazione: e?.popolazione ?? null });
  }
  if (azione === "simulata") {
    if (invio && !invio.simulato_il) await admin.from("mkt_invio").update({ simulato_il: new Date().toISOString() }).eq("id", invio.id);
    return json({ ok: true });
  }
  if (azione === "disiscrivi") {
    if (!invio) return json({ ok: false, errore: "Collegamento non valido." }, 404);
    await admin.from("mkt_disiscrizione").upsert({ email: invio.email, ente_id: invio.ente_id }, { onConflict: "email" });
    return json({ ok: true });
  }
  if (azione === "richiesta") {
    // Campo trappola: i robot lo compilano, le persone non lo vedono.
    if (t(body.sito_web)) return json({ ok: true });
    const ente = t(body.ente), referente = t(body.referente), email = mail(body.email);
    if (!ente || ente.length < 2 || !referente || referente.length < 2 || !email) {
      return json({ ok: false, errore: "Indica ente, nome e cognome ed email validi." }, 400);
    }
    const ora = new Date(Date.now() - 3600_000).toISOString();
    const { count: perEmail } = await admin.from("mkt_richiesta").select("id", { count: "exact", head: true }).eq("email", email).gte("creato_il", ora);
    const { count: tutte } = await admin.from("mkt_richiesta").select("id", { count: "exact", head: true }).gte("creato_il", ora);
    if ((perEmail || 0) >= 3 || (tutte || 0) >= 30) return json({ ok: false, errore: "Troppe richieste: riprova più tardi o scrivi a info@carbonwasteprint.com." }, 429);
    const simulazione = body.simulazione && typeof body.simulazione === "object" ? body.simulazione : null;
    const { error } = await admin.from("mkt_richiesta").insert({
      invio_id: invio?.id || null, ente_id: invio?.ente_id || null, ente: ente.slice(0, 200), referente: referente.slice(0, 200),
      ruolo: t(body.ruolo)?.slice(0, 200) || null, email, telefono: t(body.telefono)?.slice(0, 60) || null,
      messaggio: t(body.messaggio)?.slice(0, 4000) || null, simulazione,
    });
    if (error) return json({ ok: false, errore: "Richiesta non salvata: riprova." }, 500);
    if (invio) await admin.from("mkt_invio").update({ richiesta_il: new Date().toISOString() }).eq("id", invio.id);
    // A tutti gli Amministratori attivi: notifica nel portale ed email.
    const { data: ammin } = await admin.from("profilo").select("id").eq("ruolo", "admin").eq("attivo", true);
    // deno-lint-ignore no-explicit-any
    const s = simulazione as any;
    const riepilogo = s?.totali ? ` Simulazione: ${s.anni_durata || ""} anni, margine stimato ${Math.round(s.totali.margine).toLocaleString("it-IT")} €.` : "";
    await admin.rpc("cwp_notifica", {
      p_destinatari: (ammin || []).map((a) => a.id), p_pratica: null, p_evento: "richiesta_registrazione",
      p_titolo: `Richiesta di registrazione: ${ente}`,
      p_testo: `${referente}${t(body.ruolo) ? ` (${t(body.ruolo)})` : ""} · ${email}${t(body.telefono) ? ` · ${t(body.telefono)}` : ""}.${riepilogo} Dettagli in Marketing → Richieste.`,
    });
    return json({ ok: true });
  }
  return json({ errore: "Azione sconosciuta" }, 400);
}
