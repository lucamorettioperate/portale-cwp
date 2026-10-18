-- =====================================================================
--  PRATICHE: RIFINITURE (backlog 10, 11, 12, 13, 26, 27 — 18/10/2026)
--  Eseguire DOPO 16_recupero_password.sql. Lo script è rieseguibile.
--
--  1. Pagamenti visibili al Comune in sola lettura (punto 27).
--  2. Note di fase: interne alla Fondazione o condivise con il Comune
--     (punto 10).
--  3. Enti di Validazione: anagrafica gestita dagli Amministratori e
--     assegnazione dell'ente alla pratica (punto 11).
--  4. Modelli di documento scaricabili dai Comuni (punto 12).
--  5. Messaggi tra Comune e Fondazione nella pratica (punto 26).
--  6. Consultazione pubblica (punto 13): osservazioni dall'esterno con
--     email confermata (decisione D), allegati, errata corrige con
--     ripartenza dei 30 giorni decisa dallo staff (decisione B).
--  7. Audit e notifiche per le nuove tabelle.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PAGAMENTI: il Comune li vede, solo lo staff li modifica
-- ---------------------------------------------------------------------
drop policy if exists pagamento_all on pagamento;
drop policy if exists pagamento_select on pagamento;
drop policy if exists pagamento_write on pagamento;
create policy pagamento_select on pagamento for select
  using (app_is_staff() or pratica_mia(pratica_id));
create policy pagamento_write on pagamento for all
  using (app_is_staff()) with check (app_is_staff());


-- ---------------------------------------------------------------------
-- 2. NOTE DI FASE
-- ---------------------------------------------------------------------
create table if not exists nota_fase (
  id            uuid primary key default gen_random_uuid(),
  fase_id       uuid not null references fase(id) on delete cascade,
  pratica_id    uuid not null references pratica(id) on delete cascade,
  testo         text not null check (length(trim(testo)) between 2 and 4000),
  visibile_cliente boolean not null default false,  -- false = nota interna della Fondazione
  autore_id     uuid references auth.users(id) on delete set null,
  autore_nome   text,
  creato_il     timestamptz not null default now()
);
create index if not exists idx_nota_fase on nota_fase (fase_id, creato_il);

alter table nota_fase enable row level security;
drop policy if exists nota_fase_select on nota_fase;
create policy nota_fase_select on nota_fase for select
  using (app_is_staff() or (visibile_cliente and pratica_mia(pratica_id)));
drop policy if exists nota_fase_insert on nota_fase;
create policy nota_fase_insert on nota_fase for insert
  with check (app_is_staff());
-- Nessuna policy di modifica o cancellazione: le note restano come scritte.


-- ---------------------------------------------------------------------
-- 3. ENTI DI VALIDAZIONE
-- ---------------------------------------------------------------------
alter table ente_validazione add column if not exists referente text;
alter table ente_validazione add column if not exists email text;
alter table ente_validazione add column if not exists telefono text;
alter table ente_validazione add column if not exists attivo boolean not null default true;
alter table ente_validazione add column if not exists aggiornato_il timestamptz not null default now();

drop policy if exists ente_select on ente_validazione;
create policy ente_select on ente_validazione for select
  using (auth.uid() is not null);
drop policy if exists ente_write on ente_validazione;
create policy ente_write on ente_validazione for all
  using (app_is_admin()) with check (app_is_admin());

