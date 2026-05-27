-- Diagnóstico — ejecutar para ver qué existe en tu proyecto

-- 1) ¿Existe la tabla?
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) Columnas de profiles (si existe)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

-- 3) Políticas RLS
select polname, polcmd
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'profiles';

-- 4) Trigger en auth.users
select tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;

-- 5) Cuántos perfiles hay
select count(*) as total_profiles from public.profiles;
