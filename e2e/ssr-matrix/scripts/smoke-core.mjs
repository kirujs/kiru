/**
 * Tier A smoke — shared across matrix cells.
 * @param {string} base e.g. http://127.0.0.1:5199
 * @param {{ frameworkHealth?: boolean }} [opts]
 */
export async function smokeMatrix(base, opts = {}) {
  const { frameworkHealth = false } = opts
  assertNoTemplate(await body(`${base}/`), "/")
  const home = await body(`${base}/`)
  if (!home.includes("Matrix E2E Home")) {
    throw new Error("missing Matrix E2E Home on /")
  }

  assertNoTemplate(await body(`${base}/hello`), "/hello")
  const hello = await body(`${base}/hello`)
  if (!hello.includes("Matrix SSR hello")) {
    throw new Error("missing Matrix SSR hello on /hello")
  }

  if (frameworkHealth) {
    const health = await fetch(`${base}/api/health`)
    if (!health.ok) throw new Error(`/api/health ${health.status}`)
    const healthJson = await health.json()
    if (healthJson?.ok !== true) {
      throw new Error(
        `/api/health expected { ok: true }, got ${JSON.stringify(healthJson)}`
      )
    }
  }

  const missing = await fetch(`${base}/no-such-kiru-route`)
  if (missing.status !== 404) {
    throw new Error(
      `expected 404 for unknown route, got ${missing.status}`
    )
  }
}

async function body(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.text()
}

function assertNoTemplate(html, label) {
  if (html.includes("{{kiru_body}}") || html.includes("{{kiru_head}}")) {
    throw new Error(`${label}: unrendered HTML shell`)
  }
}
