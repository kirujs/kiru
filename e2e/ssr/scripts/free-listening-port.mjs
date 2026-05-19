import { execSync } from "node:child_process"

/** Stop any process listening on `port` so a fresh e2e server can bind. */
export function freeListeningPort(port) {
  if (process.platform === "win32") {
    try {
      const lines = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
      }).split(/\r?\n/)
      for (const line of lines) {
        if (!/LISTENING/.test(line)) continue
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" })
        }
      }
    } catch {
      /* nothing listening */
    }
    return
  }
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
      shell: true,
    })
  } catch {
    /* nothing listening */
  }
}
