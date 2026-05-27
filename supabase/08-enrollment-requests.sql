-- Solicitudes de matrícula (estudiante → revisión admin)
-- Requiere: 01, 05-courses, 06-students-enrollments

create table if not exists public.enrollment_requests (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  message text,
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now ()
);

create index if not exists enrollment_requests_student_idx on public.enrollment_requests (student_id);
create index if not exists enrollment_requests_course_idx on public.enrollment_requests (course_id);
create index if not exists enrollment_requests_status_idx on public.enrollment_requests (status);

-- Solo una solicitud pendiente por estudiante y curso
create unique index if not exists enrollment_requests_one_pending_idx
  on public.enrollment_requests (student_id, course_id)
  where status = 'pending';

comment on table public.enrollment_requests is 'Solicitudes de matrícula pendientes de aprobación admin';

-- Estudiante envía solicitud
create or replace function public.student_submit_enrollment_request (
  p_course_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_course public.courses;
  v_request public.enrollment_requests;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select p.role into v_role from public.profiles as p where p.id = auth.uid();
  if v_role is distinct from 'student' then
    raise exception 'Solo estudiantes pueden solicitar matrícula';
  end if;

  select * into v_course from public.courses as c where c.id = p_course_id;
  if v_course.id is null then
    raise exception 'Curso no encontrado';
  end if;
  if not v_course.is_active then
    raise exception 'Este curso no está disponible para matrícula';
  end if;

  if exists (
    select 1 from public.enrollments as e
    where e.student_id = auth.uid()
      and e.course_id = p_course_id
      and e.status = 'active'
  ) then
    raise exception 'Ya estás matriculado en este curso';
  end if;

  if exists (
    select 1 from public.enrollment_requests as r
    where r.student_id = auth.uid()
      and r.course_id = p_course_id
      and r.status = 'pending'
  ) then
    raise exception 'Ya tienes una solicitud pendiente para este curso';
  end if;

  insert into public.enrollment_requests (student_id, course_id, message, status)
  values (auth.uid(), p_course_id, nullif(trim(p_message), ''), 'pending')
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'course_id', v_request.course_id,
    'status', v_request.status,
    'created_at', v_request.created_at
  );
end;
$$;

-- Admin aprueba o rechaza
create or replace function public.admin_review_enrollment_request (
  p_request_id uuid,
  p_approve boolean,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.enrollment_requests;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_admin() then
    raise exception 'Solo administradores pueden revisar solicitudes';
  end if;

  select * into v_request
  from public.enrollment_requests as r
  where r.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_request.status is distinct from 'pending' then
    raise exception 'Esta solicitud ya fue procesada';
  end if;

  if p_approve then
    insert into public.enrollments (student_id, course_id, status)
    values (v_request.student_id, v_request.course_id, 'active')
    on conflict (student_id, course_id) do update
    set status = 'active', enrolled_at = now();

    update public.enrollment_requests
    set
      status = 'approved',
      admin_notes = nullif(trim(p_admin_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where id = p_request_id
    returning * into v_request;
  else
    update public.enrollment_requests
    set
      status = 'rejected',
      admin_notes = nullif(trim(p_admin_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
    where id = p_request_id
    returning * into v_request;
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'student_id', v_request.student_id,
    'course_id', v_request.course_id
  );
end;
$$;

grant execute on function public.student_submit_enrollment_request (uuid, text) to authenticated;
grant execute on function public.admin_review_enrollment_request (uuid, boolean, text) to authenticated;

-- RLS
alter table public.enrollment_requests enable row level security;

drop policy if exists "enrollment_requests_student_select" on public.enrollment_requests;
create policy "enrollment_requests_student_select"
  on public.enrollment_requests for select
  using (student_id = auth.uid ());

drop policy if exists "enrollment_requests_admin_all" on public.enrollment_requests;
create policy "enrollment_requests_admin_all"
  on public.enrollment_requests for all
  using (public.is_admin ())
  with check (public.is_admin ());

select 'enrollment_requests' as tabla, count(*) as columnas
from information_schema.columns
where table_schema = 'public' and table_name = 'enrollment_requests';
