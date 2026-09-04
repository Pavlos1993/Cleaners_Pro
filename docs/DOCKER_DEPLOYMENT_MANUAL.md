# Cleaners Pro — Docker Deployment Manual

Deploy and operate Cleaners Pro with Docker Compose.

---

## 1. Architecture

```
Host :5173
   │
   ▼
opsboard-web (nginx:80)
   │  static SPA
   │  /api/*  ──proxy──►  opsboard-api :8787
   │                         │
   │                         ▼
   │                   SQLite in volume opsboard_data
   │                   (/app/data/opsboard.sqlite)
```

| Compose service | Container name | Image build |
|-----------------|----------------|-------------|
| `api` | `opsboard-api` | `web/Dockerfile.api` |
| `web` | `opsboard-web` | `web/Dockerfile.web` |

---

## 2. Prerequisites

- Docker Desktop **or** Docker Engine + Compose plugin
- Verify: `docker compose version`

---

## 3. First deploy

From the repository root:

```bash
git clone https://github.com/Pavlos1993/Cleaners_Pro.git
cd Cleaners_Pro
docker compose up -d --build
docker compose ps
```

Open: **http://localhost:5173**

(Optional) Copy `.env.example` to `.env` only if you add future overrides; current compose works without env vars.

---

## 4. Day-to-day operations

```bash
docker compose up -d              # start
docker compose down               # stop (keeps volume)
docker compose restart
docker compose up -d --build      # rebuild after code pull
docker compose logs -f web
docker compose logs -f api
```

---

## 5. Data persistence & backup

- Volume name: `opsboard_data`
- Contains Hosthub cache, cleaners, assignments, completion, settings (including API key and branding)

**Backup example (Linux/macOS/WSL):**

```bash
docker run --rm -v cleanerspro_opsboard_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/opsboard-data-backup.tgz -C /data .
```

On Windows PowerShell, adjust volume name via `docker volume ls` (often `cleanerspro_opsboard_data` or similar project prefix).

**Restore:** stop stack, extract into the volume, start again.

`docker compose down -v` **deletes** the volume — avoid unless you intend a full wipe.

---

## 6. Networking / Tailscale

Binding is `0.0.0.0:5173→80`, so the UI is reachable on LAN or Tailscale IP (e.g. `http://100.x.x.x:5173`).

Ensure firewall allows TCP 5173. The API is not published on the host; only Nginx proxies `/api`.

---

## 7. Troubleshooting

| Symptom | Check |
|---------|--------|
| Page blank / hangs | `curl http://localhost:5173/api/health` and `/api/bootstrap` size/time; API logs |
| API down | `docker compose logs api`; container `opsboard-api` running |
| Stale UI after pull | `docker compose up -d --build` and hard-refresh browser |
| Sync fails | Valid Hosthub key in Preferences; network/VPN to Hosthub; API timeout messages |
| UNIQUE / SQLite errors on sync | Current code upserts slimmed events by composite cache id; rebuild API image |

---

## 8. Security checklist for production-ish use

- Restrict who can reach port 5173
- Do not commit SQLite files or real API keys
- Rotate Hosthub key if it was ever committed or shared
- Prefer HTTPS reverse proxy in front of Nginx for internet exposure (not included by default)

---

## 9. Port reference

| Port | Where | Purpose |
|------|--------|---------|
| 5173 | Host | Public UI (maps to nginx 80) |
| 8787 | Internal Docker network only | Express API |
