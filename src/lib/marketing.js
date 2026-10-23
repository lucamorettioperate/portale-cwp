/* =========================================================================
   marketing.js — funzioni pure dello strumento di marketing (richiesta di
   Luca Moretti del 23/10/2026).

   Scopo:
   - htmlCampagna / testoCampagna: l'email di una campagna (grafica in
     testa, testo, riquadro «risorse per 7, 10 o 21 anni», pulsante
     «Approfondisci» verso la landing page, informativa e disiscrizione).
     La STESSA funzione è copiata identica nella funzione del server
     supabase/functions/marketing/index.ts (che spedisce): la prova
     test/marketing.test.mjs controlla che le due copie coincidano;
   - microSimulazione: la stima della landing page per un Comune (abitanti,
     secco e totale in tonnellate all'anno, anni) con il motore del
     simulatore (simula e simulaEconomia di crediti/simulatore.js): crediti,
     ricavi, costi del listino Caso 1 o 2, margine anno per anno;
   - ruoloUfficio / sembraPec: regole usate dall'importazione da IndicePA
     (anch'esse copiate nella funzione del server).

   Ipotesi della micro simulazione (dichiarate nella pagina e nel
   fascicolo; stima indicativa, non certificabile):
   - differenziata ripartita con una composizione media nazionale;
   - metodo «per utenza, solo utenze virtuose» (come le stime dei contratti
     tipo), variabilità tra utenze 30%, buffer del Capitolo 7;
   - obiettivo: secco pro capite −30% e produzione −5% entro l'ultimo anno
     (traiettoria lineare);
   - valore del credito 32 € (proposto dal simulatore), costi del Caso 1
     (progetto volontario) o del Caso 2 (da bando di gara).

   Registro sviluppo e deploy: capitolo «Marketing».
   ========================================================================= */
import {
  simula, simulaEconomia, bufferMetodologia, valoreProgettoCaso, PREZZO_PROPOSTO, STIMA_PREDEFINITA, CASI_COSTI,
} from "./crediti/simulatore.js";

// ---------------------------------------------------------------------
// Email della campagna — COPIA IDENTICA nella funzione del server.
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

// ---------------------------------------------------------------------
// Regole dell'importazione da IndicePA — COPIA IDENTICA nella funzione.
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

// ---------------------------------------------------------------------
// Micro simulazione della landing page
// ---------------------------------------------------------------------
// Composizione media della raccolta differenziata (quote), usata quando il
// Comune indica solo secco e totale.
export const COMPOSIZIONE_DIFFERENZIATA = { organico: 0.38, carta: 0.22, vetro: 0.14, plastica: 0.14, verde: 0.08, metallo: 0.04 };
export const RIDUZIONE_SECCO = 0.3; // −30% di secco pro capite entro l'ultimo anno
export const RIDUZIONE_TOTALE = 0.05; // −5% di produzione pro capite

// Controlla i dati del modulo. Restituisce un array di messaggi.
export function erroriMicro({ abitanti, secco, totale, anni }) {
  const e = [];
  const n = (v) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  if (!(n(abitanti) >= 100 && n(abitanti) <= 3000000)) e.push("Indica gli abitanti (almeno 100).");
  if (!(n(totale) > 0)) e.push("Indica la produzione totale di rifiuti in tonnellate all'anno.");
  if (!(n(secco) >= 0)) e.push("Indica il secco residuo in tonnellate all'anno.");
  if (n(secco) > n(totale)) e.push("Il secco non può superare la produzione totale.");
  if (![7, 10, 21].includes(Number(anni))) e.push("Scegli la durata: 7, 10 o 21 anni.");
  const pc = (n(totale) * 1000) / n(abitanti);
  if (n(abitanti) > 0 && n(totale) > 0 && (pc < 150 || pc > 1200)) e.push(`La produzione risulta di ${Math.round(pc)} kg per abitante all'anno: controlla che i rifiuti siano in tonnellate all'anno.`);
  return e;
}

/* Parametri: { abitanti, secco (t/anno), totale (t/anno), anni (7, 10,
   21), caso ("caso1" | "caso2"), annoInizio }. Restituisce { errori,
   anni: [{ anno, crediti, ricavi, costi, margine, cumulato }], totali:
   { crediti, ricavi, costi, margine, perAbitante, rientro }, ipotesi }. */
