-- =====================================================================
--  INVIO DELLE NOTIFICHE PER EMAIL (requisiti §9)
--  Eseguire DOPO 11_crediti.sql. Lo script è rieseguibile.
--
--  Ogni nuova notifica chiama la Edge Function "invia-email-notifica",
--  passando solo il suo identificativo: la funzione rilegge contenuto e
--  destinatario dal database e spedisce ogni notifica una sola volta.
--  Per questo la chiamata non contiene chiavi né testi.
--
--  Un controllo ogni 15 minuti riprova le notifiche delle ultime 6 ore non
--  ancora spedite (ad esempio se il servizio email era momentaneamente
--  non raggiungibile).
--
--  Prerequisiti (vedi docs/email-notifiche.md):
--   - Edge Function "invia-email-notifica" pubblicata, con "Verify JWT"
--     disattivato (la funzione non si fida del messaggio ricevuto)
--   - Secrets RESEND_API_KEY ed EMAIL_MITTENTE impostati in Supabase
-- =====================================================================

create extension if not exists pg_net;

-- Indirizzo della funzione (dipende dal progetto Supabase).
insert into impostazione (chiave, valore)
values ('url_email_notifiche', 'https://ajxrnofgunynkynozmrn.supabase.co/functions/v1/invia-email-notifica')
on conflict (chiave) do nothing;

-- Chiede l'invio di una notifica (asincrono: non rallenta il portale).
create or replace function richiedi_email_notifica(p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text;
begin
  select valore into v_url from impostazione where chiave = 'url_email_notifiche';
  if v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifica', 'record', jsonb_build_object('id', p_id)),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  -- l'invio email non deve mai bloccare l'operazione che ha creato la notifica
  raise warning 'Invio email non richiesto: %', sqlerrm;
end $$;

create or replace function notifica_email_dopo_inserimento()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform richiedi_email_notifica(new.id);
  return null;
end $$;

drop trigger if exists trg_notifica_email on notifica;
create trigger trg_notifica_email
  after insert on notifica
  for each row execute function notifica_email_dopo_inserimento();

-- Nuovo tentativo per le notifiche recenti non ancora spedite.
create or replace function riprova_email_notifiche()
returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  for r in
    select id from notifica
    where not email_inviata
      and creato_il > now() - interval '6 hours'
      and creato_il < now() - interval '2 minutes'
    order by creato_il
    limit 200
  loop
    perform richiedi_email_notifica(r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cwp_riprova_email';
    perform cron.schedule('cwp_riprova_email', '*/15 * * * *', 'select public.riprova_email_notifiche()');
  end if;
end $$;
