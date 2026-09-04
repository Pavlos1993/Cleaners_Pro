import { useEffect, useMemo, useState } from 'react'
import { fetchBootstrap, type BootstrapPayload } from '../lib/localDbApi'

export function DbAdminPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<'ok' | 'down' | 'unknown'>('unknown')
  const [data, setData] = useState<BootstrapPayload | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [h, b] = await Promise.all([
        fetch('/api/health').then((r) => (r.ok ? 'ok' : 'down')).catch(() => 'down'),
        fetchBootstrap(),
      ])
      setHealth(h as 'ok' | 'down')
      setData(b)
      if (!b) setError('Could not load bootstrap data from local DB API.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load DB data')
      setHealth('down')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const summary = useMemo(() => {
    if (!data) return null
    return {
      cleaners: data.cleaners.length,
      propertyOverrides: Object.keys(data.propertyOverrides).length,
      assignments: data.assignmentHistory.length,
      completedTasks: Object.keys(data.completedTaskAt).length,
      rentalsCache: data.rentals.length,
      eventsCache: data.events.length,
      liveFromHosthub: data.liveFromHosthub,
      selectedBoardDate: data.selectedBoardDate,
      carryForwardStartDate: data.carryForwardStartDate,
    }
  }, [data])

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">DB Admin</h1>
        <p className="mt-1 max-w-3xl font-['Inter'] text-sm text-on-surface-variant">
          Read-only SQLite inspector for local persistence.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 p-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary"
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <span
            className={
              health === 'ok'
                ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800'
                : health === 'down'
                  ? 'rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700'
            }
          >
            API: {health.toUpperCase()}
          </span>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
        {health === 'down' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Local DB API is not running.</p>
            <p className="mt-1">
              Start it from <code className="rounded bg-white/70 px-1">web/</code>:
            </p>
            <p className="mt-1 font-mono text-xs">
              npm run dev:api
            </p>
            <p className="mt-1">Or run frontend + API together:</p>
            <p className="mt-1 font-mono text-xs">
              npm run dev:all
            </p>
            <p className="mt-2 text-xs">
              After it starts, click <strong>Refresh</strong>.
            </p>
          </div>
        )}

        {summary && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Cleaners" value={String(summary.cleaners)} />
            <Stat label="Property Overrides" value={String(summary.propertyOverrides)} />
            <Stat label="Assignments" value={String(summary.assignments)} />
            <Stat label="Completed Tasks" value={String(summary.completedTasks)} />
            <Stat label="Rentals Cache" value={String(summary.rentalsCache)} />
            <Stat label="Events Cache" value={String(summary.eventsCache)} />
            <Stat label="Live Mode" value={summary.liveFromHosthub ? 'true' : 'false'} />
            <Stat label="Board Date" value={summary.selectedBoardDate ?? 'null'} />
          </div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <JsonCard title="Turnover Rules" value={data.turnoverRules} />
            <JsonCard
              title="Settings"
              value={{
                selectedBoardDate: data.selectedBoardDate,
                carryForwardStartDate: data.carryForwardStartDate,
                liveFromHosthub: data.liveFromHosthub,
              }}
            />
            <JsonCard title="Cleaners" value={data.cleaners} />
            <JsonCard title="Property Overrides" value={data.propertyOverrides} />
            <JsonCard title="Assignment History" value={data.assignmentHistory} />
            <JsonCard title="Task Completion" value={data.completedTaskAt} />
            <JsonCard title="Rentals Cache (first 10)" value={data.rentals.slice(0, 10)} />
            <JsonCard title="Events Cache (first 10)" value={data.events.slice(0, 10)} />
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 task-card-shadow">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-['Manrope'] text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 task-card-shadow">
      <h2 className="mb-2 font-['Manrope'] text-lg font-semibold text-slate-900">{title}</h2>
      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  )
}

