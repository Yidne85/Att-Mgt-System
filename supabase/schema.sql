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


-- User profiles: roles per organization (admin/support) + username
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  username text not null,
  role text not null check (role in ('admin','support')),
  created_at timestamptz not null default now(),
  unique (org_id, username)
);

create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  student_uid text not null unique,
  full_name text not null,
  gender text not null default 'unknown',
  qr_data_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_students (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);


create table if not exists public.class_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null default 'Class session',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
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
  e.ends_at,
  s.id as student_id,
  s.full_name,
  coalesce(t.points, 0) as points
from public.class_events e
join public.class_students cs on cs.class_id = e.class_id
join public.students s on s.id = cs.student_id
left join public.attendance a on a.event_id = e.id and a.student_id = s.id
left join public.classes c on c.id = e.class_id
left join public.orgs o on o.id = c.org_id
left join public.attendance_types t on t.org_id = o.id and t.name = coalesce(a.status, 'absent');


-- RLS (Row Level Security) - keep data private per admin/org
alter table public.orgs enable row level security;
alter table public.user_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_events enable row level security;
alter table public.attendance_types enable row level security;
alter table public.attendance enable row level security;

-- Helper predicates
create or replace function public.is_org_member(p_org uuid, p_user uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_profiles up
    where up.org_id = p_org and up.user_id = p_user
  );
$$;

create or replace function public.is_org_admin(p_org uuid, p_user uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_profiles up
    where up.org_id = p_org and up.user_id = p_user and up.role = 'admin'
  );
$$;

-- Policies:
-- orgs: members can read; only owner(admin) can write
drop policy if exists "orgs owner read" on public.orgs;
drop policy if exists "orgs owner write" on public.orgs;

create policy "orgs member read" on public.orgs for select
  using (public.is_org_member(id, auth.uid()) or owner_user_id = auth.uid());

create policy "orgs admin write" on public.orgs for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- user_profiles: self read; org admins manage
drop policy if exists "profiles self read" on public.user_profiles;
drop policy if exists "profiles admin read" on public.user_profiles;
drop policy if exists "profiles admin write" on public.user_profiles;
drop policy if exists "profiles admin update" on public.user_profiles;
drop policy if exists "profiles admin delete" on public.user_profiles;

create policy "profiles self read" on public.user_profiles for select
  using (user_id = auth.uid());

create policy "profiles admin read" on public.user_profiles for select
  using (public.is_org_admin(org_id, auth.uid()));

create policy "profiles admin write" on public.user_profiles for insert
  with check (public.is_org_admin(org_id, auth.uid()));

create policy "profiles admin update" on public.user_profiles for update
  using (public.is_org_admin(org_id, auth.uid()))
  with check (public.is_org_admin(org_id, auth.uid()));

create policy "profiles admin delete" on public.user_profiles for delete
  using (public.is_org_admin(org_id, auth.uid()));

-- classes: members read; admins write
drop policy if exists "classes read" on public.classes;
drop policy if exists "classes write" on public.classes;
drop policy if exists "classes admin write" on public.classes;

create policy "classes read" on public.classes for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "classes admin write" on public.classes for all
  using (public.is_org_admin(org_id, auth.uid()))
  with check (public.is_org_admin(org_id, auth.uid()));

-- students: members read; admins write
drop policy if exists "students read" on public.students;
drop policy if exists "students write" on public.students;
drop policy if exists "students admin write" on public.students;

create policy "students read" on public.students for select
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and public.is_org_member(c.org_id, auth.uid())
  ));

create policy "students admin write" on public.students for all
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and public.is_org_admin(c.org_id, auth.uid())
  ))
  with check (exists (
    select 1 from public.classes c
    where c.id = class_id and public.is_org_admin(c.org_id, auth.uid())
  ));

-- class_events: members (admin/support) can read/insert/update; only admins delete
drop policy if exists "events read" on public.class_events;
drop policy if exists "events write" on public.class_events;
drop policy if exists "events member insert" on public.class_events;
drop policy if exists "events member update" on public.class_events;
drop policy if exists "events admin delete" on public.class_events;

create policy "events read" on public.class_events for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "events member insert" on public.class_events for insert
  with check (public.is_org_member(org_id, auth.uid()));

create policy "events member update" on public.class_events for update
  using (public.is_org_member(org_id, auth.uid()))
  with check (public.is_org_member(org_id, auth.uid()));

create policy "events admin delete" on public.class_events for delete
  using (public.is_org_admin(org_id, auth.uid()));

-- attendance_types: members read; admins write
drop policy if exists "types read" on public.attendance_types;
drop policy if exists "types write" on public.attendance_types;
drop policy if exists "types admin write" on public.attendance_types;

create policy "types read" on public.attendance_types for select
  using (public.is_org_member(org_id, auth.uid()));

create policy "types admin write" on public.attendance_types for all
  using (public.is_org_admin(org_id, auth.uid()))
  with check (public.is_org_admin(org_id, auth.uid()));

-- attendance: members read/insert/update; admins delete
drop policy if exists "attendance read" on public.attendance;
drop policy if exists "attendance write" on public.attendance;
drop policy if exists "attendance member write" on public.attendance;
drop policy if exists "attendance member update" on public.attendance;
drop policy if exists "attendance admin delete" on public.attendance;

create policy "attendance read" on public.attendance for select
  using (exists (
    select 1 from public.class_events e
    join public.classes c on c.id = e.class_id
    where e.id = event_id and public.is_org_member(c.org_id, auth.uid())
  ));

create policy "attendance member write" on public.attendance for insert
  with check (exists (
    select 1 from public.class_events e
    join public.classes c on c.id = e.class_id
    where e.id = event_id and public.is_org_member(c.org_id, auth.uid())
  ));

create policy "attendance member update" on public.attendance for update
  using (exists (
    select 1 from public.class_events e
    join public.classes c on c.id = e.class_id
    where e.id = event_id and public.is_org_member(c.org_id, auth.uid())
  ))
  with check (exists (
    select 1 from public.class_events e
    join public.classes c on c.id = e.class_id
    where e.id = event_id and public.is_org_member(c.org_id, auth.uid())
  ));

create policy "attendance admin delete" on public.attendance for delete
  using (exists (
    select 1 from public.class_events e
    join public.classes c on c.id = e.class_id
    where e.id = event_id and public.is_org_admin(c.org_id, auth.uid())
  ));


-- VIEW: attendance detail joined with events (for date-range summaries)
create or replace view public.attendance_detail_view as
select
  e.id as event_id,
  e.class_id,
  e.title as event_title,
  e.starts_at,
  e.ends_at,
  a.student_id,
  s.full_name,
  a.status,
  a.checked_in_at
from public.attendance a
join public.class_events e on e.id = a.event_id
join public.students s on s.id = a.student_id;


