import type { Plugin } from "vite"
import type { ImportGlobFunction } from "vite"

export type FileLinkFormatter = (path: string, line: number) => string

export interface DevtoolsOptions {
  /**
   * Specifies the path to the devtools app displayed via popup
   * @default "/__devtools__"
   */
  pathname?: string

  /**
   * Formats the link displayed in devtools to the component's source code
   * @param path the path to the file that contains the component on disk
   * @param line the component's line number
   * @returns {string} the formatted link
   * @default (path, line) => `vscode://file/${path}:${line}`
   */
  formatFileLink?: FileLinkFormatter
}

export interface FileRouterOptions {
  /**
   * @default "/src/pages"
   */
  dir: string
  /**
   * @default "index.{js,jsx,ts,tsx,mdx}"
   */
  page: string
  /**
   * @default "layout.{js,jsx,ts,tsx,mdx}"
   */
  layout: string
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
   * File-based routing configuration
   * @default {
   *    dir: "/src/pages",
   *    page: "index.{js,jsx,ts,tsx,mdx}",
   *    layout: "layout.{js,jsx,ts,tsx,mdx}",
   * }
   */
  fileRouter?: boolean | FileRouterOptions

  /**
   * Callback for when a file is transformed
   */
  onFileTransformed?: (id: string, content: string) => void

  /**
   * Callback for when a file is excluded from transforms due to not being in project root or `include`
   */
  onFileExcluded?: (id: string) => void
}

/**
 * Registers a callback to be fired when the HMR is triggered
 */
export function onHMR(callback: () => void): void

export default function kiru(opts?: KiruPluginOptions): Plugin
