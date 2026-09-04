# Cleaners Pro — Developer Technical Guide

Architecture, data flow, and extension points for engineers.

---

## 1. Repository layout

```
Cleaners_Pro/
  README.md
  docker-compose.yml
  docs/                     Product, deploy, and this guide
  web/                      Application (frontend + local API)
    src/
      App.tsx               Routes, hydrate, auto-sync, lite poll
      components/           AppShell, Icon
      pages/                Operations, Calendar, Cleaners, …
      store/appStore.ts     Zustand state + computeBoardTasks
      lib/hosthub.ts        Read-only Hosthub client
      lib/localDbApi.ts     /api client
    server/
      index.js              Express routes
      db.js                 SQLite schema, slim payloads, bootstrap
    Dockerfile.web / Dockerfile.api
    nginx.conf
  hosthub-openapi.yaml      Reference only
```

Legacy Stitch / HTML mock folders (`operations_board/`, `analytics/`, etc.) may exist for design reference; the running product is under `web/`.

---

## 2. Runtime stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript, Vite 8, Tailwind 4, React Router 7, Zustand, @dnd-kit |
| Local API | Node, Express 5, better-sqlite3 |
| Prod | Docker Compose: Nginx (web) + Node API; volume `opsboard_data` |

Zustand `persist` is configured with `partialize: () => ({})` so **browser localStorage is not the source of truth**. Shared state goes through `/api` → SQLite so LAN / Tailscale clients stay consistent.

---

## 3. Hosthub (read-only)

File: `web/src/lib/hosthub.ts`

- Key normalized with `normalizeHosthubApiKey` (strips accidental `Bearer `).
- Header: `Authorization: <raw key>` (Hosthub OpenAPI style).
- Dev: Vite proxies `/hosthub` → `https://app.hosthub.com/api/2019-03-01`.
- Prod browser: calls Hosthub origin directly (CORS must allow the page origin) **or** rely on cached SQLite after sync from a machine that can reach Hosthub.
- 45s request timeout; calendar pagination capped; merges global + per-rental feeds; composite merge key for dedupe.
- `isBookingEvent` / `resolveRentalIdForEvent` handle messy OTA / offline payloads.

`syncFromHosthub()` preserves local-only state: cleaners, availability, column overrides, completion, notes, priority, property toggles.

---

## 4. Local database API

SQLite path: `web/data/opsboard.sqlite` (dev) or `/app/data/opsboard.sqlite` (Docker volume).

### Tables
`settings`, `cleaners`, `property_overrides`, `task_assignments`, `task_completion`, `rentals_cache`, `events_cache`

### Important endpoints

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health` | Liveness |
| GET | `/api/bootstrap` | Full hydrate (settings + slimmed rentals/events) |
| GET | `/api/local-state` | Lite poll (no bookings cache / no branding blobs) |
| PUT | `/api/settings` | Key-value settings JSON |
| PUT | `/api/property-overrides` | Cleaning on/off per rental |
| PUT | `/api/cleaners` | Replace cleaners list |
| PUT | `/api/assignments` | Assignment history |
| PUT | `/api/completion` | Done map |
| PUT | `/api/bookings-cache/*` | Rentals + chunked events (slimmed, upsert by cache id) |
| POST | `/api/reset` | Wipe local tables |

### Performance notes

- Hosthub event objects are **slimmed** before store/serve (`slimEvent` / `slimRental` in `db.js`).
- Cache row id for events uses a **composite** `eventCacheId` to avoid UNIQUE collisions when Hosthub reuses ids.
- App startup uses full bootstrap once; background sync uses `/api/local-state` every 15s (not full bootstrap).

---

## 5. Board task engine

`computeBoardTasks()` in `appStore.ts` is the single source of cleaning cards:

1. Checkout cleaning → date = `date_to + cleaningOffsetDays`, default column `checkouts`
2. Arrival prep → before `date_from`, default `turnovers`
3. Mid-stay → stay-day schedule, default `turnovers`
4. Manual cleanings from settings

Then apply: property toggle, column overrides, completion, notes, priority, carry-forward rules.

Task ids are deterministic, e.g. `cleaning-checkout-{eventId}`, so overrides survive re-sync.

---

## 6. Frontend routes

| Path | Page |
|------|------|
| `/` | Operations |
| `/calendar` | Calendar |
| `/cleaners` | Cleaners |
| `/properties` | Properties |
| `/analytics` | Analytics |
| `/preferences` | Preferences hub |
| `/preferences/hosthub` | API key / sync |
| `/preferences/turnover-rules` | Rules |
| `/preferences/branding` | Logo / favicon |
| `/preferences/db-admin` | SQLite inspector |

---

## 7. Dev scripts (`web/package.json`)

```bash
npm run dev        # Vite
npm run dev:api    # Express :8787
npm run dev:all    # both
npm run build      # tsc + vite build
```

Vite proxy (`vite.config.ts`): `/api` → `localhost:8787`, `/hosthub` → Hosthub.

---

## 8. Debugging checklist

1. `GET /api/health` → `{ ok: true }`
2. `GET /api/bootstrap` size — should be a few MB max after slim, not tens of MB
3. Browser Network: `/api/local-state` on interval, not full bootstrap
4. Hosthub sync errors surface in Preferences / Operations banners (`syncStatus` / `syncMessage`)
5. Docker: `docker compose logs api` for SQLite errors

---

## 9. Safe change areas

| Goal | Touch |
|------|-------|
| New board column behavior | `computeBoardTasks`, OperationsPage |
| Sync reliability | `hosthub.ts`, `syncFromHosthub` |
| Persistence shape | `server/db.js`, `localDbApi.ts`, hydrate helpers |
| Print layouts | OperationsPage print section + `index.css` print rules |
