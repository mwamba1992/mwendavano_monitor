export const SYSTEM_LABEL: Record<string, string> = { mauzo: 'Mauzo', soko: 'Soko', wafanyakazi: 'Wafanyakazi', cargo: 'Cargo', server: 'Server' }
export const LEVEL_LABEL: Record<string, string> = { admin: 'Admin', support: 'Support', view: 'View', none: 'None' }

export function timeAgo(v: string | null | undefined): string {
  if (!v) return 'Never'
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000)
  if (s < 90) return 'Just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  return d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : shortDate(v)
}

const TZ = 'Africa/Dar_es_Salaam'
export const shortDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }) : '')
export const clock = (v: string | null | undefined) => (v ? new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '')
export const longDate = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
export const number = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'))

export function greeting(): string {
  const h = Number(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase()
export function logTime(v: string): string {
  const days = Math.floor((new Date().setHours(23, 59, 59, 999) - new Date(v).getTime()) / 86400000)
  return `${days === 0 ? 'Today' : days === 1 ? 'Yesterday' : shortDate(v)} ${clock(v)}`
}

/** Colour follows the site, never its position, so nothing repaints when a site is hidden. Checked with the palette validator. */
const SITE_COLOUR: Record<string, string> = {
  'dukanisoko.com': '#00908c',
  'dukanimauzo.com': '#d99a00',
  'store.mwendavano.com': '#4a6fd0',
  'cargo.mwendavano.com': '#c4471f',
  'wafanyakazi.mwendavano.com': '#9a63c9',
  'mwendavano.com': '#4f9e3a',
}
export const siteColour = (site: string) => SITE_COLOUR[site] ?? '#4d5f5c'
