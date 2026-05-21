/**
 * Route match scoring (higher wins; manifest routes sorted descending by score):
 * - static segment: +4
 * - [param]: +2
 * - [...rest] or [[opt]]: +1
 * - [[...rest]]: +0
 */
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  defineSiteConfig,
  generateSitemapPaths,
  generateStaticPaths,
  matchRoute,
} from "../../router/index.js"
import {
  absoluteRouteUrl,
  addBase,
  formatPathname,
  resolvePathPolicy,
} from "../../router/pathPolicy.js"

const noopPage = async () => ({ default: () => null })

describe("manifest routing / catch-all", () => {
  const catchAllRoutes = createRouteTree({
      static: true,
      children: [
        createRoute("/docs/[...slug]", {
          component: async () => ({
            default: () => null,
            generateStaticParams: () => [
              { slug: "a/b" },
              { slug: "guides/getting-started" },
            ],
          }),
        }),
      ],
    })
  it("matches catch-all params with slash-separated values", () => {
    const manifest = compileRouteTree(catchAllRoutes)
    const match = matchRoute(manifest, "/docs/a/b")
    assert.ok(match)
    assert.strictEqual(match!.params.slug, "a/b")
    assert.strictEqual(match!.pathname, "/docs/a/b")
  })

  it("decodes encoded catch-all segments", () => {
    const manifest = compileRouteTree(catchAllRoutes)
    const match = matchRoute(manifest, "/docs/hello%20world")
    assert.ok(match)
    assert.strictEqual(match!.params.slug, "hello world")
  })

  it("rejects [...slug] when not the last path segment", () => {
    assert.throws(
      () =>
        compileRouteTree(
          createRouteTree({
              children: [
                createRoute("/[...slug]/extra", noopPage),
              ],
            })
        ),
      /must be the last segment/
    )
  })

  it("generateStaticPaths encodes slashes in catch-all param values", async () => {
    const manifest = compileRouteTree(catchAllRoutes)
    const paths = await generateStaticPaths(manifest)
    assert.deepStrictEqual(paths, [
      "/docs/a/b",
      "/docs/guides/getting-started",
    ])
  })
})

describe("manifest routing / optional catch-all [[...segment]]", () => {
  const optionalCatchAllRoutes = createRouteTree({
      static: true,
      children: [
        createRoute("/docs/[[...slug]]", {
          component: async () => ({
            default: () => null,
            generateStaticParams: () => [
              { slug: "" },
              { slug: "a/b" },
              { slug: "guides/start" },
            ],
          }),
        }),
      ],
    })
  it("matches with and without trailing path", () => {
    const manifest = compileRouteTree(optionalCatchAllRoutes)
    const index = matchRoute(manifest, "/docs")
    assert.ok(index)
    assert.strictEqual(index!.params.slug, "")
    assert.strictEqual(index!.route.path, "/docs/[[...slug]]")
    const nested = matchRoute(manifest, "/docs/a/b")
    assert.ok(nested)
    assert.strictEqual(nested!.params.slug, "a/b")
  })

  it("rejects [[...slug]] when not the last path segment", () => {
    assert.throws(
      () =>
        compileRouteTree(
          createRouteTree({
              children: [createRoute("/[[...slug]]/extra", noopPage)],
            })
        ),
      /must be the last segment/
    )
  })

  it("generateStaticPaths includes index and nested optional catch-all paths", async () => {
    const manifest = compileRouteTree(optionalCatchAllRoutes)
    const paths = await generateStaticPaths(manifest)
    assert.deepStrictEqual(paths, ["/docs", "/docs/a/b", "/docs/guides/start"])
  })

  it("prefers required [...slug] over [[...slug]] when path has segments", () => {
    const routes = createRouteTree({
        children: [
          createRoute("/files/[[...path]]", noopPage),
          createRoute("/files/[...path]", noopPage),
        ],
      })
    const manifest = compileRouteTree(routes)
    const index = matchRoute(manifest, "/files")
    assert.ok(index)
    assert.strictEqual(index!.route.path, "/files/[[...path]]")
    const nested = matchRoute(manifest, "/files/a/b")
    assert.ok(nested)
    assert.strictEqual(nested!.route.path, "/files/[...path]")
  })
})

