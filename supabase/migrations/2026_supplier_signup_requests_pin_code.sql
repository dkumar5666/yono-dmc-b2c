alter table if exists public.supplier_signup_requests
  add column if not exists pin_code text;
