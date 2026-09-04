import { addDays, format, parseISO, subDays } from 'date-fns'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEvent, Rental } from '../lib/hosthub'
import {
  HosthubError,
  isBookingEvent,
  listCalendarEventsWithRentalFallback,
  listRentals,
  normalizeHosthubApiKey,
  resolveRentalIdForEvent,
} from '../lib/hosthub'
import { fetchBootstrap, fetchLocalState, localDbApi } from '../lib/localDbApi'

export type Priority = 'high' | 'medium' | 'low'
export type PlanningWindow = 'day' | 'week' | 'month'

export interface Cleaner {
  id: string
  name: string
  avatarUrl?: string
}

export interface CleanerAvailabilityPeriod {
  from: string
  to: string | null
}

export type TaskColumn =
  | 'checkouts'
  | 'turnovers'
  | `cleaner:${string}`

export interface BoardTask {
  id: string
  kind: 'cleaning'
  eventId: string
  rentalId: string
  rentalName: string
  plannedDate: string
  done: boolean
  title: string
  timeLabel: string
  badge: string
  priority: Priority
  carriedOver?: boolean
  note?: string
  /** 0–1 for cleaning progress UI */
  progress?: number
  statusChip?: string
  column: TaskColumn
}

export interface TurnoverRules {
  /** Cleaning card appears on checkout + this offset (days). */
  cleaningOffsetDays: number
  /** Also create prep cleanings before check-in. */
  enableArrivalPrep: boolean
  /** Prep task date is check-in - this many days. */
  arrivalPrepDaysBefore: number
  /** Mid-stay housekeeping tasks while guests are still in house. */
  enableMidStay: boolean
  /** First in-stay clean is scheduled on this stay day number (day 1 = check-in day). */
  midStayFirstCleanDay: number
  /** After first in-stay clean, repeat every N stay-days. */
  midStayRepeatEveryDays: number
  /** Skip in-stay clean if checkout is the next day. */
  skipMidStayIfCheckoutNextDay: boolean
  /** Fallback due time when event has no checkout time. */
  defaultCleaningDueTime: string
}

export interface AssignmentHistoryRecord {
  id: string
  taskId: string
  eventId: string
  rentalId: string
  cleanerId: string
  plannedDate: string
  assignedAt: string
}

export interface ManualCleaningTask {
  id: string
  rentalId: string
  plannedDate: string
  column: TaskColumn
}

interface AppState {
  apiKey: string
  /** After a successful Hosthub pull: real bookings only; cleaners are local. */
  liveFromHosthub: boolean
  /** Carry unfinished tasks only from this date onward (set on first live sync). */
  carryForwardStartDate: string | null
  selectedBoardDate: string
  planningWindow: PlanningWindow
  turnoverRules: TurnoverRules
  assignmentHistory: AssignmentHistoryRecord[]
  /** taskId -> local board date when marked done (yyyy-MM-dd). */
  completedTaskAt: Record<string, string>
  taskNotes: Record<string, string>
  taskPriority: Record<string, Priority>
  manualCleanings: ManualCleaningTask[]
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error'
  syncMessage: string
  /** Auto-sync interval in minutes. 0 disables background sync. */
  autoSyncMinutes: number
  brandLogoDataUrl: string | null
  faviconDataUrl: string | null
  rentals: Rental[]
  events: CalendarEvent[]
  cleaningEnabledByRentalId: Record<string, boolean>
  cleaners: Cleaner[]
  cleanerAvailabilityById: Record<string, CleanerAvailabilityPeriod[]>
  /** Local only: drag assignments (never sent to Hosthub). */
  taskColumnOverride: Record<string, TaskColumn>
  setApiKey: (key: string) => void
  setAutoSyncMinutes: (minutes: number) => void
  setBrandLogoDataUrl: (dataUrl: string | null) => void
  setFaviconDataUrl: (dataUrl: string | null) => void
  setSelectedBoardDate: (isoDate: string) => void
  setPlanningWindow: (window: PlanningWindow) => void
  setTurnoverRules: (patch: Partial<TurnoverRules>) => void
  toggleCleaning: (rentalId: string, on: boolean) => void
  setCleaners: (c: Cleaner[]) => void
  addCleaner: (name: string) => void
  setCleanerActive: (id: string, active: boolean) => void
  removeCleaner: (id: string) => void
  moveTask: (taskId: string, column: TaskColumn) => void
  setTaskCompleted: (taskId: string, done: boolean) => void
  setTaskNote: (taskId: string, note: string) => void
  setTaskPriority: (taskId: string, priority: Priority) => void
  addManualCleaning: (input: {
    rentalId: string
    plannedDate: string
    column: TaskColumn
    note?: string
    priority: Priority
  }) => void
  hydrateFromDb: () => Promise<void>
  hydrateLocalStateFromDb: () => Promise<void>
  syncFromHosthub: (apiKeyOverride?: string) => Promise<void>
  seedDemo: () => void
}

