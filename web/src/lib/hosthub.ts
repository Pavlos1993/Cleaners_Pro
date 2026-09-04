import { addDays, format, parseISO } from 'date-fns'

/**
 * Hosthub REST API (Swagger 2.0) — read-only usage in this app:
 * GET /rentals, GET /calendar-events (and pagination via navigation.next).
 * We do not POST/PATCH/DELETE calendar events or any other write endpoints.
 */

const PROXY_PREFIX = '/hosthub'
const PER_RENTAL_FETCH_CONCURRENCY = 6

/** Cap calendar pagination so a bad `next` link cannot run unbounded. */
const MAX_CALENDAR_PAGES = 200

const REQUEST_TIMEOUT_MS = 45_000

function requestTimeoutSignal(): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }
  const c = new AbortController()
  setTimeout(() => {
    c.abort(new DOMException(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`, 'TimeoutError'))
  }, REQUEST_TIMEOUT_MS)
  return c.signal
}

export function apiBase(): string {
  if (import.meta.env.DEV) return PROXY_PREFIX
  return 'https://app.hosthub.com/api/2019-03-01'
}

/** Swagger: value goes in the `Authorization` header as-is (no "Bearer" in spec). */
export function normalizeHosthubApiKey(raw: string): string {
  let k = raw.trim()
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, '').trim()
  return k
}

export interface Money {
  cents: number
  currency: string
}

export interface Rental {
  id: string
  object: string
  name: string
  postal_code?: string
  latitude?: string
  longitude?: string
  url?: string
}

export interface RentalsList {
  object?: string
  data?: Rental[] | null
}

export interface CalendarEventRental {
  /** Some channel/offline payloads omit id but still send `name`. */
  id?: string
  object: string
  name: string
  url?: string
}

export interface CalendarEvent {
  id: string
  object: string
  type?: string
  date_from: string
  date_to: string
  check_in_time?: string | null
  check_out_time?: string | null
  nights?: number
  rental?: CalendarEventRental
  title?: string
  guest_name?: string
  reservation_id?: string
  is_visible?: boolean
  /** Unix seconds; if set, booking was cancelled. */
  cancelled_at?: number | null
  master_calendar_event_id?: string | number | null
  url?: string
}

export interface CalendarEventList {
  object?: string
  data?: CalendarEvent[] | null
  navigation?: { next?: string; previous?: string }
}

export class HosthubError extends Error {
  status: number
  body: string
  constructor(message: string, status: number, body: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function hosthubFetch<T>(
  pathOrUrl: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T> {
  const key = normalizeHosthubApiKey(apiKey)
  const url =
    pathOrUrl.startsWith('http') || pathOrUrl.startsWith(PROXY_PREFIX)
      ? pathOrUrl
      : `${apiBase()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`

  const signal = requestTimeoutSignal()

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: key,
        ...init?.headers,
      },
    })
  } catch (e: unknown) {
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      throw new HosthubError(
        `No response from Hosthub after ${REQUEST_TIMEOUT_MS / 1000}s. If this keeps happening, check VPN/firewall, dev-server proxy, or try from another network.`,
        0,
        '',
      )
    }
    throw e
  }

  const text = await res.text()
  if (!res.ok) {
    throw new HosthubError(`Hosthub HTTP ${res.status}`, res.status, text)
  }
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HosthubError(
      'Hosthub returned non-JSON (check dev server / proxy)',
      res.status,
      text.slice(0, 200),
    )
  }
}

export async function listRentals(apiKey: string): Promise<Rental[]> {
  const r = await hosthubFetch<RentalsList>('/rentals', apiKey)
  const data = r.data
  return Array.isArray(data) ? data : []
}

function requestUrlFromApiLink(link: string): string {
  const base = 'https://app.hosthub.com'
  const u = link.startsWith('http') ? new URL(link) : new URL(link, base)
  const pathAndQuery = u.pathname + u.search
  if (import.meta.env.DEV) {
    const rest = pathAndQuery.replace(/^\/api\/2019-03-01/, '')
    return `${PROXY_PREFIX}${rest}`
  }
  return `${base}${pathAndQuery}`
}

export async function listCalendarEvents(
  apiKey: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  // Match Hosthub-style calendars: include rows that are hidden in the generic
  // "visible only" feed. We still drop cancelled rows in isBookingEvent / reconcile.
  params.set('is_visible', 'all')
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v))
    }
  }
  return paginateCalendarEvents(`${apiBase()}/calendar-events?${params.toString()}`, apiKey)
}

async function paginateCalendarEvents(startUrl: string, apiKey: string): Promise<CalendarEvent[]> {
  const all: CalendarEvent[] = []
  let url = startUrl
  const visited = new Set<string>()
  let pages = 0

  for (;;) {
    if (visited.has(url)) {
      console.warn('Hosthub: calendar pagination repeated URL, stopping to avoid a loop')
      break
    }
    visited.add(url)

    pages += 1
    if (pages > MAX_CALENDAR_PAGES) {
      console.warn(`Hosthub: stopped calendar pagination after ${MAX_CALENDAR_PAGES} pages`)
      break
    }

    const page = await hosthubFetch<CalendarEventList>(url, apiKey)
    const chunk = page.data
    const rows = Array.isArray(chunk) ? chunk : []
    all.push(...rows)

    const next = page.navigation?.next
    if (!next) break

    const nextUrl = requestUrlFromApiLink(next)
    if (nextUrl === url) {
      console.warn('Hosthub: calendar next URL matched current URL, stopping')
      break
    }
    url = nextUrl
  }
  return all
}

export async function listCalendarEventsForRental(
  apiKey: string,
  rentalId: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  params.set('is_visible', 'all')
  const url = `${apiBase()}/rentals/${encodeURIComponent(rentalId)}/calendar-events?${params.toString()}`
  return paginateCalendarEvents(url, apiKey)
}

/**
 * Hosthub global calendar endpoint can occasionally omit rows that appear in per-rental feeds.
 * Merge both sources and dedupe by event id for safer operations counts.
 */
export async function listCalendarEventsWithRentalFallback(
  apiKey: string,
  rentals: Rental[],
): Promise<CalendarEvent[]> {
  const globalRows = await listCalendarEvents(apiKey)
  const merged = new Map<string, CalendarEvent>()
  for (const e of globalRows) merged.set(eventMergeKey(e), e)

  const queue = [...rentals]
  const workerCount = Math.min(PER_RENTAL_FETCH_CONCURRENCY, queue.length)
  const perRentalLists: CalendarEvent[][] = []
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const r = queue.shift()
        if (!r) break
        try {
          const rows = await listCalendarEventsForRental(apiKey, r.id)
          perRentalLists.push(rows)
        } catch (err) {
          console.warn(`Hosthub: failed per-rental calendar for ${r.id}`, err)
          perRentalLists.push([])
        }
      }
    }),
  )

  for (const rows of perRentalLists) {
    for (const e of rows) {
      const k = eventMergeKey(e)
      if (!merged.has(k)) merged.set(k, e)
    }
  }
  return Array.from(merged.values())
}

function eventMergeKey(e: CalendarEvent): string {
  // Some channel payloads can reuse event ids across related rows.
  // Use a composite key to avoid dropping legitimate checkouts.
  return [
    e.id ?? '',
    e.rental?.id ?? '',
    e.rental?.name ?? '',
    e.date_from ?? '',
    e.date_to ?? '',
    e.reservation_id ?? '',
    e.type ?? '',
    e.check_in_time ?? '',
    e.check_out_time ?? '',
  ].join('|')
}

export function isEventCancelled(e: CalendarEvent): boolean {
  return e.cancelled_at != null && e.cancelled_at !== 0
}

function normRentalLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/-/g, '')
}

/**
 * Map a calendar row to a Rental `id` using `rental.id`, or by matching
 * `rental.name` / `title` to the rentals list (fixes offline / some OTA rows
 * that omit `rental.id` in JSON).
 */
export function resolveRentalIdForEvent(e: CalendarEvent, rentals: Rental[]): string | null {
  const rawId = e.rental?.id
  if (rawId != null && String(rawId).trim() !== '') return String(rawId)
  const candidates = [e.rental?.name, e.title].filter((x): x is string =>
    Boolean(x && String(x).trim()),
  )
  for (const cand of candidates) {
    const hit = rentals.find((r) => normRentalLabel(r.name) === normRentalLabel(cand))
    if (hit) return hit.id
  }
  return null
}

/**
 * Bookings from channels / offline bookings. Excludes Hold blocks (swagger: type Hold vs Booking).
 * API examples use values like `CalendarEventBooking`. Some rows omit "booking" in `type` but
 * still have guest/times — treat those as bookings when not a hold and not cancelled.
 */
export function isBookingEvent(e: CalendarEvent): boolean {
  if (isEventCancelled(e)) return false
  const o = (e.object ?? '').toLowerCase()
  if (o.includes('tax') || o.includes('notecalendar')) return false
  const t = (e.type ?? '').toLowerCase()
  if (t.includes('hold')) return false
  if (!e.date_from || !e.date_to) return false
  const hasRentalHint = Boolean(
    (e.rental?.id != null && String(e.rental.id).trim() !== '') || e.rental?.name?.trim(),
  )
  if (!hasRentalHint) return false

  if (t.includes('booking')) return true
  if (e.reservation_id) return true
  if (e.check_in_time || e.check_out_time) return true
  if (e.guest_name?.trim()) return true
  if (e.date_from < e.date_to) return true
  if (typeof e.nights === 'number' && e.nights > 0) return true
  return false
}

/** Non-cancelled, non-hold calendar row with checkout on dateISO (diagnostics). */
export function isNonHoldCalendarRow(e: CalendarEvent): boolean {
  if (isEventCancelled(e)) return false
  const o = (e.object ?? '').toLowerCase()
  if (o.includes('tax')) return false
  const t = (e.type ?? '').toLowerCase()
  if (t.includes('hold')) return false
  return Boolean(
    e.date_to &&
      ((e.rental?.id != null && String(e.rental.id).trim() !== '') || e.rental?.name?.trim()),
  )
}

export function countRawDeparturesOnDate(events: CalendarEvent[], dateISO: string): number {
  let n = 0
  for (const e of events) {
    if (!isNonHoldCalendarRow(e)) continue
    if (e.date_to !== dateISO) continue
    n += 1
  }
  return n
}

/** Same as departures but one per reservation_id when present (satellite rows share id). */
export function countUniqueBookingDeparturesOnDate(
  events: CalendarEvent[],
  dateISO: string,
  rentals: Rental[],
): number {
  const seen = new Set<string>()
  let n = 0
  for (const e of events) {
    if (!isBookingEvent(e)) continue
    if (e.date_to !== dateISO) continue
    const rid = resolveRentalIdForEvent(e, rentals)
    if (!rid) continue
    const key =
      e.reservation_id != null && String(e.reservation_id).length > 0
        ? `res:${String(e.reservation_id)}`
        : `id:${e.id}`
    if (seen.has(key)) continue
    seen.add(key)
    n += 1
  }
  return n
}

/** Count Hosthub departures: bookings whose checkout calendar day is `dateISO` (raw date_to). */
export function countHosthubDeparturesOnDate(
  events: CalendarEvent[],
  dateISO: string,
  rentals: Rental[],
): { total: number; resolvedRental: number; unresolved: number } {
  let total = 0
  let resolvedRental = 0
  let unresolved = 0
  for (const e of events) {
    if (!isBookingEvent(e)) continue
    if (e.date_to !== dateISO) continue
    total += 1
    const rid = resolveRentalIdForEvent(e, rentals)
    if (rid) resolvedRental += 1
    else unresolved += 1
  }
  return { total, resolvedRental, unresolved }
}

/** Same formula as board: cleaning card date = checkout date + offset days. */
export function checkoutCleaningPlannedDate(dateToISO: string, cleaningOffsetDays: number): string {
  const base = parseISO(`${dateToISO}T00:00:00`)
  return format(addDays(base, cleaningOffsetDays), 'yyyy-MM-dd')
}

/**
 * How many checkout cleanings the rules would place on `dayISO` (ignores drag column;
 * matches generate step before shouldInclude — use for reconciliation vs Hosthub departures).
 */
export function countCheckoutCleaningsPlannedForDay(
  events: CalendarEvent[],
  dayISO: string,
  cleaningEnabled: Record<string, boolean>,
  cleaningOffsetDays: number,
  rentals: Rental[],
): number {
  let n = 0
  for (const e of events) {
    if (!isBookingEvent(e)) continue
    const rid = resolveRentalIdForEvent(e, rentals)
    if (!rid) continue
    if (cleaningEnabled[rid] === false) continue
    if (checkoutCleaningPlannedDate(e.date_to, cleaningOffsetDays) === dayISO) n += 1
  }
  return n
}
