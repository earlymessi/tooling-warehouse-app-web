const SESSION_KEY = 'tooling-admin-session'

export interface AdminSession {
  username: string
  displayName: string
  loggedInAt: string
}

export function getAdminSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export function setAdminSession(session: AdminSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAdminLoggedIn(): boolean {
  return getAdminSession() !== null
}
