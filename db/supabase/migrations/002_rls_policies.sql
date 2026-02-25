-- Strict RLS Policies for Booking-Centric TOS
-- Applies role-aware access controls for admin, customer, supplier

begin;

-- Supplier user mapping (needed for supplier-level JWT access checks)
alter table public.suppliers
  add column if not exists user_id uuid unique references public.users(id) on delete set null;

create index if not exists idx_suppliers_user_id on public.suppliers(user_id);

-- ---------- Helper functions ----------

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'user_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() ->> 'role', ''),
    'authenticated'
  );
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.suppliers s
  where s.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.customer_has_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    where b.id = p_booking_id
      and c.user_id = auth.uid()
  );
$$;

create or replace function public.supplier_has_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.booking_items bi
    join public.suppliers s on s.id = bi.supplier_id
    where bi.booking_id = p_booking_id
      and s.user_id = auth.uid()
  );
$$;

grant execute on function public.jwt_role() to authenticated;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.current_supplier_id() to authenticated;
grant execute on function public.customer_has_booking(uuid) to authenticated;
grant execute on function public.supplier_has_booking(uuid) to authenticated;

-- ---------- Enable RLS ----------

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.leads enable row level security;
alter table public.quotations enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.documents enable row level security;
alter table public.itineraries enable row level security;
alter table public.ground_services enable row level security;

-- ---------- USERS ----------
drop policy if exists users_admin_all on public.users;
drop policy if exists users_self_select on public.users;
drop policy if exists users_self_update on public.users;

create policy users_admin_all
on public.users
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy users_self_select
on public.users
for select
using (id = auth.uid());

create policy users_self_update
on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

-- ---------- CUSTOMERS ----------
drop policy if exists customers_admin_all on public.customers;
drop policy if exists customers_self_select on public.customers;
drop policy if exists customers_self_update on public.customers;
drop policy if exists customers_self_insert on public.customers;

create policy customers_admin_all
on public.customers
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy customers_self_select
on public.customers
for select
using (user_id = auth.uid());

create policy customers_self_update
on public.customers
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy customers_self_insert
on public.customers
for insert
with check (user_id = auth.uid());

-- ---------- SUPPLIERS ----------
drop policy if exists suppliers_admin_all on public.suppliers;
drop policy if exists suppliers_self_select on public.suppliers;
drop policy if exists suppliers_self_update on public.suppliers;

create policy suppliers_admin_all
on public.suppliers
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy suppliers_self_select
on public.suppliers
for select
using (user_id = auth.uid());

create policy suppliers_self_update
on public.suppliers
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------- LEADS ----------
drop policy if exists leads_admin_all on public.leads;
drop policy if exists leads_customer_select on public.leads;
drop policy if exists leads_customer_insert on public.leads;

create policy leads_admin_all
on public.leads
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy leads_customer_select
on public.leads
for select
using (customer_id = public.current_customer_id());

create policy leads_customer_insert
on public.leads
for insert
with check (customer_id = public.current_customer_id());

-- ---------- QUOTATIONS ----------
drop policy if exists quotations_admin_all on public.quotations;
drop policy if exists quotations_customer_select on public.quotations;
drop policy if exists quotations_supplier_select on public.quotations;

create policy quotations_admin_all
on public.quotations
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy quotations_customer_select
on public.quotations
for select
using (customer_id = public.current_customer_id());

create policy quotations_supplier_select
on public.quotations
for select
using (booking_id is not null and public.supplier_has_booking(booking_id));

-- ---------- BOOKINGS ----------
drop policy if exists bookings_admin_all on public.bookings;
drop policy if exists bookings_customer_select on public.bookings;
drop policy if exists bookings_customer_insert on public.bookings;
drop policy if exists bookings_supplier_select on public.bookings;
drop policy if exists bookings_supplier_update on public.bookings;

create policy bookings_admin_all
on public.bookings
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy bookings_customer_select
on public.bookings
for select
using (customer_id = public.current_customer_id());

create policy bookings_customer_insert
on public.bookings
for insert
with check (customer_id = public.current_customer_id());

create policy bookings_supplier_select
on public.bookings
for select
using (public.supplier_has_booking(id));

create policy bookings_supplier_update
on public.bookings
for update
using (public.supplier_has_booking(id))
with check (public.supplier_has_booking(id));

-- ---------- BOOKING ITEMS ----------
drop policy if exists booking_items_admin_all on public.booking_items;
drop policy if exists booking_items_customer_select on public.booking_items;
drop policy if exists booking_items_supplier_select on public.booking_items;
drop policy if exists booking_items_supplier_update on public.booking_items;

create policy booking_items_admin_all
on public.booking_items
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy booking_items_customer_select
on public.booking_items
for select
using (public.customer_has_booking(booking_id));

create policy booking_items_supplier_select
on public.booking_items
for select
using (supplier_id = public.current_supplier_id());

create policy booking_items_supplier_update
on public.booking_items
for update
using (supplier_id = public.current_supplier_id())
with check (supplier_id = public.current_supplier_id());

-- ---------- PAYMENTS ----------
drop policy if exists payments_admin_all on public.payments;
drop policy if exists payments_customer_select on public.payments;

create policy payments_admin_all
on public.payments
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy payments_customer_select
on public.payments
for select
using (public.customer_has_booking(booking_id));

-- ---------- INVOICES ----------
drop policy if exists invoices_admin_all on public.invoices;
drop policy if exists invoices_customer_select on public.invoices;

create policy invoices_admin_all
on public.invoices
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy invoices_customer_select
on public.invoices
for select
using (public.customer_has_booking(booking_id));

-- ---------- DOCUMENTS ----------
drop policy if exists documents_admin_all on public.documents;
drop policy if exists documents_customer_select on public.documents;
drop policy if exists documents_supplier_select on public.documents;

create policy documents_admin_all
on public.documents
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy documents_customer_select
on public.documents
for select
using (booking_id is not null and public.customer_has_booking(booking_id));

create policy documents_supplier_select
on public.documents
for select
using (booking_id is not null and public.supplier_has_booking(booking_id));

-- ---------- ITINERARIES ----------
drop policy if exists itineraries_admin_all on public.itineraries;
drop policy if exists itineraries_customer_select on public.itineraries;

create policy itineraries_admin_all
on public.itineraries
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy itineraries_customer_select
on public.itineraries
for select
using (public.customer_has_booking(booking_id));

-- ---------- GROUND SERVICES ----------
drop policy if exists ground_services_admin_all on public.ground_services;
drop policy if exists ground_services_customer_select on public.ground_services;
drop policy if exists ground_services_supplier_select on public.ground_services;
drop policy if exists ground_services_supplier_update on public.ground_services;

create policy ground_services_admin_all
on public.ground_services
for all
using (public.jwt_role() = 'admin')
with check (public.jwt_role() = 'admin');

create policy ground_services_customer_select
on public.ground_services
for select
using (public.customer_has_booking(booking_id));

create policy ground_services_supplier_select
on public.ground_services
for select
using (supplier_id = public.current_supplier_id());

create policy ground_services_supplier_update
on public.ground_services
for update
using (supplier_id = public.current_supplier_id())
with check (supplier_id = public.current_supplier_id());

commit;
