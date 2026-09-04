import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAppStore } from '../store/appStore'

export function SettingsPage() {
  const apiKey = useAppStore((s) => s.apiKey)
  const setApiKey = useAppStore((s) => s.setApiKey)
  const syncFromHosthub = useAppStore((s) => s.syncFromHosthub)
  const seedDemo = useAppStore((s) => s.seedDemo)
  const syncStatus = useAppStore((s) => s.syncStatus)
  const syncMessage = useAppStore((s) => s.syncMessage)
  const autoSyncMinutes = useAppStore((s) => s.autoSyncMinutes)
  const setAutoSyncMinutes = useAppStore((s) => s.setAutoSyncMinutes)
  const [local, setLocal] = useState(apiKey)
  const [saveHint, setSaveHint] = useState<string | null>(null)

  useEffect(() => {
    setLocal(apiKey)
  }, [apiKey])

  async function saveAndSync() {
    setSaveHint(null)
    const k = local.trim()
    if (!k) {
      setSaveHint('Paste your API key first.')
      return
    }
    await syncFromHosthub(k)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Hosthub connection</h1>
        <p className="mt-1 max-w-2xl font-['Inter'] text-sm text-on-surface-variant">
          Per the Hosthub OpenAPI spec, the key is sent in the <code className="rounded bg-slate-100 px-1">Authorization</code>{' '}
          header (no &quot;Bearer&quot; prefix required). This app only performs <strong>GET</strong> requests for
          rentals and calendar events — nothing is written back to Hosthub. After a successful sync, add your own
          cleaners here; assignments on the board stay in local storage only.
        </p>
      </header>
      <div className="mx-auto max-w-xl space-y-6 p-8">
        {(syncMessage || syncStatus === 'syncing') && (
          <div
            role="status"
            className={clsx(
              'rounded-xl border px-4 py-3 font-[Inter] text-sm',
              syncStatus === 'error' && 'border-red-200 bg-red-50 text-red-900',
              syncStatus === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
              syncStatus === 'syncing' && 'border-blue-200 bg-blue-50 text-blue-900',
              syncStatus === 'idle' && syncMessage && 'border-slate-200 bg-slate-50 text-slate-800',
            )}
          >
            {syncStatus === 'syncing' && (
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <Icon name="sync" className="animate-spin text-[20px]" />
                  Contacting Hosthub…
                </p>
                <p className="mt-2 text-xs opacity-90">
                  Each request aborts after 45s if there is no response. Calendar sync may walk several pages; if
                  this message stays here past a couple of minutes, check the browser Network tab for{' '}
                  <code className="rounded bg-white/60 px-1">/hosthub/</code> calls (dev) or errors.
                </p>
              </div>
            )}
            {syncMessage && <p className="mt-1 whitespace-pre-wrap break-words">{syncMessage}</p>}
          </div>
        )}

        {saveHint && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{saveHint}</p>
        )}

        <label className="block">
          <span className="mb-1 block font-['Inter'] text-xs font-semibold uppercase tracking-wide text-slate-500">
            Authorization header value
          </span>
          <input
            type="password"
            autoComplete="off"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 font-mono text-sm outline-none ring-secondary-container focus:ring-2"
            placeholder="Paste key, then Save & sync"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-secondary px-4 py-2 font-['Inter'] text-sm font-semibold text-on-secondary"
            onClick={() => void saveAndSync()}
            disabled={syncStatus === 'syncing'}
          >
            Save &amp; sync from Hosthub
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 font-['Inter'] text-sm font-semibold"
            onClick={() => {
              setApiKey(local.trim())
              setSaveHint(local.trim() ? 'Key saved. Open Operations and click Sync, or use Save & sync.' : null)
            }}
          >
            Save key only
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 font-['Inter'] text-sm font-semibold"
            onClick={() => void syncFromHosthub(local.trim() || undefined)}
            disabled={syncStatus === 'syncing'}
          >
            <Icon name="sync" />
            Sync (use field above)
          </button>
          <button
            type="button"
            className="rounded-lg border border-dashed border-slate-300 px-4 py-2 font-['Inter'] text-sm text-slate-600"
            onClick={() => {
              seedDemo()
              setLocal('')
              setSaveHint(null)
            }}
          >
            Reset demo data
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block font-['Inter'] text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hosthub auto-sync interval
          </span>
          <select
            value={String(autoSyncMinutes)}
            onChange={(e) => setAutoSyncMinutes(Number(e.target.value))}
            className="w-full rounded-xl border border-outline-variant px-4 py-3 text-sm outline-none ring-secondary-container focus:ring-2"
          >
            <option value="0">Off (manual sync only)</option>
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="60">Every 1 hour</option>
            <option value="120">Every 2 hours</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Runs while the app tab is open. Recommended: every 30 minutes.
          </p>
        </label>
        <p className="font-['Inter'] text-xs text-slate-500">
          Tip: If the board still looks empty, sync may have worked but no bookings match{' '}
          <strong>today</strong> for check-in or checkout. Open Calendar and Properties to confirm Hosthub data
          loaded.
        </p>

      </div>
    </div>
  )
}