-- Assegnazione dell'ente a una pratica (Operatore o Amministratore).
create or replace function staff_imposta_ente_validazione(p_pratica uuid, p_ente uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  if p_ente is not null and not exists (select 1 from ente_validazione where id = p_ente and attivo) then
    raise exception 'Ente di Validazione non trovato o non attivo';
  end if;
  update pratica set ente_validazione_id = p_ente, aggiornato_il = now() where id = p_pratica;
  if not found then raise exception 'Pratica non trovata'; end if;
end $$;
grant execute on function staff_imposta_ente_validazione(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. MODELLI DI DOCUMENTO
-- ---------------------------------------------------------------------
create table if not exists modello_documento (
  id            uuid primary key default gen_random_uuid(),
  titolo        text not null check (length(trim(titolo)) >= 3),
  descrizione   text,
  fase_numero   int check (fase_numero between 1 and 7),   -- null = modello generale
  storage_path  text not null unique,
  nome_file     text not null,
  dimensione    bigint,
  tipo_mime     text,
  attivo        boolean not null default true,
  caricato_da   uuid references auth.users(id) on delete set null,
  creato_il     timestamptz not null default now()
);

alter table modello_documento enable row level security;
drop policy if exists modello_select on modello_documento;
create policy modello_select on modello_documento for select
  using (app_is_admin() or (attivo and auth.uid() is not null));
drop policy if exists modello_write on modello_documento;
create policy modello_write on modello_documento for all
  using (app_is_admin()) with check (app_is_admin());

-- Archivio dei modelli: privato, leggibile da chi ha effettuato l'accesso,
-- caricato solo dagli Amministratori.
insert into storage.buckets (id, name, public)
values ('modelli', 'modelli', false)
on conflict (id) do nothing;
update storage.buckets
   set file_size_limit = cwp_dimensione_massima(),
       allowed_mime_types = (select array_agg(distinct mime) from cwp_formati_ammessi())
 where id = 'modelli';

drop policy if exists modelli_select on storage.objects;
create policy modelli_select on storage.objects for select
  using (bucket_id = 'modelli' and auth.uid() is not null);
drop policy if exists modelli_insert on storage.objects;
create policy modelli_insert on storage.objects for insert
  with check (bucket_id = 'modelli' and app_is_admin());
drop policy if exists modelli_delete on storage.objects;
create policy modelli_delete on storage.objects for delete
  using (bucket_id = 'modelli' and app_is_admin());


-- ---------------------------------------------------------------------
-- 5. MESSAGGI TRA COMUNE E FONDAZIONE
-- ---------------------------------------------------------------------
create table if not exists messaggio (
  id            uuid primary key default gen_random_uuid(),
  pratica_id    uuid not null references pratica(id) on delete cascade,
  testo         text not null check (length(trim(testo)) between 1 and 4000),
  autore_id     uuid references auth.users(id) on delete set null,
  autore_ruolo  text,
  autore_nome   text,
  creato_il     timestamptz not null default now()
);
create index if not exists idx_messaggio_pratica on messaggio (pratica_id, creato_il);

alter table messaggio enable row level security;
drop policy if exists messaggio_select on messaggio;
create policy messaggio_select on messaggio for select
  using (pratica_mia(pratica_id));
drop policy if exists messaggio_insert on messaggio;
create policy messaggio_insert on messaggio for insert
  with check (
    app_is_staff()
    or (pratica_mia(pratica_id)
        and exists (select 1 from pratica p where p.id = pratica_id and p.stato <> 'annullata'))
  );
-- Nessuna modifica o cancellazione.

-- Autore compilato dal database (nessuno può scrivere a nome di altri).
create or replace function cwp_autore_riga()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  select coalesce(nullif(pr.nome_completo, ''), u.email) into v_nome
    from auth.users u left join profilo pr on pr.id = u.id
   where u.id = auth.uid();
  new.autore_id := auth.uid();
  new.autore_nome := v_nome;
  if tg_table_name = 'messaggio' then
    new.autore_ruolo := app_ruolo();
  end if;
  new.testo := trim(new.testo);
  new.creato_il := now();
  return new;
end $$;

drop trigger if exists trg_autore on nota_fase;
create trigger trg_autore before insert on nota_fase
  for each row execute function cwp_autore_riga();
drop trigger if exists trg_autore on messaggio;
create trigger trg_autore before insert on messaggio
  for each row execute function cwp_autore_riga();


-- ---------------------------------------------------------------------
-- 6. CONSULTAZIONE PUBBLICA
-- ---------------------------------------------------------------------

-- 6a. Osservazioni dall'esterno: identità confermata via email.
alter table commento add column if not exists autore_nome text;
alter table commento add column if not exists autore_email text;
alter table commento add column if not exists firma_pubblica text;   -- nome mostrato se l'autore acconsente
alter table commento add column if not exists allegato_path text;    -- archivio "allegati-consultazione"
alter table commento add column if not exists allegato_nome text;
alter table commento add column if not exists email_verificata_il timestamptz;

-- Il portale legge l'osservazione ma non i dati dell'autore (solo la firma
-- pubblica, se c'è): nome ed email li vede lo staff con la funzione sotto.
revoke select on commento from anon, authenticated;
grant select (
  id, consultazione_id, pratica_id, testo, allegato_documento_id,
  stato, motivazione_moderazione, risposta_testo, creato_il,
  firma_pubblica, allegato_path, allegato_nome, email_verificata_il
) on commento to authenticated;

create or replace function staff_autori_commenti(p_consultazione uuid)
returns table (commento_id uuid, autore_nome text, autore_email text, email_verificata_il timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform cwp_richiedi_staff();
  return query
    select c.id, coalesce(c.autore_nome, pr.nome_completo), coalesce(c.autore_email, u.email), c.email_verificata_il
      from commento c
      left join auth.users u on u.id = c.autore_utente_id
      left join profilo pr on pr.id = c.autore_utente_id
     where c.consultazione_id = p_consultazione;
end $$;
grant execute on function staff_autori_commenti(uuid) to authenticated;

-- Le osservazioni si inviano solo dalla pagina pubblica (funzione
-- "consultazione-pubblica"), dopo la conferma dell'email: dal portale
-- non si inseriscono più direttamente.
drop policy if exists commento_insert on commento;

-- Osservazioni in attesa della conferma dell'email (solo la funzione).
create table if not exists commento_in_attesa (
  id              uuid primary key default gen_random_uuid(),
  consultazione_id uuid not null references consultazione(id) on delete cascade,
  pratica_id      uuid not null references pratica(id) on delete cascade,
  nome            text not null,
  email           text not null,
  testo           text not null,
  nome_pubblico   boolean not null default false,
  allegato_path   text,
  allegato_nome   text,
  token_hash      text not null unique,
  creato_il       timestamptz not null default now(),
  scade_il        timestamptz not null default now() + interval '48 hours'
);
create index if not exists idx_commento_attesa_email on commento_in_attesa (email, creato_il);
alter table commento_in_attesa enable row level security;
-- Nessuna policy: dal browser non si legge né si scrive.

-- Archivio degli allegati alle osservazioni (scritto solo dalla funzione).
insert into storage.buckets (id, name, public)
values ('allegati-consultazione', 'allegati-consultazione', false)
on conflict (id) do nothing;
update storage.buckets
   set file_size_limit = 10485760,  -- 10 MB
       allowed_mime_types = array['application/pdf','image/jpeg','image/png',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.oasis.opendocument.text']
 where id = 'allegati-consultazione';

-- Lettura: staff sempre; il Comune solo per le osservazioni ammesse.
create or replace function allegato_commento_visibile(p_path text)
returns boolean
language sql stable security definer set search_path = public as $$
  select app_is_staff() or exists (
    select 1 from commento c
     where c.allegato_path = p_path
       and c.stato in ('pubblicato', 'risposto')
       and pratica_mia(c.pratica_id)
  );
$$;
drop policy if exists allegati_consultazione_select on storage.objects;
create policy allegati_consultazione_select on storage.objects for select
  using (bucket_id = 'allegati-consultazione' and allegato_commento_visibile(name));

-- 6b. Errata corrige.
create table if not exists consultazione_errata (
  id              uuid primary key default gen_random_uuid(),
  consultazione_id uuid not null references consultazione(id) on delete cascade,
  pratica_id      uuid not null references pratica(id) on delete cascade,
  documento_id    uuid references documento(id) on delete set null,
  testo           text not null,
  riparte         boolean not null default false,   -- i 30 giorni ripartono?
  chiusura_precedente date,
  nuova_chiusura  date,
  motivazione     text,
  creato_da       uuid references auth.users(id) on delete set null,
  creato_il       timestamptz not null default now()
);
create index if not exists idx_errata_consultazione on consultazione_errata (consultazione_id, creato_il);

alter table consultazione_errata enable row level security;
drop policy if exists errata_select on consultazione_errata;
create policy errata_select on consultazione_errata for select
  using (pratica_mia(pratica_id));
-- Inserimento solo con la funzione qui sotto.

create or replace function staff_errata_corrige(
  p_consultazione uuid, p_documento uuid, p_testo text, p_riparte boolean, p_motivazione text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c consultazione; v_id uuid; v_nuova date;
begin
  perform cwp_richiedi_staff();
  select * into c from consultazione where id = p_consultazione;
  if c.id is null then raise exception 'Consultazione non trovata'; end if;
  if not c.attiva then raise exception 'La consultazione è chiusa'; end if;
  if p_testo is null or length(trim(p_testo)) < 3 then
    raise exception 'Descrivi la correzione';
  end if;
  if p_documento is not null and not exists (
      select 1 from documento where id = p_documento and pratica_id = c.pratica_id) then
    raise exception 'Il documento non appartiene a questa pratica';
  end if;
  if coalesce(p_riparte, false) then
    perform cwp_richiedi_motivazione(p_motivazione);
    v_nuova := current_date + 30;
    update consultazione set data_chiusura = v_nuova where id = c.id;
  elsif p_motivazione is not null and length(trim(p_motivazione)) > 0 then
    perform set_config('cwp.motivazione', trim(p_motivazione), true);
  end if;
  insert into consultazione_errata (consultazione_id, pratica_id, documento_id, testo, riparte,
                                    chiusura_precedente, nuova_chiusura, motivazione, creato_da)
  values (c.id, c.pratica_id, p_documento, trim(p_testo), coalesce(p_riparte, false),
          c.data_chiusura, coalesce(v_nuova, c.data_chiusura), nullif(trim(coalesce(p_motivazione, '')), ''), auth.uid())
  returning id into v_id;
  -- Il documento dell'errata corrige è pubblico come quello in consultazione.
  if p_documento is not null then
    update documento set pubblico = true where id = p_documento and not pubblico;
  end if;
  return v_id;
end $$;
grant execute on function staff_errata_corrige(uuid, uuid, text, boolean, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. AUDIT (nomi delle nuove operazioni) E NOTIFICHE
-- ---------------------------------------------------------------------
create or replace function audit_registra()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_rec jsonb := coalesce(v_new, v_old);
  v_diff jsonb := '{}'::jsonb;
  v_chiave text;
  v_op text;
  v_prec text;
  v_succ text;
  v_motivazione text;
  v_oggetto uuid;
  v_pratica uuid;
  v_etichetta text;
begin
  if tg_op = 'UPDATE' then
    for v_chiave in select jsonb_object_keys(v_new) loop
      if v_new -> v_chiave is distinct from v_old -> v_chiave
         and v_chiave not in ('aggiornato_il') then
        v_diff := v_diff || jsonb_build_object(
          v_chiave, jsonb_build_object('da', v_old -> v_chiave, 'a', v_new -> v_chiave));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return null;
    end if;
    if tg_table_name = 'documento'
       and (select bool_and(k in ('corrente','stato')) from jsonb_object_keys(v_diff) k) then
      return null;
    end if;
  end if;

  if tg_table_name = 'utente_organizzazione' then
    v_oggetto := (v_rec ->> 'utente_id')::uuid;
  else
    v_oggetto := (v_rec ->> 'id')::uuid;
  end if;
  v_pratica := case
    when tg_table_name = 'pratica' then v_oggetto
    when v_rec ? 'pratica_id' then (v_rec ->> 'pratica_id')::uuid
  end;

  v_etichetta := case when tg_table_name = 'fase' then (v_rec ->> 'nome') || ' / ' else '' end;
  if v_old ? 'stato' then v_prec := v_etichetta || upper(replace(v_old ->> 'stato', '_', ' ')); end if;
  if v_new ? 'stato' then v_succ := v_etichetta || upper(replace(v_new ->> 'stato', '_', ' ')); end if;

  v_motivazione := coalesce(v_new ->> 'motivazione_stato', v_new ->> 'motivazione_moderazione');
  if tg_op = 'UPDATE'
     and not (v_diff ? 'motivazione_stato' or v_diff ? 'motivazione_moderazione' or v_diff ? 'stato') then
    v_motivazione := null;
  end if;
  v_motivazione := coalesce(nullif(current_setting('cwp.motivazione', true), ''), v_motivazione);

  v_op := case tg_table_name
    when 'pratica' then case
      when tg_op = 'INSERT' then 'creazione ' || coalesce(v_new ->> 'tipo', 'pratica')
      when v_diff ? 'stato' then 'cambio stato pratica'
      when v_diff ? 'ente_validazione_id' then 'assegnazione ente di validazione'
      else 'modifica pratica' end
    when 'fase' then case
      when tg_op = 'INSERT' then 'creazione fase'
      when v_diff ? 'stato' and v_new ->> 'stato' = 'in_corso' and v_old ->> 'stato' = 'non_iniziata' then 'apertura fase'
      when v_diff ? 'stato' and v_new ->> 'stato' = 'completata' then 'chiusura fase'
      when v_diff ? 'stato' then 'cambio stato fase'
      when v_diff ? 'data_prevista_chiusura' then 'modifica scadenza fase'
      else 'modifica fase' end
    when 'documento' then case
      when tg_op = 'INSERT' then 'caricamento documento v' || (v_new ->> 'versione')
      when v_diff ? 'pubblico' or v_diff ? 'visibile_cliente' or v_diff ? 'visibile_fondazione' then 'modifica visibilità documento'
      else 'modifica documento' end
    when 'consultazione' then case
      when tg_op = 'INSERT' then 'apertura consultazione pubblica'
      when v_diff ? 'attiva' and not (v_new ->> 'attiva')::boolean then 'chiusura consultazione pubblica'
      when v_diff ? 'documento_id' then 'sostituzione documento in consultazione'
      when v_diff ? 'data_chiusura' then 'proroga consultazione pubblica'
      else 'modifica consultazione' end
    when 'commento' then case
      when tg_op = 'INSERT' then 'ricezione commento'
      when v_diff ? 'risposta_testo' then 'risposta a commento'
      when v_diff ? 'stato' then 'moderazione commento'
      else 'modifica commento' end
    when 'consultazione_errata' then 'errata corrige in consultazione'
    when 'richiesta_integrazione' then case
      when tg_op = 'INSERT' then 'richiesta di integrazione'
      when v_diff ? 'risolta' and (v_new ->> 'risolta')::boolean then 'integrazione completata'
      when v_diff ? 'documento_risposta_id' then 'risposta del cliente a integrazione'
      else 'modifica richiesta di integrazione' end
    when 'pagamento' then case
      when tg_op = 'INSERT' then 'registrazione voce di pagamento'
      when v_diff ? 'pagato' and (v_new ->> 'pagato')::boolean then 'registrazione incasso'
      else 'modifica pagamento' end
    when 'nota_fase' then case when (v_new ->> 'visibile_cliente')::boolean
      then 'nota di fase condivisa con il cliente' else 'nota di fase interna' end
    when 'messaggio' then 'messaggio nella pratica'
    when 'modello_documento' then case
      when tg_op = 'INSERT' then 'pubblicazione modello di documento'
      when v_diff ? 'attivo' and not (v_new ->> 'attivo')::boolean then 'ritiro modello di documento'
      else 'modifica modello di documento' end
    when 'organizzazione' then case when tg_op = 'INSERT' then 'censimento organizzazione' else 'modifica organizzazione' end
    when 'ente_validazione' then case when tg_op = 'INSERT' then 'censimento ente di validazione' else 'modifica ente di validazione' end
    when 'profilo' then case when tg_op = 'INSERT' then 'creazione utente' else 'modifica utente' end
    when 'utente_organizzazione' then case when tg_op = 'INSERT' then 'associazione utente-organizzazione' else 'rimozione associazione utente-organizzazione' end
    else lower(tg_op) || ' ' || tg_table_name
  end;
  if tg_op = 'DELETE' and tg_table_name <> 'utente_organizzazione' then
    v_op := 'cancellazione ' || tg_table_name;
  end if;

  insert into audit_event (
    utente_id, ruolo, operazione, oggetto_tipo, oggetto_id, pratica_id,
    stato_precedente, stato_successivo, motivazione, dettaglio
  ) values (
    auth.uid(), app_ruolo(), v_op, tg_table_name, v_oggetto, v_pratica,
    v_prec, v_succ, v_motivazione,
    case when tg_op = 'UPDATE' then v_diff
         -- i dati dell'autore di un'osservazione non finiscono nel dettaglio
         when tg_table_name = 'commento' then v_rec - 'autore_email' - 'autore_nome'
         else v_rec end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['nota_fase','messaggio','modello_documento','consultazione_errata'] loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on %I
         for each row execute function audit_registra()', t);
  end loop;
end $$;

-- Notifiche: aggiunti note condivise, messaggi, errata corrige, nuove
-- voci di pagamento (ora visibili al Comune).
create or replace function notifiche_eventi()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pratica uuid;
  v_etichetta text;
  v_clienti uuid[];
  v_staff uuid[];
begin
  v_pratica := coalesce((to_jsonb(new) ->> 'pratica_id')::uuid, (to_jsonb(new) ->> 'id')::uuid);
  v_etichetta := cwp_etichetta_pratica(v_pratica);
  v_clienti := array(select cwp_clienti_pratica(v_pratica));
  v_staff := array(select cwp_staff());

  if tg_table_name = 'fase' then
    if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
      if new.stato = 'in_corso' and old.stato = 'non_iniziata' then
        perform cwp_notifica(v_clienti, v_pratica, 'apertura_fase',
          'Aperta la fase «' || new.nome || '»',
          v_etichetta || coalesce(' — scadenza ' || to_char(new.data_prevista_chiusura, 'DD/MM/YYYY'), ''));
      elsif new.stato = 'completata' then
        perform cwp_notifica(v_clienti, v_pratica, 'chiusura_fase',
          'Completata la fase «' || new.nome || '»', v_etichetta);
      end if;
    end if;

  elsif tg_table_name = 'richiesta_integrazione' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'richiesta_integrazione',
        'Nuova richiesta di integrazione', v_etichetta || ' — ' || new.descrizione);
    elsif new.documento_risposta_id is distinct from old.documento_risposta_id then
      perform cwp_notifica(v_staff, v_pratica, 'risposta_integrazione',
        'Il Cliente ha risposto a una richiesta di integrazione', v_etichetta || ' — ' || new.descrizione);
    end if;

  elsif tg_table_name = 'documento' then
    if tg_op = 'INSERT' then
      if app_is_staff() then
        if new.visibile_cliente or new.pubblico then
          perform cwp_notifica(v_clienti, v_pratica, 'nuovo_documento',
            'Nuovo documento disponibile', v_etichetta || ' — ' || new.nome || ' (v' || new.versione || ')');
        end if;
      else
        perform cwp_notifica(v_staff, v_pratica, 'nuovo_documento',
          'Il Cliente ha caricato un documento', v_etichetta || ' — ' || new.nome || ' (v' || new.versione || ')');
      end if;
    end if;

  elsif tg_table_name = 'consultazione' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'apertura_consultazione',
        'Aperta la consultazione pubblica',
        v_etichetta || ' — fino al ' || coalesce(to_char(new.data_chiusura, 'DD/MM/YYYY'), '—'));
    end if;

  elsif tg_table_name = 'commento' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_staff, v_pratica, 'nuovo_commento',
        'Nuova osservazione da moderare', v_etichetta);
    end if;

  elsif tg_table_name = 'consultazione_errata' then
    perform cwp_notifica(v_clienti, v_pratica, 'errata_corrige',
      'Errata corrige pubblicata in consultazione',
      v_etichetta || case when new.riparte
        then ' — la consultazione riparte: nuova chiusura ' || to_char(new.nuova_chiusura, 'DD/MM/YYYY')
        else '' end);

  elsif tg_table_name = 'nota_fase' then
    if new.visibile_cliente then
      perform cwp_notifica(v_clienti, v_pratica, 'nota_fase',
        'Nuova nota della Fondazione',
        v_etichetta || ' — ' || left(new.testo, 160));
    end if;

  elsif tg_table_name = 'messaggio' then
    if new.autore_ruolo in ('operatore', 'admin') then
      perform cwp_notifica(v_clienti, v_pratica, 'messaggio',
        'Nuovo messaggio dalla Fondazione', v_etichetta || ' — ' || left(new.testo, 160));
    else
      perform cwp_notifica(v_staff, v_pratica, 'messaggio',
        'Nuovo messaggio dal Cliente', v_etichetta || ' — ' || left(new.testo, 160));
    end if;

  elsif tg_table_name = 'pagamento' then
    if tg_op = 'INSERT' then
      perform cwp_notifica(v_clienti, v_pratica, 'nuovo_pagamento',
        'Nuova voce di pagamento',
        v_etichetta || ' — ' || coalesce(new.descrizione, 'voce')
          || coalesce(' · scadenza ' || to_char(new.scadenza, 'DD/MM/YYYY'), ''));
    end if;

  elsif tg_table_name = 'pratica' then
    if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
      perform cwp_notifica(v_clienti, v_pratica,
        case when new.stato = 'chiusa' then 'chiusura_pratica' else 'cambio_stato' end,
        'Pratica ' || case new.stato when 'attiva' then 'riattivata' when 'sospesa' then 'sospesa'
                                     when 'annullata' then 'annullata' else 'chiusa' end,
        v_etichetta || coalesce(' — ' || new.motivazione_stato, ''));
    end if;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fase','richiesta_integrazione','documento','consultazione','commento','pratica',
                           'consultazione_errata','nota_fase','messaggio','pagamento'] loop
    execute format('drop trigger if exists trg_notifiche on %I', t);
    execute format(
      'create trigger trg_notifiche after insert or update on %I
         for each row execute function notifiche_eventi()', t);
  end loop;
end $$;
