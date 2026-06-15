# Safe Structure Inventory (2026-05-08)

This document classifies current project directories and scripts for safe reorganization.

## 1) Runtime-Critical (Do not move in first pass)

- `frontend/app/`
- `frontend/components/`
- `frontend/features/`
- `frontend/lib/`
- `frontend/types/`
- `frontend/Production_Planing.tsx`
- `backend/server.js`
- `backend/routes/`
- `backend/controllers/`
- `backend/models/`
- `backend/config/`
- `backend/middleware/`

Reason: These paths are directly loaded by Next.js/Express runtime or imported by runtime entry files.

## 2) Maintenance/Tooling (Move only with path updates)

- `infra/` (docker-compose and deployment envs)
- `tools/` (docker/scripts/testing utilities)
- `scripts/` (repo-level utility scripts)
- `database/sql/` (manual SQL scripts)
- Backend manual scripts in `backend/`:
  - `check-*.js`
  - `test-*.js`
  - `migrate-*.js`
  - `verify-*.js`
  - `add-*.js`
  - `seed-*.js`

Reason: Not runtime entry points, but often referenced by manual runbooks/docs.

## 3) Legacy/Quarantine Candidates

- `newfrontendlogs/` (standalone alternate frontend snapshot; no runtime imports found)
- `WeeklyCalendar/` (root-level example package scaffold; not used by runtime imports)

Reason: Duplicated or example-only structure that can confuse source-of-truth.

## 4) Decision for Safe Batch #1

Move only the root `WeeklyCalendar/` example files into documentation legacy space:

- from `WeeklyCalendar/README.md`
- from `WeeklyCalendar/index.ts`
- to `docs/legacy/weekly-calendar/`

This is selected because:

- no runtime imports reference these root files
- only self-references exist inside that folder
- change is reversible and low blast radius

## 5) Deferred Items (Needs Confirm)

- `newfrontendlogs/` full relocation (large folder, better done in dedicated batch)
- backend script flattening into `backend/scripts/` (many docs references should be updated together)
