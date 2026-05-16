import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export interface SsrPaths {
  /**
   * Absolute path to the project root — i.e. the nearest ancestor of the
   * server entry that contains a `package.json`. Resolved by walking up
   * from {@link ResolveSsrPathsOptions.importMetaUrl} (or the supplied
   * `entryDir`) until a `package.json` is found.
   */
  projectRoot: string
  /**
   * Absolute path to the Vite **client** build directory (the directory
   * Vite emits hashed assets and the post-build `index.html` template
   * into). Defaults to `<projectRoot>/dist/client`, which is what the
   * `vite-plugin-kiru` SSR build pipeline produces.
   */
  clientDir: string
  /**
   * Absolute path to the HTML template that was loaded into
   * {@link SsrPaths.htmlTemplate}. Useful for logging / cache-invalidation
   * wiring; you generally don't need to read it again yourself.
   */
  templatePath: string
  /**
   * The HTML shell, already read into a string. In production this is
   * `<clientDir>/index.html` (the post-build template with hashed asset
   * references), falling back to `<projectRoot>/index.html` if the build
   * output is missing. In development it's always `<projectRoot>/index.html`.
   */
  htmlTemplate: string
}

export interface ResolveSsrPathsOptions {
  /**
   * Override the resolved client build directory. Defaults to
   * `<projectRoot>/dist/client`.
   */
  clientDir?: string
  /**
   * Template filename to read. Defaults to `"index.html"`.
   */
  templateName?: string
  /**
   * Override the project root resolution. When omitted, the helper walks
   * up from the server entry's directory until it finds a `package.json`.
   */
  projectRoot?: string
  /**
   * Override the development check. Defaults to `process.env.NODE_ENV !== "production"`.
   */
  dev?: boolean
}

/**
 * Resolve the runtime paths and HTML template for a Vite-built SSR server.
 *
 * Designed to collapse the boilerplate that every `server.ts` repeats:
 * detecting prod vs. dev, locating the project root, finding `dist/client`,
 * and choosing the right `index.html` to feed `createRenderer`.
 *
 * For hybrid static prerender + SSR, pass **`prerenderedHtmlDir`** (typically
 * {@link SsrPaths.clientDir} from this helper) into `createRenderer`;
 * **`NODE_ENV=production`** triggers disk-backed static HTML for `generateStaticPaths`
 * before SSR — **development never reads from disk** under `prerenderedHtmlDir`.
 *
 * @example
 * ```ts
 * import { Hono } from "hono"
 * import { serveStatic } from "@hono/node-server/serve-static"
 * import { createRenderer, resolveStatic } from "kiru/router"
 * import { routes } from "./routes"
 *
 * const isProd = process.env.NODE_ENV === "production"
 * const { clientDir, htmlTemplate } = resolveStatic(import.meta.url, { dev: !isProd })
 *
 * const renderer = createRenderer({ stream: true, routes, htmlTemplate })
 * const app = new Hono()
 * if (isProd) app.use("/assets/*", serveStatic({ root: clientDir }))
 * app.all("*", async (c) => {
 *   const r = await renderer.render(c.req.raw)
 *   return r ? new Response(r.body, r) : c.notFound()
 * })
 * export default app
 * ```
 *
 * @param importMetaUrl Pass `import.meta.url` from the server entry. The
 *   helper uses it to locate the project root regardless of where the
 *   process was launched from (so `node dist/server/index.js` works from
 *   any cwd).
 */
export function resolveStatic(
  importMetaUrl: string,
  options: ResolveSsrPathsOptions = { }
): SsrPaths {
  const isProd = typeof options.dev === "boolean" ? !options.dev : process.env.NODE_ENV === "production"
  const entryDir = dirname(fileURLToPath(importMetaUrl))
  const projectRoot = options.projectRoot ?? findProjectRoot(entryDir)
  const clientDir = options.clientDir ?? join(projectRoot, "dist", "client")
  const templateName = options.templateName ?? "index.html"
  const templatePath = isProd ? join(clientDir, templateName) : join(projectRoot, templateName)

  const htmlTemplate = readFileSync(templatePath, "utf8")

  return {
    projectRoot,
    clientDir,
    templatePath,
    htmlTemplate,
  }
}

/**
 * Walk upward from `start` until a directory containing `package.json`
 * is found. This is the same heuristic Vite, Node, and tsc use to locate
 * a project root.
 */
function findProjectRoot(start: string): string {
  let dir = start
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(
        `[kiru/router] resolveStatic: could not find a package.json walking up from "${start}". ` +
          `Pass { projectRoot } explicitly if your server entry lives outside the project tree.`
      )
    }
    dir = parent
  }
}
