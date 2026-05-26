import esbuild from "esbuild"
import fs from "node:fs"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8")) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  "rollup/parseAst",
]

await esbuild
  .context({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "esnext",
    format: "esm",
    outfile: "./dist/index.js",
    packages: "external",
    external,
    write: true,
    plugins: [
      {
        name: "build-evts",
        setup({ onEnd }) {
          onEnd(() => {
            console.log("[vite-plugin-kiru]: Build complete!")
            fs.copyFileSync("./src/types.d.ts", "dist/index.d.ts")
          })
        },
      },
    ],
  })
  .then((ctx) => {
    ctx.watch()
    console.log("[vite-plugin-kiru]: Watching for changes...")
  })
