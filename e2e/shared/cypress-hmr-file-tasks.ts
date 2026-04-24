import fs from "node:fs/promises"
import path from "node:path"

type FileBackup = {
  content: string
  atimeMs: number
  mtimeMs: number
}

export function registerHmrFileTasks(on: Cypress.PluginEvents) {
  const hmrBackups = new Map<string, FileBackup>()

  async function restoreFileFromBackup(resolvedPath: string, backup: FileBackup) {
    await fs.writeFile(resolvedPath, backup.content)
    await fs.utimes(resolvedPath, backup.atimeMs / 1000, backup.mtimeMs / 1000)
  }

  on("task", {
    async hmrMutateFile({
      filePath,
      content,
    }: {
      filePath: string
      content: string
    }) {
      const resolvedPath = path.resolve(filePath)
      if (!hmrBackups.has(resolvedPath)) {
        const [originalContent, stats] = await Promise.all([
          fs.readFile(resolvedPath, "utf8"),
          fs.stat(resolvedPath),
        ])
        hmrBackups.set(resolvedPath, {
          content: originalContent,
          atimeMs: stats.atimeMs,
          mtimeMs: stats.mtimeMs,
        })
      }

      await fs.writeFile(resolvedPath, content)
      return null
    },
    async hmrRestoreFile(filePath: string) {
      const resolvedPath = path.resolve(filePath)
      const backup = hmrBackups.get(resolvedPath)
      if (!backup) return null

      await restoreFileFromBackup(resolvedPath, backup)
      hmrBackups.delete(resolvedPath)
      return null
    },
  })

  return async function restoreAllHmrFiles() {
    for (const [resolvedPath, backup] of hmrBackups) {
      await restoreFileFromBackup(resolvedPath, backup)
    }
    hmrBackups.clear()
  }
}
