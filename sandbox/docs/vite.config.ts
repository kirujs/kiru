import path from "node:path"
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"
import mdx from "@mdx-js/rollup"
import shiki, { type RehypeShikiOptions } from "@shikijs/rehype"
import {
  transformerNotationHighlight,
  transformerNotationDiff,
} from "@shikijs/transformers"

export default defineConfig({
  resolve: {
    alias: {
      $: path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    sourcemap: false,
  },
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        jsx: false,
        jsxImportSource: "kiru",
        jsxRuntime: "automatic",
        rehypePlugins: [
          [
            shiki,
            {
              theme: "github-dark",
              transformers: [
                transformerNotationHighlight(),
                transformerNotationDiff(),
              ],
            } satisfies RehypeShikiOptions,
          ],
        ],
      }),
    },
    kiru({
      ssg: {
        page: "index.{tsx,mdx}",
        transition: false,
      },
    }),
  ],
})