const demoRentals: Rental[] = [
  { id: 'r1', object: 'Rental', name: 'Ocean View Suite #402' },
  { id: 'r2', object: 'Rental', name: 'Garden Loft #12' },
  { id: 'r3', object: 'Rental', name: 'Downtown Studio #09' },
  { id: 'r4', object: 'Rental', name: 'Mountain Cabin #22' },
  { id: 'r5', object: 'Rental', name: 'Penthouse #5001' },
]

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function buildDemoEvents(): CalendarEvent[] {
  const t = todayISO()
  const checkoutFuture = format(addDays(new Date(), 3), 'yyyy-MM-dd')
  const stayStart = format(addDays(new Date(), -2), 'yyyy-MM-dd')
  return [
    {
      id: 'e1',
      object: 'CalendarEvent',
      type: 'CalendarEventBooking',
      date_from: t,
      date_to: checkoutFuture,
      check_in_time: '15:00',
      check_out_time: '11:00',
      rental: { id: 'r1', object: 'Rental', name: 'Ocean View Suite #402' },
      guest_name: 'Guest A',
    },
    {
      id: 'e2',
      object: 'CalendarEvent',
      type: 'CalendarEventBooking',
      date_from: t,
      date_to: checkoutFuture,
      check_in_time: '16:30',
      rental: { id: 'r2', object: 'Rental', name: 'Garden Loft #12' },
      guest_name: 'Guest B',
    },
    {
      id: 'e3',
      object: 'CalendarEvent',
      type: 'CalendarEventBooking',
      date_from: stayStart,
      date_to: t,
      check_in_time: '14:00',
      check_out_time: '14:00',
      rental: { id: 'r3', object: 'Rental', name: 'Downtown Studio #09' },
      guest_name: 'Guest C',
    },
    {
      id: 'e4',
      object: 'CalendarEvent',
      type: 'CalendarEventBooking',
      date_from: stayStart,
      date_to: t,
      rental: { id: 'r4', object: 'Rental', name: 'Mountain Cabin #22' },
      guest_name: 'Guest D',
    },
    {
      id: 'e5',
      object: 'CalendarEvent',
      type: 'CalendarEventBooking',
      date_from: t,
      date_to: checkoutFuture,
      check_in_time: '11:00',
      check_out_time: '14:00',
      rental: { id: 'r5', object: 'Rental', name: 'Penthouse #5001' },
      guest_name: 'Guest E',
    },
  ]
}

const defaultCleaners: Cleaner[] = [
  {
    id: 'c1',
    name: 'Maria',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBWZPX3g0bQcgj8Y9hv3NVIEq3u7U8J6NsbWVSUdU-zu2G0AWWOBxFDHqkXkpXtpugWi5rGlAO3hZuTmrzrHZmzKDisGozwgO_7sMkK4dBAT9IF6gec4HoxhBiQDJKxcgoT2aA4uw1rYE0TJTwO_NGfeAXpbjtWZ2BBVHeor5pfpUiL1JlV7-_nmM7RXLYBCOqggMTH9GG_XZMTIcn3sIhuGexhh9jZUpIzXbd0zM5V1RSQBb8AU6PwjfcT9DM7zkN4iHYqDUpVybQL',
  },
  {
    id: 'c2',
    name: 'John',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAYsavfJm9_gIx9A3enkShY_KfSuVYF02gXcE30_a1huELXSDiZimp3EzErwy0mq_5wsGMKdMBzPWoR8o6UXJCYjt85mY1xU1ty0Ts6LJgmpJNtIxyBcZNZSIx4T9e8g7sMgcR-q7U8n1yUZ5qDurFIC8bIgqqmwISAv-O9apBWU1fL1pVfMKcwBrGZaJPIjssqXqFgrQk7A3UBC1DnlHH8Nge8oVYm7yhVAL1zNTqEdM8REPM1Jp38rabgMZ8AhWz9-qJAmDyax26Q',
  },
]

const defaultTurnoverRules: TurnoverRules = {
  cleaningOffsetDays: 0,
  // You asked for all properties to be cleaned before check-in.
  enableArrivalPrep: true,
  arrivalPrepDaysBefore: 1,
  enableMidStay: true,
  // Example requested: 10-day stay => day 4 and day 8.
  midStayFirstCleanDay: 4,
  midStayRepeatEveryDays: 4,
  skipMidStayIfCheckoutNextDay: true,
  defaultCleaningDueTime: '12:00',
}

