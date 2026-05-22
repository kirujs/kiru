type ManifestChunk = {
  file?: string
  css?: string[]
  isEntry?: boolean
}

export function resolveClientEntryChunk(
  manifest: Record<string, ManifestChunk> | undefined,
  entry = "src/main.tsx"
): ManifestChunk | undefined {
  if (!manifest) return undefined
  const direct = manifest[entry] ?? manifest[`/${entry}`]
  if (direct?.file) return direct
  const fromHtml = manifest["index.html"]
  if (fromHtml?.file) return fromHtml
  for (const chunk of Object.values(manifest)) {
    if (chunk.isEntry && chunk.file) return chunk
  }
  return undefined
}

function escapePreloadHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

export function formatBootstrapPreloadLinksForHtml(urls: Iterable<string>): string {
  const parts: string[] = []
  for (const href of urls) {
    if (!href) continue
    parts.push(
      `<link rel="modulepreload" crossorigin href="${escapePreloadHref(href)}" fetchpriority="low">`
    )
  }
  return parts.length ? parts.join("\n    ") : ""
}

export function formatRouteModulePreloadLinksForHtml(urls: Iterable<string>): string {
  const parts: string[] = []
  for (const href of urls) {
    if (!href) continue
    parts.push(
      `<link rel="modulepreload" crossorigin href="${escapePreloadHref(href)}">`
    )
  }
  return parts.length ? parts.join("\n    ") : ""
}

/** Insert bootstrap + route modulepreload links before `</head>` (bootstrap first). */
export function injectHydrationPreloadLinks(
  html: string,
  input: { bootstrap?: Iterable<string>; route?: Iterable<string> }
): string {
  const boot = [...new Set(input.bootstrap ?? [])]
  const bootSet = new Set(boot)
  const route = [...new Set(input.route ?? [])].filter((u) => !bootSet.has(u))
  const preloadLinksHtml =
    formatBootstrapPreloadLinksForHtml(boot) +
    (boot.length && route.length ? "\n    " : "") +
    formatRouteModulePreloadLinksForHtml(route)
  if (!preloadLinksHtml) return html
  return html.replace("</head>", `    ${preloadLinksHtml}\n  </head>`)
}

/** @deprecated Use injectHydrationPreloadLinks */
export function injectRouteModulePreloadLinks(
  html: string,
  urls: Iterable<string>
): string {
  return injectHydrationPreloadLinks(html, { route: urls })
}

/** Swap dev `src/main.tsx` (etc.) for hashed production assets in prerendered HTML. */
export function injectClientEntryScripts(
  html: string,
  manifest: Record<string, ManifestChunk> | undefined,
  entry = "src/main.tsx"
): string {
  const chunk = resolveClientEntryChunk(manifest, entry)
  if (!chunk?.file) return html

  const cssLinks = (chunk.css ?? [])
    .map((href) => `<link rel="stylesheet" crossorigin href="/${href}">`)
    .join("\n    ")
  const moduleScript = `<script type="module" crossorigin src="/${chunk.file}"></script>`

  let out = html.replace(
    /<script\s+type="module"[^>]*src="[^"]+"[^>]*>\s*<\/script>/i,
    moduleScript
  )

  if (cssLinks && !(chunk.css ?? []).some((href) => out.includes(href))) {
    out = out.replace("</head>", `    ${cssLinks}\n  </head>`)
  }

  return out
}
