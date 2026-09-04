# Cleaners Pro

**Cleaners Pro** is a local-first operations board for short-term rental cleaning teams. It reads properties and bookings from [Hosthub](https://www.hosthub.com/) (read-only) and keeps cleaner assignments, notes, completion, and turnover rules on your own machine.

---

## What it does

| Area | Purpose |
|------|---------|
| **Operations** | Day / week / month Kanban board: checkout, turnover, mid-stay, and manual cleanings. Drag tasks onto cleaners. Print manager, cleaner, and inspector sheets. |
| **Calendar** | Month view with booking density and cleaning counts; export `.ics`. |
| **Cleaners** | Local roster with per-date on/off availability. |
| **Properties** | Toggle which rentals generate cleaning tasks. |
| **Analytics** | Completion, assignment, and workload charts for a date range. |
| **Preferences** | Hosthub API key, auto-sync, turnover rules, branding, DB inspector, full reset. |

Hosthub is used only for **GET** rentals and calendar events. Assignments never leave your local database.

---

## Quick start (Docker)

**Requirements:** Docker Desktop (or Docker Engine + Compose).

```bash
git clone https://github.com/Pavlos1993/Cleaners_Pro.git
cd Cleaners_Pro
docker compose up -d --build
```

Open: **http://localhost:5173**

| Service | Container | Role |
|---------|-----------|------|
| `web` | `opsboard-web` | Nginx static UI + reverse proxy for `/api` |
| `api` | `opsboard-api` | Express + SQLite (`opsboard_data` volume) |

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
docker compose up -d --build   # after code changes
```

---

## Local development (without Docker)

```bash
cd web
npm install
npm run dev:all    # API on :8787 + Vite on :5173
```

Or separately:

```bash
npm run dev:api    # Express API + SQLite in web/data/
npm run dev        # Vite only (proxies /api and /hosthub)
```

1. Open http://localhost:5173  
2. Go to **Preferences → Hosthub API**  
3. Paste your Hosthub Authorization key → **Save & sync from Hosthub**  
4. Add cleaners and assign tasks on **Operations**

---

## Documentation

| Document | Audience |
|----------|----------|
| [docs/PRODUCT_AND_OPERATIONS_GUIDE.md](docs/PRODUCT_AND_OPERATIONS_GUIDE.md) | Managers / operators — how to use the app |
| [docs/DEVELOPER_TECHNICAL_GUIDE.md](docs/DEVELOPER_TECHNICAL_GUIDE.md) | Engineers — architecture, data flow, APIs |
| [docs/DOCKER_DEPLOYMENT_MANUAL.md](docs/DOCKER_DEPLOYMENT_MANUAL.md) | Operators — deploy, backup, troubleshoot |

---

## Architecture (short)

```
Browser (React + Zustand)
    │  /api/*  (settings, bootstrap, local-state, caches)
    ▼
Express API  →  SQLite (opsboard.sqlite)
    │
Browser ──GET──► Hosthub API (rentals + calendar events only)
```

- **Bootstrap** (`GET /api/bootstrap`): full state including slimmed bookings cache (startup).  
- **Local state** (`GET /api/local-state`): lighter poll every ~15s for multi-browser sync (no bookings blob).  
- Event payloads are slimmed to fields the board needs to keep load times reasonable.

---

## Tech stack

- React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, Zustand, @dnd-kit  
- Node.js, Express 5, better-sqlite3  
- Docker: Node 20 + Nginx 1.27  

---

## Security notes

- Do **not** commit Hosthub API keys, `.env` secrets, or `web/data/*.sqlite`.  
- Full reset in Preferences requires confirmation code `550077`.  
- Branding uploads (logo/favicon) are stored locally in SQLite as data URLs.

---

## License

Private / proprietary unless otherwise stated by the repository owner.
