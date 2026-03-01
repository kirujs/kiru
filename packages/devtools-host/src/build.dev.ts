import esbuild from "esbuild"
import { options, writeFile } from "./build.options"

await esbuild
  .context({
    ...options,
    minify: false,
    plugins: [
      ...options.plugins,
      {
        name: "build-evts",
        setup({ onEnd }) {
          onEnd((result) => {
            console.log("[devtools-host]: Build complete!")
            const out = result.outputFiles?.[0]
            if (out) writeFile(out.text)
          })
        },
      },
    ],
  })
  .then((ctx) => {
    ctx.watch()
    console.log("[devtools-host]: Watching for changes...")
  })
