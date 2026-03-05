import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { watch } from "node:fs"
import { spawn } from "node:child_process"
import { createServer } from "vite"

if (process.argv.includes("--child")) {
  const server = await createServer({
    root: process.cwd(),
    customLogger: console,
  })
  await server.listen()
  const { https, host, port } = server.config.server
  console.log(
    "Vite server started at " +
      `http${https ? "s" : ""}://${host ?? "localhost"}:${port}`
  )
} else {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const pluginPath = join(
    __dirname,
    "../../packages/vite-plugin-kiru/dist/index.js"
  )

  const createChild = () =>
    spawn("node", [__filename, "--child"], { stdio: "inherit" })

  let child = createChild()

  /**
   * watcher is fired multiple times (probably esbuild being a bit aggressive),
   * so we use a same-tick debounce to prevent multiple restarts.
   * Could probably tack on an actual timeout duration but this seems to work well.
   */
  let restartTimeout = null
  watch(pluginPath, () => {
    if (restartTimeout) clearTimeout(restartTimeout)
    restartTimeout = setTimeout(() => {
      console.log("Restarting server due to plugin change...")
      child.kill()
      child = createChild()
    })
  })
}
