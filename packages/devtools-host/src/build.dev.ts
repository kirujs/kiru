import esbuild from "esbuild"
import { options, writeFile } from "./options"

await esbuild
  .context({
    ...options,
    plugins: [
      ...options.plugins,
      {
        name: "build-evts",
        setup({ onEnd }) {
          onEnd((result) => {
            console.log("[devtools-host]: Build complete!")
            writeFile(result.outputFiles![0].text)
          })
        },
      },
    ],
  })
  .then((ctx) => {
    ctx.watch()
    console.log("[devtools-host]: Watching for changes...")
  })
