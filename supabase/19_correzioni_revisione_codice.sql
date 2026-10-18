-- =====================================================================
--  CORREZIONI EMERSE DALLA REVISIONE DEL CODICE (punto 31, 18/10/2026)
--  Eseguire DOPO 18_registro_crediti.sql. Lo script è rieseguibile.
--
--  1. Osservazioni della consultazione: il Comune legge solo quelle
--     ammesse (Pubblicato / Risposto). Prima la regola dello script 02
--     gli lasciava leggere anche quelle ancora da moderare o non
--     pubblicate (senza i dati dell'autore): il filtro era solo
--     nell'interfaccia. Lo staff continua a vederle tutte.
-- =====================================================================

drop policy if exists commento_select on commento;
create policy commento_select on commento for select
  using (
    app_is_staff()
    or (pratica_mia(pratica_id) and stato in ('pubblicato', 'risposto'))
  );
