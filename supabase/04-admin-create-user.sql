-- Ejecutar en SQL Editor (después de 01-schema-core.sql y seed)
-- Permite al admin crear usuarios con rol admin o teacher desde la app

create or replace function public.admin_create_staff_user (
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_role text;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select p.role into v_caller_role
  from public.profiles as p
  where p.id = auth.uid();

  if v_caller_role is distinct from 'admin' then
    raise exception 'Solo administradores pueden crear usuarios';
  end if;

  if p_role not in ('admin', 'teacher') then
    raise exception 'Solo se permiten roles: admin o teacher';
  end if;

  if length(trim(coalesce(p_password, ''))) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;

  perform public.zao_seed_auth_user(
    trim(p_email),
    p_password,
    jsonb_build_object(
      'role', p_role,
      'full_name', trim(p_full_name),
      'phone', trim(p_phone)
    )
  );

  v_profile := public.zao_upsert_profile(
    trim(p_email),
    trim(p_full_name),
    trim(p_phone),
    p_role,
    null,
    false
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'role', v_profile.role,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'created', true
  );
end;
$$;

grant execute on function public.admin_create_staff_user (text, text, text, text, text) to authenticated;

-- Listar staff (admin/teacher) — el admin ya puede leer vía profiles_select_admin
comment on function public.admin_create_staff_user is 'Crea usuario Auth + perfil (roles admin|teacher). Solo callable por admin.';
