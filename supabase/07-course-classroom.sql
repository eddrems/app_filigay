-- Cuaderno de clase: horarios, asistencia, actividades, entregas y notas
-- Ejecutar después de 05-courses.sql y 06-students-enrollments.sql

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.is_course_manager (p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_admin (), false)
    or exists (
      select 1
      from public.courses as c
      where c.id = p_course_id and c.teacher_id = auth.uid ()
    );
$$;

create or replace function public.is_enrolled_in_course (p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments as e
    where e.course_id = p_course_id
      and e.student_id = auth.uid ()
      and e.status = 'active'
  );
$$;

grant execute on function public.is_course_manager (uuid) to authenticated;
grant execute on function public.is_enrolled_in_course (uuid) to authenticated;

-- Docentes pueden ver perfiles de alumnos matriculados en sus cursos
drop policy if exists "profiles_teacher_students_select" on public.profiles;
create policy "profiles_teacher_students_select"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.enrollments as e
      inner join public.courses as c on c.id = e.course_id
      where e.student_id = profiles.id
        and e.status = 'active'
        and c.teacher_id = auth.uid ()
    )
  );

-- ─── Sesiones / horario de clase ───────────────────────────────────────────

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid (),
  course_id uuid not null references public.courses (id) on delete cascade,
  session_date date not null,
  start_time time not null default '19:00',
  end_time time,
  label text,
  created_at timestamptz not null default now (),
  unique (course_id, session_date, start_time)
);

create index if not exists course_sessions_course_date_idx
  on public.course_sessions (course_id, session_date);

comment on table public.course_sessions is 'Fechas y horas de clase por curso';

-- ─── Asistencia ────────────────────────────────────────────────────────────

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid (),
  session_id uuid not null references public.course_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'absent'
    check (status in ('present', 'absent', 'late', 'excused')),
  notes text,
  marked_at timestamptz not null default now (),
  marked_by uuid references public.profiles (id) on delete set null,
  unique (session_id, student_id)
);

create index if not exists attendance_records_session_idx
  on public.attendance_records (session_id);

-- ─── Actividades ───────────────────────────────────────────────────────────

create table if not exists public.course_activities (
  id uuid primary key default gen_random_uuid (),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  allow_online_submit boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now ()
);

create index if not exists course_activities_course_idx
  on public.course_activities (course_id, due_at);

-- ─── Entregas en línea (enlace) ────────────────────────────────────────────

create table if not exists public.activity_submissions (
  id uuid primary key default gen_random_uuid (),
  activity_id uuid not null references public.course_activities (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  submission_url text not null,
  notes text,
  submitted_at timestamptz not null default now (),
  unique (activity_id, student_id)
);

-- ─── Notas sobre 100 ───────────────────────────────────────────────────────

create table if not exists public.activity_grades (
  id uuid primary key default gen_random_uuid (),
  activity_id uuid not null references public.course_activities (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  feedback text,
  graded_at timestamptz not null default now (),
  graded_by uuid references public.profiles (id) on delete set null,
  unique (activity_id, student_id)
);

-- ─── RLS: course_sessions ──────────────────────────────────────────────────

alter table public.course_sessions enable row level security;

drop policy if exists "course_sessions_manager_all" on public.course_sessions;
create policy "course_sessions_manager_all"
  on public.course_sessions for all
  using (public.is_course_manager (course_id))
  with check (public.is_course_manager (course_id));

drop policy if exists "course_sessions_student_select" on public.course_sessions;
create policy "course_sessions_student_select"
  on public.course_sessions for select
  using (public.is_enrolled_in_course (course_id));

-- ─── RLS: attendance_records ───────────────────────────────────────────────

alter table public.attendance_records enable row level security;

drop policy if exists "attendance_manager_all" on public.attendance_records;
create policy "attendance_manager_all"
  on public.attendance_records for all
  using (
    exists (
      select 1
      from public.course_sessions as cs
      where cs.id = session_id and public.is_course_manager (cs.course_id)
    )
  )
  with check (
    exists (
      select 1
      from public.course_sessions as cs
      where cs.id = session_id and public.is_course_manager (cs.course_id)
    )
  );

drop policy if exists "attendance_student_select_own" on public.attendance_records;
create policy "attendance_student_select_own"
  on public.attendance_records for select
  using (student_id = auth.uid ());

-- ─── RLS: course_activities ──────────────────────────────────────────────────

alter table public.course_activities enable row level security;

drop policy if exists "course_activities_manager_all" on public.course_activities;
create policy "course_activities_manager_all"
  on public.course_activities for all
  using (public.is_course_manager (course_id))
  with check (public.is_course_manager (course_id));

drop policy if exists "course_activities_student_select" on public.course_activities;
create policy "course_activities_student_select"
  on public.course_activities for select
  using (public.is_enrolled_in_course (course_id));

-- ─── RLS: activity_submissions ─────────────────────────────────────────────

alter table public.activity_submissions enable row level security;

drop policy if exists "submissions_manager_select" on public.activity_submissions;
create policy "submissions_manager_select"
  on public.activity_submissions for select
  using (
    exists (
      select 1
      from public.course_activities as a
      where a.id = activity_id and public.is_course_manager (a.course_id)
    )
  );

drop policy if exists "submissions_student_all" on public.activity_submissions;
create policy "submissions_student_all"
  on public.activity_submissions for all
  using (student_id = auth.uid ())
  with check (
    student_id = auth.uid ()
    and exists (
      select 1
      from public.course_activities as a
      where a.id = activity_id
        and a.allow_online_submit = true
        and public.is_enrolled_in_course (a.course_id)
    )
  );

-- ─── RLS: activity_grades ────────────────────────────────────────────────────

alter table public.activity_grades enable row level security;

drop policy if exists "grades_manager_all" on public.activity_grades;
create policy "grades_manager_all"
  on public.activity_grades for all
  using (
    exists (
      select 1
      from public.course_activities as a
      where a.id = activity_id and public.is_course_manager (a.course_id)
    )
  )
  with check (
    exists (
      select 1
      from public.course_activities as a
      where a.id = activity_id and public.is_course_manager (a.course_id)
    )
  );

drop policy if exists "grades_student_select_own" on public.activity_grades;
create policy "grades_student_select_own"
  on public.activity_grades for select
  using (student_id = auth.uid ());

-- Verificación
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'course_sessions',
    'attendance_records',
    'course_activities',
    'activity_submissions',
    'activity_grades'
  )
order by table_name;
