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
