-- DEPRECADO: usar supabase/seed-usuarios-prueba.sql (crea auth.users + profiles)
-- Este archivo solo conserva la función de perfil por compatibilidad.

create or replace function public.seed_profile_for_email (
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
    raise exception 'Rol inválido: % (use admin, teacher o student)', p_role;
  end if;

  select u.id, u.email
  into v_user_id, v_user_email
  from auth.users as u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception
      'No existe usuario en Authentication con email "%". '
      'Créalo en Dashboard → Authentication → Users (Auto Confirm).',
      p_email;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    student_id,
    needs_profile_update
  )
  values (
    v_user_id,
    v_user_email,
    p_full_name,
    p_phone,
    p_role,
    p_student_id,
    p_needs_update
  )
  on conflict (id) do update
  set
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

-- Permisos para ejecutar desde SQL Editor y desde el cliente
grant execute on function public.seed_profile_for_email (text, text, text, text, text, boolean) to postgres, service_role;
