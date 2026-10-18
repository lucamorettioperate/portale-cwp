-- =====================================================================
--  RECUPERO PASSWORD CON EMAIL DEL PORTALE (Edge Function recupera-password)
--  Eseguire DOPO 15_password.sql. Lo script è rieseguibile.
--
--  Registra l'ora dell'ultima richiesta di recupero per ogni indirizzo,
--  così la funzione ne accetta al massimo una ogni 2 minuti (evita che
--  qualcuno riempia di email la casella di un utente).
--  Nessun accesso dal portale: la tabella la usa solo la funzione con la
--  chiave di servizio.
-- =====================================================================

create table if not exists recupero_password_richiesta (
  email        text primary key,
  richiesta_il timestamptz not null default now()
);

alter table recupero_password_richiesta enable row level security;
-- Nessuna policy: dal browser non si legge né si scrive.
