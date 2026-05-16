import path from "node:path"
import { glob } from "tinyglobby"

const GLOB_RE = /[*?{}[\]]/

export function isGlobPattern(pattern: string): boolean {
  return GLOB_RE.test(pattern)
}

/**
 * Resolve a module path or glob pattern to absolute file paths under `projectRoot`.
 */
export async function resolveModulePattern(
  pattern: string,
  projectRoot: string,
  label: string
): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, "/")

  if (!isGlobPattern(normalized)) {
    const abs = path.isAbsolute(normalized)
      ? normalized
      : path.resolve(projectRoot, normalized)
    return [abs.replace(/\\/g, "/")]
  }

  const matches = (
    await glob(normalized, {
      cwd: projectRoot,
      absolute: true,
      onlyFiles: true,
    })
  ).map((p) => p.replace(/\\/g, "/"))

  if (matches.length === 0) {
    throw new Error(
      `[vite-plugin-kiru]: ${label} matched no files for pattern "${pattern}"`
    )
  }

  return matches.sort((a, b) => a.localeCompare(b))
}

/** Resolve to exactly one file; errors if the pattern matches zero or many paths. */
export async function resolveSingleModulePattern(
  pattern: string,
  projectRoot: string,
  label: string
): Promise<string> {
  const matches = await resolveModulePattern(pattern, projectRoot, label)
  if (matches.length > 1) {
    throw new Error(
      `[vite-plugin-kiru]: ${label} "${pattern}" matched multiple files:\n` +
        matches.map((m) => `  - ${m}`).join("\n") +
        "\nUse a more specific pattern."
    )
  }
  return matches[0]!
}

/** Prefer `.ts` over `.js` when a brace pattern expands to both site configs. */
export function sortSiteConfigPaths(paths: string[]): string[] {
  const rank = (p: string) =>
    p.endsWith(".ts") ? 0 : p.endsWith(".js") ? 1 : 2
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export function toViteModuleId(
  absolutePath: string,
  projectRoot: string
): string {
  return (
    "/" + path.relative(projectRoot, absolutePath).replace(/\\/g, "/")
  )
}