function normalizeTurnoverRules(
  incoming: Partial<TurnoverRules> | null | undefined,
): TurnoverRules {
  const merged = { ...defaultTurnoverRules, ...(incoming ?? {}) }
  return {
    cleaningOffsetDays: Number.isFinite(merged.cleaningOffsetDays)
      ? merged.cleaningOffsetDays
      : defaultTurnoverRules.cleaningOffsetDays,
    enableArrivalPrep: Boolean(merged.enableArrivalPrep),
    arrivalPrepDaysBefore: Number.isFinite(merged.arrivalPrepDaysBefore)
      ? Math.max(0, merged.arrivalPrepDaysBefore)
      : defaultTurnoverRules.arrivalPrepDaysBefore,
    enableMidStay: Boolean(merged.enableMidStay),
    midStayFirstCleanDay: Number.isFinite(merged.midStayFirstCleanDay)
      ? Math.max(2, merged.midStayFirstCleanDay)
      : defaultTurnoverRules.midStayFirstCleanDay,
    midStayRepeatEveryDays: Number.isFinite(merged.midStayRepeatEveryDays)
      ? Math.max(1, merged.midStayRepeatEveryDays)
      : defaultTurnoverRules.midStayRepeatEveryDays,
    skipMidStayIfCheckoutNextDay: Boolean(
      merged.skipMidStayIfCheckoutNextDay,
    ),
    defaultCleaningDueTime:
      typeof merged.defaultCleaningDueTime === 'string' &&
      /^\d{2}:\d{2}$/.test(merged.defaultCleaningDueTime)
        ? merged.defaultCleaningDueTime
        : defaultTurnoverRules.defaultCleaningDueTime,
  }
}

function shiftISO(isoDate: string, days: number): string {
  const base = parseISO(`${isoDate}T00:00:00`)
  return format(addDays(base, days), 'yyyy-MM-dd')
}

function stayNights(e: CalendarEvent): number {
  if (typeof e.nights === 'number' && e.nights > 0) return e.nights
  const from = parseISO(`${e.date_from}T00:00:00`)
  const to = parseISO(`${e.date_to}T00:00:00`)
  const ms = to.getTime() - from.getTime()
  const nights = Math.round(ms / (1000 * 60 * 60 * 24))
  return Math.max(0, nights)
}

function fireAndForget(p: Promise<unknown>) {
  void p.catch((err) => {
    console.warn('Local DB sync failed:', err)
  })
}