export function microSimulazione({ abitanti, secco, totale, anni, caso = "caso1", annoInizio = new Date().getFullYear() + 1 }) {
  const errori = erroriMicro({ abitanti, secco, totale, anni });
  if (errori.length) return { errori };
  const n = (v) => Number(String(v).replace(/\s/g, "").replace(",", "."));
  const pop = n(abitanti);
  const tot = n(totale);
  const sec = n(secco);
  const diff = tot - sec;
  const rifiuti = { indifferenziato: sec };
  Object.entries(COMPOSIZIONE_DIFFERENZIATA).forEach(([t, q]) => { rifiuti[t] = Math.round(diff * q * 10) / 10; });
  const durata = Number(anni);
  const pc0 = (tot * 1000) / pop;
  const sc0 = (sec * 1000) / pop;
  const righeAnni = Array.from({ length: durata }, (_, i) => {
    const quota = (i + 1) / durata;
    const pc = pc0 * (1 - RIDUZIONE_TOTALE * quota);
    const sc = sc0 * (1 - RIDUZIONE_SECCO * quota);
    return { anno: annoInizio + i, popolazione: pop, totale: Math.round(((pc * pop) / 1000) * 10) / 10, seccoProCapite: Math.round(sc * 10) / 10 };
  });
  const stima = { ...STIMA_PREDEFINITA };
  const bufferPct = bufferMetodologia({ ...stima, soloVirtuose: true }).totale;
  const sim = simula({
    annoBase: { metodo: "anno", popolazione: pop, rifiuti },
    anni: righeAnni,
    bufferPct,
    metodoStima: "utenze",
    stimaUtenze: stima,
  });
  if (!sim.righe.length) return { errori: sim.errori?.length ? sim.errori : ["Dati insufficienti per la stima."] };
  const casoOk = CASI_COSTI[caso] ? caso : "caso1";
  const eco = simulaEconomia(sim.righe, { prezzo: PREZZO_PROPOSTO, prezzi: {}, crescitaPrezzo: 0, listino: casoOk }, pop);
  const righe = eco.righe.map((r) => ({
    anno: r.anno,
    crediti: r.crediti,
    ricavi: Math.round(r.ricavi),
    costi: Math.round(r.tariffeProgramma),
    margine: Math.round(r.ricavi - r.tariffeProgramma),
  }));
  let cum = 0;
  righe.forEach((r) => { cum += r.margine; r.cumulato = cum; });
  const t = (k) => righe.reduce((s, r) => s + r[k], 0);
  const rientro = righe.find((r) => r.cumulato > 0)?.anno ?? null;
  return {
    errori: [],
    caso: casoOk,
    anni: righe,
    totali: {
      crediti: t("crediti"),
      ricavi: t("ricavi"),
      costi: t("costi"),
      margine: t("margine"),
      perAbitante: Math.round((t("margine") / pop) * 100) / 100,
      rientro,
      bufferPct,
      rdIniziale: Math.round((diff / tot) * 1000) / 10,
      valoreProgetto: valoreProgettoCaso(casoOk, pop, durata === 7 ? "7 anni rinnovabili" : "10 anni"),
    },
    ipotesi: [
      `Secco residuo per abitante −${RIDUZIONE_SECCO * 100}% e rifiuti totali −${RIDUZIONE_TOTALE * 100}% entro il ${annoInizio + durata - 1}, in modo graduale.`,
      `Crediti stimati con il metodo «per utenza» della Metodologia CWP (solo utenze che migliorano), buffer di garanzia del ${bufferPct}%.`,
      `Valore del credito ${PREZZO_PROPOSTO} € (ipotesi); costi del ${CASI_COSTI[casoOk]} (tabelle della Fondazione, IVA esclusa)${durata !== 10 ? ", calcolati per 10 anni e qui ripetuti come stima" : ""}.`,
      "Stima indicativa, non certificabile: i crediti veri si calcolano ogni anno sui dati misurati delle utenze.",
    ],
  };
}
