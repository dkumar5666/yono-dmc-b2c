CREATE TABLE IF NOT EXISTS custom_package_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  destination TEXT NOT NULL,
  travel_start_date TEXT,
  travel_end_date TEXT,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  budget_min REAL,
  budget_max REAL,
  currency TEXT NOT NULL DEFAULT 'INR',
  needs_flights INTEGER NOT NULL DEFAULT 1,
  needs_stays INTEGER NOT NULL DEFAULT 1,
  needs_activities INTEGER NOT NULL DEFAULT 1,
  needs_transfers INTEGER NOT NULL DEFAULT 1,
  needs_visa INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_custom_package_requests_status
  ON custom_package_requests(status, created_at DESC);
