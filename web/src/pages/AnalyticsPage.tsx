import {
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Icon } from '../components/Icon'
import { computeBoardTasks, useAppStore } from '../store/appStore'

type Row = { label: string; value: number }

export function AnalyticsPage() {
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

  const [fromDate, setFromDate] = useState(() =>
    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [toDate, setToDate] = useState(() =>
    format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  )

  const range = useMemo(() => {
    if (!fromDate || !toDate) return null
    if (fromDate > toDate) return null
    return { from: fromDate, to: toDate }
  }, [fromDate, toDate])

  const metrics = useMemo(() => {
    if (!range) {
      return {
        tasks: [],
        checkouts: 0,
        turnovers: 0,
        completionRate: 0,
        assignmentRate: 0,
        propertiesCovered: 0,
        cleanerRows: [] as Row[],
        propertyRows: [] as Row[],
      }
    }

    const tasks = computeBoardTasks(
      events,
      rentals,
      manualCleanings,
      cleaningEnabled,
      overrides,
      range.from,
      range.to,
      turnoverRules,
      completedTaskAt,
      taskNotes,
      taskPriority,
      carryForwardStartDate,
      format(new Date(), 'yyyy-MM-dd'),
      false,
    )

    const cleanerById = Object.fromEntries(cleaners.map((c) => [c.id, c.name]))
    const cleanerCount: Record<string, number> = {}
    const propertyCount: Record<string, number> = {}
    let assigned = 0

    for (const t of tasks) {
      propertyCount[t.rentalName] = (propertyCount[t.rentalName] ?? 0) + 1
      if (t.column.startsWith('cleaner:')) {
        assigned += 1
        const cid = t.column.slice('cleaner:'.length)
        const name = cleanerById[cid] ?? 'Unknown cleaner'
        cleanerCount[name] = (cleanerCount[name] ?? 0) + 1
      } else {
        cleanerCount['Unassigned'] = (cleanerCount['Unassigned'] ?? 0) + 1
      }
    }

    const cleanerRows = Object.entries(cleanerCount)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    const propertyRows = Object.entries(propertyCount)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)

    // Use task type badge, not current column assignment, for operational totals.
    const checkouts = tasks.filter((t) => t.badge === 'CHECKOUT').length
    const turnovers = tasks.filter((t) => t.badge === 'TURNOVER').length
    const completionRate = tasks.length
      ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
      : 0
    const assignmentRate = tasks.length
      ? Math.round((assigned / tasks.length) * 100)
      : 0

    return {
      tasks,
      checkouts,
      turnovers,
      completionRate,
      assignmentRate,
      propertiesCovered: Object.keys(propertyCount).length,
      cleanerRows,
      propertyRows,
    }
  }, [
    range,
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
    cleaners,
  ])

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Analytics</h1>
      </header>

      <div className="space-y-4 p-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 task-card-shadow">
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                From
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                To
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {!range && (
              <p className="text-sm text-red-700">Invalid range: "From" must be before or equal to "To".</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Kpi label="Planned Checkouts" value={metrics.checkouts} />
          <Kpi label="Planned Turnovers" value={metrics.turnovers} />
          <Kpi label="Total Cleanings" value={metrics.tasks.length} />
          <Kpi label="Completion Rate" value={`${metrics.completionRate}%`} />
          <Kpi label="Assignment Rate" value={`${metrics.assignmentRate}%`} />
          <Kpi label="Properties Covered" value={metrics.propertiesCovered} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <BarChartCard
              title="Cleanings Distribution by Cleaner"
              rows={metrics.cleanerRows}
              emptyText="No cleanings in selected range."
              colorClass="bg-secondary"
            />
            <PieChartCard
              title="Cleaner Distribution (Pie)"
              rows={metrics.cleanerRows}
              emptyText="No cleanings in selected range."
            />
          </div>
          <div className="space-y-4">
            <BarChartCard
              title="Cleanings Distribution by Property"
              rows={metrics.propertyRows}
              emptyText="No cleanings in selected range."
              colorClass="bg-on-tertiary-container"
            />
            <PieChartCard
              title="Property Distribution (Pie)"
              rows={metrics.propertyRows}
              emptyText="No cleanings in selected range."
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 task-card-shadow">
          <p className="flex items-center gap-1">
            <Icon name="info" className="text-[18px]" />
            Distributions use rule-generated cleanings for the selected date range and include assigned + unassigned work.
          </p>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border-l-[3px] border-secondary-container bg-white p-6 task-card-shadow">
      <p className="font-['Inter'] text-xs font-bold uppercase tracking-wider text-on-primary-container">
        {label}
      </p>
      <p className="mt-2 font-['Manrope'] text-3xl font-bold">{value}</p>
    </div>
  )
}

function BarChartCard({
  title,
  rows,
  emptyText,
  colorClass,
}: {
  title: string
  rows: Row[]
  emptyText: string
  colorClass: string
}) {
  const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 1
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 task-card-shadow">
      <h2 className="mb-3 font-['Manrope'] text-lg font-bold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(120px,1fr)_3fr_auto] items-center gap-2 text-xs">
              <span className="truncate font-semibold text-slate-700">{r.label}</span>
              <div className="h-3 rounded bg-slate-100">
                <div
                  className={clsx('h-3 rounded', colorClass)}
                  style={{ width: `${Math.max(6, Math.round((r.value / max) * 100))}%` }}
                />
              </div>
              <span className="font-bold text-slate-800">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PieChartCard({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: Row[]
  emptyText: string
}) {
  const top = rows.slice(0, 8)
  const total = top.reduce((acc, r) => acc + r.value, 0)
  const palette = [
    '#2170e4',
    '#009668',
    '#f59e0b',
    '#8b5cf6',
    '#ef4444',
    '#14b8a6',
    '#6366f1',
    '#a16207',
  ]

  let cursor = 0
  const stops = top
    .map((r, idx) => {
      const start = cursor
      const pct = total > 0 ? (r.value / total) * 100 : 0
      cursor += pct
      const end = cursor
      const c = palette[idx % palette.length]
      return `${c} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    })
    .join(', ')

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 task-card-shadow">
      <h2 className="mb-3 font-['Manrope'] text-lg font-bold text-slate-900">{title}</h2>
      {top.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
          <div className="mx-auto h-40 w-40 rounded-full border border-slate-100 bg-slate-100 p-4">
            <div
              className="h-full w-full rounded-full"
              style={{
                background: `conic-gradient(${stops})`,
              }}
            />
          </div>
          <div className="space-y-2">
            {top.map((r, idx) => {
              const c = palette[idx % palette.length]
              const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
              return (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                    <span className="truncate font-semibold text-slate-700">
                      {r.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-bold text-slate-800">
                    {r.value} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
