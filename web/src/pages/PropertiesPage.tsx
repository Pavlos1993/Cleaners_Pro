import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppStore } from '../store/appStore'

export function PropertiesPage() {
  const rentals = useAppStore((s) => s.rentals)
  const cleaning = useAppStore((s) => s.cleaningEnabledByRentalId)
  const toggleCleaning = useAppStore((s) => s.toggleCleaning)
  const syncStatus = useAppStore((s) => s.syncStatus)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rentals
    return rentals.filter((r) => r.name.toLowerCase().includes(s))
  }, [rentals, q])

  const enabled = rentals.filter((r) => cleaning[r.id] !== false).length

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Properties</h1>
        </div>
        <div className="relative hidden lg:block">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search addresses..."
            className="w-64 rounded-xl border border-outline-variant bg-white py-2 pl-10 pr-4 text-sm outline-none ring-secondary-container focus:ring-2"
          />
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total Assets"
            value={String(rentals.length)}
            border="border-secondary-container"
            sub={
              <span className="flex items-center gap-1 rounded bg-tertiary-fixed/10 px-2 py-1 font-['Inter'] text-xs font-semibold text-on-tertiary-container">
                <Icon name="trending_up" className="text-[14px]" />
                live
              </span>
            }
          />
          <StatCard
            label="Cleaning Enabled"
            value={String(enabled)}
            border="border-tertiary-fixed-dim"
            sub={
              <span className="rounded bg-surface-container px-2 py-1 font-['Inter'] text-xs font-semibold text-on-surface-variant">
                {rentals.length ? Math.round((enabled / rentals.length) * 100) : 0}% active
              </span>
            }
          />
          <StatCard
            label="Hosthub Sync"
            value={syncStatus === 'ok' ? 'Live' : syncStatus === 'syncing' ? '…' : 'Demo'}
            border="border-on-tertiary-container"
            sub={
              <span className="flex items-center gap-1 font-['Inter'] text-xs font-semibold text-on-tertiary-container">
                <Icon name="check_circle" filled className="text-[18px]" />
                {syncStatus === 'error' ? 'Issue' : 'Healthy'}
              </span>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const on = cleaning[r.id] !== false
            return (
              <div
                key={r.id}
                className="flex flex-col rounded-xl border border-slate-100 bg-white p-5 task-card-shadow"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-['Inter'] text-xs font-bold uppercase tracking-wider text-on-primary-container">
                      Rental
                    </p>
                    <h2 className="font-['Manrope'] text-lg font-semibold text-slate-900">{r.name}</h2>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleCleaning(r.id, !on)}
                    className={clsx(
                      'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                      on ? 'bg-secondary' : 'bg-slate-200',
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                        on ? 'left-6' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
                <p className="font-['Inter'] text-sm text-on-surface-variant">
                  {on ? 'Cleaning workflow enabled for turnovers.' : 'Excluded from automated cleaning tasks.'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  border,
  sub,
}: {
  label: string
  value: string
  border: string
  sub: React.ReactNode
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border-l-[3px] bg-white p-6 task-card-shadow',
        border,
      )}
    >
      <p className="mb-1 font-['Inter'] text-[11px] font-bold uppercase tracking-wider text-on-primary-container">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <span className="font-['Manrope'] text-3xl font-bold text-on-surface">{value}</span>
        {sub}
      </div>
    </div>
  )
}
