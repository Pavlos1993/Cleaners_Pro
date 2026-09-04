import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { BrandingPage } from './pages/BrandingPage'
import { CalendarPage } from './pages/CalendarPage'
import { CleanersPage } from './pages/CleanersPage'
import { DbAdminPage } from './pages/DbAdminPage'
import { OperationsPage } from './pages/OperationsPage'
import { PreferencesPage } from './pages/PreferencesPage'
import { PropertiesPage } from './pages/PropertiesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TurnoverRulesPage } from './pages/TurnoverRulesPage'
import { useAppStore } from './store/appStore'

const STARTUP_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000
const LAST_SYNC_KEY = 'ops:lastHosthubSyncAt'
const DB_POLL_INTERVAL_MS = 15000

export default function App() {
  const hydrateFromDb = useAppStore((s) => s.hydrateFromDb)
  const hydrateLocalStateFromDb = useAppStore((s) => s.hydrateLocalStateFromDb)
  const autoSyncMinutes = useAppStore((s) => s.autoSyncMinutes)
  const faviconDataUrl = useAppStore((s) => s.faviconDataUrl)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await hydrateFromDb()
      if (cancelled) return
      const s = useAppStore.getState()
      if (!s.apiKey.trim()) return
      if (s.syncStatus === 'syncing') return
      try {
        const last = Number(window.localStorage.getItem(LAST_SYNC_KEY) ?? '0')
        if (Number.isFinite(last) && Date.now() - last < STARTUP_SYNC_MIN_INTERVAL_MS) {
          return
        }
      } catch {
        // If storage is unavailable, continue without freshness check.
      }
      void s.syncFromHosthub()
    })()
    return () => {
      cancelled = true
    }
  }, [hydrateFromDb])

  useEffect(() => {
    if (!autoSyncMinutes || autoSyncMinutes <= 0) return
    const timer = window.setInterval(() => {
      const s = useAppStore.getState()
      if (!s.apiKey.trim()) return
      if (s.syncStatus === 'syncing') return
      void s.syncFromHosthub()
    }, autoSyncMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [autoSyncMinutes])

  useEffect(() => {
    // Poll lightweight local state only (assignments/completion/settings).
    // Full /api/bootstrap includes the bookings cache and is too large to refresh every 15s.
    const timer = window.setInterval(() => {
      const s = useAppStore.getState()
      if (s.syncStatus === 'syncing') return
      void hydrateLocalStateFromDb()
    }, DB_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [hydrateLocalStateFromDb])

  useEffect(() => {
    const link =
      (document.querySelector("link[rel='icon']") as HTMLLinkElement | null) ??
      (() => {
        const el = document.createElement('link')
        el.rel = 'icon'
        document.head.appendChild(el)
        return el
      })()
    link.href = faviconDataUrl || '/favicon.svg'
  }, [faviconDataUrl])

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OperationsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="cleaners" element={<CleanersPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="preferences" element={<PreferencesPage />} />
        <Route path="preferences/branding" element={<BrandingPage />} />
        <Route path="preferences/hosthub" element={<SettingsPage />} />
        <Route path="preferences/turnover-rules" element={<TurnoverRulesPage />} />
        <Route path="preferences/db-admin" element={<DbAdminPage />} />
        <Route path="settings" element={<Navigate to="/preferences/hosthub" replace />} />
        <Route path="db-admin" element={<Navigate to="/preferences/db-admin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
