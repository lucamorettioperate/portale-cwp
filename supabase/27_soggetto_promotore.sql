-- =====================================================================
--  SOGGETTO PROMOTORE DEL PROGRAMMA (19/10/2026)
--  Eseguire DOPO 24_programma_pubblico_crediti_reclami.sql. Rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 19/10.
--
--  Comunicazione di Luca del 19/10/2026: lo Studio Associato Wastelab,
--  proprietario del Programma, ha conferito in esclusiva a Fondazione
--  Operate, con accordi legali e commerciali, la gestione della parte
--  commerciale e della parte tecnologica (portale CWP). Fondazione Operate
--  è quindi il soggetto promotore del programma (Guida al Programma 3.1).
--  Il testo compare sulla pagina pubblica /programma; si modifica poi da
--  Impostazioni › Il Programma.
-- =====================================================================

do $$
declare
  v_nuovo text := 'Fondazione Operate, gestore in esclusiva del Programma Carbon WastePrint® (parte commerciale e parte tecnologica, portale CWP) per conferimento dello Studio Associato Wastelab, proprietario del Programma';
  v_prima text;
begin
  select valore into v_prima from impostazione where chiave = 'programma_soggetto_promotore';
  if v_prima is distinct from v_nuovo then
    update impostazione set valore = v_nuovo, aggiornato_il = now() where chiave = 'programma_soggetto_promotore';
    insert into audit_event (operazione, oggetto_tipo, stato_precedente, stato_successivo, motivazione)
    values ('modifica informazioni del Programma', 'impostazione', 'soggetto_promotore: ' || coalesce(v_prima, ''),
            'soggetto_promotore: ' || v_nuovo,
            'Esclusiva conferita da Wastelab a Fondazione Operate, comunicata da Luca il 19/10/2026; inserita dal SQL Editor');
  end if;
end $$;
