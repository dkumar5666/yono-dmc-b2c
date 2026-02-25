-- Booking-Centric Travel Operating System (TOS)
-- Target: Supabase Postgres
-- Lifecycle-first schema centered on booking_id

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_lifecycle_status') then
    create type booking_lifecycle_status as enum (
      'lead_created',
      'quotation_sent',
      'quotation_approved',
      'booking_created',
      'payment_pending',
      'payment_confirmed',
      'supplier_confirmed',
      'documents_generated',
      'completed',
      'cancelled',
      'refunded'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type record_status as enum ('active', 'inactive', 'archived');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  phone text,
  full_name text,
  role text not null check (role in ('customer', 'admin', 'staff', 'supplier', 'ops', 'finance')),
  branch_code text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete set null,
  customer_code text unique not null,
  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  nationality text,
  preferred_currency char(3) not null default 'INR',
  status record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text unique not null,
  supplier_type text not null check (
    supplier_type in ('airline', 'hotel', 'activity', 'transport', 'visa', 'insurance', 'dmc_partner', 'other')
  ),
  legal_name text not null,
  trade_name text,
  contact_email text,
  contact_phone text,
  default_currency char(3) not null default 'USD',
  api_enabled boolean not null default false,
  api_provider text,
  status record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  source text not null default 'website',
  destination_country text,
  destination_city text,
  travel_start_date date,
  travel_end_date date,
  pax_adults integer not null default 1 check (pax_adults >= 0),
  pax_children integer not null default 0 check (pax_children >= 0),
  notes text,
  status text not null check (
    status in ('lead_created', 'qualified', 'quotation_sent', 'won', 'lost', 'archived')
  ) default 'lead_created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_code text unique not null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid,
  version integer not null default 1,
  currency_code char(3) not null default 'INR',
  total_amount numeric(14,2) not null default 0,
  supplier_cost_amount numeric(14,2) not null default 0,
  margin_amount numeric(14,2) not null default 0,
  expires_at timestamptz,
  terms text,
  status text not null check (status in ('draft', 'sent', 'approved', 'rejected', 'expired')) default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_code text unique not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  travelers_count integer not null default 1 check (travelers_count > 0),
  status text not null check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')) default 'upcoming',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  booking_channel text not null default 'web' check (booking_channel in ('web', 'admin', 'api', 'agent')),
  booking_mode text not null default 'ota' check (booking_mode in ('ota', 'dmc', 'mixed')),
  lifecycle_status booking_lifecycle_status not null default 'booking_created',
  payment_status text not null default 'payment_pending' check (
    payment_status in ('payment_pending', 'partially_paid', 'paid', 'refund_pending', 'refunded', 'failed')
  ),
  supplier_status text not null default 'pending' check (
    supplier_status in ('pending', 'partially_confirmed', 'confirmed', 'failed', 'cancelled')
  ),
  currency_code char(3) not null default 'INR',
  gross_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  due_amount numeric(14,2) not null default 0,
  refund_amount numeric(14,2) not null default 0,
  travel_start_date date,
  travel_end_date date,
  pnr_primary text,
  supplier_confirmation_reference text,
  external_reference text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

alter table public.quotations
  add constraint quotations_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  product_type text not null check (
    product_type in ('flight', 'hotel', 'activity', 'transfer', 'visa', 'insurance', 'package', 'ground_service')
  ),
  name text not null,
  description text,
  destination_country text,
  destination_city text,
  default_currency char(3) not null default 'USD',
  base_price numeric(14,2),
  status record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  item_type text not null check (
    item_type in ('flight', 'hotel', 'activity', 'transfer', 'visa', 'insurance', 'package', 'ground_service')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'quoted', 'booked', 'confirmed', 'ticketed', 'cancelled', 'refunded')
  ),
  currency_code char(3) not null default 'INR',
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  supplier_cost_amount numeric(14,2) not null default 0,
  service_start_at timestamptz,
  service_end_at timestamptz,
  supplier_confirmation_reference text,
  supplier_pnr text,
  ticket_numbers text[],
  external_item_id text,
  traveler_details jsonb not null default '[]'::jsonb,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  provider text not null check (provider in ('razorpay', 'stripe', 'manual', 'bank_transfer')),
  idempotency_key text unique,
  webhook_event_id text unique,
  provider_order_id text,
  provider_payment_intent_id text,
  provider_payment_id text,
  provider_signature text,
  currency_code char(3) not null default 'INR',
  amount numeric(14,2) not null default 0,
  amount_captured numeric(14,2) not null default 0,
  amount_refunded numeric(14,2) not null default 0,
  status text not null default 'created' check (
    status in (
      'created',
      'requires_action',
      'authorized',
      'captured',
      'failed',
      'cancelled',
      'partially_refunded',
      'refunded'
    )
  ),
  paid_at timestamptz,
  failed_reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_refund_id text,
  currency_code char(3) not null default 'INR',
  amount numeric(14,2) not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  invoice_number text unique not null,
  currency_code char(3) not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void', 'paid', 'partially_paid', 'refunded')),
  issued_at timestamptz,
  due_at timestamptz,
  pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  quotation_id uuid references public.quotations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  type text not null check (type in ('invoice', 'voucher', 'itinerary', 'ticket', 'visa', 'insurance', 'other')),
  status text not null default 'generated' check (status in ('generated', 'uploaded', 'failed', 'archived')),
  version integer not null default 1,
  storage_bucket text,
  storage_path text,
  public_url text,
  mime_type text,
  checksum text,
  generated_by uuid references public.users(id),
  generated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  title text not null,
  summary text,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  day_plan jsonb not null default '[]'::jsonb,
  pdf_document_id uuid references public.documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  unique (booking_id, version)
);

create table if not exists public.ground_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  booking_item_id uuid references public.booking_items(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  service_type text not null check (
    service_type in ('transfer', 'meet_and_greet', 'visa_assistance', 'guide', 'insurance', 'other')
  ),
  service_date date,
  pickup_location text,
  dropoff_location text,
  status text not null default 'requested' check (status in ('requested', 'assigned', 'confirmed', 'completed', 'cancelled')),
  confirmation_reference text,
  currency_code char(3) not null default 'INR',
  cost_amount numeric(14,2) not null default 0,
  sell_amount numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table if not exists public.booking_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status booking_lifecycle_status,
  to_status booking_lifecycle_status not null,
  event_name text not null,
  actor_type text not null check (actor_type in ('system', 'customer', 'admin', 'supplier', 'webhook')),
  actor_id uuid,
  idempotency_key text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (booking_id, idempotency_key)
);

create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_lifecycle_status on public.bookings(lifecycle_status);
create index if not exists idx_bookings_payment_status on public.bookings(payment_status);
create index if not exists idx_booking_items_booking_id on public.booking_items(booking_id);
create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_payments_provider_payment_id on public.payments(provider_payment_id);
create index if not exists idx_documents_booking_id on public.documents(booking_id);
create index if not exists idx_itineraries_booking_id on public.itineraries(booking_id);
create index if not exists idx_ground_services_booking_id on public.ground_services(booking_id);
create index if not exists idx_lifecycle_events_booking_id on public.booking_lifecycle_events(booking_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users',
    'customers',
    'suppliers',
    'leads',
    'quotations',
    'trips',
    'bookings',
    'products',
    'booking_items',
    'payments',
    'payment_refunds',
    'invoices',
    'documents',
    'itineraries',
    'ground_services'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
  end loop;
end $$;
