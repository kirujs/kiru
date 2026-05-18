import { promises as fs } from "node:fs"
import path from "node:path"

export const LOADER_MODULES_MANIFEST = "kiru-loader-modules.json"

export function devLoaderManifestPath(projectRoot: string): string {
  return path
    .join(projectRoot, "node_modules/.vite", LOADER_MODULES_MANIFEST)
    .replace(/\\/g, "/")
}

export function renderLoaderRegistryVirtual(
  modules: Record<string, string>
): string {
  const entries = Object.entries(modules)
  if (entries.length === 0) {
    return "export {};\n"
  }
  const lines = entries.map(
    ([routeId, viteId]) =>
      `__INTERNAL_LOADER_REGISTRY.registerLazyImport(${JSON.stringify(routeId)}, () => import(${JSON.stringify(viteId)}));`
  )
  return `import { __INTERNAL_LOADER_REGISTRY } from "kiru/router";\n${lines.join("\n")}\nexport {};\n`
}

export async function readLoaderModuleManifest(
  projectRoot: string,
  clientOutDir?: string
): Promise<Record<string, string>> {
  const merged: Record<string, string> = {}
  const candidates = [
    devLoaderManifestPath(projectRoot),
    clientOutDir
      ? path.join(clientOutDir, LOADER_MODULES_MANIFEST).replace(/\\/g, "/")
      : null,
  ].filter((p): p is string => !!p)

  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, "utf8")
      Object.assign(merged, JSON.parse(raw) as Record<string, string>)
    } catch {
      /* optional */
    }
  }
  return merged
}

export async function writeDevLoaderManifest(
  projectRoot: string,
  modules: Record<string, string>
): Promise<void> {
  const filePath = devLoaderManifestPath(projectRoot)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(modules, null, 2))
}

export function mergeLoaderModules(
  inMemory: Map<string, string>,
  fromDisk: Record<string, string>
): Record<string, string> {
  return { ...fromDisk, ...Object.fromEntries(inMemory) }
}
