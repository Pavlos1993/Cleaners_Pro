import { useState } from 'react'
import { useAppStore, useBoardTasks } from '../store/appStore'

export function CleanersPage() {
  const cleaners = useAppStore((s) => s.cleaners)
  const cleanerAvailabilityById = useAppStore((s) => s.cleanerAvailabilityById)
  const selectedBoardDate = useAppStore((s) => s.selectedBoardDate)
  const liveFromHosthub = useAppStore((s) => s.liveFromHosthub)
  const addCleaner = useAppStore((s) => s.addCleaner)
  const setCleanerActive = useAppStore((s) => s.setCleanerActive)
  const removeCleaner = useAppStore((s) => s.removeCleaner)
  const tasks = useBoardTasks()
  const [name, setName] = useState('')

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Cleaners</h1>
        <p className="mt-1 max-w-xl font-['Inter'] text-sm text-on-surface-variant">
          Cleaners exist only in this app. Hosthub is used only to <strong>read</strong> bookings; drag-and-drop
          assignments on the Operations board are stored locally and are never sent back to Hosthub.
        </p>
        {liveFromHosthub && cleaners.length === 0 && (
          <p className="mt-3 max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            You are on live Hosthub data. Add at least one cleaner so you can assign turnover tasks from the
            board.
          </p>
        )}
      </header>
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 task-card-shadow"
          onSubmit={(e) => {
            e.preventDefault()
            addCleaner(name)
            setName('')
          }}
        >
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              New cleaner
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-secondary px-4 py-2 font-['Inter'] text-sm font-semibold text-on-secondary"
          >
            Add cleaner
          </button>
        </form>

        <div className="space-y-3">
          {cleaners.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
              No cleaners yet. Add people who appear as columns on the Operations board.
            </p>
          )}
          {cleaners.map((c) => {
            const count = tasks.filter((t) => t.column === `cleaner:${c.id}`).length
            const periods = cleanerAvailabilityById[c.id]
            const activeNow =
              !periods || periods.length === 0
                ? true
                : periods.some(
                    (p) =>
                      p.from <= selectedBoardDate &&
                      (p.to === null || p.to >= selectedBoardDate),
                  )
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 task-card-shadow"
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-lg font-bold text-secondary">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-['Manrope'] text-lg font-semibold text-slate-900">{c.name}</h2>
                  <p className="font-['Inter'] text-sm text-slate-500">{count} assigned tasks today</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {activeNow
                      ? 'Active on selected date (visible on Kanban).'
                      : 'Off on selected date (hidden on Kanban). Past dates still show this cleaner if active then.'}
                  </p>
                </div>
                <label className="mr-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>{activeNow ? 'ON' : 'OFF'}</span>
                  <input
                    type="checkbox"
                    checked={activeNow}
                    onChange={(e) => setCleanerActive(c.id, e.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeCleaner(c.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-['Inter'] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
