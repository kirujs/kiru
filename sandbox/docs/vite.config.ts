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
        layout: "layout.{tsx,mdx}",
        sitemap: {
          domain: "https://kirujs.dev",
          lastmod: new Date(),
          changefreq: "weekly",
          priority: 0.5,
          overrides: {
            "/": {
              changefreq: "never",
              priority: 0.8,
            },
          },
        },
      },
    }),
  ],
})
