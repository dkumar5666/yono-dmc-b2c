CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  status text DEFAULT 'processed',
  booking_id text,
  payment_id text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_webhook_events_provider_event
ON webhook_events(provider, event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created
ON webhook_events(created_at DESC);
