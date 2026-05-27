-- Estudiantes (login) + matrículas en cursos
-- Requiere: 01-schema-core.sql, 05-courses.sql

-- Matrícula estudiante ↔ curso (varios cursos por estudiante)
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'withdrawn')),
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index if not exists enrollments_student_id_idx on public.enrollments (student_id);
create index if not exists enrollments_course_id_idx on public.enrollments (course_id);

comment on table public.enrollments is 'Matrícula de estudiantes en cursos';

-- Código estudiante ZAO-YYYY-###
create or replace function public.generate_student_code ()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next int;
begin
  select coalesce(
    max(
      nullif(
        regexp_replace(student_id, '^ZAO-' || v_year || '-', ''),
        ''
      )::int
    ),
    0
  ) + 1
  into v_next
  from public.profiles
  where role = 'student'
    and student_id ~ ('^ZAO-' || v_year || '-[0-9]+$');

  return 'ZAO-' || v_year || '-' || lpad(v_next::text, 3, '0');
end;
$$;

-- Crear estudiante (Auth + perfil, puede iniciar sesión)
-- Clave inicial = teléfono; debe cambiar contraseña en el primer acceso
create or replace function public.admin_create_student_user (
  p_email text,
  p_full_name text,
  p_phone text,
  p_student_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_role text;
  v_profile public.profiles;
  v_code text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select p.role into v_caller_role from public.profiles as p where p.id = auth.uid();
  if v_caller_role is distinct from 'admin' then
    raise exception 'Solo administradores pueden crear estudiantes';
  end if;

  v_phone := trim(p_phone);
  if length(v_phone) < 6 then
    raise exception 'El teléfono debe tener al menos 6 caracteres (se usa como clave inicial)';
  end if;

  v_code := nullif(trim(p_student_id), '');
  if v_code is null then
    v_code := public.generate_student_code();
  end if;

  perform public.zao_seed_auth_user(
    trim(p_email),
    v_phone,
    jsonb_build_object(
      'role', 'student',
      'full_name', trim(p_full_name),
      'phone', v_phone,
      'student_id', v_code,
      'needs_profile_update', true
    )
  );

  v_profile := public.zao_upsert_profile(
    trim(p_email),
    trim(p_full_name),
    v_phone,
    'student',
    v_code,
    true
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'role', v_profile.role,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'student_id', v_profile.student_id
  );
end;
$$;

-- Sincronizar matrículas (uno o varios cursos)
create or replace function public.admin_sync_student_enrollments (
  p_student_id uuid,
  p_course_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_student_role text;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select p.role into v_caller_role from public.profiles as p where p.id = auth.uid();
  if v_caller_role is distinct from 'admin' then
    raise exception 'Solo administradores pueden matricular';
  end if;

  select p.role into v_student_role from public.profiles as p where p.id = p_student_id;
  if v_student_role is distinct from 'student' then
    raise exception 'El perfil no es de un estudiante';
  end if;

  delete from public.enrollments as e
  where e.student_id = p_student_id
    and e.status = 'active'
    and not (e.course_id = any (coalesce(p_course_ids, array[]::uuid[])));

  insert into public.enrollments (student_id, course_id, status)
  select p_student_id, c.id, 'active'
  from unnest(coalesce(p_course_ids, array[]::uuid[])) as cid (id)
  join public.courses as c on c.id = cid.id
  on conflict (student_id, course_id) do update
  set status = 'active', enrolled_at = now();

  select count(*)::int into v_count
  from public.enrollments as e
  where e.student_id = p_student_id and e.status = 'active';

  return jsonb_build_object('student_id', p_student_id, 'active_enrollments', v_count);
end;
$$;

grant execute on function public.admin_create_student_user (text, text, text, text) to authenticated;
grant execute on function public.admin_sync_student_enrollments (uuid, uuid[]) to authenticated;

-- RLS enrollments
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_admin_all" on public.enrollments;
create policy "enrollments_admin_all"
  on public.enrollments for all
  using (public.is_admin ())
  with check (public.is_admin ());

drop policy if exists "enrollments_student_select" on public.enrollments;
create policy "enrollments_student_select"
  on public.enrollments for select
  using (student_id = auth.uid ());

drop policy if exists "enrollments_teacher_select" on public.enrollments;
create policy "enrollments_teacher_select"
  on public.enrollments for select
  using (
    exists (
      select 1 from public.courses as c
      where c.id = course_id and c.teacher_id = auth.uid ()
    )
  );

-- Admin ya lee todos los profiles; estudiantes listados por role=student en cliente

select 'enrollments' as tabla, count(*) as columnas
from information_schema.columns
where table_schema = 'public' and table_name = 'enrollments';
