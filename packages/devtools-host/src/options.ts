import type { BuildOptions } from "esbuild"
import fs from "node:fs"
import path from "node:path"
import esbuildPluginInlineImport from "esbuild-plugin-inline-import"
import postCss from "postcss"
import tailwindcss from "tailwindcss"
import autoprefixer from "autoprefixer"

const postCssInstance = postCss([tailwindcss, autoprefixer])

type EsbuildInlineTransform = NonNullable<
  Parameters<typeof esbuildPluginInlineImport>[0]
>["transform"]
export const esbuildPluginTransform: EsbuildInlineTransform = async (
  content,
  file
) => {
  if (file.path.includes(path.join("devtools-host", "src", "style.css"))) {
    const newContent = await postCssInstance.process(content, {
      from: file.path,
    })
    return newContent.css
  }

  return content
}

export const options = {
  entryPoints: ["src/index.ts", "src/style.css"],
  jsx: "transform",
  outdir: "dist",
  jsxFactory: "kiru.createElement",
  jsxFragment: "kiru.Fragment",
  bundle: true,
  platform: "browser",
  target: "es2020",
  format: "esm",
  minify: true,
  write: false,
  keepNames: false,
  plugins: [
    esbuildPluginInlineImport({
      transform: esbuildPluginTransform,
    }),
  ],
} as const satisfies BuildOptions

export function writeFile(content: string) {
  fs.rmSync("dist", { recursive: true, force: true })
  fs.mkdirSync("dist")
  fs.writeFileSync(
    "dist/index.js",
    `export default \`${content.replace(/[`\\$]/g, "\\$&")}\n\``,
    {
      encoding: "utf-8",
    }
  )
}
