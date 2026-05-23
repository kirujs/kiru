import { createHash } from "node:crypto"

const ACTIONS_FILE = "src/pages/context-concurrency.actions.ts"
const PATH_PREFIX = "/context-concurrency"

export function routeIdForActionsFile(relativeFromE2eRoot = ACTIONS_FILE) {
  const routePath = relativeFromE2eRoot.replace(/\.[^./]+$/, "")
  const digest = createHash("sha256").update(routePath).digest("hex").slice(0, 12)
  return `r_${digest}`
}

export const echoContextActionId = `${routeIdForActionsFile()}:echoContextUser`

function extractJsonScript(body, attr) {
  const re = new RegExp(
    `<script[^>]*\\b${attr}\\b[^>]*>([^<]*)</script>`,
    "i"
  )
  const m = body.match(re)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

function assertIsolation(name, body, allNames) {
  if (!body.includes(`data-testid="ctx-loader-user">${name}`)) {
    throw new Error(`missing loader marker for ${name}`)
  }
  if (!body.includes(`data-testid="ctx-hook-user">${name}`)) {
    throw new Error(`missing hook marker for ${name}`)
  }
  const ctx = extractJsonScript(body, "k-request-context")
  if (!ctx?.user?.name || ctx.user.name !== name) {
    throw new Error(
      `k-request-context mismatch for ${name}: ${JSON.stringify(ctx)}`
    )
  }
  for (const other of allNames) {
    if (other === name) continue
    if (body.includes(`>${other}<`)) {
      throw new Error(`cross-talk: response for ${name} contains ${other}`)
    }
  }
}

async function invokeEchoAction(origin, token, name) {
  const url = `${origin}/?action=${encodeURIComponent(echoContextActionId)}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiru-token": token,
      Origin: origin,
    },
    body: JSON.stringify(null),
  })
  if (!res.ok) {
    throw new Error(`action RPC failed for ${name}: ${res.status}`)
  }
  const json = await res.json()
  if (json !== name) {
    throw new Error(`action RPC wrong body for ${name}: ${JSON.stringify(json)}`)
  }
}

/**
 * @param {{ origin: string, concurrency?: number }} options
 */
export async function runConcurrentContextCheck(options) {
  const { origin } = options
  const concurrency = options.concurrency ?? 32
  const names = Array.from(
    { length: concurrency },
    (_, i) => `concurrent-user-${i}`
  )

  const results = await Promise.all(
    names.map(async (name) => {
      const res = await fetch(`${origin}${PATH_PREFIX}`, {
        headers: { "x-e2e-user-name": name },
      })
      const body = await res.text()
      return { name, status: res.status, body }
    })
  )

  for (const { name, status, body } of results) {
    if (status !== 200) {
      throw new Error(`GET failed for ${name}: ${status}`)
    }
    assertIsolation(name, body, names)
    const tokenRe = /<script[^>]*\bk-request-token\b[^>]*>([^<]*)<\/script>/i
    const tokenMatch = body.match(tokenRe)
    const token = tokenMatch?.[1]?.trim()
    if (!token) {
      throw new Error(`missing action token for ${name}`)
    }
    await invokeEchoAction(origin, token, name)
  }

  return { ok: true, concurrency, origin }
}
