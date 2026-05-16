import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  absoluteRouteUrl,
  normalizePathname,
  resolvePathPolicy,
  type RouterPathPolicy,
} from "./pathPolicy.js"

export interface SitemapVideoEntry {
  title: string
  thumbnail_loc: string
  description?: string
  content_loc?: string
  player_loc?: string
}

export interface SitemapUrlOverride {
  changefreq?: string
  priority?: number
  lastmod?: string
  images?: string[]
  videos?: SitemapVideoEntry[]
}

export interface SitemapOptionsInput {
  /** Sitemap base origin; defaults to top-level `url` when omitted. */
  domain?: string
  changefreq?: string
  priority?: number
  lastmod?: string
  overrides?: Record<string, SitemapUrlOverride>
}

export interface SitemapOptions {
  /** Resolved origin used for sitemap `<loc>` and media URLs. */
  domain: string
  changefreq?: string
  priority?: number
  lastmod?: string
  overrides: Record<string, SitemapUrlOverride>
}

export interface RobotsOptions {
  rules?: string
}

export interface SiteConfigInput {
  url: string
  pathPolicy?: RouterPathPolicy
  sitemap?: boolean | SitemapOptionsInput
  robots?: boolean | RobotsOptions
}

export interface SiteConfig {
  url: string
  pathPolicy: Required<RouterPathPolicy>
  sitemap: false | SitemapOptions
  robots: false | RobotsOptions
}

function parseHttpOrigin(value: string, label: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`defineSiteConfig: invalid ${label} "${value}"`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `defineSiteConfig: ${label} must use http or https, got "${parsed.protocol}"`
    )
  }
  return parsed.origin
}

function normalizeSitemapOverrides(
  overrides?: Record<string, SitemapUrlOverride>
): Record<string, SitemapUrlOverride> {
  if (!overrides) return {}
  const out: Record<string, SitemapUrlOverride> = {}
  for (const [key, value] of Object.entries(overrides)) {
    out[normalizePathname(key)] = value
  }
  return out
}

function normalizeSitemapOptions(
  input: SitemapOptionsInput,
  siteUrl: string
): SitemapOptions {
  const opts: SitemapOptions = {
    domain: parseHttpOrigin(input.domain ?? siteUrl, "sitemap.domain"),
    overrides: normalizeSitemapOverrides(input.overrides),
  }
  if (input.changefreq !== undefined) opts.changefreq = input.changefreq
  if (input.priority !== undefined) opts.priority = input.priority
  if (input.lastmod !== undefined) opts.lastmod = input.lastmod
  return opts
}

export function defineSiteConfig(input: SiteConfigInput): SiteConfig {
  const origin = parseHttpOrigin(input.url, "url")
  const pathPolicy = resolvePathPolicy(input.pathPolicy)

  let sitemap: false | SitemapOptions = false
  if (input.sitemap === true) {
    sitemap = normalizeSitemapOptions({}, origin)
  } else if (input.sitemap && typeof input.sitemap === "object") {
    sitemap = normalizeSitemapOptions(input.sitemap, origin)
  }

  let robots: false | RobotsOptions = false
  if (input.robots === true) {
    robots = {}
  } else if (input.robots && typeof input.robots === "object") {
    robots = input.robots
  }

  return { url: origin, pathPolicy, sitemap, robots }
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function absoluteMediaUrl(origin: string, href: string): string {
  if (isAbsoluteHttpUrl(href)) return href
  const base = origin.replace(/\/$/, "")
  const path = href.startsWith("/") ? href : `/${href}`
  return `${base}${path}`
}

interface ResolvedSitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
  images: string[]
  videos: SitemapVideoEntry[]
}

function resolveSitemapUrl(
  path: string,
  site: SiteConfig,
  opts: SitemapOptions,
  buildDate?: string
): ResolvedSitemapUrl {
  const routePath = normalizePathname(path)
  const override = opts.overrides[routePath]
  const lastmodSource = override?.lastmod ?? opts.lastmod
  const lastmod =
    lastmodSource === "build"
      ? (buildDate ?? new Date().toISOString().slice(0, 10))
      : lastmodSource

  return {
    loc: absoluteRouteUrl(opts.domain, routePath, site.pathPolicy),
    lastmod,
    changefreq: override?.changefreq ?? opts.changefreq,
    priority: override?.priority ?? opts.priority,
    images: override?.images ?? [],
    videos: override?.videos ?? [],
  }
}

function renderImageTags(origin: string, images: string[]): string {
  return images
    .map(
      (href) =>
        `    <image:image>\n      <image:loc>${escXml(absoluteMediaUrl(origin, href))}</image:loc>\n    </image:image>`
    )
    .join("\n")
}

