-- =====================================================================
--  DURATA DELLE FASI MODIFICABILE DALL'AMMINISTRATORE
--  Eseguire DOPO 12_email_notifiche.sql. Lo script è rieseguibile.
--
--  Prima la durata di ogni fase era scritta nel codice (0/10/40/60/135/150).
--  Ora è in una tabella che l'Amministratore modifica dal portale
--  (menu Impostazioni), con motivazione obbligatoria registrata nell'audit.
--
--  La nuova durata vale per le fasi aperte da quel momento: le scadenze
--  già fissate restano come sono (si possono cambiare pratica per pratica
--  con "Modifica scadenza").
-- =====================================================================

create table if not exists durata_fase (
  id            uuid primary key default gen_random_uuid(),
  numero        int not null unique check (numero between 1 and 7),
  nome          text not null,
  giorni        int not null check (giorni between 0 and 365),
  aggiornato_il timestamptz not null default now(),
  aggiornato_da uuid references auth.users(id) on delete set null
);

-- Valori iniziali = quelli finora scritti nel codice (requisiti, infografica).
insert into durata_fase (numero, nome, giorni) values
  (1, 'Adesione', 0),
  (2, 'Prima verifica documentale', 10),
  (3, 'Consultazione pubblica', 30),
  (4, 'Risposta ai commenti / pubblicazione', 20),
  (5, 'Validazione e verifica', 75),
  (6, 'Seconda verifica documentale', 15),
  (7, 'Chiusura', 0)
on conflict (numero) do nothing;

alter table durata_fase enable row level security;
-- Lettura per tutti gli utenti autenticati (servono a mostrare le scadenze);
-- nessuna scrittura diretta: si passa solo dalla funzione qui sotto.
drop policy if exists durata_fase_select on durata_fase;
create policy durata_fase_select on durata_fase
  for select to authenticated using (true);

-- La scadenza di una fase appena aperta usa la durata in tabella.
create or replace function cwp_durata_fase(p_numero int)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select giorni from durata_fase where numero = p_numero), 0);
$$;

-- Modifica della durata (solo Amministratori, motivazione obbligatoria).
create or replace function admin_imposta_durata_fase(p_numero int, p_giorni int, p_motivazione text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_prima int; v_nome text; v_id uuid; v_motivazione text;
begin
  if not app_is_admin() then
    raise exception 'Operazione riservata agli amministratori';
  end if;
  v_motivazione := cwp_richiedi_motivazione(p_motivazione);
  if p_numero not between 2 and 7 then
    raise exception 'La fase 1 (Adesione) è il giorno di avvio e non ha durata';
  end if;
  if p_giorni is null or p_giorni not between 0 and 365 then
    raise exception 'La durata deve essere tra 0 e 365 giorni';
  end if;

  select id, giorni, nome into v_id, v_prima, v_nome from durata_fase where numero = p_numero;
  if v_id is null then raise exception 'Fase non trovata'; end if;
  if v_prima = p_giorni then return; end if;

  update durata_fase
     set giorni = p_giorni, aggiornato_il = now(), aggiornato_da = auth.uid()
   where id = v_id;

  insert into audit_event (utente_id, ruolo, operazione, oggetto_tipo, oggetto_id,
                           stato_precedente, stato_successivo, motivazione, dettaglio)
  values (auth.uid(), app_ruolo(), 'modifica durata fase', 'durata_fase', v_id,
          v_nome || ' / ' || v_prima || ' giorni', v_nome || ' / ' || p_giorni || ' giorni',
          v_motivazione, jsonb_build_object('numero', p_numero, 'da', v_prima, 'a', p_giorni));
end $$;

revoke all on function admin_imposta_durata_fase(int, int, text) from public, anon;
grant execute on function admin_imposta_durata_fase(int, int, text) to authenticated;
