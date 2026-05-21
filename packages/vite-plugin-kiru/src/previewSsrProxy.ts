import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import { createServer } from "node:net"
import type { Connect } from "vite"
import { isPreviewAssetPath, previewPathname, type PreviewRequest } from "./preview-server.js"

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      probe.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

async function waitForHttpReady(baseUrl: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/`, { redirect: "manual" })
      if (res.status < 500) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(
    `[vite-plugin-kiru]: preview SSR server did not become ready at ${baseUrl}`
  )
}

export type PreviewSsrProxyHandle = {
  middleware: Connect.NextHandleFunction
  baseUrl: string
  dispose: () => void
}

export async function createPreviewSsrProxy(
  serverEntryAbs: string
): Promise<PreviewSsrProxyHandle> {
  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const stderrChunks: Buffer[] = []
  const child: ChildProcess = spawn(
    process.execPath,
    [serverEntryAbs],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
      },
      cwd: path.dirname(path.dirname(path.dirname(serverEntryAbs))),
      stdio: ["ignore", "ignore", "pipe"],
    }
  )
  child.stderr?.on("data", (chunk: Buffer) => {
    if (stderrChunks.length < 8) stderrChunks.push(chunk)
  })

  try {
    await waitForHttpReady(baseUrl)
  } catch (err) {
    const detail = Buffer.concat(stderrChunks).toString("utf8").trim()
    const exitHint =
      child.exitCode != null ? ` (exit ${child.exitCode})` : ""
    throw new Error(
      detail
        ? `${(err as Error).message}${exitHint}: ${detail}`
        : `${(err as Error).message}${exitHint}`
    )
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    try {
      const pathname = previewPathname(req as PreviewRequest)
      if (isPreviewAssetPath(pathname)) return next()
      const method = (req.method ?? "GET").toUpperCase()
      if (method !== "GET" && method !== "HEAD") return next()

      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
        method,
        headers: req.headers as HeadersInit,
      })
      const { writeNodeResponse } = await import("@kirujs/adapter-node")
      await writeNodeResponse(res, response)
    } catch (err) {
      next(err as Error)
    }
  }

  return {
    middleware,
    baseUrl,
    dispose: () => {
      child.kill()
    },
  }
}
