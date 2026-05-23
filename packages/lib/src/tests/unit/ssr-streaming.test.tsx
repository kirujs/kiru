import { describe, it } from "node:test"
import assert from "node:assert"
import * as kiru from "../../index.js"
import { action } from "../../remote/action.js"
import { renderToReadableStream } from "../../ssr/server.js"
import { Derive } from "../../components/derive.js"
import { resource } from "../../resource.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"

type Product = { id: string; name: string }
type Review = { id: string; text: string }

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let out = ""
  while (true) {
    const next = await reader.read()
    if (next.done) break
    out += next.value
  }
  reader.releaseLock()
  return out
}

function extractStreamDataIds(html: string): string[] {
  const ids: string[] = []
  const re = /__\$k_data\("([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    ids.push(match[1])
  }
  return ids
}

describe("renderToReadableStream speculative Derive traversal", () => {
  it("streams nested resource promises discovered after parent Derive settles", async () => {
    const productDeferred = createDeferred<Product>()
    const reviewsDeferred = createDeferred<Review[]>()
    let reviewsLoaderCalls = 0

    function ProductCard({ product }: { product: Product }) {
      const reviews = resource(() => {
        reviewsLoaderCalls++
        return reviewsDeferred.promise
      })

      return () => (
        <div>
          <Derive
            from={reviews}
            fallback={<p data-testid="reviews-fallback">Loading reviews...</p>}
          >
            {(items) => (
              <ul data-testid="reviews-list" data-product={product.name}>
                {items.map((r) => (
                  <li key={r.id}>{r.text}</li>
                ))}
              </ul>
            )}
          </Derive>
          <p data-testid="product-name">{product.name}</p>
        </div>
      )
    }

    function Page() {
      const product = resource(() => productDeferred.promise)

      return () => (
        <Derive
          from={product}
          fallback={<p data-testid="product-fallback">Loading product...</p>}
        >
          {(p) => <ProductCard product={p} />}
        </Derive>
      )
    }

    const stream = renderToReadableStream(<Page />)

    productDeferred.resolve({ id: "1", name: "Widget" })
    reviewsDeferred.resolve([{ id: "r1", text: "Great" }])

    const html = await readStream(stream)

    assert.ok(
      html.includes('data-testid="product-fallback"'),
      "shell should contain parent fallback"
    )
    assert.ok(
      !html.includes('data-testid="reviews-list"'),
      "shell should not contain nested success content"
    )

    const ids = extractStreamDataIds(html)
    assert.strictEqual(
      ids.length,
      2,
      `expected two streamed data scripts, got ${ids.length}: ${ids.join(", ")}`
    )
    assert.strictEqual(
      reviewsLoaderCalls,
      1,
      "nested resource loader should run once during speculative SSR"
    )
    assert.ok(
      html.includes('"text":"Great"'),
      "stream should include resolved nested review payload"
    )
    assert.ok(
      html.includes(`,${JSON.stringify(ids[1])}`),
      "parent __$k_data should pass nested resource ids as variadic arguments"
    )
  })

  it("streams nested remote actions with SSR request context during speculation", async () => {
    const getStreamingProduct = action(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return { id: "p1", name: "Streaming Product" }
    })

    const getStreamingReviews = action(async ({
      body,
      context,
    }: import("../../remote/action.js").RemoteActionHandlerArgs<{
      productId: string
    }>) => {
      assert.equal((context as { user?: { name: string } }).user?.name, "Ada")
      await new Promise((r) => setTimeout(r, 50))
      return [{ id: "r1", text: `Review for ${body.productId}` }]
    })

    function ProductCard({ product }: { product: Product }) {
      const reviews = resource(({ signal }) =>
        getStreamingReviews({
          body: { productId: product.id },
          signal,
        })
      )

      return () => (
        <div>
          <Derive
            from={reviews}
            fallback={<p data-testid="reviews-fallback">Loading reviews...</p>}
          >
            {(items) => (
              <ul data-testid="reviews-list">
                {items.map((r) => (
                  <li key={r.id}>{r.text}</li>
                ))}
              </ul>
            )}
          </Derive>
          <p data-testid="product-name">{product.name}</p>
        </div>
      )
    }

    function Page() {
      const product = resource(({ signal }) => getStreamingProduct({ signal }))

      return () => (
        <Derive
          from={product}
          fallback={<p data-testid="product-fallback">Loading product...</p>}
        >
          {(p) => <ProductCard product={p} />}
        </Derive>
      )
    }

    const stream = renderToReadableStream(<Page />, {
      requestContext: { user: { name: "Ada" } },
      renderSignal: staticLoaderSignal(),
    })

    const html = await readStream(stream)

    assert.ok(!html.includes('"error"'), `stream should not contain action errors: ${html}`)
    assert.ok(
      html.includes("Review for p1"),
      "nested remote action should resolve during speculative SSR"
    )
  })
})
