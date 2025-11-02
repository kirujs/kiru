import type { Connect } from "vite"
import { resolve } from "node:path"
import fs from "node:fs"
import path from "node:path"
import mime from "mime"

export function createPreviewMiddleware(
  projectRoot: string,
  baseOutDir: string
): Connect.NextHandleFunction {
  const clientOutDir = resolve(projectRoot, `${baseOutDir}/client`)

  return async (req, res, next) => {
    try {
      let url = req.url || "/"

      // SPA/folder fallback: /blog -> /blog/index.html
      let filePath = path.join(clientOutDir, url)
      if (url.endsWith("/")) {
        filePath = path.join(filePath, "index.html")
      }

      // If the path has no extension and doesn't end with '/', try ".html" variant
      if (!path.extname(filePath) && !url.endsWith("/")) {
        const htmlCandidate = filePath + ".html"
        if (fs.existsSync(htmlCandidate)) {
          filePath = htmlCandidate
        }
      }

      if (!fs.existsSync(filePath)) {
        // fallback to index.html for SPA
        const indexPath = path.join(clientOutDir, "404.html")
        if (fs.existsSync(indexPath)) {
          filePath = indexPath
        } else {
          res.statusCode = 404
          res.end("Not Found")
          return
        }
      }

      const type = mime.getType(filePath) ?? "application/octet-stream"
      const content = fs.readFileSync(filePath)

      res.statusCode = 200
      res.setHeader("Content-Type", type)
      res.end(content)
    } catch (err) {
      next(err)
    }
  }
}
