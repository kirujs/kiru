import { promises as fs } from "node:fs"
import path from "node:path"
import { generateFileRoutes } from "@kirujs/file-routes"
import type { ResolvedFileRoutes } from "./fileRoutesConfig.js"

export async function writeGeneratedRoutes(
  fileRoutes: ResolvedFileRoutes
): Promise<{ written: boolean; outFileAbs: string }> {
  const { source } = await generateFileRoutes({
    pagesDir: fileRoutes.pagesDirAbs,
    outFile: fileRoutes.outFileAbs,
    pageFiles: fileRoutes.pageFiles,
    layoutFiles: fileRoutes.layoutFiles,
    errorFiles: fileRoutes.errorFiles,
    notFoundFiles: fileRoutes.notFoundFiles,
    extend: fileRoutes.extendAbs,
  })

  let previous = ""
  try {
    previous = await fs.readFile(fileRoutes.outFileAbs, "utf8")
  } catch {
    // missing file
  }

  if (previous === source) {
    return { written: false, outFileAbs: fileRoutes.outFileAbs }
  }

  await fs.mkdir(path.dirname(fileRoutes.outFileAbs), { recursive: true })
  await fs.writeFile(fileRoutes.outFileAbs, source, "utf8")
  return { written: true, outFileAbs: fileRoutes.outFileAbs }
}
