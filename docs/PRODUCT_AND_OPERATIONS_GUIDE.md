# Cleaners Pro — Product & Operations Guide

Plain-language guide for property managers and cleaning coordinators.

---

## 1. What Cleaners Pro is for

Cleaners Pro helps you plan and track cleaning work around guest bookings. It connects to Hosthub only to **read** your properties and calendar. It does **not** write changes back to Hosthub.

Cleaner names, assignments, notes, turnover rules, and “done” status stay on your side (local SQLite database shared by the Docker API).

---

## 2. Main areas of the app

### Operations (board)
Kanban board for a selected day (or week/month planning window).

- Columns: checkout cleanings, turnover / prep / mid-stay style cleanings, plus one column per cleaner who is **on** for that date.
- Drag a card onto a cleaner to assign it.
- Open a card for notes, priority, and mark done / reopen.
- **Add**: create a manual cleaning (searchable property list).
- **Print**: manager schedule, per-cleaner sheets, inspector checklist (linen / same-day check-in).

### Calendar
Month view with booking density and cleaning counts. Export cleanings to `.ics` (e.g. Google Calendar).

### Cleaners
Add or remove cleaners. Toggle **ON / OFF** for the board date you are viewing. Turning someone off hides their column and returns their future assignments (from that date onward) to unassigned checkout/turnover columns.

### Properties
Rentals from Hosthub after sync. Turn cleaning **off** for a property if you do not want automated tasks for it.

### Analytics
KPIs and charts for a date range: planned checkouts/turnovers, completion rate, assignment rate, distribution by cleaner and property.

### Preferences
- **Branding** — sidebar logo and favicon  
- **Hosthub API** — key, manual sync, auto-sync interval  
- **Turnover rules** — how checkout / arrival-prep / mid-stay tasks are generated  
- **DB Admin** — read-only view of local SQLite  
- **Full reset** — demo mode + wipe local DB (confirmation code required)

---

## 3. Hosthub and demo mode

Before you add an API key, the app can show **sample** bookings so you can try the board.

After **Save & sync from Hosthub** with a valid key:

- You see real rentals and events.
- Cleaners and assignments remain local; re-sync does not wipe assignments or completed tasks.
- On startup, if a key exists, the app may auto-sync (and can skip a sync if one happened very recently).

If the board looks empty after a successful sync, check that bookings match the selected **date** (use Calendar / Properties to confirm data loaded).

---

## 4. Turnover rules (simple)

Rules control which cleaning cards appear and on which dates:

| Rule | Meaning |
|------|---------|
| Cleaning offset from checkout | `0` = checkout day, `1` = next day, `-1` = day before |
| Arrival prep | Optional clean before check-in (e.g. 1 day before) |
| Mid-stay | Optional cleans during long stays (first stay-day + repeat every N days) |
| Skip mid-stay if checkout next day | Avoids a mid-stay clean right before turnover |
| Default due time | Shown when Hosthub has no checkout time |

Use **Week** or **Month** on Operations to preview many days at once.

---

## 5. Carry-forward

Unfinished tasks from past calendar days can appear on today’s board as **CARRIED** (after your first live Hosthub sync day). Completed tasks stay visible in the planning window where they were marked done.

---

## 6. Printing tips

From Operations → **Print**:

1. Manager schedule — who has which properties  
2. Cleaners schedule — one page per cleaner  
3. Inspector checklist — linen tick boxes + same-day check-in hint  

Optional: exclude cards already marked done.

---

## 7. Safety

- Prefer Docker so SQLite lives in the named volume `opsboard_data` (survives container recreate).
- Do not share screenshots that show your Hosthub API key.
- Full reset is destructive; only use it when you intend to wipe local operational data.
