import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export interface SsrPaths {
  projectRoot: string
  clientDir: string
  templatePath: string
  htmlTemplate: string
}

export interface ResolveSsrPathsOptions {
  clientDir?: string
  templateName?: string
  projectRoot?: string
  dev?: boolean
}

/**
 * Resolve project root, client build dir, and HTML shell for Node/Bun SSR servers.
 *
 * @see docs/router/deploy-runtimes.md
 */
export function resolveStatic(
  importMetaUrl: string,
  options: ResolveSsrPathsOptions = {}
): SsrPaths {
  const isProd =
    typeof options.dev === "boolean"
      ? !options.dev
      : process.env.NODE_ENV === "production"
  const entryDir = dirname(fileURLToPath(importMetaUrl))
  const projectRoot = options.projectRoot ?? findProjectRoot(entryDir)
  const clientDir = options.clientDir ?? join(projectRoot, "dist", "client")
  const templateName = options.templateName ?? "index.html"
  const templatePath = isProd
    ? join(clientDir, templateName)
    : join(projectRoot, templateName)

  const htmlTemplate = readFileSync(templatePath, "utf8")

  return {
    projectRoot,
    clientDir,
    templatePath,
    htmlTemplate,
  }
}

function findProjectRoot(start: string): string {
  let dir = start
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(
        `[@kirujs/adapter-node] resolveStatic: could not find package.json walking up from "${start}". ` +
          `Pass { projectRoot } explicitly.`
      )
    }
    dir = parent
  }
}
