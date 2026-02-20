-- Run this in Supabase SQL Editor.
-- It creates the tables + views required by the app.

create extension if not exists "uuid-ossp";

-- Organization: one per admin account (owner)
create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_uid text not null unique,
  full_name text not null,
  gender text not null default 'unknown',
  qr_data_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null default 'Class session',
  starts_at timestamptz not null,
  late_after_minutes int not null default 15,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_types (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  points numeric not null default 0,
  -- Configurable time window (minutes) relative to event start:
  -- Example: present: 0-15, late: 15-null (open-ended)
  start_minute int not null default 0,
  end_minute int,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);


-- One check-in per student per event
create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.class_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  status text not null default 'present', -- present | late | absent
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

-- VIEW: attendance summary per event
create or replace view public.attendance_records_view as
select
  a.id as attendance_id,
  a.event_id,
  a.student_id,
  s.full_name,
  a.status,
  a.checked_in_at
from public.attendance a
join public.students s on s.id = a.student_id;

-- VIEW: points per attendance record based on status -> attendance_types
create or replace view public.points_report_view as
select
  e.id as event_id,
  e.class_id,
  e.starts_at,
  s.id as student_id,
  s.full_name,
  coalesce(t.points, 0) as points
from public.class_events e
join public.students s on s.class_id = e.class_id
left join public.attendance a on a.event_id = e.id and a.student_id = s.id
left join public.classes c on c.id = e.class_id
left join public.orgs o on o.id = c.org_id
left join public.attendance_types t on t.org_id = o.id and t.name = coalesce(a.status, 'absent');

-- RLS (Row Level Security) - keep data private per admin/org
alter table public.orgs enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_events enable row level security;
alter table public.attendance_types enable row level security;
alter table public.attendance enable row level security;

-- Policies:
-- orgs: owner only
create policy "orgs owner read" on public.orgs for select
  using (owner_user_id = auth.uid());

create policy "orgs owner write" on public.orgs for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- classes: allow via org ownership
create policy "classes read" on public.classes for select
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

create policy "classes write" on public.classes for all
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

-- students: allow via class->org ownership
create policy "students read" on public.students for select
  using (exists (
    select 1 from public.classes c
    join public.orgs o on o.id = c.org_id
    where c.id = class_id and o.owner_user_id = auth.uid()
  ));

create policy "students write" on public.students for all
  using (exists (
    select 1 from public.classes c
    join public.orgs o on o.id = c.org_id
    where c.id = class_id and o.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.classes c
    join public.orgs o on o.id = c.org_id
    where c.id = class_id and o.owner_user_id = auth.uid()
  ));

-- class_events
create policy "events read" on public.class_events for select
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

create policy "events write" on public.class_events for all
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

-- attendance_types
create policy "types read" on public.attendance_types for select
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

create policy "types write" on public.attendance_types for all
  using (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.orgs o where o.id = org_id and o.owner_user_id = auth.uid()));

-- attendance: allow via event->org ownership
create policy "attendance read" on public.attendance for select
  using (exists (
    select 1 from public.class_events e
    join public.orgs o on o.id = e.org_id
    where e.id = event_id and o.owner_user_id = auth.uid()
  ));

create policy "attendance write" on public.attendance for all
  using (exists (
    select 1 from public.class_events e
    join public.orgs o on o.id = e.org_id
    where e.id = event_id and o.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.class_events e
    join public.orgs o on o.id = e.org_id
    where e.id = event_id and o.owner_user_id = auth.uid()
  ));

-- VIEW: attendance detail joined with events (for date-range summaries)
create or replace view public.attendance_detail_view as
select
  e.id as event_id,
  e.class_id,
  e.title as event_title,
  e.starts_at,
  a.student_id,
  s.full_name,
  a.status,
  a.checked_in_at
from public.attendance a
join public.class_events e on e.id = a.event_id
join public.students s on s.id = a.student_id;


