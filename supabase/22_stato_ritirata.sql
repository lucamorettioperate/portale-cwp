-- =====================================================================
--  STATO «RITIRATA» DELLA PRATICA (Guida al Programma, cap. 6.4.1)
--  Eseguire DOPO 21_completamento_funzionale.sql e PRIMA di
--  23_allineamento_guida.sql, in un'esecuzione separata: un nuovo valore
--  di un tipo enumerato si può usare solo dopo che è stato salvato.
--  Lo script è rieseguibile.
--  Registro sviluppo e deploy: capitolo «Database», cronologia del 18/10.
--
--  Un Progetto ritirato su richiesta del soggetto promotore del progetto
--  resta pubblico ma non può più emettere crediti; può rientrare nel
--  Programma se la Fondazione lo ritiene ammissibile.
-- =====================================================================

alter type stato_pratica add value if not exists 'ritirata';
