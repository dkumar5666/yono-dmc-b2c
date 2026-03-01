create extension if not exists pgcrypto;

create table if not exists public.otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  ip text,
  user_agent text,
  status text not null check (status in ('sent', 'verified', 'failed', 'blocked')),
  provider text not null default 'twilio',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_requests_phone_created
on public.otp_requests (phone_e164, created_at desc);

create index if not exists idx_otp_requests_ip_created
on public.otp_requests (ip, created_at desc);

create table if not exists public.otp_blocks (
  key text primary key,
  blocked_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.otp_requests enable row level security;
alter table public.otp_blocks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'otp_requests'
      and policyname = 'otp_requests_client_deny_all'
  ) then
    execute 'create policy otp_requests_client_deny_all on public.otp_requests for all using (false) with check (false)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'otp_blocks'
      and policyname = 'otp_blocks_client_deny_all'
  ) then
    execute 'create policy otp_blocks_client_deny_all on public.otp_blocks for all using (false) with check (false)';
  end if;
end $$;
