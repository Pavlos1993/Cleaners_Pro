import { useMemo, useState, type ChangeEvent } from 'react'
import { useAppStore } from '../store/appStore'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/svg+xml']
const ACCEPTED_FAVICON_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function BrandingPage() {
  const brandLogoDataUrl = useAppStore((s) => s.brandLogoDataUrl)
  const faviconDataUrl = useAppStore((s) => s.faviconDataUrl)
  const setBrandLogoDataUrl = useAppStore((s) => s.setBrandLogoDataUrl)
  const setFaviconDataUrl = useAppStore((s) => s.setFaviconDataUrl)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [faviconError, setFaviconError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'logo' | 'favicon' | null>(null)

  const logoPreview = useMemo(() => brandLogoDataUrl, [brandLogoDataUrl])
  const faviconPreview = useMemo(() => faviconDataUrl, [faviconDataUrl])

  async function handleUpload(
    e: ChangeEvent<HTMLInputElement>,
    mode: 'logo' | 'favicon',
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const lowerName = file.name.toLowerCase()
    const typeAllowed =
      mode === 'logo'
        ? ACCEPTED_LOGO_TYPES.includes(file.type)
        : ACCEPTED_FAVICON_TYPES.includes(file.type)
    const extensionAllowed =
      mode === 'logo'
        ? lowerName.endsWith('.svg') || lowerName.endsWith('.png')
        : lowerName.endsWith('.svg') ||
          lowerName.endsWith('.png') ||
          lowerName.endsWith('.ico')
    if (!typeAllowed && !extensionAllowed) {
      const msg = mode === 'logo' ? 'Use SVG or PNG only.' : 'Use SVG, PNG, or ICO only.'
      if (mode === 'logo') setLogoError(msg)
      else setFaviconError(msg)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const msg = 'File is too large. Max size is 2MB.'
      if (mode === 'logo') setLogoError(msg)
      else setFaviconError(msg)
      return
    }

    if (mode === 'logo') setLogoError(null)
    else setFaviconError(null)
    setBusy(mode)

    try {
      const dataUrl = await toDataUrl(file)
      if (mode === 'logo') setBrandLogoDataUrl(dataUrl)
      else setFaviconDataUrl(dataUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      if (mode === 'logo') setLogoError(msg)
      else setFaviconError(msg)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Branding</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Upload your own logo and favicon. Files stay local in your device database.
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 task-card-shadow">
          <h2 className="font-['Manrope'] text-lg font-bold text-slate-900">App logo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Replaces “PropManager Pro” in the sidebar.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-36 items-center justify-center rounded-md border border-slate-200 bg-white p-2">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="max-h-10 max-w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-500">No logo</span>
              )}
            </div>
            <label className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
              {busy === 'logo' ? 'Uploading...' : 'Upload logo'}
              <input
                type="file"
                accept=".svg,.png,image/svg+xml,image/png"
                className="hidden"
                onChange={(e) => void handleUpload(e, 'logo')}
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setBrandLogoDataUrl(null)}
            >
              Remove
            </button>
          </div>
          {logoError && <p className="mt-2 text-xs text-error">{logoError}</p>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 task-card-shadow">
          <h2 className="font-['Manrope'] text-lg font-bold text-slate-900">Favicon</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sets the browser tab icon for this app.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-1">
              {faviconPreview ? (
                <img src={faviconPreview} alt="Favicon preview" className="h-8 w-8 object-contain" />
              ) : (
                <span className="text-[10px] text-slate-500">None</span>
              )}
            </div>
            <label className="rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
              {busy === 'favicon' ? 'Uploading...' : 'Upload favicon'}
              <input
                type="file"
                accept=".svg,.png,.ico,image/svg+xml,image/png,image/x-icon,image/vnd.microsoft.icon"
                className="hidden"
                onChange={(e) => void handleUpload(e, 'favicon')}
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setFaviconDataUrl(null)}
            >
              Remove
            </button>
          </div>
          {faviconError && <p className="mt-2 text-xs text-error">{faviconError}</p>}
        </section>
      </div>
    </div>
  )
}

