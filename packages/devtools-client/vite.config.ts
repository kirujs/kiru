import fs from "node:fs"
import { PluginOption, defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  esbuild: {
    jsxInject: `import * as kiru from "kiru"`,
    jsx: "transform",
    jsxFactory: "kiru.createElement",
    jsxFragment: "kiru.Fragment",
    loader: "tsx",
    include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
  },
  base: "./",
  build: {
    assetsInlineLimit: () => true,
    chunkSizeWarningLimit: 100_000_000,
    cssCodeSplit: false,
    assetsDir: "",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    viteSingleFile({
      useRecommendedBuildConfig: false,
    }),
    {
      name: "dt-client:post-build",
      enforce: "post",
      async closeBundle(error) {
        if (error) return
        const html = fs.readFileSync("dist/index.html", "utf-8")

        fs.writeFileSync(
          "dist/index.js",
          `export default \`${html.replace(/[`\\$]/g, "\\$&")}\``,
          { encoding: "utf-8", flush: true }
        )

        console.log("[devtools-client]: Build complete!", error ?? "")
      },
    } satisfies PluginOption,
  ],
})
