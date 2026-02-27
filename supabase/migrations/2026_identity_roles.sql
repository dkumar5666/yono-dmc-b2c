begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'agent', 'supplier', 'admin')),
  full_name text,
  email text,
  phone text,
  company_name text,
  city text,
  country text default 'India',
  status text not null default 'active' check (status in ('active', 'pending', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_name text,
  gst_number text,
  pan_number text,
  office_address text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  supplier_type text,
  business_name text,
  service_areas text,
  api_enabled boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_phone on public.profiles(phone);
create index if not exists idx_agent_profiles_verification_status on public.agent_profiles(verification_status);
create index if not exists idx_supplier_profiles_verification_status on public.supplier_profiles(verification_status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name_value text;
begin
  full_name_value := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, new.phone, ''), '@', 1),
    'User'
  );

  insert into public.profiles (
    id,
    role,
    full_name,
    email,
    phone
  )
  values (
    new.id,
    'customer',
    full_name_value,
    new.email,
    new.phone
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.supplier_profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

create policy profiles_self_select
on public.profiles
for select
using (id = auth.uid());

create policy profiles_self_insert
on public.profiles
for insert
with check (id = auth.uid());

create policy profiles_self_update
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists agent_profiles_self_select on public.agent_profiles;
drop policy if exists agent_profiles_self_insert on public.agent_profiles;
drop policy if exists agent_profiles_self_update on public.agent_profiles;

create policy agent_profiles_self_select
on public.agent_profiles
for select
using (id = auth.uid());

create policy agent_profiles_self_insert
on public.agent_profiles
for insert
with check (id = auth.uid());

create policy agent_profiles_self_update
on public.agent_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists supplier_profiles_self_select on public.supplier_profiles;
drop policy if exists supplier_profiles_self_insert on public.supplier_profiles;
drop policy if exists supplier_profiles_self_update on public.supplier_profiles;

create policy supplier_profiles_self_select
on public.supplier_profiles
for select
using (id = auth.uid());

create policy supplier_profiles_self_insert
on public.supplier_profiles
for insert
with check (id = auth.uid());

create policy supplier_profiles_self_update
on public.supplier_profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'agent_profiles', 'supplier_profiles']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
  end loop;
end $$;

commit;
