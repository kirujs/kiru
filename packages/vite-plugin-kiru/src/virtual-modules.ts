import { ResolvedSSGOptions } from "./config.js"
import type { SSROptions } from "./types.js"
import { resolveUserDocument } from "./utils.js"

export const VIRTUAL_CONFIG_ID = "virtual:kiru:config"
export const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
export const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

export function createVirtualModules_SSG(
  projectRoot: string,
  options: ResolvedSSGOptions
) {
  const userDoc = resolveUserDocument(projectRoot, options)
  const documentModuleId = userDoc.substring(projectRoot.length)
  const { dir, baseUrl, page, layout, guard, transition } = options

  function createConfigModule() {
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

  function createEntryServerModule() {
    return `
import {
  render as kiruStaticRender,
  generateStaticPaths as kiruGenerateStaticPaths
} from "kiru/router/ssg"
import Document from "${userDoc}"
import * as config from "${VIRTUAL_CONFIG_ID}"

export const documentModuleId = "${documentModuleId}"

export async function render(url, ctx) {
  return kiruStaticRender(url, { ...ctx, ...config, Document })
}

export async function generateStaticPaths() {
  return kiruGenerateStaticPaths(config.pages)
}
`
  }

  function createEntryClientModule() {
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

export function createVirtualModules_SSR(
  projectRoot: string,
  options: Required<SSROptions>
) {
  const userDoc = resolveUserDocument(projectRoot, options)
  const documentModuleId = userDoc.substring(projectRoot.length)
  const { dir, baseUrl, page, layout, guard, remote, transition, secret } =
    options

  function createConfigModule() {
    return `
import { formatViteImportMap, normalizePrefixPath } from "kiru/router/utils"

const dir = normalizePrefixPath("${dir}")
const baseUrl = normalizePrefixPath("${baseUrl}")
const pages = formatViteImportMap(import.meta.glob(["/**/${page}"]), dir, baseUrl)
const layouts = formatViteImportMap(import.meta.glob(["/**/${layout}"]), dir, baseUrl)
const guards = formatViteImportMap(import.meta.glob(["/**/${guard}"]), dir, baseUrl)
const remotes = formatViteImportMap(import.meta.glob(["/**/${remote}"]), dir, baseUrl)
const transition = ${transition}
const actions = new Map()

let token
if ("window" in globalThis) {
  try {
    const s = document.querySelector("[k-request-token]")
    token = s.innerHTML
    s.remove()
  } catch {}
}

globalThis.__kiru_serverActions ??= {
  register: (fp, actionsMap) => {
    actions.set(fp, actionsMap)
    console.log("[create-kiru]: Registered actions for", fp, actionsMap)
  },
  dispatch: async (id, ...args) => {   
    const r = await fetch(\`/?action=\${id}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-kiru-token": token },
      body: JSON.stringify(args)
    })
    if (!r.ok) throw new Error("Action failed")
    return r.json()
  }
}

export { dir, baseUrl, pages, actions, layouts, guards, remotes, transition }
`
  }

  function createEntryServerModule() {
    return `
import { render as kiruServerRender } from "kiru/router/ssr"
import Document from "${userDoc}"
import * as config from "${VIRTUAL_CONFIG_ID}"

export const remoteFunctionSecret = "${secret}"
export const documentModuleId = "${documentModuleId}"

export async function render(url, ctx) {
  return kiruServerRender(url, { ...ctx, ...config, Document })
}

export { config }
`
  }

  function createEntryClientModule() {
    return `
import { initClient } from "kiru/router/client"
import * as config from "${VIRTUAL_CONFIG_ID}"
import "${userDoc}"

initClient({ ...config, hydrationMode: "dynamic" })
`
  }

  return {
    [VIRTUAL_CONFIG_ID]: createConfigModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }
}
