/** Dummy auth for the sandbox — cookie sessions + in-memory data (dev only). */

import type { KiruSetCookie } from "kiru/remote"

export const SESSION_COOKIE = "sandbox_session"

const SESSION_MAX_AGE = 604800

export type SandboxUser = {
  id: string
  name: string
  email: string
}

/** Login credentials (password === username for demo accounts). */
export const DUMMY_ACCOUNTS: Record<
  string,
  { id: string; password: string }
> = {
  demo: { id: "demo", password: "demo" },
  admin: { id: "admin", password: "admin" },
}

const sessions = new Map<string, string>()

/** Mutable profile fields (name / email) per user id. */
const profiles = new Map<string, { name: string; email: string }>()

function ensureProfile(userId: string): { name: string; email: string } | null {
  if (!DUMMY_ACCOUNTS[userId] && !profiles.has(userId)) return null
  let profile = profiles.get(userId)
  if (!profile) {
    const label = userId.charAt(0).toUpperCase() + userId.slice(1)
    profile = {
      name: userId === "demo" ? "Demo User" : userId === "admin" ? "Admin" : label,
      email: `${userId}@sandbox.local`,
    }
    profiles.set(userId, profile)
  }
  return profile
}

export function userFromId(userId: string): SandboxUser | null {
  const profile = ensureProfile(userId)
  if (!profile) return null
  return { id: userId, name: profile.name, email: profile.email }
}

export function createSession(userId: string): string {
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, userId)
  return sessionId
}

export function revokeSession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function getUserIdForSession(sessionId: string): string | null {
  return sessions.get(sessionId) ?? null
}

export function getUserFromRequest(request: Request): SandboxUser | null {
  const raw = readCookie(request.headers.get("cookie"), SESSION_COOKIE)
  if (!raw) return null
  return userForSessionId(raw)
}

export function getSessionIdFromCookieHeader(
  cookieHeader: string | undefined
): string | null {
  return readCookie(cookieHeader ?? null, SESSION_COOKIE)
}

export function getUserFromCookieHeader(
  cookieHeader: string | undefined
): SandboxUser | null {
  const raw = getSessionIdFromCookieHeader(cookieHeader)
  if (!raw) return null
  return userForSessionId(raw)
}

function userForSessionId(sessionId: string): SandboxUser | null {
  const userId = getUserIdForSession(sessionId)
  if (!userId) return null
  return userFromId(userId)
}

export function validateCredentials(
  username: string,
  password: string
): SandboxUser | null {
  const key = username.trim().toLowerCase()
  const account = DUMMY_ACCOUNTS[key]
  if (!account || account.password !== password) return null
  return userFromId(account.id)
}

export function updateUserProfile(
  userId: string,
  data: { name: string; email: string }
): SandboxUser | null {
  const profile = ensureProfile(userId)
  if (!profile) return null
  profile.name = data.name.trim()
  profile.email = data.email.trim()
  return userFromId(userId)
}

function readCookie(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

/** Set-Cookie spec for a new session (used by login form action). */
export function sessionCookieSpec(sessionId: string): KiruSetCookie {
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    sameSite: "Lax",
    httpOnly: true,
  }
}

/** Set-Cookie spec that clears the session cookie (logout). */
export function clearSessionCookieSpec(): KiruSetCookie {
  return {
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "Lax",
    httpOnly: true,
  }
}
