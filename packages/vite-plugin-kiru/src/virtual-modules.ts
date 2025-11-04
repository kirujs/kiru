import path from "node:path"
import fs from "node:fs"
import type { SSGOptions } from "./types.js"

export const VIRTUAL_ROUTES_ID = "virtual:kiru:routes"
export const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
export const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

export function createVirtualModules(
  projectRoot: string,
  ssgOptions: Required<SSGOptions>
) {
  function resolveUserDocument(): string {
    const { dir, document } = ssgOptions
    const fp = path.resolve(projectRoot, dir, document)
    if (fs.existsSync(fp)) return fp.replace(/\\/g, "/")
    throw new Error(`Document not found at ${fp}`)
  }

  function createRoutesModule(): string {
    const { dir, baseUrl, page, layout } = ssgOptions
    return `
import { formatViteImportMap, normalizePrefixPath } from "kiru/router/utils"

const dir = normalizePrefixPath("${dir}")
const baseUrl = normalizePrefixPath("${baseUrl}")
const pagesMap = import.meta.glob(["/**/${page}"])
const layoutsMap = import.meta.glob(["/**/${layout}"])
const pages = formatViteImportMap(pagesMap, dir, baseUrl)
const layouts = formatViteImportMap(layoutsMap, dir, baseUrl)

export { dir, baseUrl, pages, layouts }
`
  }

  function createEntryServerModule(): string {
    const userDoc = resolveUserDocument()
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
    return `
import { onLoadedDev } from "kiru/router/dev"
import { initClient } from "kiru/router/client"
import { dir, baseUrl, pages, layouts } from "${VIRTUAL_ROUTES_ID}"
import "${resolveUserDocument()}" // todo: only include this in dev mode

initClient({ dir, baseUrl, pages, layouts })
if (import.meta.env.DEV) {
  onLoadedDev()
}
`
  }

  return {
    [VIRTUAL_ROUTES_ID]: createRoutesModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }
}
