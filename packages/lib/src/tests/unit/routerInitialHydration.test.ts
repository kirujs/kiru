import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  compileRouteTree,
  createRoute,
  createRouteTree,
  loader,
} from "../../router/index.js"
import { createRouter } from "../../router/csr.js"
import { defineHeadContent } from "../../router/pageHead.js"
import { withJSDOM } from "./jsdom.js"

async function flushInitialRouterWork(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe("createRouter initial hydration", () => {
  it("syncs static page head title on first paint", async () => {
    await withJSDOM(async () => {
      const manifest = compileRouteTree(
        createRouteTree({
          children: [
            createRoute("/", async () => ({
              default: () => null,
              head: defineHeadContent({ title: "Home — Kiru" }),
            })),
          ],
        })
      )
      createRouter({
        routes: manifest,
        history: window.history,
        location: window.location,
      })
      await flushInitialRouterWork()
      assert.equal(document.title, "Home — Kiru")
    })
  })

  it("validates initial search and sets validatedQuery", async () => {
    await withJSDOM(
      async () => {
        const pageLoad = loader({
          validation: {
            query: {
              parse(input: unknown) {
                if (
                  typeof input !== "object" ||
                  input === null ||
                  !("q" in input)
                ) {
                  throw new Error("bad")
                }
                return input as { q: string }
              },
            },
            queryDefaults: { q: "default" },
          },
          load: async ({ query }) => query,
        })
        const manifest = compileRouteTree(
          createRouteTree({
            children: [
              createRoute("/search", {
                component: async () => ({
                  default: () => null,
                  load: pageLoad,
                }),
              }),
            ],
          })
        )
        const router = createRouter({
          routes: manifest,
          history: window.history,
          location: new URL("http://localhost/search?q=ok") as unknown as Location,
        })
        await flushInitialRouterWork()
        assert.deepEqual(router.validatedQuery.peek(), { q: "ok" })
      },
      { url: "http://localhost/search?q=ok" }
    )
  })
})
