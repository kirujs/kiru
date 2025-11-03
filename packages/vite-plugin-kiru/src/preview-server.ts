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

      let filePath = path.join(clientOutDir, url)

      const extName = path.extname(filePath)
      if (extName && extName !== ".html") {
        return next()
      }

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
        // Try to find a 404 page at parent directory levels
        // Remove trailing slash and normalize the URL
        const normalizedUrl = url.replace(/\/$/, "") || "/"
        const urlSegments = normalizedUrl.split("/").filter(Boolean)
        let found404 = false

        // Start from deepest level and work up to root
        for (let i = urlSegments.length; i >= 0; i--) {
          const parentSegments = urlSegments.slice(0, i)
          const fourOhFourPath = "/" + [...parentSegments, "404"].join("/")
          const fourOhFourFilePath = path.join(
            clientOutDir,
            fourOhFourPath + ".html"
          )

          if (fs.existsSync(fourOhFourFilePath)) {
            filePath = fourOhFourFilePath
            found404 = true
            break
          }
        }

        if (!found404) {
          res.statusCode = 404
          res.end("Not Found")
          return
        }
      }

      const type = mime.getType(filePath) ?? "application/octet-stream"
      const content = fs.readFileSync(filePath)

      // Set status to 404 if we're serving a 404 page
      const is404Page = filePath.includes("/404.html")
      res.statusCode = is404Page ? 404 : 200
      res.setHeader("Content-Type", type)
      res.end(content)
    } catch (err) {
      next(err)
    }
  }
}
