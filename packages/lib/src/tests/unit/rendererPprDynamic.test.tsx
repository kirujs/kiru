import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import * as kiru from "../../index.js"
import {
  createRenderer,
  defineISR,
  defineRouteTree,
} from "../../router/index.js"

const MINIMAL_TPL =
  "<!doctype html><html><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>"

describe("renderer PPR-lite dynamic modes", () => {
  it("force-static returns 404 when prerender HTML is missing", async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const clientDir = await mkdtemp(join(tmpdir(), "kiru-ppr-static-"))
      const routes = defineRouteTree((r) =>
        r.scope({
          children: [
            r.page("/only-static", async () => ({
              default: () => <p data-testid="only-static">nope</p>,
              isr: defineISR({ dynamic: "force-static" }),
            })),
          ],
        })
      )
      const renderer = createRenderer({
        routes,
        htmlTemplate: MINIMAL_TPL,
        prerenderedHtmlDir: clientDir,
      })
      const response = await renderer.render("/only-static")
      assert.equal(response?.status, 404)
      assert.equal(response?.body, "Not Found")
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevEnv
    }
  })

  it("force-dynamic skips disk prerender when HTML exists", async () => {
    const prevEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const clientDir = await mkdtemp(join(tmpdir(), "kiru-ppr-dynamic-"))
      const { writeFileSync } = await import("node:fs")
      const htmlPath = join(clientDir, "live.html")
      writeFileSync(
        htmlPath,
        "<html><body><p data-testid='stale'>stale-prerender</p></body></html>",
        "utf8"
      )
      const { persistPrerenderBuildOutput } = await import(
        "../../router/prerenderCache.js"
      )
      persistPrerenderBuildOutput({
        clientDir,
        pathname: "/live",
        htmlAbsolutePath: htmlPath,
        revalidate: false,
      })

      let hits = 0
      const routes = defineRouteTree((r) =>
        r.scope({
          children: [
            r.page("/live", async () => ({
              default: () => {
                hits += 1
                return <p data-testid="live-hit">{hits}</p>
              },
              isr: defineISR({ dynamic: "force-dynamic" }),
            })),
          ],
        })
      )
      const renderer = createRenderer({
        routes,
        htmlTemplate: MINIMAL_TPL,
        prerenderedHtmlDir: clientDir,
      })

      const first = await renderer.render("/live")
      assert.equal(first?.status, 200)
      assert.match(String(first?.body), /live-hit[^>]*>1</)
      assert.doesNotMatch(String(first?.body), /stale-prerender/)

      const second = await renderer.render("/live")
      assert.match(String(second?.body), /live-hit[^>]*>2</)
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevEnv
    }
  })
})