describe("manifest routing / optional [[segment]]", () => {
  const optionalRoutes = createRouteTree({
      children: [
        createRoute("/blog/[[page]]", noopPage),
      ],
    })
  it("matches with and without the optional segment", () => {
    const manifest = compileRouteTree(optionalRoutes)
    const root = matchRoute(manifest, "/blog")
    assert.ok(root)
    assert.strictEqual(root!.params.page, "")
    const withPage = matchRoute(manifest, "/blog/2")
    assert.ok(withPage)
    assert.strictEqual(withPage!.params.page, "2")
  })
})

describe("manifest routing / ambiguous scoring", () => {
  it("prefers static /users/new over /users/[id]", () => {
    const routes = createRouteTree({
        children: [
          createRoute("/users/[id]", noopPage),
          createRoute("/users/new", noopPage),
        ],
      })
    const manifest = compileRouteTree(routes)
    const match = matchRoute(manifest, "/users/new")
    assert.ok(match)
    assert.strictEqual(match!.route.path, "/users/new")
  })

  it("prefers dynamic /posts/[page] over optional /posts/[[page]] when segment present", () => {
    const routes = createRouteTree({
        children: [
          createRoute("/posts/[[page]]", noopPage),
          createRoute("/posts/[page]", noopPage),
        ],
      })
    const manifest = compileRouteTree(routes)
    const withPage = matchRoute(manifest, "/posts/2")
    assert.ok(withPage)
    assert.strictEqual(withPage!.route.path, "/posts/[page]")
    const index = matchRoute(manifest, "/posts")
    assert.ok(index)
    assert.strictEqual(index!.route.path, "/posts/[[page]]")
  })
})

describe("manifest routing / baseUrl and trailingSlash", () => {
  const appRoutes = createRouteTree({
      children: [
        createRoute("/", noopPage),
        createRoute("/about", noopPage),
        createRoute("/users/[id]", {
          static: true,
          component: async () => ({
            default: () => null,
            generateStaticParams: () => [{ id: "1" }],
          }),
        }),
      ],
    })
  const policy = { baseUrl: "/app", trailingSlash: "always" as const }

  it("matchRoute strips baseUrl and honors trailingSlash always", () => {
    const manifest = compileRouteTree(appRoutes)
    const match = matchRoute(manifest, "/app/users/1/", policy)
    assert.ok(match)
    assert.strictEqual(match!.params.id, "1")
    assert.strictEqual(match!.pathname, "/users/1")
  })

  it("pathnameForMatch strips trailing slash before matching when policy is never", () => {
    const manifest = compileRouteTree(appRoutes)
    const match = matchRoute(manifest, "/app/about/", {
      baseUrl: "/app",
      trailingSlash: "never",
    })
    assert.ok(match)
    assert.strictEqual(match!.route.path, "/about")
  })

  it("formatPathname applies trailingSlash always; addBase prepends baseUrl", () => {
    const resolved = resolvePathPolicy(policy)
    assert.strictEqual(formatPathname("/about", resolved), "/about/")
    assert.strictEqual(addBase("/about", resolved.baseUrl), "/app/about")
    assert.strictEqual(addBase("/", resolved.baseUrl), "/app")
  })

  it("absoluteRouteUrl and generateSitemapPaths respect path policy", async () => {
    const manifest = compileRouteTree(appRoutes)
    const site = defineSiteConfig({
      url: "https://example.com",
      pathPolicy: policy,
      sitemap: true,
    })
    const url = absoluteRouteUrl("https://example.com", "/users/1", policy)
    assert.strictEqual(url, "https://example.com/app/users/1/")
    const paths = await generateSitemapPaths(manifest, site, {
      defaultSsrPaths: true,
    })
    assert.ok(paths.includes("/"))
    assert.ok(paths.includes("/users/1/"))
    assert.ok(paths.every((p) => p === "/" || p.endsWith("/")))
  })
})
