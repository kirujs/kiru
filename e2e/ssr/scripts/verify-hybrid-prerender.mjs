import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertServerBundleConsistent } from "./assert-server-bundle.mjs"

const e2eRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const clientDir = path.join(e2eRoot, "dist", "client")
const docsHtml = path.join(clientDir, "docs.html")
const revalidateHtml = path.join(clientDir, "revalidate-demo.html")
const revalidateMeta = path.join(
  clientDir,
  "revalidate-demo.prerender-meta.json"
)
const sitemapXml = path.join(clientDir, "sitemap.xml")
const robotsTxt = path.join(clientDir, "robots.txt")
const serverEntry = path.join(e2eRoot, "dist", "server", "index.js")

const errors = []
if (!fs.existsSync(docsHtml)) {
  errors.push(`missing prerendered ${path.relative(e2eRoot, docsHtml)}`)
}
if (!fs.existsSync(revalidateHtml)) {
  errors.push(
    `missing prerendered ${path.relative(e2eRoot, revalidateHtml)}`
  )
}
if (!fs.existsSync(revalidateMeta)) {
  errors.push(
    `missing ISR meta ${path.relative(e2eRoot, revalidateMeta)}`
  )
}
if (!fs.existsSync(sitemapXml)) {
  errors.push(
    `missing ${path.relative(e2eRoot, sitemapXml)} (src/site.config.ts + router.ssg)`
  )
}
if (!fs.existsSync(robotsTxt)) {
  errors.push(`missing ${path.relative(e2eRoot, robotsTxt)}`)
}
if (fs.existsSync(sitemapXml)) {
  const xml = fs.readFileSync(sitemapXml, "utf8")
  if (!xml.includes("https://e2e-ssr.example/")) {
    errors.push("sitemap.xml missing e2e origin URLs")
  }
  if (!xml.includes("/docs")) {
    errors.push("sitemap.xml missing hybrid static /docs path")
  }
  if (!xml.includes("<loc>https://e2e-ssr.example/</loc>")) {
    errors.push("sitemap.xml missing default SSR home path")
  }
  if (!xml.includes("/users/1")) {
    errors.push("sitemap.xml missing sitemap.include /users/[id] expansion")
  }
  if (xml.includes("/ssr-break")) {
    errors.push("sitemap.xml should exclude /ssr-break via sitemap.exclude")
  }
}
if (!fs.existsSync(serverEntry)) {
  errors.push(`missing SSR bundle ${path.relative(e2eRoot, serverEntry)}`)
} else {
  try {
    assertServerBundleConsistent(serverEntry)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log("[e2e/ssr] hybrid build artifacts ok")
