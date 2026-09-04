import type {
  AssignmentHistoryRecord,
  Cleaner,
  TurnoverRules,
} from '../store/appStore'
import type { CalendarEvent, Rental } from './hosthub'

const BASE = '/api'
const EVENTS_BATCH_SIZE = 500

async function put(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Local API ${path} failed (${res.status}): ${text.slice(0, 240)}`)
  }
}

export interface BootstrapPayload {
  apiKey?: string
  selectedBoardDate: string | null
  turnoverRules: TurnoverRules | null
  carryForwardStartDate: string | null
  liveFromHosthub: boolean
  autoSyncMinutes?: number
  brandLogoDataUrl?: string | null
  faviconDataUrl?: string | null
  cleanerAvailabilityById?: Record<
    string,
    { from: string; to: string | null }[]
  >
  taskColumnOverride?: Record<string, `cleaner:${string}` | 'checkouts' | 'turnovers'>
  cleaners: Cleaner[]
  propertyOverrides: Record<string, boolean>
  assignmentHistory: AssignmentHistoryRecord[]
  completedTaskAt: Record<string, string>
  taskNotes?: Record<string, string>
  taskPriority?: Record<string, 'low' | 'medium' | 'high'>
  manualCleanings?: {
    id: string
    rentalId: string
    plannedDate: string
    column: `cleaner:${string}` | 'checkouts' | 'turnovers'
  }[]
  rentals: Rental[]
  events: CalendarEvent[]
}

export async function fetchBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const res = await fetch(`${BASE}/bootstrap`)
    if (!res.ok) return null
    return (await res.json()) as BootstrapPayload
  } catch {
    return null
  }
}

/** Local board state only — excludes rentals/events cache (much smaller). */
export async function fetchLocalState(): Promise<Omit<
  BootstrapPayload,
  'rentals' | 'events'
> | null> {
  try {
    const res = await fetch(`${BASE}/local-state`)
    if (!res.ok) return null
    return (await res.json()) as Omit<BootstrapPayload, 'rentals' | 'events'>
  } catch {
    return null
  }
}

export const localDbApi = {
  saveSettings(payload: {
    apiKey?: string
    selectedBoardDate?: string
    turnoverRules?: TurnoverRules
    carryForwardStartDate?: string | null
    liveFromHosthub?: boolean
    autoSyncMinutes?: number
    brandLogoDataUrl?: string | null
    faviconDataUrl?: string | null
    taskNotes?: Record<string, string>
    taskPriority?: Record<string, 'low' | 'medium' | 'high'>
    manualCleanings?: {
      id: string
      rentalId: string
      plannedDate: string
      column: `cleaner:${string}` | 'checkouts' | 'turnovers'
    }[]
    cleanerAvailabilityById?: Record<
      string,
      { from: string; to: string | null }[]
    >
    taskColumnOverride?: Record<string, `cleaner:${string}` | 'checkouts' | 'turnovers'>
  }) {
    return put('/settings', payload)
  },
  savePropertyOverrides(cleaningEnabledByRentalId: Record<string, boolean>) {
    return put('/property-overrides', { cleaningEnabledByRentalId })
  },
  saveCleaners(cleaners: Cleaner[]) {
    return put('/cleaners', { cleaners })
  },
  saveAssignments(assignmentHistory: AssignmentHistoryRecord[]) {
    return put('/assignments', { assignmentHistory })
  },
  saveCompletion(completedTaskAt: Record<string, string>) {
    return put('/completion', { completedTaskAt })
  },
  saveBookingsCache(rentals: Rental[], events: CalendarEvent[]) {
    return put('/bookings-cache', { rentals, events })
  },
  async saveBookingsCacheChunked(rentals: Rental[], events: CalendarEvent[]) {
    await put('/bookings-cache/rentals', { rentals })
    if (events.length === 0) {
      await put('/bookings-cache/events-batch', { events: [], reset: true })
      return
    }
    let reset = true
    for (let i = 0; i < events.length; i += EVENTS_BATCH_SIZE) {
      const batch = events.slice(i, i + EVENTS_BATCH_SIZE)
      await put('/bookings-cache/events-batch', { events: batch, reset })
      reset = false
    }
  },
  resetAll() {
    return fetch(`${BASE}/reset`, { method: 'POST' }).then(() => {})
  },
}

