import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import { e2ePorts, envDevPort, envHmrPort } from "../shared/ports.mjs"

const rpcTraceOn =
  process.env.KIRU_RPC_TRACE === "1" || process.env.KIRU_E2E_DIAG === "1"

export default defineConfig({
  define: {
    __KIRU_RPC_TRACE__: JSON.stringify(rpcTraceOn),
  },
  server: {
    port: envDevPort(e2ePorts.ssr.core.dev),
    strictPort: true,
    hmr: { port: envHmrPort(e2ePorts.ssr.core.hmr) },
  },
  /** One Node copy of `kiru` so the remote action registry matches `createRenderer({ actions })`. */
  ssr: {
    external: ["kiru"],
  },
  plugins: [
    kiru({
      router: {
        serverEntry: "./src/server.ts",
        ssg: true,
        remote: "**/*.actions.ts",
      },
      experimental: {
        staticHoisting: true,
      },
    }),
  ],
})
