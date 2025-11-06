import type { SSGOptions } from "./types.js"
import { resolveUserDocument } from "./utils.js"

export const VIRTUAL_ROUTES_ID = "virtual:kiru:routes"
export const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
export const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

export async function createVirtualModules(
  projectRoot: string,
  ssgOptions: Required<SSGOptions>
) {
  const userDoc = resolveUserDocument(projectRoot, ssgOptions)

  function createRoutesModule(): string {
    const { dir, baseUrl, page, layout, transition } = ssgOptions
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
    return `
import {
  render as kiruServerRender,
  generateStaticPaths as kiruServerGenerateStaticPaths
} from "kiru/router/server"
import Document from "${userDoc}"
import { pages, layouts } from "${VIRTUAL_ROUTES_ID}"

export async function render(url, ctx) {
  const { registerModule, registerPreloadedPageProps } = ctx
  return kiruServerRender(url, { registerModule, registerPreloadedPageProps, Document, pages, layouts })
}

export async function generateStaticPaths() {
  return kiruServerGenerateStaticPaths(pages)
}
`
  }

  function createEntryClientModule(): string {
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