function renderVideoTags(origin: string, videos: SitemapVideoEntry[]): string {
  return videos
    .map((video) => {
      const parts = [
        `    <video:video>`,
        `      <video:thumbnail_loc>${escXml(absoluteMediaUrl(origin, video.thumbnail_loc))}</video:thumbnail_loc>`,
        `      <video:title>${escXml(video.title)}</video:title>`,
      ]
      if (video.description) {
        parts.push(
          `      <video:description>${escXml(video.description)}</video:description>`
        )
      }
      if (video.content_loc) {
        parts.push(
          `      <video:content_loc>${escXml(absoluteMediaUrl(origin, video.content_loc))}</video:content_loc>`
        )
      }
      if (video.player_loc) {
        parts.push(
          `      <video:player_loc>${escXml(absoluteMediaUrl(origin, video.player_loc))}</video:player_loc>`
        )
      }
      parts.push(`    </video:video>`)
      return parts.join("\n")
    })
    .join("\n")
}

function renderUrlEntry(origin: string, entry: ResolvedSitemapUrl): string {
  const parts = [`    <loc>${escXml(entry.loc)}</loc>`]
  if (entry.lastmod) parts.push(`    <lastmod>${escXml(entry.lastmod)}</lastmod>`)
  if (entry.changefreq)
    parts.push(`    <changefreq>${escXml(entry.changefreq)}</changefreq>`)
  if (entry.priority !== undefined)
    parts.push(`    <priority>${entry.priority}</priority>`)
  if (entry.images.length) parts.push(renderImageTags(origin, entry.images))
  if (entry.videos.length) parts.push(renderVideoTags(origin, entry.videos))
  return `  <url>\n${parts.join("\n")}\n  </url>`
}

export function buildSitemapXml(
  paths: string[],
  site: SiteConfig,
  buildDate?: string
): string {
  if (!site.sitemap) {
    throw new Error("buildSitemapXml: site.sitemap is not enabled")
  }
  const opts = site.sitemap
  const origin = opts.domain
  const entries = paths.map((path) =>
    resolveSitemapUrl(path, site, opts, buildDate)
  )
  const hasImages = entries.some((e) => e.images.length > 0)
  const hasVideos = entries.some((e) => e.videos.length > 0)
  const xmlns = ['xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"']
  if (hasImages) {
    xmlns.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
  }
  if (hasVideos) {
    xmlns.push('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"')
  }
  const urls = entries.map((entry) => renderUrlEntry(origin, entry)).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${xmlns.join(" ")}>\n${urls}\n</urlset>\n`
}

export function buildRobotsTxt(site: SiteConfig): string {
  if (!site.robots) {
    throw new Error("buildRobotsTxt: site.robots is not enabled")
  }
  if (site.robots.rules) return site.robots.rules
  const sitemapUrl = `${site.url.replace(/\/$/, "")}/sitemap.xml`
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`
}

export async function writeSiteArtifacts({
  outDir,
  paths,
  site,
  buildDate,
}: {
  outDir: string
  paths: string[]
  site: SiteConfig
  buildDate?: string
}): Promise<void> {
  if (site.sitemap) {
    const xml = buildSitemapXml(paths, site, buildDate)
    await writeFile(join(outDir, "sitemap.xml"), xml, "utf8")
  }
  if (site.robots) {
    const txt = buildRobotsTxt(site)
    await writeFile(join(outDir, "robots.txt"), txt, "utf8")
  }
}

/** Default site config filenames (sibling of the routes module), tried in order. */
export const DEFAULT_SITE_CONFIG_BASENAMES = [
  "site.config.ts",
  "site.config.js",
] as const

/**
 * Paths to probe for a site config module.
 *
 * When `configured` is set (via `router.ssg.siteModule` in vite-plugin-kiru), only
 * that path is returned. Otherwise returns sibling `site.config.ts` then
 * `site.config.js`.
 */
export function siteConfigModuleCandidates(
  routesModulePath: string,
  configured?: string | null
): string[] {
  if (configured) {
    return [configured.replace(/\\/g, "/")]
  }
  const dir = routesModulePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "")
  return DEFAULT_SITE_CONFIG_BASENAMES.map((name) => `${dir}/${name}`)
}

/**
 * @deprecated Use {@link siteConfigModuleCandidates} — returns the first default basename only.
 */
export function resolveSiteModulePath(routesModulePath: string): string {
  return siteConfigModuleCandidates(routesModulePath)[0]!
}
