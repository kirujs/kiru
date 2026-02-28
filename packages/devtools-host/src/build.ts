import esbuild from "esbuild"
import { options, writeFile } from "./build.options"

esbuild.build(options).then((res) => {
  writeFile(res.outputFiles![0].text)
})
