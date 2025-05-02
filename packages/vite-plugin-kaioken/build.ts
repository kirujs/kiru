import esbuild from "esbuild"
import fs from "node:fs"

esbuild.buildSync({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "esnext",
  format: "esm",
  outfile: "./dist/index.js",
  external: ["kaioken"],
  write: true,
})

fs.copyFileSync("./src/types.d.ts", "dist/index.d.ts")
