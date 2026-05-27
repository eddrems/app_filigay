-- SEED completo: auth.users + auth.identities + public.profiles
--
-- Requisito: 01-schema-core.sql ejecutado antes
-- Ejecutar TODO este archivo en SQL Editor
--
-- Credenciales de prueba:
--   admin@zao.edu      / admin123
--   maestro@zao.edu    / prof123
--   estudiante@zao.edu / alum123

create extension if not exists "pgcrypto" with schema extensions;

-- ─── Crear usuario en Auth (users + identities) ───
create or replace function public.zao_seed_auth_user (
  p_email text,
  p_password text,
  p_user_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
  v_instance_id uuid;
begin
  select u.id into v_user_id
  from auth.users as u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is not null then
    return v_user_id;
  end if;

  select i.id into v_instance_id from auth.instances as i limit 1;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  values (
    v_user_id,
    v_instance_id,
    'authenticated',
    'authenticated',
    trim(p_email),
    v_encrypted_pw,
    now(),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    p_user_meta,
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    trim(p_email),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', trim(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  return v_user_id;
end;
$$;

-- ─── Crear / actualizar perfil (requiere usuario en Auth) ───
create or replace function public.zao_upsert_profile (
  p_email text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_student_id text default null,
  p_needs_update boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_row public.profiles;
begin
  if p_role not in ('admin', 'teacher', 'student') then
    raise exception 'Rol inválido: %', p_role;
  end if;

  select u.id, u.email into v_user_id, v_user_email
  from auth.users as u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'Usuario no encontrado en auth.users: %', p_email;
  end if;

  insert into public.profiles (
    id, email, full_name, phone, role, student_id, needs_profile_update
  )
  values (
    v_user_id, v_user_email, p_full_name, p_phone, p_role, p_student_id, p_needs_update
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    role = excluded.role,
    student_id = excluded.student_id,
    needs_profile_update = excluded.needs_profile_update,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.zao_seed_auth_user (text, text, jsonb) to postgres, service_role;
grant execute on function public.zao_upsert_profile (text, text, text, text, text, boolean) to postgres, service_role;

-- ═══════════════════════════════════════════════════════════════
-- ADMIN
-- ═══════════════════════════════════════════════════════════════
select public.zao_seed_auth_user(
  'admin@zao.edu',
  'admin123',
  '{"role":"admin","full_name":"Administrador ZAO"}'::jsonb
) as auth_id_admin;

select public.zao_upsert_profile(
  'admin@zao.edu', 'Administrador ZAO', 'admin123', 'admin', null, false
) as perfil_admin;

-- ═══════════════════════════════════════════════════════════════
-- DOCENTE
-- ═══════════════════════════════════════════════════════════════
select public.zao_seed_auth_user(
  'maestro@zao.edu',
  'prof123',
  '{"role":"teacher","full_name":"Prof. Carlos Mendoza"}'::jsonb
) as auth_id_docente;

select public.zao_upsert_profile(
  'maestro@zao.edu', 'Prof. Carlos Mendoza', 'prof123', 'teacher', null, false
) as perfil_docente;

-- ═══════════════════════════════════════════════════════════════
-- ESTUDIANTE
-- ═══════════════════════════════════════════════════════════════
select public.zao_seed_auth_user(
  'estudiante@zao.edu',
  '3001234567',
  '{"role":"student","full_name":"Alejandro Martínez","phone":"3001234567","needs_profile_update":true}'::jsonb
) as auth_id_estudiante;

select public.zao_upsert_profile(
  'estudiante@zao.edu', 'Alejandro Martínez', '3001234567', 'student', 'ZAO-2023-459', true
) as perfil_estudiante;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN (3 filas en cada consulta)
-- ═══════════════════════════════════════════════════════════════
select u.id, u.email, u.email_confirmed_at is not null as confirmado
from auth.users as u
where lower(u.email) in (
  'admin@zao.edu', 'maestro@zao.edu', 'estudiante@zao.edu'
)
order by u.email;

select p.id, p.email, p.role, p.full_name
from public.profiles as p
order by p.email;

select i.provider_id, i.provider, u.email
from auth.identities as i
join auth.users as u on u.id = i.user_id
where lower(u.email) in (
  'admin@zao.edu', 'maestro@zao.edu', 'estudiante@zao.edu'
);