function makeId(prefix: string): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${rand}`
}

function isCleanerActiveOnDate(
  cleanerId: string,
  dateISO: string,
  availabilityById: Record<string, CleanerAvailabilityPeriod[]>,
): boolean {
  const periods = availabilityById[cleanerId]
  if (!periods || periods.length === 0) return true
  return periods.some((p) => p.from <= dateISO && (p.to === null || p.to >= dateISO))
}

function formatTime(t?: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function computeBoardTasks(
  events: CalendarEvent[],
  rentals: Rental[],
  manualCleanings: ManualCleaningTask[],
  cleaningEnabled: Record<string, boolean>,
  overrides: Record<string, TaskColumn>,
  boardDateISO: string,
  boardEndDateISO: string,
  rules: TurnoverRules,
  completedTaskAt: Record<string, string>,
  taskNotes: Record<string, string>,
  taskPriority: Record<string, Priority>,
  carryForwardStartDate: string | null,
  realTodayISO: string,
  includeCarry: boolean,
): BoardTask[] {
  const rentalName = (id: string) =>
    rentals.find((r) => r.id === id)?.name ??
    events.find((e) => e.rental?.id === id)?.rental?.name ??
    'Property'

  const tasks: BoardTask[] = []

  function shouldInclude(taskId: string, taskDateISO: string): boolean {
    if (taskDateISO > boardEndDateISO) return false
    const completedAt = completedTaskAt[taskId]
    if (completedAt) {
      // Keep done cards visible in the selected planning range.
      return completedAt >= boardDateISO && completedAt <= boardEndDateISO
    }
    if (!includeCarry) return taskDateISO >= boardDateISO
    // Carry-forward only begins once the task's actual calendar day has passed.
    const dayHasActuallyPassed = taskDateISO < realTodayISO
    if (taskDateISO < boardDateISO && !dayHasActuallyPassed) {
      return false
    }
    // Carry-forward (past unfinished into selected date) starts at first live sync day.
    if (
      taskDateISO < boardDateISO &&
      carryForwardStartDate &&
      taskDateISO < carryForwardStartDate
    ) {
      return false
    }
    return true
  }

  function isCarried(taskDateISO: string): boolean {
    return includeCarry && taskDateISO < boardDateISO
  }

  for (const e of events) {
    if (!isBookingEvent(e)) continue
    const rid = resolveRentalIdForEvent(e, rentals)
    if (!rid) continue
    const cleaningOn = cleaningEnabled[rid] !== false

    const checkoutCleaningDate = shiftISO(e.date_to, rules.cleaningOffsetDays)
    if (cleaningOn && shouldInclude(`cleaning-checkout-${e.id}`, checkoutCleaningDate)) {
      const id = `cleaning-checkout-${e.id}`
      const col: TaskColumn = overrides[id] ?? 'checkouts'
      const done = Boolean(completedTaskAt[id])
      const carried = isCarried(checkoutCleaningDate)
      tasks.push({
        id,
        kind: 'cleaning',
        eventId: e.id,
        rentalId: rid,
        rentalName: rentalName(rid),
        plannedDate: checkoutCleaningDate,
        done,
        title: e.rental?.name ?? rentalName(rid),
        timeLabel: carried
          ? `Carried from ${checkoutCleaningDate} · Due ${formatTime(e.check_out_time ?? rules.defaultCleaningDueTime)}`
          : `Due ${formatTime(e.check_out_time ?? rules.defaultCleaningDueTime)}`,
        badge: 'CHECKOUT',
        priority: taskPriority[id] ?? 'medium',
        carriedOver: carried,
        note: taskNotes[id] ?? '',
        column: col,
      })
    }

    if (cleaningOn && rules.enableArrivalPrep) {
      const prepDate = format(
        subDays(parseISO(`${e.date_from}T00:00:00`), rules.arrivalPrepDaysBefore),
        'yyyy-MM-dd',
      )
      if (shouldInclude(`cleaning-prep-${e.id}`, prepDate)) {
        const id = `cleaning-prep-${e.id}`
        const col: TaskColumn = overrides[id] ?? 'turnovers'
        const done = Boolean(completedTaskAt[id])
        const carried = isCarried(prepDate)
        tasks.push({
          id,
          kind: 'cleaning',
          eventId: e.id,
          rentalId: rid,
          rentalName: rentalName(rid),
          plannedDate: prepDate,
          done,
          title: e.rental?.name ?? rentalName(rid),
          timeLabel: carried
            ? `Carried from ${prepDate} · Prep by ${formatTime(rules.defaultCleaningDueTime)}`
            : `Prep by ${formatTime(rules.defaultCleaningDueTime)}`,
          badge: 'TURNOVER',
          priority: taskPriority[id] ?? 'medium',
          carriedOver: carried,
          note: taskNotes[id] ?? '',
          column: col,
        })
      }
    }

    if (cleaningOn && rules.enableMidStay) {
      const nights = stayNights(e)
      if (nights >= rules.midStayFirstCleanDay) {
        const every = Math.max(1, rules.midStayRepeatEveryDays)
        for (let stayDay = rules.midStayFirstCleanDay; stayDay <= nights; stayDay += every) {
          // stayDay 1 = check-in date, so date offset is stayDay-1.
          const cleanDate = format(
            addDays(parseISO(`${e.date_from}T00:00:00`), stayDay - 1),
            'yyyy-MM-dd',
          )
          if (rules.skipMidStayIfCheckoutNextDay) {
            const checkoutNextDay = cleanDate === shiftISO(e.date_to, -1)
            if (checkoutNextDay) continue
          }
          const id = `cleaning-midstay-${e.id}-${stayDay}`
          if (!shouldInclude(id, cleanDate)) continue
          const col: TaskColumn = overrides[id] ?? 'turnovers'
          const done = Boolean(completedTaskAt[id])
          const carried = isCarried(cleanDate)
          tasks.push({
            id,
            kind: 'cleaning',
            eventId: e.id,
            rentalId: rid,
            rentalName: rentalName(rid),
            plannedDate: cleanDate,
            done,
            title: e.rental?.name ?? rentalName(rid),
            timeLabel: carried
              ? `Carried from ${cleanDate} · Mid-stay day ${stayDay} · ${formatTime(rules.defaultCleaningDueTime)}`
              : `Mid-stay · day ${stayDay} · ${formatTime(rules.defaultCleaningDueTime)}`,
            badge: 'MID-STAY',
            priority: taskPriority[id] ?? 'medium',
            carriedOver: carried,
            note: taskNotes[id] ?? '',
            column: col,
          })
        }
      }
    }
  }

  for (const manual of manualCleanings) {
    const id = manual.id
    if (!shouldInclude(id, manual.plannedDate)) continue
    const done = Boolean(completedTaskAt[id])
    const carried = isCarried(manual.plannedDate)
    const col: TaskColumn = overrides[id] ?? manual.column
    tasks.push({
      id,
      kind: 'cleaning',
      eventId: id,
      rentalId: manual.rentalId,
      rentalName: rentalName(manual.rentalId),
      plannedDate: manual.plannedDate,
      done,
      title: rentalName(manual.rentalId),
      timeLabel: carried
        ? `Carried from ${manual.plannedDate} · Manual cleaning`
        : 'Manual cleaning',
      badge: 'MANUAL',
      priority: taskPriority[id] ?? 'medium',
      carriedOver: carried,
      note: taskNotes[id] ?? '',
      column: col,
    })
  }

  return tasks
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      liveFromHosthub: false,
      carryForwardStartDate: null,
      selectedBoardDate: todayISO(),
      planningWindow: 'day',
      turnoverRules: defaultTurnoverRules,
      assignmentHistory: [],
      completedTaskAt: {},
      taskNotes: {},
      taskPriority: {},
      manualCleanings: [],
      syncStatus: 'idle',
      syncMessage: '',
      autoSyncMinutes: 30,
      brandLogoDataUrl: null,
      faviconDataUrl: null,
      rentals: demoRentals,
      events: buildDemoEvents(),
      cleaningEnabledByRentalId: Object.fromEntries(
        demoRentals.map((r) => [r.id, true]),
      ),
      cleaners: defaultCleaners,
      cleanerAvailabilityById: Object.fromEntries(
        defaultCleaners.map((c) => [c.id, [{ from: '1970-01-01', to: null }]]),
      ),
      taskColumnOverride: { 'cleaning-e3': 'cleaner:c1' },

      setApiKey: (apiKey) =>
        set(() => {
          const normalized = normalizeHosthubApiKey(apiKey)
          fireAndForget(localDbApi.saveSettings({ apiKey: normalized }))
          return { apiKey: normalized }
        }),
      setAutoSyncMinutes: (autoSyncMinutes) =>
        set(() => {
          const safe = Math.max(0, Math.min(1440, Number(autoSyncMinutes) || 0))
          fireAndForget(localDbApi.saveSettings({ autoSyncMinutes: safe }))
          return { autoSyncMinutes: safe }
        }),
      setBrandLogoDataUrl: (brandLogoDataUrl) =>
        set(() => {
          fireAndForget(localDbApi.saveSettings({ brandLogoDataUrl }))
          return { brandLogoDataUrl }
        }),
      setFaviconDataUrl: (faviconDataUrl) =>
        set(() => {
          fireAndForget(localDbApi.saveSettings({ faviconDataUrl }))
          return { faviconDataUrl }
        }),
      setSelectedBoardDate: (selectedBoardDate) => {
        set({ selectedBoardDate })
        fireAndForget(localDbApi.saveSettings({ selectedBoardDate }))
      },
      setPlanningWindow: (planningWindow) => set({ planningWindow }),
      setTurnoverRules: (patch) =>
        set((s) => {
          const turnoverRules = normalizeTurnoverRules({
            ...s.turnoverRules,
            ...patch,
          })
          fireAndForget(localDbApi.saveSettings({ turnoverRules }))
          return { turnoverRules }
        }),

      toggleCleaning: (rentalId, on) =>
        set((s) => {
          const cleaningEnabledByRentalId = {
            ...s.cleaningEnabledByRentalId,
            [rentalId]: on,
          }
          fireAndForget(localDbApi.savePropertyOverrides(cleaningEnabledByRentalId))
          return { cleaningEnabledByRentalId }
        }),

      setCleaners: (cleaners) => {
        set({ cleaners })
        fireAndForget(localDbApi.saveCleaners(cleaners))
      },

      addCleaner: (name) => {
        const n = name.trim()
        if (!n) return
        set((s) => {
          const id = makeId('cleaner')
          const cleaners = [...s.cleaners, { id, name: n }]
          const cleanerAvailabilityById = {
            ...s.cleanerAvailabilityById,
            [id]: [{ from: todayISO(), to: null }],
          }
          fireAndForget(localDbApi.saveCleaners(cleaners))
          fireAndForget(localDbApi.saveSettings({ cleanerAvailabilityById }))
          return { cleaners, cleanerAvailabilityById }
        })
      },

      setCleanerActive: (id, active) =>
        set((s) => {
          const raw = s.cleanerAvailabilityById[id]
          const current =
            raw && raw.length > 0 ? raw : [{ from: '1970-01-01', to: null }]
          const refDate = s.selectedBoardDate
          const activeNow = isCleanerActiveOnDate(
            id,
            refDate,
            { ...s.cleanerAvailabilityById, [id]: current },
          )
          let next = [...current]

          if (active && !activeNow) {
            next.push({ from: refDate, to: null })
          }
          if (!active && activeNow) {
            const openIdx = [...next]
              .map((p, i) => ({ p, i }))
              .reverse()
              .find(({ p }) => p.to === null)?.i
            if (openIdx !== undefined) {
              const open = next[openIdx]
              if (open.from >= refDate) {
                next = next.filter((_, i) => i !== openIdx)
              } else {
                next[openIdx] = {
                  ...open,
                  to: format(
                    subDays(parseISO(`${refDate}T00:00:00`), 1),
                    'yyyy-MM-dd',
                  ),
                }
              }
            }
          }

          // When a cleaner is switched off, move that cleaner's future-assigned tasks
          // back to their default unassigned columns (checkouts/turnovers).
          let taskColumnOverride = s.taskColumnOverride
          if (!active && activeNow) {
            const boardEndDate = format(
              addDays(parseISO(`${refDate}T00:00:00`), 730),
              'yyyy-MM-dd',
            )
            const projectedTasks = computeBoardTasks(
              s.events,
              s.rentals,
              s.manualCleanings,
              s.cleaningEnabledByRentalId,
              s.taskColumnOverride,
              refDate,
              boardEndDate,
              s.turnoverRules,
              s.completedTaskAt,
              s.taskNotes,
              s.taskPriority,
              s.carryForwardStartDate,
              todayISO(),
              false,
            )
            const futureTaskIds = new Set(
              projectedTasks
                .filter((t) => t.plannedDate >= refDate && t.column === `cleaner:${id}`)
                .map((t) => t.id),
            )
            if (futureTaskIds.size > 0) {
              taskColumnOverride = Object.fromEntries(
                Object.entries(s.taskColumnOverride).filter(
                  ([taskId, col]) =>
                    !(col === `cleaner:${id}` && futureTaskIds.has(taskId)),
                ),
              )
            }
          }

          const cleanerAvailabilityById = {
            ...s.cleanerAvailabilityById,
            [id]: next,
          }
          fireAndForget(localDbApi.saveSettings({ cleanerAvailabilityById }))
          fireAndForget(localDbApi.saveSettings({ taskColumnOverride }))
          return { cleanerAvailabilityById, taskColumnOverride }
        }),

      removeCleaner: (id) =>
        set((s) => {
          const cleaners = s.cleaners.filter((c) => c.id !== id)
          const taskColumnOverride = Object.fromEntries(
            Object.entries(s.taskColumnOverride).filter(
              ([, col]) => col !== `cleaner:${id}`,
            ),
          )
          const cleanerAvailabilityById = Object.fromEntries(
            Object.entries(s.cleanerAvailabilityById).filter(([k]) => k !== id),
          )
          fireAndForget(localDbApi.saveCleaners(cleaners))
          fireAndForget(localDbApi.saveSettings({ cleanerAvailabilityById }))
          fireAndForget(localDbApi.saveSettings({ taskColumnOverride }))
          return { cleaners, taskColumnOverride, cleanerAvailabilityById }
        }),

      moveTask: (taskId, column) =>
        set((s) => {
          const prev = s.taskColumnOverride[taskId]
          const nextOverrides = { ...s.taskColumnOverride, [taskId]: column }
          let nextHistory = s.assignmentHistory
          if (column.startsWith('cleaner:') && prev !== column) {
            const tasks = computeBoardTasks(
              s.events,
              s.rentals,
              s.manualCleanings,
              s.cleaningEnabledByRentalId,
              nextOverrides,
              s.selectedBoardDate,
              s.planningWindow === 'day'
                ? s.selectedBoardDate
                : s.planningWindow === 'week'
                  ? format(
                      addDays(parseISO(`${s.selectedBoardDate}T00:00:00`), 6),
                      'yyyy-MM-dd',
                    )
                  : format(
                      addDays(parseISO(`${s.selectedBoardDate}T00:00:00`), 29),
                      'yyyy-MM-dd',
                    ),
              s.turnoverRules,
              s.completedTaskAt,
              s.taskNotes,
              s.taskPriority,
              s.carryForwardStartDate,
              todayISO(),
              s.planningWindow === 'day',
            )
            const t = tasks.find((x) => x.id === taskId)
            if (t) {
              nextHistory = [
                ...s.assignmentHistory,
                {
                  id: makeId('assignment'),
                  taskId: t.id,
                  eventId: t.eventId,
                  rentalId: t.rentalId,
                  cleanerId: column.slice('cleaner:'.length),
                  plannedDate: s.selectedBoardDate,
                  assignedAt: new Date().toISOString(),
                },
              ].slice(-2000)
            }
          }
          fireAndForget(localDbApi.saveAssignments(nextHistory))
          fireAndForget(localDbApi.saveSettings({ taskColumnOverride: nextOverrides }))
          return {
            taskColumnOverride: nextOverrides,
            assignmentHistory: nextHistory,
          }
        }),

      setTaskCompleted: (taskId, done) =>
        set((s) => {
          const completedTaskAt = done
            ? { ...s.completedTaskAt, [taskId]: s.selectedBoardDate }
            : Object.fromEntries(
                Object.entries(s.completedTaskAt).filter(([k]) => k !== taskId),
              )
          fireAndForget(localDbApi.saveCompletion(completedTaskAt))
          return { completedTaskAt }
        }),
      setTaskNote: (taskId, note) =>
        set((s) => {
          const n = note.trim()
          const taskNotes = n
            ? { ...s.taskNotes, [taskId]: n }
            : Object.fromEntries(
                Object.entries(s.taskNotes).filter(([k]) => k !== taskId),
              )
          fireAndForget(localDbApi.saveSettings({ taskNotes }))
          return { taskNotes }
        }),
      setTaskPriority: (taskId, priority) =>
        set((s) => {
          const taskPriority = { ...s.taskPriority, [taskId]: priority }
          fireAndForget(localDbApi.saveSettings({ taskPriority }))
          return { taskPriority }
        }),
      addManualCleaning: ({ rentalId, plannedDate, column, note, priority }) =>
        set((s) => {
          const id = makeId('manual-cleaning')
          const manualCleanings = [
            ...s.manualCleanings,
            { id, rentalId, plannedDate, column },
          ]
          const taskColumnOverride = {
            ...s.taskColumnOverride,
            [id]: column,
          }
          const n = note?.trim() ?? ''
          const taskNotes = n ? { ...s.taskNotes, [id]: n } : s.taskNotes
          const taskPriority = { ...s.taskPriority, [id]: priority }
          fireAndForget(localDbApi.saveSettings({ manualCleanings }))
          fireAndForget(localDbApi.saveSettings({ taskColumnOverride }))
          fireAndForget(localDbApi.saveSettings({ taskNotes }))
          fireAndForget(localDbApi.saveSettings({ taskPriority }))
          return { manualCleanings, taskColumnOverride, taskNotes, taskPriority }
        }),

      hydrateFromDb: async () => {
        const boot = await fetchBootstrap()
        if (!boot) return
        set((s) => ({
          apiKey:
            typeof boot.apiKey === 'string'
              ? normalizeHosthubApiKey(boot.apiKey)
              : s.apiKey,
          selectedBoardDate:
            typeof boot.selectedBoardDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(boot.selectedBoardDate)
              ? boot.selectedBoardDate
              : s.selectedBoardDate,
          turnoverRules: normalizeTurnoverRules(
            boot.turnoverRules ?? s.turnoverRules,
          ),
          carryForwardStartDate:
            boot.carryForwardStartDate ?? s.carryForwardStartDate,
          liveFromHosthub: boot.liveFromHosthub ?? s.liveFromHosthub,
          autoSyncMinutes:
            typeof boot.autoSyncMinutes === 'number'
              ? Math.max(0, Math.min(1440, boot.autoSyncMinutes))
              : s.autoSyncMinutes,
          brandLogoDataUrl:
            typeof boot.brandLogoDataUrl === 'string'
              ? boot.brandLogoDataUrl
              : s.brandLogoDataUrl,
          faviconDataUrl:
            typeof boot.faviconDataUrl === 'string'
              ? boot.faviconDataUrl
              : s.faviconDataUrl,
          cleaners: boot.cleaners,
          cleanerAvailabilityById:
            boot.cleanerAvailabilityById ?? s.cleanerAvailabilityById,
          taskColumnOverride: boot.taskColumnOverride ?? s.taskColumnOverride,
          cleaningEnabledByRentalId:
            Object.keys(boot.propertyOverrides).length > 0
              ? boot.propertyOverrides
              : s.cleaningEnabledByRentalId,
          assignmentHistory: boot.assignmentHistory,
          completedTaskAt: boot.completedTaskAt,
          taskNotes: boot.taskNotes ?? s.taskNotes,
          taskPriority: boot.taskPriority ?? s.taskPriority,
          manualCleanings: Array.isArray(boot.manualCleanings)
            ? boot.manualCleanings
            : s.manualCleanings,
          rentals: boot.rentals.length > 0 ? boot.rentals : s.rentals,
          events: boot.events.length > 0 ? boot.events : s.events,
        }))
      },

      hydrateLocalStateFromDb: async () => {
        const boot = await fetchLocalState()
        if (!boot) return
        set((s) => ({
          apiKey:
            typeof boot.apiKey === 'string'
              ? normalizeHosthubApiKey(boot.apiKey)
              : s.apiKey,
          selectedBoardDate:
            typeof boot.selectedBoardDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(boot.selectedBoardDate)
              ? boot.selectedBoardDate
              : s.selectedBoardDate,
          turnoverRules: normalizeTurnoverRules(
            boot.turnoverRules ?? s.turnoverRules,
          ),
          carryForwardStartDate:
            boot.carryForwardStartDate ?? s.carryForwardStartDate,
          liveFromHosthub: boot.liveFromHosthub ?? s.liveFromHosthub,
          autoSyncMinutes:
            typeof boot.autoSyncMinutes === 'number'
              ? Math.max(0, Math.min(1440, boot.autoSyncMinutes))
              : s.autoSyncMinutes,
          brandLogoDataUrl:
            typeof boot.brandLogoDataUrl === 'string'
              ? boot.brandLogoDataUrl
              : boot.brandLogoDataUrl === null
                ? null
                : s.brandLogoDataUrl,
          faviconDataUrl:
            typeof boot.faviconDataUrl === 'string'
              ? boot.faviconDataUrl
              : boot.faviconDataUrl === null
                ? null
                : s.faviconDataUrl,
          cleaners: boot.cleaners,
          cleanerAvailabilityById:
            boot.cleanerAvailabilityById ?? s.cleanerAvailabilityById,
          taskColumnOverride: boot.taskColumnOverride ?? s.taskColumnOverride,
          cleaningEnabledByRentalId:
            Object.keys(boot.propertyOverrides).length > 0
              ? boot.propertyOverrides
              : s.cleaningEnabledByRentalId,
          assignmentHistory: boot.assignmentHistory,
          completedTaskAt: boot.completedTaskAt,
          taskNotes: boot.taskNotes ?? s.taskNotes,
          taskPriority: boot.taskPriority ?? s.taskPriority,
          manualCleanings: Array.isArray(boot.manualCleanings)
            ? boot.manualCleanings
            : s.manualCleanings,
        }))
      },

      seedDemo: () => {
        set({
          apiKey: '',
          liveFromHosthub: false,
          carryForwardStartDate: null,
          selectedBoardDate: todayISO(),
          planningWindow: 'day',
          turnoverRules: defaultTurnoverRules,
          assignmentHistory: [],
          completedTaskAt: {},
          taskNotes: {},
          taskPriority: {},
          manualCleanings: [],
          autoSyncMinutes: 30,
          brandLogoDataUrl: null,
          faviconDataUrl: null,
          rentals: demoRentals,
          events: buildDemoEvents(),
          cleaningEnabledByRentalId: Object.fromEntries(
            demoRentals.map((r) => [r.id, true]),
          ),
          cleaners: defaultCleaners,
          cleanerAvailabilityById: Object.fromEntries(
            defaultCleaners.map((c) => [c.id, [{ from: '1970-01-01', to: null }]]),
          ),
          taskColumnOverride: { 'cleaning-e3': 'cleaner:c1' },
          syncStatus: 'idle',
          syncMessage: '',
        })
        fireAndForget(localDbApi.resetAll())
      },

      syncFromHosthub: async (apiKeyOverride) => {
        const key = normalizeHosthubApiKey(apiKeyOverride ?? get().apiKey)
        if (!key) {
          set({
            syncStatus: 'error',
            syncMessage:
              'No API key found. Paste your Hosthub key below, then click “Save & sync from Hosthub”.',
          })
          return
        }
        set({ apiKey: key, syncStatus: 'syncing', syncMessage: '' })
        try {
          const rentalList = await listRentals(key)
          const eventList = await listCalendarEventsWithRentalFallback(
            key,
            rentalList,
          )
          const state = get()
          const firstSyncDate = state.carryForwardStartDate ?? todayISO()
          // Keep existing local property toggles where possible; default new rentals to true.
          const cleaning: Record<string, boolean> = Object.fromEntries(
            rentalList.map((r) => [r.id, state.cleaningEnabledByRentalId[r.id] ?? true]),
          )
          await Promise.all([
            localDbApi.saveSettings({
              apiKey: key,
              carryForwardStartDate: firstSyncDate,
              liveFromHosthub: true,
            }),
            localDbApi.savePropertyOverrides(cleaning),
          ])
          await localDbApi.saveBookingsCacheChunked(rentalList, eventList)
          try {
            window.localStorage.setItem('ops:lastHosthubSyncAt', String(Date.now()))
          } catch {
            // Ignore storage write errors.
          }
          set((s) => ({
            liveFromHosthub: true,
            rentals: rentalList,
            events: eventList,
            cleaningEnabledByRentalId: cleaning,
            // Preserve local card state across API re-sync.
            cleaners: s.cleaners,
            cleanerAvailabilityById: s.cleanerAvailabilityById,
            taskColumnOverride: s.taskColumnOverride,
            completedTaskAt: s.completedTaskAt,
            taskNotes: s.taskNotes,
            taskPriority: s.taskPriority,
            carryForwardStartDate: firstSyncDate,
            syncStatus: 'ok',
            syncMessage: `Read-only sync: ${rentalList.length} rentals, ${eventList.length} calendar events. Local card state was preserved.`,
          }))
        } catch (e: unknown) {
          let msg = 'Sync failed'
          if (e instanceof HosthubError) {
            const hint = e.body?.trim()
            msg = hint ? `${e.message}: ${hint.slice(0, 500)}` : e.message
          } else if (e instanceof Error) {
            msg = e.message
          }
          set({ syncStatus: 'error', syncMessage: msg })
        }
      },
    }),
    {
      name: 'ptp-storage',
      // Keep localStorage empty and use shared DB-backed state through /api endpoints.
      // This avoids different behavior between localhost/LAN URLs and between browsers.
      partialize: () => ({}),
    },
  ),
)

export function useBoardTasks(): BoardTask[] {
  const rentals = useAppStore((s) => s.rentals)
  const events = useAppStore((s) => s.events)
  const manualCleanings = useAppStore((s) => s.manualCleanings)
  const cleaning = useAppStore((s) => s.cleaningEnabledByRentalId)
  const overrides = useAppStore((s) => s.taskColumnOverride)
  const selectedBoardDate = useAppStore((s) => s.selectedBoardDate)
  const planningWindow = useAppStore((s) => s.planningWindow)
  const turnoverRules = useAppStore((s) => s.turnoverRules)
  const completedTaskAt = useAppStore((s) => s.completedTaskAt)
  const taskNotes = useAppStore((s) => s.taskNotes)
  const taskPriority = useAppStore((s) => s.taskPriority)
  const boardEndDate =
    planningWindow === 'day'
      ? selectedBoardDate
      : planningWindow === 'week'
        ? format(addDays(parseISO(`${selectedBoardDate}T00:00:00`), 6), 'yyyy-MM-dd')
        : format(addDays(parseISO(`${selectedBoardDate}T00:00:00`), 29), 'yyyy-MM-dd')
  return computeBoardTasks(
    events,
    rentals,
    manualCleanings,
    cleaning,
    overrides,
    selectedBoardDate,
    boardEndDate,
    turnoverRules,
    completedTaskAt,
    taskNotes,
    taskPriority,
    useAppStore.getState().carryForwardStartDate,
    todayISO(),
    planningWindow === 'day',
  )
}
