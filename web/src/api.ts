import { reactive } from 'vue'

/** The access token stays in memory; the refresh token is an httpOnly cookie this code cannot read. */
export type Level = 'admin' | 'support' | 'view' | 'none'
export type SystemKey = 'mauzo' | 'soko' | 'wafanyakazi' | 'cargo' | 'server'
export interface Me {
  id: number
  name: string
  phone: string
  email: string | null
  jobRole: string
  isOwner: boolean
  access: Record<SystemKey, Level>
  twoFactorMethod: 'sms' | 'totp' | null
  mustChangePassword: boolean
  canManageStaff: boolean
  twoStepRequired: boolean
  smsAvailable: boolean
}

export const session = reactive<{ me: Me | null; token: string | null; alerts: number }>({ me: null, token: null, alerts: 0 })

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
  }
}

let refreshing: Promise<boolean> | null = null

export function refresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) return false
      const b = await r.json()
      session.token = b.accessToken
      session.me = b.staff
      return true
    })
    .catch(() => false)
    .finally(() => (refreshing = null))
  return refreshing
}

async function send(path: string, init: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
  })
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(path, init)
  if (res.status === 401 && !path.startsWith('/auth/') && (await refresh())) res = await send(path, init)
  if (res.ok) return res
  const body = await res.json().catch(() => null)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    session.me = session.token = null
    location.assign('/login')
  }
  const msg = Array.isArray(body?.message) ? body.message[0] : body?.message
  throw new ApiError(res.status, msg || 'Something went wrong. Please try again', body?.error)
}

export const get = async <T = any>(path: string): Promise<T> => (await raw(path)).json()
export const post = async <T = any>(path: string, body?: unknown): Promise<T> => (await raw(path, { method: 'POST', body: JSON.stringify(body ?? {}) })).json()
export const patch = async <T = any>(path: string, body: unknown): Promise<T> => (await raw(path, { method: 'PATCH', body: JSON.stringify(body) })).json()
export const del = async <T = any>(path: string): Promise<T> => (await raw(path, { method: 'DELETE' })).json()
export const blob = async (path: string): Promise<Blob> => (await raw(path)).blob()

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
  session.me = session.token = null
  location.assign('/login')
}
