import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAppStore } from '../store/appStore'

export function PreferencesPage() {
  const location = useLocation()
  const isRoot = location.pathname === '/preferences'
  const seedDemo = useAppStore((s) => s.seedDemo)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)

  function confirmFullReset() {
    if (resetCode.trim() !== '550077') {
      setResetError('Invalid code. Enter 550077 to continue.')
      return
    }
    seedDemo()
    setResetCode('')
    setResetError(null)
    setShowResetDialog(false)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Preferences</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage integrations and local system settings.
        </p>
      </header>

      {isRoot && (
        <div className="mx-auto max-w-6xl space-y-5 p-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PrefCard
              to="/preferences/branding"
              icon="branding_watermark"
              title="Branding"
              description="Upload your sidebar logo and favicon (SVG or PNG)."
            />
            <PrefCard
              to="/preferences/hosthub"
              icon="key"
              title="Hosthub API"
              description="Connection, API key, manual sync, and auto-sync interval settings."
            />
            <PrefCard
              to="/preferences/turnover-rules"
              icon="rule"
              title="Turnover Rules"
              description="Configure checkout/arrival-prep/mid-stay cleaning logic and view assignment history."
            />
            <PrefCard
              to="/preferences/db-admin"
              icon="storage"
              title="DB Admin"
              description="Inspect local SQLite data (cleaners, rules, assignments, completion, cache)."
            />
          </div>

          <section className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-['Manrope'] text-lg font-bold text-red-900">Danger Zone</h2>
            <p className="mt-1 text-sm text-red-800">
              Full reset returns the app to demo mode, removes the saved API key, and clears local database data.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
              onClick={() => {
                setResetCode('')
                setResetError(null)
                setShowResetDialog(true)
              }}
            >
              Full reset
            </button>
          </section>
        </div>
      )}

      {showResetDialog && (
        <div className="fixed inset-0 z-[90] bg-black/35 p-4" onClick={() => setShowResetDialog(false)}>
          <div
            className="mx-auto mt-16 max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Manrope'] text-xl font-bold text-slate-900">Confirm full reset</h3>
            <p className="mt-1 text-sm text-slate-600">
              Enter reset code <strong>550077</strong> to wipe local DB and return to demo mode.
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reset code
              </span>
              <input
                type="password"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2"
                placeholder="Enter code"
              />
            </label>
            {resetError && <p className="mt-2 text-xs text-error">{resetError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setShowResetDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
                onClick={confirmFullReset}
              >
                Confirm reset
              </button>
            </div>
          </div>
        </div>
      )}

      {!isRoot && <Outlet />}
    </div>
  )
}

function PrefCard({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-secondary-container hover:shadow-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon name={icon} className="text-secondary" />
        <h2 className="font-['Manrope'] text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-600">{description}</p>
    </Link>
  )
}

