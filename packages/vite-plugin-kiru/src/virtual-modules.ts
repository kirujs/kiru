import { ResolvedSSGOptions } from "./config.js"
import type { SSROptions } from "./types.js"
import { resolveUserDocument } from "./utils.js"

export const VIRTUAL_CONFIG_ID = "virtual:kiru:config"
export const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
export const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

export async function createVirtualModules(
  projectRoot: string,
  options: ResolvedSSGOptions | Required<SSROptions>,
  mode: "ssg" | "ssr"
) {
  const userDoc = resolveUserDocument(projectRoot, options)

  function createConfigModule(): string {
    const { dir, baseUrl, page, layout, guard, transition } = options
    return `
import { formatViteImportMap, normalizePrefixPath } from "kiru/router/utils"

const dir = normalizePrefixPath("${dir}")
const baseUrl = normalizePrefixPath("${baseUrl}")
const pages = formatViteImportMap(import.meta.glob(["/**/${page}"]), dir, baseUrl)
const layouts = formatViteImportMap(import.meta.glob(["/**/${layout}"]), dir, baseUrl)
const guards = formatViteImportMap(import.meta.glob(["/**/${guard}"]), dir, baseUrl)
const transition = ${transition}

export { dir, baseUrl, pages, layouts, guards, transition }
`
  }

  function createEntryServerModule(): string {
    if (mode === "ssr") {
      return `
import { render as kiruServerRender } from "kiru/router/ssr"
import Document from "${userDoc}"
import * as config from "${VIRTUAL_CONFIG_ID}"

export const documentModuleId = "${userDoc.substring(projectRoot.length)}"

export async function render(url, ctx) {
  return kiruServerRender(url, { ...ctx, ...config, Document })
}
`
    }

    // SSG mode
    return `
import {
  render as kiruStaticRender,
  generateStaticPaths as kiruGenerateStaticPaths
} from "kiru/router/ssg"
import Document from "${userDoc}"
import * as config from "${VIRTUAL_CONFIG_ID}"

export const documentModuleId = "${userDoc.substring(projectRoot.length)}"

export async function render(url, ctx) {
  return kiruStaticRender(url, { ...ctx, ...config, Document })
}

export async function generateStaticPaths() {
  return kiruGenerateStaticPaths(config.pages)
}
`
  }

  function createEntryClientModule(): string {
    if (mode === "ssr") {
      return `
import { initClient } from "kiru/router/client"
import * as config from "${VIRTUAL_CONFIG_ID}"
import "${userDoc}"

initClient({ ...config, hydrationMode: "dynamic" })
`
    }
    // todo: only include Document in dev mode, we should instead scan for included assets
    return `
import { initClient } from "kiru/router/client"
import * as config from "${VIRTUAL_CONFIG_ID}"
import "${userDoc}"

initClient({ ...config })
`
  }

  return {
    [VIRTUAL_CONFIG_ID]: createConfigModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }
}
