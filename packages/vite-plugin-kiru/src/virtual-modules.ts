import type { SSGOptions, SSROptions } from "./types.js"
import { resolveUserDocument } from "./utils.js"

export const VIRTUAL_ROUTES_ID = "virtual:kiru:routes"
export const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
export const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

export async function createVirtualModules(
  projectRoot: string,
  options: Required<SSGOptions> | Required<SSROptions>,
  mode: "ssg" | "ssr"
) {
  const userDoc = resolveUserDocument(projectRoot, options)

  function createRoutesModule(): string {
    const { dir, baseUrl, page, layout, transition } = options
    return `
import { formatViteImportMap, normalizePrefixPath } from "kiru/router/utils"

const dir = normalizePrefixPath("${dir}")
const baseUrl = normalizePrefixPath("${baseUrl}")
const pagesMap = import.meta.glob(["/**/${page}"])
const layoutsMap = import.meta.glob(["/**/${layout}"])
const pages = formatViteImportMap(pagesMap, dir, baseUrl)
const layouts = formatViteImportMap(layoutsMap, dir, baseUrl)
const transition = ${transition}

export { dir, baseUrl, pages, layouts, transition }
`
  }

  function createEntryServerModule(): string {
    if (mode === "ssr") {
      return `
import { render as kiruSSRRender } from "kiru/router/ssr"
import Document from "${userDoc}"
import { pages, layouts } from "${VIRTUAL_ROUTES_ID}"

export async function render(url, ctx) {
  return kiruSSRRender(url, { ...ctx, Document, pages, layouts })
}
`
    }

    // SSG mode
    return `
import {
  render as kiruStaticRender,
  generateStaticPaths as kiruServerGenerateStaticPaths
} from "kiru/router/ssg"
import Document from "${userDoc}"
import { pages, layouts } from "${VIRTUAL_ROUTES_ID}"

export async function render(url, ctx) {
  return kiruStaticRender(url, { ...ctx, Document, pages, layouts })
}

export async function generateStaticPaths() {
  return kiruServerGenerateStaticPaths(pages)
}
`
  }

  function createEntryClientModule(): string {
    if (mode === "ssr") {
      return `
import { initClient } from "kiru/router/client"
import { dir, baseUrl, pages, layouts, transition } from "${VIRTUAL_ROUTES_ID}"
import "${userDoc}"

initClient({ dir, baseUrl, pages, layouts, transition, hydrationMode: "dynamic" })
`
    }
    // todo: only include Document in dev mode, we should instead scan for included assets
    return `
import { initClient } from "kiru/router/client"
import { dir, baseUrl, pages, layouts, transition } from "${VIRTUAL_ROUTES_ID}"
import "${userDoc}"

initClient({ dir, baseUrl, pages, layouts, transition })
`
  }

  return {
    [VIRTUAL_ROUTES_ID]: createRoutesModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }
}
