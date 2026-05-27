-- Solo si ya ejecutaste 05-courses.sql con price >= 0
-- Actualiza la regla: precio en USD, obligatoriamente mayor a 0

alter table public.courses drop constraint if exists courses_price_check;

alter table public.courses
  add constraint courses_price_check check (price > 0);

comment on column public.courses.price is 'Precio en USD (mayor a 0)';
