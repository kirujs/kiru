import type { ESBuildOptions, Plugin } from "vite"

export type FileLinkFormatter = (path: string, line: number) => string

export interface SSGBuildOptions {
  /**
   * The max number of pages to render/load concurrently
   * @default 100
   */
  maxConcurrentRenders?: number
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
   * @default "document.tsx"
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
   * Options for SSG/SSR
   * @example
   * ```ts
   * app: {
   *   dir: "./src/app",
   *   document: "document.tsx",
   *   page: "index.{tsx,jsx}",
   *   layout: "layout.{tsx,jsx}",
   *   transition: true
   * }
   * ```
   */
  ssg?: SSGOptions
}

export { defaultEsBuildOptions } from "./config"

/**
 * Registers a callback to be fired when the HMR is triggered
 */
export function onHMR(callback: () => void): void

export default function kiru(opts?: KiruPluginOptions): Plugin
