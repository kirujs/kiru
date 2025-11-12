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
    const { dir, baseUrl, page, layout, guard, transition } = ssgOptions
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
    return `
import {
  render as kiruServerRender,
  generateStaticPaths as kiruServerGenerateStaticPaths
} from "kiru/router/server"
import Document from "${userDoc}"
import { pages, layouts, guards } from "${VIRTUAL_ROUTES_ID}"

export async function render(url, ctx) {
  const { registerModule, registerPreloadedPageProps } = ctx
  return kiruServerRender(url, { registerModule, registerPreloadedPageProps, Document, pages, layouts, guards })
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
import { dir, baseUrl, pages, layouts, guards, transition } from "${VIRTUAL_ROUTES_ID}"
import "${userDoc}"

initClient({ dir, baseUrl, pages, layouts, guards, transition })
`
  }

  return {
    [VIRTUAL_ROUTES_ID]: createRoutesModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }
}
