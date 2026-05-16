import type { ESBuildOptions } from "vite"

export type FileLinkFormatter = (path: string, line: number) => string

export interface DevtoolsOptions {
  /**
   * Formats the link displayed in devtools to the component's source code
   * @param path the path to the file that contains the component on disk
   * @param line the component's line number
   * @returns {string} the formatted link
   * @default (path, line) => `vscode://file/${path}:${line}`
   */
  formatFileLink?: FileLinkFormatter
}

export interface ExperimentalOptions {
  /**
   * Enable static JSX hoisting optimization
   * @default false
   * @example
   * ```tsx
   * function MyComponent() {
   *   return <div>Hello, world!</div>
   * }
   * // becomes:
   * const $k0 = createElement("div", null, "Hello, world!")
   * function MyComponent() {
   *   return $k0
   * }
   * // because the JSX is static, it can be hoisted to the top of the component.
   * // our 'div' with 'Hello, world!' is _never rerendered_.
   * ```
   */
  staticHoisting?: boolean
}

export interface KiruPluginOptions {
  /**
   * Whether the devtools should be injected into the build during development
   * @default true
   */
  devtools?: boolean | DevtoolsOptions

  /**
   * Additional directories (relative to root) to include in transforms
   * @example ['../path/to/components/']
   */
  include?: string[]

  /**
   * Whether logging should be enabled
   * @default false
   */
  loggingEnabled?: boolean

  /**
   * Callback for when a file is transformed
   */
  onFileTransformed?: (id: string, content: string) => void

  /**
   * Callback for when a file is excluded from transforms due to not being in project root or `include`
   */
  onFileExcluded?: (id: string) => void

  /**
   * Experimental options
   */
  experimental?: ExperimentalOptions

  /**
   * Declarative router support options.
   */
  router?: {
    /**
     * Enable SSG HTML generation and configure the routes module.
     * - `true` uses the default `"./src/routes.ts"`
     * - `{ routes: "..." }` uses a custom routes module path
     * @default false
     *
     * Can be combined with {@link serverEntry}: `vite build` emits prerendered
     * HTML for routes marked `static: true`, then bundles the SSR server. In dev,
     * when `serverEntry` is set, the SSR dev pipeline still handles navigation;
     * use `node dist/server` (or equivalent) to verify hybrid static + SSR in prod.
     */
    ssg?: boolean | { routes: string }
    /**
     * Path to the module that exports the Hono app as `default` (SSR only).
     * When set, the kiru plugin handles dev-mode SSR requests directly —
     * loading your app via `ssrLoadModule`, calling `app.fetch`, and injecting
     * render-blocking CSS links — so `@hono/vite-dev-server` is not needed.
     * @example "./src/server.ts"
     */
    serverEntry?: string
    /**
     * Glob pattern for remote function files.
     * Matching modules will be transformed to client fetch stubs and made
     * available on the server via `virtual:kiru:remote-registry`.
     * @example "*.actions.ts"
     */
    remote?: string
    /**
     * HTML file in `outDir` to use as the shell after `vite build` (must contain
     * `{{kiru_body}}` and optionally `{{kiru_head}}` in `<head>`.
     * @default "index.html"
     */
    htmlTemplate?: string
    /**
     * Optional full HTML override per route. If set, {@link htmlTemplate} injection is skipped.
     * Prefer the default template tokens (`{{kiru_head}}` + `{{kiru_body}}`) and route `meta` for SEO.
     * May be async. Receives the Vite client `manifest.json` object when available (for modulepreload, etc.).
     */
    htmlShell?: (
      body: string,
      path: string,
      document: { headHtml: string; title?: string },
      assets?: { manifest?: Record<string, unknown> }
    ) => string | Promise<string>
  }
}

export const defaultEsBuildOptions: ESBuildOptions

type PluginInterop = Record<string, unknown> & {
  name: string
}

export default function kiru(opts?: KiruPluginOptions): PluginInterop
