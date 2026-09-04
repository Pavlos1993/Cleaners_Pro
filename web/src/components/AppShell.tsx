import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useAppStore } from '../store/appStore'
import { Icon } from './Icon'

const nav = [
  { to: '/', label: 'Operations', icon: 'grid_view' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar_today' },
  { to: '/cleaners', label: 'Cleaners', icon: 'groups' },
  { to: '/properties', label: 'Properties', icon: 'domain' },
  { to: '/analytics', label: 'Analytics', icon: 'bar_chart' },
  { to: '/preferences', label: 'Preferences', icon: 'tune' },
] as const

export function AppShell() {
  const liveFromHosthub = useAppStore((s) => s.liveFromHosthub)
  const brandLogoDataUrl = useAppStore((s) => s.brandLogoDataUrl)
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="no-print fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-6">
          {brandLogoDataUrl ? (
            <div className="flex min-h-12 items-center bg-white px-3 py-2">
              <img
                src={brandLogoDataUrl}
                alt="Brand logo"
                className="max-h-10 max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="py-2 font-['Manrope'] text-xl font-extrabold tracking-tighter text-slate-900">
              PropManager Pro
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-r-full px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 font-bold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} filled={isActive} className="text-[22px]" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-slate-200 p-6 text-slate-500">
          <Icon name="sync" className="text-[20px]" />
          <span className="text-xs font-semibold">
            {liveFromHosthub ? 'Hosthub (live read)' : 'Sample data'}
          </span>
        </div>
      </aside>
      <div className="min-h-dvh flex-1 lg:pl-64">
        <Outlet />
      </div>
    </div>
  )
}
