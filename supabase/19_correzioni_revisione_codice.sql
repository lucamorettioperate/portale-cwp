-- =====================================================================
--  CORREZIONI EMERSE DALLA REVISIONE DEL CODICE (punto 31, 18/10/2026)
--  Eseguire DOPO 18_registro_crediti.sql. Lo script è rieseguibile.
--
--  1. Osservazioni della consultazione: il Comune legge solo quelle
--     ammesse (Pubblicato / Risposto). Prima la regola dello script 02
--     gli lasciava leggere anche quelle ancora da moderare o non
--     pubblicate (senza i dati dell'autore): il filtro era solo
--     nell'interfaccia. Lo staff continua a vederle tutte.
--  2. Gestione utenti: un Amministratore non può cambiare il ruolo di un
--     altro Amministratore né il proprio (prima lo impediva solo
--     l'interfaccia). La nomina e la revoca degli Amministratori si fanno
--     da Supabase, come già previsto.
-- =====================================================================

drop policy if exists commento_select on commento;
create policy commento_select on commento for select
  using (
    app_is_staff()
    or (pratica_mia(pratica_id) and stato in ('pubblicato', 'risposto'))
  );

create or replace function admin_aggiorna_utente(
  p_utente uuid,
  p_ruolo ruolo_utente,
  p_organizzazione uuid
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not app_is_admin() then
    raise exception 'Solo un amministratore (con verifica a due fattori) può modificare gli utenti';
  end if;
  if p_ruolo = 'admin' then
    raise exception 'La nomina di amministratori non è consentita da qui';
  end if;
  if p_utente = auth.uid() then
    raise exception 'Non puoi cambiare il tuo ruolo';
  end if;
  if exists (select 1 from profilo where id = p_utente and ruolo = 'admin') then
    raise exception 'Il ruolo di un amministratore si cambia solo da Supabase';
  end if;
  update profilo
    set ruolo = p_ruolo,
        organizzazione_id = case when p_ruolo = 'cliente' then p_organizzazione else null end
  where id = p_utente;
end $$;
