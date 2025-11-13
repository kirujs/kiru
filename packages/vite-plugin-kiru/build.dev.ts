import esbuild from "esbuild"
import fs from "node:fs"

await esbuild
  .context({
    entryPoints: ["src/index.ts", "src/server.ts"],
    bundle: true,
    platform: "node",
    target: "esnext",
    format: "esm",
    outdir: "./dist",
    external: ["kiru", "vite", "virtual:kiru:entry-server"],
    write: true,
    plugins: [
      {
        name: "build-evts",
        setup({ onEnd }) {
          onEnd(() => {
            console.log("[vite-plugin-kiru]: Build complete!")
            fs.copyFileSync("./src/types.d.ts", "dist/index.d.ts")
            fs.copyFileSync("./src/types.server.d.ts", "dist/server.d.ts")
          })
        },
      },
    ],
  })
  .then((ctx) => {
    ctx.watch()
    console.log("[vite-plugin-kiru]: Watching for changes...")
  })
