# QA Baseline Report

Date: 2026-02-27
Branch: `v1-hardening`

## 1) Repo State at Start
- Uncommitted files were present before QA pass:
  - `app/admin-login/page.tsx`
  - `app/admin/login/page.tsx`
  - `app/login/page.tsx`
  - `components/LayoutShell.tsx`
  - `docs/AUTH_CURRENT_STATE.md`
  - `docs/AUTH_FLOW_MAP.md`
  - `docs/AUTH_SETUP_GUIDE.md`
  - `lib/auth/requireRole.ts`
- These were treated as in-progress auth stabilization changes and were included in this QA pass, not mixed with unrelated feature work.

## 2) Baseline Checks
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run typecheck`: initially missing script

## 3) Baseline Fixes Applied
- Added `typecheck` script in `package.json`:
  - `"typecheck": "tsc --noEmit"`
- Re-ran checks after QA fixes (see final section in this report).

## 4) API Runtime Hygiene
- Searched `app/api` for browser-only globals (`window`, `document`, local/session storage).
- Result: no browser global misuse found in API routes.

## 5) Key Hardening Added During QA
- Added centralized environment validator:
  - `lib/config/validateEnv.ts`
- Added admin-protected env check endpoint:
  - `GET /api/admin/system/env-check`
- Added System Health hard-fail banner when cron/webhook heartbeat is stale:
  - `app/admin/system/health/page.tsx`
- Normalized broken text encoding artifacts in admin health/control-center UI.

## 6) Final Verification Snapshot
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
