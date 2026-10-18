# Portale Carbon WastePrint

Piattaforma operativa del Programma Carbon WastePrint® di Fondazione Operate:
gestione delle pratiche di certificazione dei crediti di carbonio derivanti
dalla gestione virtuosa dei rifiuti urbani (Progetti e Rapporti di
Monitoraggio, 7 fasi, documenti versionati, integrazioni, consultazione
pubblica, audit) e calcolo dei crediti secondo la Metodologia CWP v1.2.

- Online: https://portale-cwp.vercel.app
- **Registro sviluppo e deploy** (architettura, servizi, database, cronologia,
  procedure): [`docs/REGISTRO_DEV_DEPLOY.md`](docs/REGISTRO_DEV_DEPLOY.md)

## Tecnologie

React + Vite (pubblicato su Vercel) · Supabase (Postgres con RLS, Auth, Storage,
Edge Functions, pg_cron) · Resend (email).

## Avvio in locale

```bash
npm install
cp .env.example .env   # inserire URL e chiave pubblica di Supabase
npm run dev
npm test               # test del motore di calcolo crediti e del lettore CSV
```

Gli script del database sono in `supabase/` e si eseguono in ordine numerico
nel SQL Editor di Supabase (vedi il registro, §4).
