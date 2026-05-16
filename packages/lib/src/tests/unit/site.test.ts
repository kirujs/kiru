import { describe, it } from "node:test"
import assert from "node:assert"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildRobotsTxt,
  buildSitemapXml,
  defineSiteConfig,
  siteConfigModuleCandidates,
  writeSiteArtifacts,
} from "../../router/site.js"

describe("site", () => {
  it("defineSite normalizes url to origin and enables flags", () => {
    const site = defineSiteConfig({
      url: "https://example.com/blog/",
      sitemap: true,
      robots: true,
    })
    assert.strictEqual(site.url, "https://example.com")
    assert.deepStrictEqual(site.sitemap, {
      domain: "https://example.com",
      overrides: {},
    })
    assert.deepStrictEqual(site.robots, {})
  })

  it("defineSite rejects non-http(s) urls", () => {
    assert.throws(
      () => defineSiteConfig({ url: "ftp://example.com", sitemap: true }),
      /http or https/
    )
  })

  it("defineSite rejects invalid urls", () => {
    assert.throws(() => defineSiteConfig({ url: "not-a-url" }), /invalid url/)
  })

  it("buildSitemapXml escapes ampersands in loc", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: true,
    })
    const xml = buildSitemapXml(["/r&d"], site)
    assert.ok(xml.includes("<loc>https://example.com/r&amp;d</loc>"))
  })

  it("buildSitemapXml uses build date for lastmod when configured", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: { lastmod: "build" },
    })
    const xml = buildSitemapXml(["/"], site, "2026-05-17")
    assert.ok(xml.includes("<lastmod>2026-05-17</lastmod>"))
  })

  it("buildSitemapXml applies defaults, domain, and per-path overrides", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: {
        domain: "https://rausten.dev",
        changefreq: "weekly",
        overrides: {
          "/": { changefreq: "daily", priority: 1 },
          "/blog": {
            changefreq: "weekly",
            priority: 0.9,
            images: ["/images/kiru.png"],
            videos: [
              {
                title: "Kiru",
                thumbnail_loc: "/images/kiru.png",
                description: "The personal website of Rob Austen",
              },
            ],
          },
        },
      },
    })
    const xml = buildSitemapXml(["/", "/blog", "/about"], site)
    assert.ok(xml.includes("<loc>https://rausten.dev/</loc>"))
    assert.match(xml, /<url>[\s\S]*?<loc>https:\/\/rausten\.dev\/<\/loc>[\s\S]*?<changefreq>daily<\/changefreq>[\s\S]*?<priority>1<\/priority>/)
    assert.ok(xml.includes("<loc>https://rausten.dev/blog</loc>"))
    assert.ok(
      xml.includes(
        "<image:loc>https://rausten.dev/images/kiru.png</image:loc>"
      )
    )
    assert.ok(
      xml.includes(
        "<video:thumbnail_loc>https://rausten.dev/images/kiru.png</video:thumbnail_loc>"
      )
    )
    assert.ok(xml.includes("<video:title>Kiru</video:title>"))
    assert.ok(xml.includes("<loc>https://rausten.dev/about</loc>"))
    assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'))
    assert.ok(xml.includes('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"'))
  })

  it("defineSite rejects invalid sitemap.domain", () => {
    assert.throws(
      () =>
        defineSiteConfig({
          url: "https://example.com",
          sitemap: { domain: "not-a-url" },
        }),
      /invalid sitemap\.domain/
    )
  })

  it("buildRobotsTxt returns default rules with sitemap line", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      robots: true,
    })
    const txt = buildRobotsTxt(site)
    assert.match(txt, /User-agent: \*/)
    assert.match(txt, /Sitemap: https:\/\/example\.com\/sitemap\.xml/)
  })

  it("buildRobotsTxt returns custom rules when provided", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      robots: { rules: "User-agent: *\nDisallow: /private\n" },
    })
    assert.strictEqual(
      buildRobotsTxt(site),
      "User-agent: *\nDisallow: /private\n"
    )
  })

  it("writeSiteArtifacts writes sitemap.xml and robots.txt", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kiru-site-"))
    try {
      const site = defineSiteConfig({
        url: "https://example.com",
        sitemap: true,
        robots: true,
      })
      await writeSiteArtifacts({
        outDir: dir,
        paths: ["/", "/about"],
        site,
        buildDate: "2026-05-17",
      })
      const sitemap = await readFile(join(dir, "sitemap.xml"), "utf8")
      const robots = await readFile(join(dir, "robots.txt"), "utf8")
      assert.ok(sitemap.includes("<loc>https://example.com/</loc>"))
      assert.ok(sitemap.includes("<loc>https://example.com/about</loc>"))
      assert.ok(robots.includes("Sitemap: https://example.com/sitemap.xml"))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it("siteConfigModuleCandidates defaults to site.config.ts then site.config.js", () => {
    assert.deepStrictEqual(
      siteConfigModuleCandidates("/project/src/routes.ts"),
      ["/project/src/site.config.ts", "/project/src/site.config.js"]
    )
  })

  it("siteConfigModuleCandidates uses configured path when set", () => {
    assert.deepStrictEqual(
      siteConfigModuleCandidates(
        "/project/src/routes.ts",
        "./seo/site.config.ts"
      ),
      ["./seo/site.config.ts"]
    )
  })
})
