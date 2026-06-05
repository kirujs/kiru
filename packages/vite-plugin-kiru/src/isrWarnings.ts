import { readFile } from "node:fs/promises"
import {
  getISRWarningsForTarget,
  type KiruDeployTarget,
} from "@kirujs/runtime"

const ISR_REVALIDATE_RE =
  /defineISR\s*\(\s*\{[^}]*revalidate\s*:\s*(\d+|false)/
const ISR_TAGS_RE = /tags\s*:\s*\[/

export async function scanFileForISRWarnings(
  filePath: string,
  deployTarget: KiruDeployTarget,
  routeId?: string
): Promise<string[]> {
  if (deployTarget !== "cloudflare") return []
  let source: string
  try {
    source = await readFile(filePath, "utf8")
  } catch {
    return []
  }

  const warnings: string[] = []
  const id = routeId ?? filePath

  if (ISR_REVALIDATE_RE.test(source)) {
    const numMatch = source.match(/revalidate\s*:\s*(\d+)/)
    if (numMatch && Number(numMatch[1]) > 0) {
      warnings.push(
        ...getISRWarningsForTarget(deployTarget, {
          revalidate: Number(numMatch[1]),
        }, id)
      )
    }
  }

  if (ISR_TAGS_RE.test(source)) {
    warnings.push(
      ...getISRWarningsForTarget(deployTarget, { tags: ["*"] }, id)
    )
  }

  return warnings
}

export async function warnCloudflareISRInPages(
  pageFiles: string[],
  log: (msg: string) => void
): Promise<void> {
  for (const file of pageFiles) {
    const warnings = await scanFileForISRWarnings(file, "cloudflare")
    for (const w of warnings) {
      log(`[vite-plugin-kiru] ${w}`)
    }
  }
}
