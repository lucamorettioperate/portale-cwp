-- =====================================================================
--  PEC DEL PROGRAMMA (19/10/2026)
--  Eseguire DOPO 24_programma_pubblico_crediti_reclami.sql. Rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 19/10.
--
--  PEC comunicata da Luca il 19/10/2026: compare sulla pagina pubblica
--  /programma (informazioni del Programma e reclami, Politica di reclamo).
--  Si potrà poi cambiare da Impostazioni › Il Programma.
-- =====================================================================

do $$
begin
  if (select valore from impostazione where chiave = 'programma_pec') is distinct from 'operate@pec.it' then
    update impostazione set valore = 'operate@pec.it', aggiornato_il = now() where chiave = 'programma_pec';
    insert into audit_event (operazione, oggetto_tipo, stato_precedente, stato_successivo, motivazione)
    values ('modifica informazioni del Programma', 'impostazione', 'pec: (vuota)', 'pec: operate@pec.it',
            'PEC del Programma comunicata da Luca il 19/10/2026, inserita dal SQL Editor');
  end if;
end $$;
