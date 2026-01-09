import type { ESBuildOptions, Plugin } from "vite"

export type FileLinkFormatter = (path: string, line: number) => string

export interface SSGBuildOptions {
  /**
   * The max number of pages to render/load concurrently
   * @default 100
   */
  maxConcurrentRenders?: number
}

export type SSGSitemapChangefreq =
  // | "always"
  "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"

export interface SSGSitemapVideo {
  title: string
  thumbnail_loc: string
  description?: string
}

export interface SSGSitemapOverride {
  /**
   * Change frequency override for this route
   * @default "weekly"
   */
  changefreq?: SSGSitemapChangefreq
  /**
   * Priority override for this route (0.0 to 1.0)
   * @default 0.5
   */
  priority?: number
  /**
   * Last modified date override for this route
   */
  lastmod?: Date
  /**
   * Images to include for this route
   * @example ["/images/kiru.png"]
   */
  images?: string[]
  /**
   * Videos to include for this route
   * @example
   * ```ts
   * videos: [
   *   {
   *     title: "Kiru",
   *     thumbnail_loc: "/images/kiru.png",
   *     description: "Kiru is a framework for building web applications."
   *   }
   * ]
   * ```
   */
  videos?: Array<SSGSitemapVideo>
}

export interface SSGSitemapOptions {
  /**
   * The domain to use for sitemap URLs
   * @example "https://example.com"
   */
  domain: string
  /**
   * Default last modified date for all URLs
   */
  lastmod?: Date
  /**
   * Default change frequency for all URLs
   * @default "weekly"
   */
  changefreq?: SSGSitemapChangefreq
  /**
   * Default priority for all URLs (0.0 to 1.0)
   * @default 0.5
   */
  priority?: number
  /**
   * Per-route overrides for sitemap entries
   * @example
   * ```ts
   * overrides: {
   *   "/": {
   *     changefreq: "never",
   *     priority: 0.8,
   *   },
   * }
   */
  overrides?: Record<string, SSGSitemapOverride>
}

export interface SSGOptions {
  /**
   * The base URL of the app
   * @default "/"
   */
  baseUrl?: string
  /**
   * The directory of the app
   * @default "src/pages"
   */
  dir?: string
  /**
   * The name of the document component
   * @default "document.{tsx,jsx}"
   */
  document?: string
  /**
   * The filename of page components to search for
   * @default "index.{tsx,jsx}"
   */
  page?: string
  /**
   * The filename of layout components to search for
   * @default "layout.{tsx,jsx}"
   */
  layout?: string
  /**
   * Enable transitions for all routes and loading states
   * @default false
   */
  transition?: boolean

  /**
   * Options for sitemap generation
   */
  sitemap?: SSGSitemapOptions

  /**
   * Options for build
   */
  build?: SSGBuildOptions
}

export interface DevtoolsOptions {
  /**
   * Specifies the path to the devtools app displayed via popup
   * @default "/__devtools__"
   */
  dtClientPathname?: string

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
   * Options for SSG
   * @example
   * ```ts
   * ssg: {
   *   dir: "./src/app",
   *   document: "document.{tsx,jsx}",
   *   page: "index.{tsx,jsx}",
   *   layout: "layout.{tsx,jsx}",
   *   transition: true
   * }
   * ```
   */
  ssg?: SSGOptions | true
}

export const defaultEsBuildOptions: ESBuildOptions

/**
 * Registers a callback to be fired when the HMR is triggered
 */
export function onHMR(callback: () => void): void

export default function kiru(opts?: KiruPluginOptions): Plugin
