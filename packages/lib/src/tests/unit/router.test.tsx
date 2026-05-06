import { describe, it } from "node:test"
import * as kiru from "../../index.js"
import assert from "node:assert"
import {
  compileRouteTree,
  createRenderer,
  createStreamRenderer,
  defineRouteTree,
  fillRouteHtmlTemplate,
  generateStaticPaths,
  Head,
  Link,
  matchRoute,
  prerenderStaticRoutes,
} from "../../router/index.js"

describe("router", () => {
  const routes = defineRouteTree((r) =>
    r.scope({
      layout: async () => ({
        default: ({ children }: { children: JSX.Children }) => (
          <main>{children}</main>
        ),
      }),
      children: [
        r.get("/", async () => ({ default: () => <h1>Home</h1> })),
        r.get("/users/[id]", {
          static: true,
          component: async () => ({
            default: ({ id }: { id: string }) => <h1>{id}</h1>,
          }),
          generateStaticParams: async () => [{ id: "1" }, { id: "2" }],
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

  it("renders with framework-agnostic renderer contract", async () => {
    const renderer = createRenderer({ routes })
    const response = await renderer.render("/users/42")
    assert.ok(response)
    const headers = response.headers as Record<string, string>
    assert.strictEqual(response.status, 200)
    assert.strictEqual(headers["content-type"], "text/html; charset=utf-8")
    assert.strictEqual(typeof response.body, "string")
    assert.ok((response.body as string).includes("<main><h1>42</h1></main>"))
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

  it("returns document head from renderer with merged route meta", async () => {
    const metaRoutes = defineRouteTree((r) =>
      r.scope({
        meta: { title: "AppRoot", description: "from-scope" },
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          r.get("/doc", {
            component: async () => ({ default: () => <p>x</p> }),
            meta: { title: "LeafTitle", description: "from-leaf" },
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: metaRoutes })
    const response = await renderer.render("/doc")
    assert.ok(response?.document?.headHtml.includes("<title>LeafTitle</title>"))
    assert.ok(
      response?.document?.headHtml.includes(
        'name="description" content="from-leaf"'
      )
    )
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
          x.get("/users/[id]", {
            component: async () => ({
              default: ({ id }: { id: string }) => <span>{id}</span>,
            }),
            meta: { title: "User {id}" },
          }),
        ],
      })
    )
    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/users/99")
    assert.ok(response?.document?.headHtml.includes("<title>User 99</title>"))
  })

  it("merges <Head content> with route meta (SSR)", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        meta: { title: "Base" },
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          x.get("/", async () => ({
            default: () => (
              <>
                <Head content={{ title: "Welcome!" }} />
                <h1>Home</h1>
              </>
            ),
          })),
        ],
      })
    )

    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/")
    assert.ok(response?.document?.headHtml.includes("<title>Welcome!</title>"))
  })

  it("awaits <Head using> resource before streaming (SSR stream)", async () => {
    const r = defineRouteTree((x) =>
      x.scope({
        meta: { title: "Base" },
        layout: async () => ({
          default: ({ children }: { children: JSX.Children }) => (
            <main>{children}</main>
          ),
        }),
        children: [
          x.get("/product", async () => ({
            default: () => {
              const product = kiru.resource(async () => ({
                title: "Gizmo",
              }))
              return (
                <>
                  <Head
                    using={product}
                    content={(p: { title: string }) => ({
                      title: `Product: ${p.title}`,
                    })}
                  />
                  <h1>{() => product.value?.title}</h1>
                </>
              )
            },
          })),
        ],
      })
    )

    const renderer = createStreamRenderer({ routes: r })
    const response = await renderer.render("/product")
    assert.ok(!!response?.document, "response.document is defined")
    assert.ok(
      response.document.headHtml.includes("<title>Product: Gizmo</title>")
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
        children: [x.get("/", async () => ({ default: () => <p>home</p> }))],
      })
    )
    const renderer = createRenderer({ routes: r })
    const response = await renderer.render("/")
    assert.ok((response?.body as string).includes('<a href="/users/1">'))
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

  it("createStreamRenderer applies htmlTemplate", async () => {
    const tpl =
      '<!doctype html><html><head>{{kiru_head}}</head><body><div id="app">{{kiru_body}}</div></body></html>'
    const renderer = createStreamRenderer({
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
})
