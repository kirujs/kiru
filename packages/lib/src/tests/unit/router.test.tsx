import { describe, it } from "node:test"
import * as kiru from "../../index.js"
import assert from "node:assert"
import {
  compileRouteTree,
  createRenderer,
  createRouter,
  defineRouteTree,
  fillRouteHtmlTemplate,
  generateStaticPaths,
  generateSitemapPaths,
  buildSitemapXml,
  defineSiteConfig,
  defineHeadContent,
  Link,
  matchRoute,
  mergeRouteHead,
  serializeDocumentHead,
  hydratePrerenderedHtmlForRequest,
  serverLoader,
  staticLoader,
  loadErrorRouteTree,
  loadRootErrorRouteTree,
  prerenderStaticRoutes,
  stripPrerenderedRequestInjections,
  toRenderError,
  useRouter,
  useRequestContext,
} from "../../router/index.js"
import type { CustomRequestContext } from "../../router/types.js"

const MINIMAL_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"

describe("router", () => {
  const routes = defineRouteTree((r) =>
    r.scope({
      layout: async () => ({
        default: ({ children }: { children: JSX.Children }) => (
          <main>{children}</main>
        ),
      }),
      children: [
        r.page("/", async () => ({ default: () => <h1>Home</h1> })),
        r.page("/users/[id]", {
          static: true,
          component: async () => ({
            default: () => {
              const router = useRouter()
              return <h1>{router.params.value.id}</h1>
            },
            generateStaticParams: async () => [{ id: "1" }, { id: "2" }],
          }),
        }),
      ],
    })
  )

  it("compiles and matches dynamic routes", () => {
    const manifest = compileRouteTree(routes)
    const match = matchRoute(manifest, "/users/99")
    assert.ok(match)
    assert.strictEqual(match.params.id, "99")
  })

  it("generates static paths for dynamic static routes", async () => {
    const manifest = compileRouteTree(routes)
    const paths = await generateStaticPaths(manifest)
    assert.deepStrictEqual(paths, ["/users/1", "/users/2"])
  })

  it("composes nested generateStaticParams from parent routes", async () => {
    const nested = defineRouteTree((r) =>
      r.scope({
        static: true,
        children: [
          r.page("/posts/[slug]", {
            component: async () => ({
              default: () => <h1>post</h1>,
              generateStaticParams: () => [{ slug: "a" }, { slug: "b" }],
            }),
          }),
          r.page("/posts/[slug]/comments/[id]", {
            component: async () => ({
              default: () => <h1>comment</h1>,
              generateStaticParams: ({
                params,
              }: {
                params: Record<string, string>
              }) => [{ id: `${params.slug}-1` }, { id: `${params.slug}-2` }],
            }),
          }),
        ],
      })
    )
    const manifest = compileRouteTree(nested)
    const paths = await generateStaticPaths(manifest)
    assert.deepStrictEqual(paths, [
      "/posts/a",
      "/posts/a/comments/a-1",
      "/posts/a/comments/a-2",
      "/posts/b",
      "/posts/b/comments/b-1",
      "/posts/b/comments/b-2",
    ])
  })

  it("rejects child generateStaticParams with parent param keys", async () => {
    const bad = defineRouteTree((r) =>
      r.scope({
        static: true,
        children: [
          r.page("/posts/[slug]", {
            component: async () => ({
              default: () => null,
              generateStaticParams: () => [{ slug: "a" }],
            }),
          }),
          r.page("/posts/[slug]/comments/[id]", {
            component: async () => ({
              default: () => null,
              generateStaticParams: () => [{ slug: "x", id: "1" }],
            }),
          }),
        ],
      })
    )
    await assert.rejects(
      () => generateStaticPaths(compileRouteTree(bad)),
      /unexpected key "slug"/
    )
  })

  it("serializes jsonLd in document head", () => {
    const html = serializeDocumentHead({
      title: "T",
      jsonLd: { "@type": "WebPage", name: "Home" },
    })
    assert.ok(html.includes('type="application/ld+json"'))
    assert.ok(html.includes("WebPage"))
    assert.ok(html.includes("<!-- kiru:head -->"))
    assert.ok(html.includes("<!-- /kiru:head -->"))
  })

  it("builds sitemap xml from static paths", () => {
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: { changefreq: "weekly", priority: 0.8 },
    })
    const xml = buildSitemapXml(["/", "/about"], site)
    assert.ok(xml.includes("<loc>https://example.com/</loc>"))
    assert.ok(xml.includes("<loc>https://example.com/about</loc>"))
    assert.ok(xml.includes("<changefreq>weekly</changefreq>"))
  })

  it("errors when static parent route lacks generateStaticParams", async () => {
    const bad = defineRouteTree((r) =>
      r.scope({
        static: true,
        children: [
          r.page("/posts/[slug]", {
            component: async () => ({ default: () => null }),
          }),
          r.page("/posts/[slug]/comments/[id]", {
            component: async () => ({
              default: () => null,
              generateStaticParams: () => [{ id: "1" }],
            }),
          }),
        ],
      })
    )
    await assert.rejects(
      async () => generateStaticPaths(compileRouteTree(bad)),
      (err: Error) =>
        /generateStaticParams is missing/.test(err.message) &&
        err.message.includes("/posts/[slug]")
    )
  })

  it("uses empty parent params when no static parent route exists", async () => {
    const solo = defineRouteTree((r) =>
      r.scope({
        static: true,
        children: [
          r.page("/items/[id]", {
            component: async () => ({
              default: () => null,
              generateStaticParams: () => [{ id: "solo" }],
            }),
          }),
        ],
      })
    )
    const paths = await generateStaticPaths(compileRouteTree(solo))
    assert.deepStrictEqual(paths, ["/items/solo"])
  })

  it("generateSitemapPaths merges static, default SSR, and included dynamic paths", async () => {
    const hybrid = defineRouteTree((r) =>
      r.scope({
        children: [
          r.page("/", async () => ({ default: () => <h1>Home</h1> })),
          r.page("/about", async () => ({ default: () => <h1>About</h1> })),
          r.page("/docs", {
            static: true,
            component: async () => ({ default: () => <h1>Docs</h1> }),
          }),
          r.page("/users/[id]", {
            component: async () => ({
              default: () => <h1>User</h1>,
              generateSitemapParams: () => [{ id: "1" }, { id: "2" }],
            }),
          }),
          r.page("/private", async () => ({ default: () => <h1>Private</h1> })),
        ],
      })
    )
    const manifest = compileRouteTree(hybrid)
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: {
        include: ["/users/[id]"],
        exclude: ["/private"],
      },
    })
    const paths = await generateSitemapPaths(manifest, site, {
      defaultSsrPaths: true,
    })
    assert.deepStrictEqual(paths, [
      "/",
      "/about",
      "/docs",
      "/users/1",
      "/users/2",
    ])
  })

  it("generateSitemapPaths rejects unknown sitemap.include route", async () => {
    const manifest = compileRouteTree(
      defineRouteTree((r) =>
        r.scope({
          children: [r.page("/", async () => ({ default: () => null }))],
        })
      )
    )
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: { include: ["/missing"] },
    })
    await assert.rejects(
      () => generateSitemapPaths(manifest, site),
      /sitemap\.include: no route/
    )
  })

  it("generateSitemapPaths requires generateSitemapParams for included dynamic routes", async () => {
    const manifest = compileRouteTree(
      defineRouteTree((r) =>
        r.scope({
          children: [
            r.page("/users/[id]", {
              component: async () => ({ default: () => null }),
            }),
          ],
        })
      )
    )
    const site = defineSiteConfig({
      url: "https://example.com",
      sitemap: { include: ["/users/[id]"] },
    })
    await assert.rejects(
      () => generateSitemapPaths(manifest, site),
      /generateSitemapParams is missing/
    )
  })

  it("generateStaticPaths applies trailingSlash always policy", async () => {
    const manifest = compileRouteTree(routes)
    const paths = await generateStaticPaths(manifest, {
      trailingSlash: "always",
    })
    assert.ok(paths.every((p) => p === "/" || p.endsWith("/")))
    assert.ok(paths.includes("/users/1/"))
  })

  it("matchRoute accepts trailing slash in pathname when policy is always", () => {
    const manifest = compileRouteTree(routes)
    const match = matchRoute(manifest, "/users/1/", {
      trailingSlash: "always",
    })
    assert.ok(match)
    assert.strictEqual(match!.params.id, "1")
  })

  it("mergeRouteHead concatenates jsonLd from layout and route", () => {
    const merged = mergeRouteHead(
      { jsonLd: { "@type": "WebSite", name: "App" } },
      { jsonLd: { "@type": "WebPage", name: "Page" } }
    )
    assert.ok(Array.isArray(merged.jsonLd))
    assert.strictEqual((merged.jsonLd as unknown[]).length, 2)
  })

  it("serializeDocumentHead escapes angle brackets in jsonLd payload", () => {
    const html = serializeDocumentHead({
      jsonLd: { html: "</script><script>alert(1)</script>" },
    })
    assert.ok(html.includes("application/ld+json"))
    assert.ok(html.includes("\\u003c/script>"))
    const payload = html.slice(html.indexOf("{"), html.lastIndexOf("}") + 1)
    assert.ok(!payload.includes("<script"))
  })

  it("SSR render includes jsonLd in document head", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/schema", {
            component: async () => ({ default: () => <h1>Schema</h1> }),
            head: {
              title: "Schema page",
              jsonLd: { "@type": "WebPage", name: "Schema" },
            },
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: r, htmlTemplate: MINIMAL_TPL })
    const res = await renderer.render("/schema")
    assert.ok(res?.body.includes("application/ld+json"))
    assert.ok(res?.body.includes("WebPage"))
  })

  it("prerenderStaticRoutes includes nested static paths", async () => {
    const nested = defineRouteTree((r) =>
      r.scope({
        static: true,
        children: [
          r.page("/posts/[slug]", {
            component: async () => ({
              default: () => <p>post</p>,
              generateStaticParams: () => [{ slug: "x" }],
            }),
          }),
          r.page("/posts/[slug]/comments/[id]", {
            component: async () => ({
              default: () => <p>c</p>,
              generateStaticParams: ({
                params,
              }: {
                params: Record<string, string>
              }) => [{ id: `${params.slug}-1` }],
            }),
          }),
        ],
      })
    )
    const outputs = await prerenderStaticRoutes({ routes: nested })
    const paths = outputs.map((o) => o.path).sort()
    assert.deepStrictEqual(paths, ["/posts/x", "/posts/x/comments/x-1"])
  })

  it("renders with framework-agnostic renderer contract", async () => {
    const renderer = createRenderer({ routes })
    const response = await renderer.render("/users/42")
    assert.ok(response)
    assert.strictEqual(response.status, 200)
    assert.strictEqual(
      response.headers["content-type"],
      "text/html; charset=utf-8"
    )
    assert.strictEqual(typeof response.body, "string")
    assert.ok(response.body.includes("<main><h1>42</h1></main>"))
  })

  it("provides CustomRequestContext to SSR components and serializes it for hydration", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          x.page("/", async () => ({
            default: () => {
              const ctx = useRequestContext() as any
              return <p>{ctx.user?.name}</p>
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({ routes: r, htmlTemplate: MINIMAL_TPL })
    const response = await renderer.render("/", {
      context: { user: { name: "John" } } as any,
    })
    assert.ok(response)
    assert.ok(response.body.includes("<p>John</p>"))
    assert.ok(response.body.includes("k-request-context"))
  })

  it("returns null when route is unmatched", async () => {
    const renderer = createRenderer({ routes })
    const response = await renderer.render("/missing")
    assert.strictEqual(response, null)
  })

  it("prerenders static routes", async () => {
    const outputs = await prerenderStaticRoutes({ routes })
    const byPath = Object.fromEntries(outputs.map((v) => [v.path, v.body]))
    assert.strictEqual(byPath["/users/1"], "<main><h1>1</h1></main>")
    assert.strictEqual(byPath["/users/2"], "<main><h1>2</h1></main>")
  })

  it("prerenderStaticRoutes respects maxConcurrentRenders", async () => {
    let inFlight = 0
    let peak = 0
    const delayMs = 30
    const pageCount = 8

    const trackLoad = staticLoader(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      inFlight -= 1
      return { ok: true as const }
    })

    const concurrentRoutes = defineRouteTree((r) =>
      r.scope({
        static: true,
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: Array.from({ length: pageCount }, (_, i) =>
          r.page(`/pages/${i}`, {
            component: async () => ({
              load: trackLoad,
              default: () => <p>{i}</p>,
            }),
          })
        ),
      })
    )

    inFlight = 0
    peak = 0
    await prerenderStaticRoutes({
      routes: concurrentRoutes,
      maxConcurrentRenders: 2,
    })
    assert.ok(peak <= 2, `expected peak <= 2, got ${peak}`)

    inFlight = 0
    peak = 0
    await prerenderStaticRoutes({
      routes: concurrentRoutes,
      maxConcurrentRenders: Infinity,
    })
    assert.ok(peak > 2, `expected peak > 2 with Infinity, got ${peak}`)
  })

  it("returns document head from renderer with merged route meta", async () => {
    const metaRoutes = defineRouteTree((r) =>
      r.scope({
        head: { title: "AppRoot", description: "from-scope" },
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          r.page("/doc", {
            component: async () => ({ default: () => <p>x</p> }),
            head: { title: "LeafTitle", description: "from-leaf" },
          }),
        ],
      })
    )
    const renderer = createRenderer({
      routes: metaRoutes,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/doc")
    assert.ok(response?.body.includes("<title>LeafTitle</title>"))
    assert.ok(response?.body.includes('name="description" content="from-leaf"'))
  })

  it("resolves {param} placeholders in meta for document head", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          x.page("/users/[id]", {
            component: async () => ({
              default: () => {
                const router = useRouter()
                return <span>{router.params.value.id}</span>
              },
            }),
            head: { title: "User {id}" },
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: r, htmlTemplate: MINIMAL_TPL })
    const response = await renderer.render("/users/99")
    assert.ok(response?.body.includes("<title>User 99</title>"))
  })

  it("merges static defineHeadContent with route meta (SSR)", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        head: { title: "Base" },
        children: [
          x.page("/", {
            component: async () => ({
              head: defineHeadContent({ title: "Welcome!" }),
              default: () => <h1>Home</h1>,
            }),
          }),
        ],
      })
    )

    const renderer = createRenderer({ routes: r, htmlTemplate: MINIMAL_TPL })
    const response = await renderer.render("/")
    assert.ok(response?.body.includes("<title>Welcome!</title>"))
  })

  it("resolves dynamic defineHeadContent after loader (SSR stream)", async () => {
    const load = serverLoader(async () => ({ title: "Gizmo" }))
    const r = defineRouteTree((x) =>
      x.scope({
        head: { title: "Base" },
        children: [
          x.page("/product", {
            component: async () => ({
              load,
              head: defineHeadContent<typeof load>((_ctx, { data }) => ({
                title: `Product: ${data!.title}`,
              })),
              default: () => <h1>Product</h1>,
            }),
          }),
        ],
      })
    )

    const renderer = createRenderer({
      stream: true,
      routes: r,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/product")
    assert.ok(response)

    const reader = (response.body as ReadableStream<string>).getReader()
    let out = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      out += next.value
    }
    reader.releaseLock()

    assert.ok(out.includes("<title>Product: Gizmo</title>"))
  })

  it("streams shell early with static head and serverLoader fallback", async () => {
    const load = serverLoader({
      load: async () => {
        await new Promise((r) => setTimeout(r, 50))
        return { ok: true }
      },
      fallback: () => <p data-testid="load-fallback">Loading...</p>,
    })
    const r = defineRouteTree((x) =>
      x.scope({
        head: { title: "Route" },
        children: [
          x.page("/loader", {
            component: async () => ({
              load,
              head: defineHeadContent({ title: "Static head" }),
              default: () => <p data-testid="ok">ok</p>,
            }),
          }),
        ],
      })
    )
    const renderer = createRenderer({
      stream: true,
      routes: r,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/loader")
    assert.ok(response)
    const reader = (response.body as ReadableStream<string>).getReader()
    const first = await reader.read()
    assert.ok(first.value?.includes("<title>Static head</title>"))
    assert.ok(
      !first.value?.includes('data-testid="load-fallback"'),
      "first chunk is static head only"
    )
    const shellDeadline = Date.now() + 25
    let shellChunk = ""
    while (Date.now() < shellDeadline) {
      const next = await reader.read()
      if (next.done) break
      shellChunk += next.value ?? ""
    }
    assert.ok(
      shellChunk.includes('data-testid="load-fallback"'),
      "shell with fallback must flush before the 50ms loader settles"
    )
    assert.ok(
      shellChunk.includes("</html>"),
      "document close must precede streamed loader data"
    )
    let out = (first.value ?? "") + shellChunk
    while (true) {
      const next = await reader.read()
      if (next.done) break
      out += next.value
    }
    reader.releaseLock()
    assert.ok(out.includes('data-testid="load-fallback"'))
    assert.ok(out.includes("__$k_data"))
    assert.ok(out.includes('"ok":true'))
    assert.ok(
      !out.includes('data-testid="ok"'),
      "page success markup is hydrated from streamed data, not in the sync shell"
    )
  })

  it("renders Link with resolved href in SSR output", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>
              <Link to="/users/1">Go</Link>
              {children}
            </main>
          ),
        }),
        children: [x.page("/", async () => ({ default: () => <p>home</p> }))],
      })
    )
    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/")
    assert.ok(response?.body.includes('<a href="/users/1">'))
  })

  it("Link resolveHref appends hash suffixes with # prefix", async () => {
    const manifest = compileRouteTree(routes)
    const history = {
      pushState() {},
      replaceState() {},
    } as any as History
    const location = {
      pathname: "/users/1",
      search: "?tab=overview",
      hash: "#summary",
      origin: "http://localhost",
    } as any as Location
    const router = createRouter({ routes: manifest, history, location })

    assert.strictEqual(router.resolveHref("#notes"), "/users/1#notes")
    assert.strictEqual(router.resolveHref("/about#top"), "/about#top")
    assert.strictEqual(
      router.resolveHref("settings#prefs"),
      "/users/1/settings#prefs"
    )
    assert.strictEqual(
      router.resolveHref("/users/2?sort=name#profile"),
      "/users/2?sort=name#profile"
    )
  })

  it("Link renders hash suffixes on href in SSR output", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: () => (
            <nav>
              <Link to="#intro">Intro</Link>
              <Link to="/about#team">Team</Link>
            </nav>
          ),
        }),
        children: [
          x.page("/docs", async () => ({ default: () => <p>docs</p> })),
          x.page("/about", async () => ({ default: () => <p>about</p> })),
        ],
      })
    )
    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/docs")
    assert.ok(response?.body.includes('<a href="/docs#intro">'))
    assert.ok(response?.body.includes('<a href="/about#team">'))
  })

  it("Link resolveHref preserves hash with baseUrl", async () => {
    const manifest = compileRouteTree(routes)
    const history = {
      pushState() {},
      replaceState() {},
    } as any as History
    const location = {
      pathname: "/app/users/1",
      search: "",
      hash: "",
      origin: "http://localhost",
    } as any as Location
    const router = createRouter({
      routes: manifest,
      history,
      location,
      pathPolicy: { baseUrl: "/app" },
    })
    assert.strictEqual(router.resolveHref("/about#section"), "/app/about#section")
    assert.strictEqual(router.resolveHref("#top"), "/app/users/1#top")
  })

  it("runs global middleware and can abort navigation", async () => {
    const manifest = compileRouteTree(routes)
    const historyEvents: Array<{ kind: "push" | "replace"; to: string }> = []
    const history = {
      pushState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "push", to })
      },
      replaceState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "replace", to })
      },
    } as any as History

    const location = { pathname: "/" } as any as Location
    const router = createRouter({
      routes: manifest,
      history,
      location,
      routeMiddleware: [() => ({ abort: true })],
    })
    router.navigate("/about")
    await new Promise((r) => setTimeout(r, 0))
    assert.strictEqual(router.path.value, "/")
    assert.strictEqual(historyEvents.length, 0)
  })

  it("runs global middleware and can redirect navigation", async () => {
    const manifest = compileRouteTree(routes)
    const historyEvents: Array<{ kind: "push" | "replace"; to: string }> = []
    const history = {
      pushState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "push", to })
      },
      replaceState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "replace", to })
      },
    } as any as History

    const location = { pathname: "/" } as any as Location
    const router = createRouter({
      routes: manifest,
      history,
      location,
      routeMiddleware: [
        (ctx) => {
          if (ctx.to.pathname === "/about") return { redirect: "/login" }
          return
        },
      ],
    })
    router.navigate("/about")
    await new Promise((r) => setTimeout(r, 0))
    assert.strictEqual(router.path.value, "/login")
    assert.ok(historyEvents.some((e) => e.to === "/login"))
  })

  it("SSR runs route middleware and returns redirect when middleware redirects", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/about", async () => ({ default: () => <p>about</p> })),
          x.page("/users/[id]", {
            component: async () => ({ default: () => <p>user</p> }),
          }),
        ],
      })
    )
    const renderer = createRenderer({
      routes: r,
      routeMiddleware: [
        (ctx) => {
          if (ctx.to.params.id === "0") return { redirect: "/about" }
          return
        },
      ],
    })
    const response = await renderer.render("/users/0")
    assert.strictEqual(response?.status, 302)
    assert.strictEqual(response?.headers.location, "/about")

    const ok = await renderer.render("/users/1")
    assert.strictEqual(ok?.status, 200)
    assert.ok(ok?.body.includes("user"))
  })

  it("runs per-route middleware abort", async () => {
    const guarded = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/", async () => ({ default: () => <p>ok</p> })),
          x.page("/blocked", {
            component: async () => ({ default: () => <p>no</p> }),
            middleware: [() => ({ abort: true })],
          }),
        ],
      })
    )
    const manifest = compileRouteTree(guarded)
    const historyEvents: Array<{ kind: "push" | "replace"; to: string }> = []
    const history = {
      pushState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "push", to })
      },
      replaceState(_a: any, _b: any, to: string) {
        historyEvents.push({ kind: "replace", to })
      },
    } as any as History

    const location = { pathname: "/" } as any as Location
    const router = createRouter({ routes: manifest, history, location })
    router.navigate("/blocked")
    await new Promise((r) => setTimeout(r, 0))
    assert.strictEqual(router.path.value, "/")
    assert.strictEqual(historyEvents.length, 0)
  })

  it("exposes pathname/params/hash/query signals via useRouter", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/users/[id]", async () => ({
            default: () => {
              const router = useRouter()
              return (
                <p>
                  {router.pathname.value}:{router.params.value.id}:
                  {router.hash.value}:{router.query.value.tag?.join(",")}
                </p>
              )
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/users/42?tag=a&tag=b#section")
    assert.ok(response?.body.includes(":42:#section:a,b"))

    const streamRenderer = createRenderer({ routes: r, stream: true })
    const streamResponse = await streamRenderer.render(
      "/users/42?tag=a&tag=b#section"
    )
    assert.ok(streamResponse)
    const reader = (streamResponse.body as ReadableStream<string>).getReader()
    let streamBody = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      streamBody += next.value
    }
    reader.releaseLock()
    assert.ok(streamBody.includes(":42:#section:a,b"))
  })

  it("supports baseUrl and query/hash mutators in router API", async () => {
    const manifest = compileRouteTree(routes)
    const historyEvents: Array<{ kind: "push" | "replace"; to: string }> = []
    const history = {
      state: null as any,
      length: 1,
      pushState(a: any, _b: any, to: string) {
        this.state = a
        this.length += 1
        historyEvents.push({ kind: "push", to })
      },
      replaceState(a: any, _b: any, to: string) {
        this.state = a
        historyEvents.push({ kind: "replace", to })
      },
    } as any as History
    const location = {
      pathname: "/app/",
      search: "",
      hash: "",
      origin: "http://localhost",
    } as any as Location
    const router = createRouter({
      routes: manifest,
      history,
      location,
      pathPolicy: { baseUrl: "/app" },
    })
    router.navigate("/users/1")
    await new Promise((r) => setTimeout(r, 0))
    assert.strictEqual(router.pathname.value, "/users/1")
    assert.strictEqual(router.resolveHref("/about"), "/app/about")

    router.setQuery({ tag: ["x", "y"] }, { replace: true })
    await new Promise((r) => setTimeout(r, 0))
    assert.deepStrictEqual(router.query.value, { tag: ["x", "y"] })

    router.setHash("top")
    await new Promise((r) => setTimeout(r, 0))
    assert.strictEqual(router.hash.value, "#top")
    assert.ok(historyEvents.some((e) => e.to.startsWith("/app/users/1")))
  })

  it("renders notFound module when route is unmatched", async () => {
    const nfRoutes = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        notFound: async () => ({
          default: () => <p>missing</p>,
        }),
        children: [x.page("/", async () => ({ default: () => <p>ok</p> }))],
      })
    )
    const renderer = createRenderer({ routes: nfRoutes })
    const response = await renderer.render("/does-not-exist")
    assert.strictEqual(response?.status, 404)
    assert.ok((response?.body).includes("<main><p>missing</p></main>"))
  })

  it("renders scope error module when SSR throws after a matched route", async () => {
    const errRoutes = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main data-layout="yes">{children}</main>
          ),
        }),
        error: async () => ({
          default: ({ error }: { error: Error }) => (
            <p data-msg={error.message}>err-scope</p>
          ),
        }),
        children: [
          x.page("/break", async () => ({
            default: () => {
              throw new Error("boom-matched")
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({ routes: errRoutes })
    const response = await renderer.render("/break")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(
      response.body.includes(
        `<main data-layout="yes"><p data-msg="boom-matched">err-scope</p></main>`
      )
    )

    const m = matchRoute(renderer.manifest, "/break")
    assert.ok(m)
    const tree = await loadErrorRouteTree(m!)
    assert.ok(tree)
    assert.strictEqual(typeof m.route.error, "function")
  })

  it("renders root error module when notFound subtree throws SSR", async () => {
    const nfErr = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <div className="shell">{children}</div>
          ),
        }),
        notFound: async () => ({
          default: () => {
            throw "nf-string"
          },
        }),
        error: async () => ({
          default: ({ error }: { error: Error }) => (
            <p className="roe">{error.message}</p>
          ),
        }),
        children: [
          x.page("/", async () => ({
            default: () => <p>ok</p>,
          })),
        ],
      })
    )
    const renderer = createRenderer({ routes: nfErr })
    const response = await renderer.render("/gone")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(
      response.body.includes(
        `<div class="shell"><p class="roe">nf-string</p></div>`
      )
    )
    const rootTree = await loadRootErrorRouteTree(renderer.manifest)
    assert.ok(rootTree)
  })

  it("streaming SSR renders custom error page with HTML template", async () => {
    const errRoutes = defineRouteTree((x) =>
      x.scope({
        error: async () => ({
          default: ({ error }: { error: Error }) => (
            <p>t-stream-{error.message}</p>
          ),
        }),
        children: [
          x.page("/bad", async () => ({
            default: () => {
              throw new Error("sink")
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({
      stream: true,
      routes: errRoutes,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/bad")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    const reader = (response!.body as ReadableStream<string>).getReader()
    let out = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      out += next.value
    }
    reader.releaseLock()
    assert.ok(out.includes("<!doctype html>"))
    assert.ok(out.includes("t-stream-sink"))

    assert.ok(renderer.manifest.rootError)
  })

  it("falls back to generic 500 HTML when route has no error module", async () => {
    const plain = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/x", async () => ({
            default: () => {
              throw new Error("silent")
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({ routes: plain })
    const response = await renderer.render("/x")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(response.body.includes("<pre>silent</pre>"))
  })

  it("toRenderError preserves Error and wraps primitives", () => {
    const e = new Error("exact")
    assert.strictEqual(toRenderError(e), e)
    assert.strictEqual(toRenderError("msg").message, "msg")
    assert.strictEqual(toRenderError(42).message, "42")
  })

  it("uses leaf route error over ancestor scope error", async () => {
    const layered = defineRouteTree((x) =>
      x.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <aside>{children}</aside>
          ),
        }),
        error: async () => ({
          default: () => <p>wrong-scope-error</p>,
        }),
        children: [
          x.page("/deep", {
            error: async () => ({
              default: ({ error }: { error: Error }) => (
                <p>caught-leaf-{error.message}</p>
              ),
            }),
            component: async () => ({
              default: () => {
                throw new Error("leaf-throw")
              },
            }),
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: layered })
    const response = await renderer.render("/deep")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(response.body.includes("caught-leaf-leaf-throw"))
    assert.ok(!response.body.includes("wrong-scope-error"))
  })

  it("uses innermost scope error when route does not define error", async () => {
    const nested = defineRouteTree((x) =>
      x.scope({
        children: [
          x.scope({
            layout: async () => ({
              default: ({ children }: { children: JSX.Children }) => (
                <section id="inner">{children}</section>
              ),
            }),
            error: async () => ({
              default: ({ error }: { error: Error }) => (
                <p>inner-{error.message}</p>
              ),
            }),
            children: [
              x.page("/inner-fail", async () => ({
                default: () => {
                  throw new Error("no-leaf-error")
                },
              })),
            ],
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: nested })
    const response = await renderer.render("/inner-fail")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(
      response.body.includes(
        '<section id="inner"><p>inner-no-leaf-error</p></section>'
      )
    )
  })

  it("applies htmlTemplate in string mode for custom 500", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        error: async () => ({
          default: ({ error }: { error: Error }) => (
            <p>string-err-{error.message}</p>
          ),
        }),
        children: [
          x.page("/se", async () => ({
            default: () => {
              throw new Error("tpl")
            },
          })),
        ],
      })
    )
    const renderer = createRenderer({
      routes: r,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/se")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(
      (response.body as string).toLowerCase().includes("<!doctype html>")
    )
    assert.ok((response.body as string).includes("string-err-tpl"))
  })

  it("root error without root layout still renders for notFound failure", async () => {
    const rootOnly = defineRouteTree((x) =>
      x.scope({
        notFound: async () => ({
          default: () => {
            throw new Error("nf-err")
          },
        }),
        error: async () => ({
          default: ({ error }: { error: Error }) => (
            <p id="root-only">{error.message}</p>
          ),
        }),
        children: [
          x.page("/", async () => ({
            default: () => <p>home</p>,
          })),
        ],
      })
    )
    const manifest = compileRouteTree(rootOnly)
    assert.strictEqual(manifest.rootLayout, undefined)
    assert.ok(typeof manifest.rootError === "function")
    assert.strictEqual(
      (await loadRootErrorRouteTree(manifest))!.layoutModules.length,
      0
    )

    const renderer = createRenderer({ routes: rootOnly })
    const response = await renderer.render("/nope")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(response.body.includes('<p id="root-only">nf-err</p>'))
  })

  it("falls back to generic 500 when custom error loader rejects", async () => {
    const badLoader = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/z", {
            error: async () => {
              throw new Error("loader-broke")
            },
            component: async () => ({
              default: () => {
                throw new Error("original-page")
              },
            }),
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: badLoader })
    const response = await renderer.render("/z")
    assert.ok(response)
    assert.strictEqual(response.status, 500)
    assert.ok(response.body.includes("<pre>original-page</pre>"))
    assert.ok(!response.body.includes("loader-broke"))
  })

  it("returns null from loadRootErrorRouteTree without root scope error", async () => {
    const routesNoRootErr = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/", async () => ({
            default: () => <p>home</p>,
          })),
        ],
      })
    )
    const m = compileRouteTree(routesNoRootErr)
    assert.strictEqual(await loadRootErrorRouteTree(m), null)
    assert.strictEqual(m.rootError, undefined)
    assert.strictEqual(m.rootLayout, undefined)
  })

  it("loadErrorRouteTree returns null when compiled route has no error", async () => {
    const r = compileRouteTree(routes)
    const match = matchRoute(r, "/")
    assert.ok(match)
    assert.strictEqual(await loadErrorRouteTree(match), null)
  })

  it("fillRouteHtmlTemplate injects head and body into a shell", () => {
    const tpl = `<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>`
    const html = fillRouteHtmlTemplate(tpl, {
      body: "<p>hi</p>",
      headHtml: "<title>T</title>",
    })
    assert.ok(html.includes("<title>T</title>"))
    assert.ok(html.includes("<p>hi</p>"))
  })

  it("supports {{kiru_head}} and {{kiru_body}} placeholders", () => {
    const tpl =
      "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"
    const html = fillRouteHtmlTemplate(tpl, {
      body: "<main>A</main>",
      headHtml: "<title>X</title>",
    })
    assert.ok(html.includes("<title>X</title>"))
    assert.ok(html.includes("<main>A</main>"))
  })

  it("createRenderer applies htmlTemplate for string mode", async () => {
    const tpl =
      '<!doctype html><html><head>{{kiru_head}}</head><body><div id="app">{{kiru_body}}</div></body></html>'
    const renderer = createRenderer({ routes, htmlTemplate: tpl })
    const response = await renderer.render("/users/1")
    assert.ok(response)
    assert.strictEqual(typeof response.body, "string")
    assert.ok((response.body as string).includes("<!doctype html>"))
    assert.ok((response.body as string).includes("<main><h1>1</h1></main>"))
  })

  it("streaming SSR embeds serverLoader page data in the document head", async () => {
    const load = serverLoader(async (ctx) => ({
      pathname: ctx.url.pathname,
      note: "from-server",
    }))
    const r = defineRouteTree((x) =>
      x.scope({
        children: [
          x.page("/loader", {
            component: async () => ({
              load,
              default: () => <p data-testid="ok">ok</p>,
            }),
          }),
        ],
      })
    )
    const renderer = createRenderer({
      stream: true,
      routes: r,
      htmlTemplate: MINIMAL_TPL,
    })
    const response = await renderer.render("/loader")
    assert.ok(response)
    const reader = (response.body as ReadableStream<string>).getReader()
    let out = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      out += next.value
    }
    reader.releaseLock()
    assert.ok(out.includes(`<script type="application/json" k-page-data>`))
    assert.ok(out.includes('"pathname":"/loader"'))
    assert.ok(out.includes('"note":"from-server"'))
  })

  it("createRenderer applies htmlTemplate for stream mode", async () => {
    const tpl =
      '<!doctype html><html><head>{{kiru_head}}</head><body><div id="app">{{kiru_body}}</div></body></html>'
    const renderer = createRenderer({
      stream: true,
      routes,
      htmlTemplate: tpl,
    })
    const response = await renderer.render("/users/1")
    assert.ok(response)
    assert.ok(typeof response.body !== "string")

    const reader = (response.body as ReadableStream<string>).getReader()
    let out = ""
    while (true) {
      const next = await reader.read()
      if (next.done) break
      out += next.value
    }
    reader.releaseLock()

    assert.ok(out.includes("<!doctype html>"))
    assert.ok(out.includes("<main><h1>1</h1></main>"))
    assert.ok(out.includes("</html>"))
  })

  it("stripPrerenderedRequestInjections removes context and token scripts", () => {
    const html = `<!doctype html><html><head><script type="application/json" k-request-context>{}</script><script type="application/json" k-request-token>tok</script></head><body></body></html>`
    const out = stripPrerenderedRequestInjections(html)
    assert.ok(!out.includes("k-request-context"))
    assert.ok(!out.includes("k-request-token"))
    assert.ok(out.includes("</head>"))
  })

  it("invalidate bumps loaderEpoch and clears force reload after outlet run", async () => {
    const routes = defineRouteTree((r) =>
      r.scope({
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          r.page("/", async () => ({ default: () => <h1>Home</h1> })),
        ],
      })
    )
    const manifest = compileRouteTree(routes)
    const history = {
      pushState() {},
      replaceState() {},
    } as unknown as History
    const location = {
      pathname: "/",
      hash: "",
      search: "",
      origin: "http://localhost",
    } as unknown as Location
    const router = createRouter({ routes: manifest, history, location })
    assert.equal(router.loaderEpoch.peek(), 0)
    await router.invalidate()
    assert.equal(router.loaderEpoch.peek(), 1)
    assert.equal(router.forceLoaderReload.peek(), true)
  })

  it("hydratePrerenderedHtmlForRequest replaces context and token for the request", async () => {
    const html = `<!doctype html><html><head><title>t</title><script type="application/json" k-request-context>{"user":{"name":"Stale"}}</script><script type="application/json" k-request-token>stale</script></head><body>x</body></html>`
    const secret = "unit-test-secret-for-hydrate"
    const out = await hydratePrerenderedHtmlForRequest(
      html,
      { user: { name: "Fresh" } } as CustomRequestContext,
      secret
    )
    assert.ok(out.includes('"name":"Fresh"'))
    assert.ok(!out.includes("Stale"))
    assert.ok(!out.includes("stale"))
    assert.ok(out.includes("k-request-token"))
    assert.match(out, /k-request-token>[^<]+\.[^<]+\.[^<]+</)
  })
})
