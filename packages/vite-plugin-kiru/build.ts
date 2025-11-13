import esbuild from "esbuild"
import fs from "node:fs"

esbuild.buildSync({
  entryPoints: ["src/index.ts", "src/server.ts"],
  bundle: true,
  platform: "node",
  target: "esnext",
  format: "esm",
  outdir: "./dist",
  external: ["kiru", "vite", "virtual:kiru:entry-server"],
  write: true,
})

fs.copyFileSync("./src/types.d.ts", "dist/index.d.ts")
fs.copyFileSync("./src/types.server.d.ts", "dist/server.d.ts")
