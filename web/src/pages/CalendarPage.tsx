import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Icon } from '../components/Icon'
import { type BoardTask, computeBoardTasks, useAppStore } from '../store/appStore'

type DayInfo = {
  dateISO: string
  bookings: number
  cleanings: BoardTask[]
}

function nextISODate(iso: string): string {
  return format(addDays(parseISO(`${iso}T00:00:00`), 1), 'yyyy-MM-dd')
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function buildCleaningIcs(tasks: BoardTask[], cleanerNameById: Record<string, string>): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpsBoard//Cleaning Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:OpsBoard Cleanings',
  ]
  const nowUtc = format(new Date(), "yyyyMMdd'T'HHmmss'Z'")

  for (const t of tasks) {
    const cleanerId = t.column.startsWith('cleaner:') ? t.column.slice('cleaner:'.length) : ''
    const cleaner = cleanerId ? cleanerNameById[cleanerId] ?? 'Unassigned' : 'Unassigned'
    const desc = [
      `Property: ${t.title}`,
      `Type: ${t.badge}`,
      `Priority: ${t.priority.toUpperCase()}`,
      `Cleaner: ${cleaner}`,
      `Done: ${t.done ? 'Yes' : 'No'}`,
      t.note ? `Notes: ${t.note}` : undefined,
    ]
      .filter(Boolean)
      .join('\n')

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${escapeIcs(`${t.id}-${t.plannedDate}@opsboard.local`)}`)
    lines.push(`DTSTAMP:${nowUtc}`)
    lines.push(`DTSTART;VALUE=DATE:${t.plannedDate.replaceAll('-', '')}`)
    lines.push(`DTEND;VALUE=DATE:${nextISODate(t.plannedDate).replaceAll('-', '')}`)
    lines.push(`SUMMARY:${escapeIcs(`[${t.badge}] ${t.title}`)}`)
    lines.push(`DESCRIPTION:${escapeIcs(desc)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function CalendarPage() {
  const events = useAppStore((s) => s.events)
  const rentals = useAppStore((s) => s.rentals)
  const manualCleanings = useAppStore((s) => s.manualCleanings)
  const cleaningEnabled = useAppStore((s) => s.cleaningEnabledByRentalId)
  const overrides = useAppStore((s) => s.taskColumnOverride)
  const turnoverRules = useAppStore((s) => s.turnoverRules)
  const completedTaskAt = useAppStore((s) => s.completedTaskAt)
  const taskNotes = useAppStore((s) => s.taskNotes)
  const taskPriority = useAppStore((s) => s.taskPriority)
  const carryForwardStartDate = useAppStore((s) => s.carryForwardStartDate)
  const cleaners = useAppStore((s) => s.cleaners)
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [openedDay, setOpenedDay] = useState<string | null>(null)

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, DayInfo>()
    for (const d of days) {
      const iso = format(d, 'yyyy-MM-dd')
      m.set(iso, { dateISO: iso, bookings: 0, cleanings: [] })
    }

    // Booking count (for occupancy context)
    for (const e of events) {
      const from = parseISO(e.date_from + 'T12:00:00')
      const to = parseISO(e.date_to + 'T12:00:00')
      const nights = Math.max(1, differenceInCalendarDays(to, from))
      for (let i = 0; i < nights; i += 1) {
        const k = format(addDays(from, i), 'yyyy-MM-dd')
        const row = m.get(k)
        if (!row) continue
        row.bookings += 1
      }
    }

    // Compute once for the whole visible calendar range, then group by planned day.
    const rangeStart = format(gridStart, 'yyyy-MM-dd')
    const rangeEnd = format(gridEnd, 'yyyy-MM-dd')
    const tasksInRange = computeBoardTasks(
      events,
      rentals,
      manualCleanings,
      cleaningEnabled,
      overrides,
      rangeStart,
      rangeEnd,
      turnoverRules,
      completedTaskAt,
      taskNotes,
      taskPriority,
      carryForwardStartDate,
      format(new Date(), 'yyyy-MM-dd'),
      false,
    )
    for (const t of tasksInRange) {
      const row = m.get(t.plannedDate)
      if (!row) continue
      row.cleanings.push(t)
    }

    return m
  }, [
    days,
    gridStart,
    gridEnd,
    events,
    rentals,
    manualCleanings,
    cleaningEnabled,
    overrides,
    turnoverRules,
    completedTaskAt,
    taskNotes,
    taskPriority,
    carryForwardStartDate,
  ])

  const cleanerNameById = useMemo(
    () => Object.fromEntries(cleaners.map((c) => [c.id, c.name])),
    [cleaners],
  )

  const monthCleanings = useMemo(() => {
    const arr: BoardTask[] = []
    for (const d of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
      const iso = format(d, 'yyyy-MM-dd')
      const row = byDay.get(iso)
      if (row) arr.push(...row.cleanings)
    }
    return arr
  }, [monthStart, monthEnd, byDay])

  const openedDayInfo = openedDay ? byDay.get(openedDay) ?? null : null

  function downloadIcal() {
    const ics = buildCleaningIcs(monthCleanings, cleanerNameById)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opsboard-cleanings-${format(monthStart, 'yyyy-MM')}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadIcal}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
            title="Export cleanings to .ics file for Google Calendar import"
          >
            Export iCal (.ics)
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={() => setCursor(subMonths(cursor, 1))}
          >
            Prev
          </button>
          <span className="min-w-[10rem] text-center font-['Manrope'] text-sm font-semibold">
            {format(monthStart, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            Next
          </button>
        </div>
      </header>
      <div className="p-8">
        <div className="mb-2 grid grid-cols-7 gap-2 text-center font-['Inter'] text-xs font-semibold uppercase tracking-wide text-slate-500">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const k = format(d, 'yyyy-MM-dd')
            const row = byDay.get(k)
            const bookingCount = row?.bookings ?? 0
            const cleaningCount = row?.cleanings.length ?? 0
            const inMonth = isSameMonth(d, cursor)
            return (
              <div
                key={k}
                onClick={() => setOpenedDay(k)}
                className={clsx(
                  'min-h-[110px] cursor-pointer rounded-xl border p-2 task-card-shadow',
                  inMonth ? 'border-slate-100 bg-white' : 'border-transparent bg-slate-50/50 opacity-40',
                  isSameDay(d, new Date()) && 'ring-2 ring-secondary',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-['Manrope'] text-sm font-semibold">{format(d, 'd')}</span>
                  {bookingCount > 0 && (
                    <span className="flex items-center gap-0.5 text-secondary">
                      <Icon name="event" className="text-[16px]" />
                      <span className="text-xs font-bold">{bookingCount}</span>
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <Icon name="cleaning_services" className="text-[14px]" />
                    <span className="font-semibold">{cleaningCount} cleanings</span>
                  </div>
                  {(row?.cleanings ?? []).slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className="truncate rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700"
                    >
                      {t.badge}: {t.title}
                    </div>
                  ))}
                  {(row?.cleanings.length ?? 0) > 2 && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      +{(row?.cleanings.length ?? 0) - 2} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {openedDayInfo && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 p-4"
          onClick={() => setOpenedDay(null)}
        >
          <div
            className="mx-auto mt-10 max-w-2xl rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-['Manrope'] text-xl font-bold text-slate-900">
                {format(parseISO(`${openedDayInfo.dateISO}T00:00:00`), 'EEEE, MMM d, yyyy')}
              </h2>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setOpenedDay(null)}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                Bookings: <strong>{openedDayInfo.bookings}</strong> · Cleanings:{' '}
                <strong>{openedDayInfo.cleanings.length}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Includes notes, assigned cleaner, priority and done state.
              </p>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
              {openedDayInfo.cleanings.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                  No cleanings scheduled for this date.
                </p>
              )}
              {openedDayInfo.cleanings.map((t) => {
                const cleanerId = t.column.startsWith('cleaner:')
                  ? t.column.slice('cleaner:'.length)
                  : null
                const cleaner = cleanerId
                  ? cleanerNameById[cleanerId] ?? 'Assigned'
                  : 'Unassigned'
                return (
                  <article
                    key={t.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{t.title}</h3>
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          t.done
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {t.done ? 'Done' : 'Open'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {t.badge} · Priority: <strong>{t.priority}</strong> · Cleaner:{' '}
                      <strong>{cleaner}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t.timeLabel}</p>
                    {t.note && (
                      <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                        {t.note}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
