-- Oferta académica: cursos
-- Ejecutar en SQL Editor después de 01-schema-core.sql

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover_image_url text,
  price numeric(12, 2) not null check (price > 0),
  teacher_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_teacher_id_idx on public.courses (teacher_id);
create index if not exists courses_is_active_idx on public.courses (is_active);

drop trigger if exists courses_updated_at on public.courses;
create trigger courses_updated_at
  before update on public.courses
  for each row
  execute function public.set_updated_at ();

comment on table public.courses is 'Oferta académica Escuela ZAO';
comment on column public.courses.price is 'Precio en USD (mayor a 0)';

-- Si ya ejecutaste una versión anterior con price >= 0:
-- alter table public.courses drop constraint if exists courses_price_check;
-- alter table public.courses add constraint courses_price_check check (price > 0);

-- RLS
alter table public.courses enable row level security;

drop policy if exists "courses_admin_all" on public.courses;
create policy "courses_admin_all"
  on public.courses for all
  using (public.is_admin ())
  with check (public.is_admin ());

drop policy if exists "courses_teacher_select" on public.courses;
create policy "courses_teacher_select"
  on public.courses for select
  using (teacher_id = auth.uid ());

drop policy if exists "courses_public_read_active" on public.courses;
create policy "courses_public_read_active"
  on public.courses for select
  using (is_active = true);

-- Storage: portadas de cursos (público lectura)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-covers',
  'course-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "course_covers_public_read" on storage.objects;
create policy "course_covers_public_read"
  on storage.objects for select
  using (bucket_id = 'course-covers');

drop policy if exists "course_covers_admin_insert" on storage.objects;
create policy "course_covers_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'course-covers' and public.is_admin ());

drop policy if exists "course_covers_admin_update" on storage.objects;
create policy "course_covers_admin_update"
  on storage.objects for update
  using (bucket_id = 'course-covers' and public.is_admin ());

drop policy if exists "course_covers_admin_delete" on storage.objects;
create policy "course_covers_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'course-covers' and public.is_admin ());

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'courses'
order by ordinal_position;
