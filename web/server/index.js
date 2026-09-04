import cors from 'cors'
import express from 'express'
import {
  db,
  eventCacheId,
  getBootstrap,
  getLocalState,
  setSetting,
  slimEvent,
  slimRental,
} from './db.js'

const app = express()
const port = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json({ limit: '100mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/bootstrap', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.json(getBootstrap())
})

app.get('/api/local-state', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.json(getLocalState())
})

app.put('/api/settings', (req, res) => {
  const {
    apiKey,
    selectedBoardDate,
    turnoverRules,
    carryForwardStartDate,
    liveFromHosthub,
    autoSyncMinutes,
    brandLogoDataUrl,
    faviconDataUrl,
    taskNotes,
    taskPriority,
    manualCleanings,
    cleanerAvailabilityById,
    taskColumnOverride,
  } =
    req.body ?? {}
  if (apiKey !== undefined) setSetting('apiKey', apiKey)
  if (selectedBoardDate !== undefined)
    setSetting('selectedBoardDate', selectedBoardDate)
  if (turnoverRules !== undefined) setSetting('turnoverRules', turnoverRules)
  if (carryForwardStartDate !== undefined)
    setSetting('carryForwardStartDate', carryForwardStartDate)
  if (liveFromHosthub !== undefined) setSetting('liveFromHosthub', liveFromHosthub)
  if (autoSyncMinutes !== undefined) setSetting('autoSyncMinutes', autoSyncMinutes)
  if (brandLogoDataUrl !== undefined) setSetting('brandLogoDataUrl', brandLogoDataUrl)
  if (faviconDataUrl !== undefined) setSetting('faviconDataUrl', faviconDataUrl)
  if (taskNotes !== undefined) setSetting('taskNotes', taskNotes)
  if (taskPriority !== undefined) setSetting('taskPriority', taskPriority)
  if (manualCleanings !== undefined) setSetting('manualCleanings', manualCleanings)
  if (cleanerAvailabilityById !== undefined)
    setSetting('cleanerAvailabilityById', cleanerAvailabilityById)
  if (taskColumnOverride !== undefined)
    setSetting('taskColumnOverride', taskColumnOverride)
  res.json({ ok: true })
})

app.put('/api/property-overrides', (req, res) => {
  const values = req.body?.cleaningEnabledByRentalId ?? {}
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM property_overrides').run()
    const stmt = db.prepare(
      'INSERT INTO property_overrides (rental_id, cleaning_enabled) VALUES (?, ?)',
    )
    for (const [rentalId, enabled] of entries) {
      stmt.run(rentalId, enabled ? 1 : 0)
    }
  })
  tx(Object.entries(values))
  res.json({ ok: true })
})

app.put('/api/cleaners', (req, res) => {
  const cleaners = Array.isArray(req.body?.cleaners) ? req.body.cleaners : []
  const now = new Date().toISOString()
  const tx = db.transaction((rows) => {
    db.prepare('DELETE FROM cleaners').run()
    const stmt = db.prepare(
      'INSERT INTO cleaners (id, name, avatar_url, created_at) VALUES (?, ?, ?, ?)',
    )
    for (const c of rows) stmt.run(c.id, c.name, c.avatarUrl ?? null, now)
  })
  tx(cleaners)
  res.json({ ok: true })
})

app.put('/api/assignments', (req, res) => {
  const rows = Array.isArray(req.body?.assignmentHistory)
    ? req.body.assignmentHistory
    : []
  const tx = db.transaction((items) => {
    db.prepare('DELETE FROM task_assignments').run()
    const stmt = db.prepare(
      `INSERT INTO task_assignments
       (id, task_id, event_id, rental_id, cleaner_id, planned_date, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const a of items) {
      stmt.run(
        a.id,
        a.taskId,
        a.eventId,
        a.rentalId,
        a.cleanerId,
        a.plannedDate,
        a.assignedAt,
      )
    }
  })
  tx(rows)
  res.json({ ok: true })
})

app.put('/api/completion', (req, res) => {
  const map = req.body?.completedTaskAt ?? {}
  const tx = db.transaction((entries) => {
    db.prepare('DELETE FROM task_completion').run()
    const stmt = db.prepare(
      'INSERT INTO task_completion (task_id, completed_date) VALUES (?, ?)',
    )
    for (const [taskId, completedDate] of entries) {
      stmt.run(taskId, completedDate)
    }
  })
  tx(Object.entries(map))
  res.json({ ok: true })
})

app.put('/api/bookings-cache', (req, res) => {
  const rentals = Array.isArray(req.body?.rentals) ? req.body.rentals : []
  const events = Array.isArray(req.body?.events) ? req.body.events : []
  const updatedAt = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM rentals_cache').run()
    db.prepare('DELETE FROM events_cache').run()
    const rs = db.prepare(
      `INSERT INTO rentals_cache (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    )
    for (const r of rentals) {
      const slim = slimRental(r)
      rs.run(slim.id, JSON.stringify(slim), updatedAt)
    }
    const es = db.prepare(
      `INSERT INTO events_cache (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    )
    for (const e of events) {
      const slim = slimEvent(e)
      es.run(eventCacheId(e), JSON.stringify(slim), updatedAt)
    }
  })
  tx()
  res.json({ ok: true })
})

app.put('/api/bookings-cache/rentals', (req, res) => {
  const rentals = Array.isArray(req.body?.rentals) ? req.body.rentals : []
  const updatedAt = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM rentals_cache').run()
    const rs = db.prepare(
      `INSERT INTO rentals_cache (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    )
    for (const r of rentals) {
      const slim = slimRental(r)
      rs.run(slim.id, JSON.stringify(slim), updatedAt)
    }
  })
  tx()
  res.json({ ok: true })
})

app.put('/api/bookings-cache/events-batch', (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : []
  const reset = Boolean(req.body?.reset)
  const updatedAt = new Date().toISOString()
  const tx = db.transaction(() => {
    if (reset) db.prepare('DELETE FROM events_cache').run()
    const es = db.prepare(
      `INSERT INTO events_cache (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    )
    for (const e of events) {
      const slim = slimEvent(e)
      es.run(eventCacheId(e), JSON.stringify(slim), updatedAt)
    }
  })
  tx()
  res.json({ ok: true })
})

app.post('/api/reset', (_req, res) => {
  db.prepare('DELETE FROM cleaners').run()
  db.prepare('DELETE FROM property_overrides').run()
  db.prepare('DELETE FROM task_assignments').run()
  db.prepare('DELETE FROM task_completion').run()
  db.prepare('DELETE FROM rentals_cache').run()
  db.prepare('DELETE FROM events_cache').run()
  db.prepare('DELETE FROM settings').run()
  res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`Local DB API running on http://localhost:${port}`)
})

