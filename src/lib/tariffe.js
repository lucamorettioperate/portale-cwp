/* =========================================================================
   tariffe.js — Schema tariffario del Programma CWP (v1.2 del 04/09/2025).

   Scopo: calcolare le voci di pagamento proposte per una pratica dalle
   tariffe massime dello Schema tariffario (IVA esclusa). Sono proposte:
   lo staff le controlla, può cambiare l'importo e le salva come voci di
   pagamento (Pagamenti.jsx). La fattura va pagata entro 30 giorni e fino
   al saldo le attività sono sospese (lo impone il database, script 23).

   Voci:
   - Progetto: 3.000 € alla richiesta di iscrizione; ad avvenuta
     registrazione un saldo per fascia di popolazione più 0,15 € per ogni
     credito previsto nel periodo di riferimento.
   - Rapporto annuale: 1.000 € alla richiesta di iscrizione; ad avvenuta
     registrazione un saldo per fascia di popolazione più 0,20 € per ogni
     credito previsto nell'anno; emissione dei crediti a scaglioni
     cumulativi (1,00 / 0,50 / 0,30 € a credito).
   - Vendita (comunicata dal registro): 20% del valore di vendita, con un
     minimo a scaglioni cumulativi (da 1,50 a 2,50 € a credito).
   «Cumulativi»: ogni scaglione si paga al proprio prezzo (2.000 crediti
   emessi = 1.000 × 1,00 + 1.000 × 0,50 = 1.500 €).

   Usato da: src/components/Pagamenti.jsx; prove in test/tariffe.test.mjs.
   Dati/servizi coinvolti: nessuno (solo calcoli).
   Registro sviluppo e deploy: capitolo «Portale (frontend)».
   ========================================================================= */

// Saldo ad avvenuta registrazione per fascia di popolazione: [fino a
// abitanti, euro]. L'ultima fascia non ha limite.
export const SALDO_PROGETTO = [[5000, 1000], [10000, 2000], [30000, 4000], [100000, 7000], [Infinity, 12000]];
export const SALDO_RAPPORTO = [[5000, 500], [10000, 1000], [30000, 2000], [100000, 4000], [Infinity, 7000]];

export const ISCRIZIONE_PROGETTO = 3000;
export const ISCRIZIONE_RAPPORTO = 1000;
export const VARIABILE_PROGETTO = 0.15; // € per credito previsto nel periodo
export const VARIABILE_RAPPORTO = 0.2; // € per credito previsto nell'anno

// Scaglioni cumulativi: [fino a crediti, € a credito].
export const SCAGLIONI_EMISSIONE = [[1000, 1.0], [10000, 0.5], [Infinity, 0.3]];
export const SCAGLIONI_MINIMO_VENDITA = [[500, 1.5], [1000, 1.75], [10000, 2.0], [50000, 2.25], [Infinity, 2.5]];
export const QUOTA_VENDITA = 0.2;

// Arrotonda ai centesimi.
const cent = (n) => Math.round(n * 100) / 100;

// Importo per fascia di popolazione (null se la popolazione non è nota).
export function saldoPerPopolazione(popolazione, fasce) {
  if (popolazione == null || popolazione === "" || isNaN(Number(popolazione))) return null;
  return fasce.find(([fino]) => Number(popolazione) <= fino)[1];
}

// Importo a scaglioni cumulativi per n crediti.
export function aScaglioni(n, scaglioni) {
  let resto = Math.max(0, Math.floor(Number(n) || 0));
  let totale = 0;
  let da = 0;
  for (const [fino, prezzo] of scaglioni) {
    const quanti = Math.min(resto, fino - da);
    totale += quanti * prezzo;
    resto -= quanti;
    da = fino;
    if (resto <= 0) break;
  }
  return cent(totale);
}

// Tariffa di emissione per i crediti emessi da un Rapporto in un anno.
export const tariffaEmissione = (crediti) => aScaglioni(crediti, SCAGLIONI_EMISSIONE);

// Tariffa di vendita: 20% del valore, non meno del minimo a scaglioni.
export function tariffaVendita(crediti, valore) {
  return cent(Math.max(QUOTA_VENDITA * (Number(valore) || 0), aScaglioni(crediti, SCAGLIONI_MINIMO_VENDITA)));
}

// Voci proposte per una pratica: [{ voce, descrizione, importo, nota }].
// importo null = manca un dato (popolazione o crediti previsti): la nota
// dice quale.
export function proposteTariffe(pratica) {
  const rapporto = pratica?.tipo === "rapporto";
  const pop = pratica?.popolazione;
  const crediti = pratica?.crediti_previsti;
  const saldo = saldoPerPopolazione(pop, rapporto ? SALDO_RAPPORTO : SALDO_PROGETTO);
  const variabile = crediti == null ? null : cent(Number(crediti) * (rapporto ? VARIABILE_RAPPORTO : VARIABILE_PROGETTO));
  const voci = [
    {
      voce: "iscrizione",
      descrizione: rapporto ? "Registrazione rapporto annuale – quota alla richiesta di iscrizione" : "Registrazione progetto – quota alla richiesta di iscrizione",
      importo: rapporto ? ISCRIZIONE_RAPPORTO : ISCRIZIONE_PROGETTO,
      nota: "Da saldare prima della fase di validazione o verifica (Guida 6.2.1 e 6.3.1)",
    },
    {
      voce: "registrazione",
      descrizione: rapporto ? "Registrazione rapporto annuale – saldo ad avvenuta registrazione" : "Registrazione progetto – saldo ad avvenuta registrazione",
      importo: saldo == null || variabile == null ? null : cent(saldo + variabile),
      nota:
        saldo == null || variabile == null
          ? "Servono popolazione e crediti previsti (Dati della pratica)"
          : `Quota per popolazione ${saldo.toLocaleString("it-IT")} € + ${rapporto ? "0,20" : "0,15"} € × ${Number(crediti).toLocaleString("it-IT")} crediti previsti`,
    },
  ];
  if (rapporto) {
    voci.push({
      voce: "emissione",
      descrizione: "Emissione dei crediti di CO₂eq",
      importo: crediti == null ? null : tariffaEmissione(crediti),
      nota: crediti == null ? "Servono i crediti (Dati della pratica)" : "A scaglioni cumulativi sui crediti dell'anno; da aggiornare con i crediti effettivamente emessi",
    });
  }
  return voci;
}
