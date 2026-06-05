/** Cookie sessions for Threadboard (dev only). */

import type { KiruSetCookie } from "kiru/remote"
import { db } from "./db.js"

export const SESSION_COOKIE = "sandbox_session"
const SESSION_MAX_AGE = 604800

export type SandboxUser = {
  id: string
  username: string
  name: string
  email: string
  bio: string
  avatarUrl: string
}

const sessions = new Map<string, string>()

function toPublicUser(user: NonNullable<ReturnType<typeof db.users.get>>): SandboxUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  }
}

export function userFromId(userId: string): SandboxUser | null {
  const user = db.users.get(userId)
  return user ? toPublicUser(user) : null
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

export function validateCredentials(
  username: string,
  password: string
): SandboxUser | null {
  const user = db.users.getByUsername(username.trim().toLowerCase())
  if (!user || user.password !== password) return null
  return toPublicUser(user)
}

export function updateUserProfile(
  userId: string,
  data: { name: string; email: string; bio?: string; avatarUrl?: string }
): SandboxUser | null {
  const updated = db.users.update(userId, {
    name: data.name.trim(),
    email: data.email.trim(),
    bio: data.bio?.trim(),
    avatarUrl: data.avatarUrl?.trim(),
  })
  return updated ? toPublicUser(updated) : null
}

function userForSessionId(sessionId: string): SandboxUser | null {
  const userId = getUserIdForSession(sessionId)
  if (!userId) return null
  return userFromId(userId)
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

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

/** Demo account usernames for login page hint. */
export function listDemoUsernames(): string[] {
  return db.users.list().map((u) => u.username)
}
