/* =========================================================================
   genera_sql_ripristino.mjs — dai file JSON di un backup automatico al file
   SQL che rimette i dati nel database (Istruzioni di ripristino, capitolo
   «Ripristino da un backup automatico»).

   Uso (dalla cartella del repository, con Node 18 o più recente):
     node strumenti/backup/genera_sql_ripristino.mjs <cartella 2_database> [file.sql]
   oppure, per un backup manuale fatto dal browser (un solo file con tutte
   le tabelle, { tabelle: { nome: [righe] }, auth_utenti: [...] }):
     node strumenti/backup/genera_sql_ripristino.mjs database_completo.json [file.sql]
   Produce ripristino_dati.sql (o il nome indicato), da eseguire DOPO gli
   script numerati (01 e seguenti) su un progetto Supabase nuovo e vuoto:
     psql "<stringa di connessione>" -f ripristino_dati.sql
   (oppure, se piccolo, incollato nel SQL Editor di Supabase).

   Cosa fa il file SQL:
   - session_replication_role = replica: durante il ripristino non partono
     trigger e controlli (audit, notifiche, immutabilità, chiavi esterne),
     così i dati tornano IDENTICI a quelli salvati, con gli stessi id, e
     l'audit non registra il ripristino come nuove operazioni;
   - utenti dell'autenticazione (auth.users e auth.identities) con lo stesso
     id ed email, SENZA password: al primo accesso si usa «Password
     dimenticata?» (le password non si possono esportare);
   - si ferma se il database contiene già pratiche (si ripristina solo su
     un progetto nuovo); poi svuota le tabelle presenti nel backup (anche le
     righe predefinite create dagli script: nel backup ci sono i valori in
     uso) e le riempie con le righe salvate; le tabelle che nel database non
     esistono si saltano con un avviso; una riga che non rispetta un
     vincolo si segnala con «RIGA NON RIPRISTINATA» e le altre entrano;
   - alla fine riallinea i contatori delle colonne «identity» e conta le
     righe ripristinate.
   Da usare solo su un progetto nuovo: le tabelle del backup vengono
   svuotate e riempite (il controllo sulle pratiche impedisce di farlo per
   errore sul database in uso).

   Prova: banco locale Postgres (Registro issue e test, «Prove del database»).
   Registro sviluppo e deploy: capitolo «Servizi e configurazione», backup.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const [cartella, uscita = "ripristino_dati.sql"] = process.argv.slice(2);
if (!cartella || !fs.existsSync(cartella)) {
  console.error("Uso: node strumenti/backup/genera_sql_ripristino.mjs <cartella 2_database | database_completo.json> [file.sql]");
  process.exit(1);
}
// Fonte dei dati: una cartella con un file JSON per tabella (backup
// automatico) oppure un solo file con tutte le tabelle (backup manuale).
const unico = fs.statSync(cartella).isFile() ? JSON.parse(fs.readFileSync(cartella, "utf8")) : null;
const leggiTabella = (t) => (unico ? unico.tabelle[t] || [] : JSON.parse(fs.readFileSync(path.join(cartella, `${t}.json`), "utf8")));

// Delimitatore dei testi JSON nel SQL (dollar quoting): non compare nei dati.
const D = "$cwp_json$";
const RIGHE_PER_BLOCCO = 2000;
const righe = [];
const scrivi = (s) => righe.push(s);

scrivi("-- Ripristino dei dati del Portale CWP da un backup automatico");
scrivi(`-- Generato il ${new Date().toISOString()} da ${unico ? path.basename(cartella) : path.basename(path.resolve(cartella, ".."))}`);
scrivi("-- Eseguire DOPO tutti gli script numerati (01 e seguenti), su un progetto nuovo.");
scrivi("set session_replication_role = replica;");
scrivi("");
// Funzione temporanea: inserisce le righe di una tabella se la tabella esiste.
// Prima tutte insieme; se una riga non entra (per esempio un vincolo di
// controllo che un dato vecchio non rispetta) si riprova riga per riga e le
// righe rifiutate si elencano come avvisi, senza fermare il ripristino.
scrivi(`create or replace function pg_temp.cwp_ripristina(p_tabella text, p_dati jsonb)
returns int language plpgsql as $f$
declare n int := 0; r jsonb;
begin
  if coalesce(current_setting('cwp.ripristino', true), '') <> 'si' then
    return 0; -- controllo iniziale non superato: nessuna modifica
  end if;
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = p_tabella) then
    raise notice 'Tabella % assente nel database: saltata', p_tabella;
    return 0;
  end if;
  begin
    execute format('insert into public.%I overriding system value select * from jsonb_populate_recordset(null::public.%I, $1)', p_tabella, p_tabella) using p_dati;
    get diagnostics n = row_count;
  exception when others then
    n := 0;
    for r in select value from jsonb_array_elements(p_dati) loop
      begin
        execute format('insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I, $1)', p_tabella, p_tabella) using r;
        n := n + 1;
      exception when others then
        raise warning 'RIGA NON RIPRISTINATA in %: % — %', p_tabella, sqlerrm, left(r::text, 300);
      end;
    end loop;
  end;
  return n;
end $f$;`);
scrivi("");

// Tabelle presenti nel backup.
const tabelle = (unico
  ? Object.keys(unico.tabelle || {})
  : fs
      .readdirSync(cartella)
      .filter((f) => f.endsWith(".json") && !["auth_utenti.json", "conteggi.json"].includes(f))
      .map((f) => f.replace(/\.json$/, ""))
).sort();
// Il ripristino SOSTITUISCE il contenuto delle tabelle (anche le righe
// predefinite create dagli script, come durate delle fasi e impostazioni,
// che nel backup hanno i valori in uso). Per sicurezza si ferma se il
// database contiene già pratiche: va fatto su un progetto nuovo.
scrivi(`do $f$
declare elenco text;
begin
  if exists (select 1 from public.pratica) then
    raise warning 'RIPRISTINO NON ESEGUITO: il database contiene già delle pratiche. Si ripristina solo su un progetto Supabase NUOVO (script numerati appena eseguiti). Nessuna modifica fatta.';
    return;
  end if;
  select string_agg(format('public.%I', tablename), ', ') into elenco
    from pg_tables where schemaname = 'public' and tablename = any (array[${tabelle.map((t) => `'${t}'`).join(", ")}]);
  if elenco is not null then execute 'truncate ' || elenco || ' cascade'; end if;
  -- Via libera per le istruzioni che seguono (valido solo in questa sessione).
  perform set_config('cwp.ripristino', 'si', false);
end $f$;`);
scrivi("");

// Utenti dell'autenticazione (prima di profilo e associazioni).
const fileUtenti = unico ? null : path.join(cartella, "auth_utenti.json");
if (unico ? Array.isArray(unico.auth_utenti) : fs.existsSync(fileUtenti)) {
  const utenti = unico ? unico.auth_utenti : JSON.parse(fs.readFileSync(fileUtenti, "utf8"));
  scrivi(`-- Utenti dell'autenticazione: ${utenti.length} (senza password)`);
  scrivi(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, banned_until)
select '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated', u->>'email', '',
       (u->>'email_confirmed_at')::timestamptz, (u->>'created_at')::timestamptz, now(),
       coalesce(u->'app_metadata', '{"provider":"email","providers":["email"]}'::jsonb), coalesce(u->'user_metadata', '{}'::jsonb),
       (u->>'banned_until')::timestamptz
  from jsonb_array_elements(${D}${JSON.stringify(utenti)}${D}::jsonb) u
 where current_setting('cwp.ripristino', true) = 'si'
on conflict (id) do nothing;`);
  scrivi(`insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select gen_random_uuid(), (u->>'id')::uuid, u->>'id', 'email',
       jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', (u->>'email_confirmed_at') is not null),
       (u->>'created_at')::timestamptz, now()
  from jsonb_array_elements(${D}${JSON.stringify(utenti)}${D}::jsonb) u
 where current_setting('cwp.ripristino', true) = 'si'
   and not exists (select 1 from auth.identities i where i.user_id = (u->>'id')::uuid and i.provider = 'email');`);
  scrivi("");
}

scrivi("");
const attese = {};
for (const t of tabelle) {
  const dati = leggiTabella(t);
  attese[t] = dati.length;
  if (!dati.length) continue;
  scrivi(`-- ${t}: ${dati.length} righe`);
  for (let i = 0; i < dati.length; i += RIGHE_PER_BLOCCO) {
    const blocco = JSON.stringify(dati.slice(i, i + RIGHE_PER_BLOCCO));
    if (blocco.includes(D)) throw new Error(`Il delimitatore ${D} compare nei dati di ${t}: cambiarlo nello script.`);
    scrivi(`select pg_temp.cwp_ripristina('${t}', ${D}${blocco}${D}::jsonb);`);
  }
}
scrivi("");

// 3. Contatori delle colonne identity allineati al valore massimo.
scrivi(`do $f$
declare c record; m bigint;
begin
  for c in select table_name, column_name from information_schema.columns
            where table_schema = 'public' and is_identity = 'YES'
  loop
    execute format('select max(%I) from public.%I', c.column_name, c.table_name) into m;
    if m is not null then
      perform setval(pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name), m);
    end if;
  end loop;
end $f$;`);
scrivi("set session_replication_role = origin;");
scrivi("");
// 4. Verifica: righe attese (dal backup) e presenti.
scrivi("-- Verifica: righe nel backup e righe ora presenti");
const confronto = tabelle
  .map((t) => `select '${t}' as tabella, ${attese[t]} as nel_backup, (select count(*) from public.${t}) as presenti where to_regclass('public.${t}') is not null`)
  .join("\nunion all ");
if (confronto) scrivi(confronto + "\norder by 1;");

fs.writeFileSync(uscita, righe.join("\n") + "\n");
console.log(`Scritto ${uscita}: ${tabelle.length} tabelle, ${Object.values(attese).reduce((a, b) => a + b, 0)} righe.`);
