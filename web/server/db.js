import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'opsboard.sqlite')
export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cleaners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_overrides (
  rental_id TEXT PRIMARY KEY,
  cleaning_enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  rental_id TEXT NOT NULL,
  cleaner_id TEXT NOT NULL,
  planned_date TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_completion (
  task_id TEXT PRIMARY KEY,
  completed_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rentals_cache (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events_cache (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`)

/** Keep only fields the OpsBoard UI needs — Hosthub payloads can be huge. */
export function slimRental(r) {
  if (!r || typeof r !== 'object') return r
  return {
    id: String(r.id ?? ''),
    object: r.object ?? 'Rental',
    name: r.name ?? 'Property',
  }
}

export function slimEvent(e) {
  if (!e || typeof e !== 'object') return e
  const rental = e.rental
  return {
    id: String(e.id ?? ''),
    object: e.object ?? 'CalendarEvent',
    type: e.type,
    date_from: e.date_from,
    date_to: e.date_to,
    check_in_time: e.check_in_time ?? null,
    check_out_time: e.check_out_time ?? null,
    nights: e.nights,
    rental: rental
      ? {
          id: rental.id != null ? String(rental.id) : undefined,
          object: rental.object ?? 'Rental',
          name: rental.name ?? '',
        }
      : undefined,
    title: e.title,
    guest_name: e.guest_name,
    reservation_id: e.reservation_id,
    cancelled_at: e.cancelled_at ?? null,
  }
}

/** Stable unique cache key when Hosthub reuses event ids across related rows. */
export function eventCacheId(e) {
  return [
    e?.id ?? '',
    e?.rental?.id ?? '',
    e?.rental?.name ?? '',
    e?.date_from ?? '',
    e?.date_to ?? '',
    e?.reservation_id ?? '',
    e?.type ?? '',
    e?.check_in_time ?? '',
    e?.check_out_time ?? '',
  ].join('|')
}

function slimCachedPayloadsOnce() {
  const flag = getSetting('_payloadsSlimmedV1', false)
  if (flag) return

  const updateEvent = db.prepare(
    'UPDATE events_cache SET payload = ? WHERE id = ?',
  )
  const updateRental = db.prepare(
    'UPDATE rentals_cache SET payload = ? WHERE id = ?',
  )

  const tx = db.transaction(() => {
    for (const row of db.prepare('SELECT id, payload FROM events_cache').all()) {
      try {
        const slim = slimEvent(JSON.parse(row.payload))
        updateEvent.run(JSON.stringify(slim), row.id)
      } catch {
        // skip corrupt rows
      }
    }
    for (const row of db.prepare('SELECT id, payload FROM rentals_cache').all()) {
      try {
        const slim = slimRental(JSON.parse(row.payload))
        updateRental.run(JSON.stringify(slim), row.id)
      } catch {
        // skip corrupt rows
      }
    }
    setSetting('_payloadsSlimmedV1', true)
  })
  tx()

  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.exec('VACUUM')
  } catch (err) {
    console.warn('DB compact after slim failed:', err)
  }
  console.log('Slimmed cached rental/event payloads for faster bootstrap')
}

function getSettingRow(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
}

export function getSetting(key, fallback = null) {
  const row = getSettingRow(key)
  if (!row) return fallback
  try {
    return JSON.parse(row.value)
  } catch {
    return fallback
  }
}

export function setSetting(key, value) {
  db.prepare(
    `
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `,
  ).run(key, JSON.stringify(value))
}

function loadLocalState() {
  const cleaners = db
    .prepare('SELECT id, name, avatar_url FROM cleaners ORDER BY created_at ASC')
    .all()
    .map((r) => ({ id: r.id, name: r.name, avatarUrl: r.avatar_url ?? undefined }))

  const propertyRows = db
    .prepare('SELECT rental_id, cleaning_enabled FROM property_overrides')
    .all()
  const propertyOverrides = Object.fromEntries(
    propertyRows.map((r) => [r.rental_id, Boolean(r.cleaning_enabled)]),
  )

  const assignments = db
    .prepare(
      'SELECT id, task_id, event_id, rental_id, cleaner_id, planned_date, assigned_at FROM task_assignments ORDER BY assigned_at ASC',
    )
    .all()
    .map((r) => ({
      id: r.id,
      taskId: r.task_id,
      eventId: r.event_id,
      rentalId: r.rental_id,
      cleanerId: r.cleaner_id,
      plannedDate: r.planned_date,
      assignedAt: r.assigned_at,
    }))

  const completionRows = db
    .prepare('SELECT task_id, completed_date FROM task_completion')
    .all()
  const completedTaskAt = Object.fromEntries(
    completionRows.map((r) => [r.task_id, r.completed_date]),
  )

  return {
    apiKey: getSetting('apiKey', ''),
    selectedBoardDate: getSetting('selectedBoardDate', null),
    turnoverRules: getSetting('turnoverRules', null),
    carryForwardStartDate: getSetting('carryForwardStartDate', null),
    liveFromHosthub: getSetting('liveFromHosthub', false),
    autoSyncMinutes: getSetting('autoSyncMinutes', 30),
    brandLogoDataUrl: getSetting('brandLogoDataUrl', null),
    faviconDataUrl: getSetting('faviconDataUrl', null),
    taskNotes: getSetting('taskNotes', {}),
    taskPriority: getSetting('taskPriority', {}),
    manualCleanings: getSetting('manualCleanings', []),
    cleanerAvailabilityById: getSetting('cleanerAvailabilityById', {}),
    taskColumnOverride: getSetting('taskColumnOverride', {}),
    cleaners,
    propertyOverrides,
    assignmentHistory: assignments,
    completedTaskAt,
  }
}

/** Lightweight payload for background multi-browser sync (no bookings cache / logos). */
export function getLocalState() {
  const local = loadLocalState()
  // Omit large branding data URLs from the frequent poll path.
  const { brandLogoDataUrl: _logo, faviconDataUrl: _icon, ...rest } = local
  return rest
}

export function getBootstrap() {
  const local = loadLocalState()
  const rentals = db
    .prepare('SELECT payload FROM rentals_cache ORDER BY updated_at ASC')
    .all()
    .map((r) => slimRental(JSON.parse(r.payload)))
  const events = db
    .prepare('SELECT payload FROM events_cache ORDER BY updated_at ASC')
    .all()
    .map((r) => slimEvent(JSON.parse(r.payload)))

  return {
    ...local,
    rentals,
    events,
  }
}

slimCachedPayloadsOnce()
