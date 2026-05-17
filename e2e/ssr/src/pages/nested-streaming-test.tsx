import { Derive, resource } from "kiru"
import {
  getStreamingProduct,
  getStreamingReviews,
  type StreamingProduct,
} from "./index.actions"

export default function NestedStreamingTestPage() {
  const product = resource(({ signal }) => {
    console.log("get product")
    return getStreamingProduct({ signal })
  })

  return () => (
    <section className="space-y-3" data-testid="nested-streaming-page">
      <h2 className="text-xl font-semibold text-slate-100">Nested streaming</h2>
      <Derive
        from={product}
        fallback={<p data-testid="product-fallback">Loading product...</p>}
      >
        {(p) => <ProductCard product={p} />}
      </Derive>
    </section>
  )
}

function ProductCard({ product }: { product: StreamingProduct }) {
  const reviews = resource(({ signal }) => {
    console.log("get reviews")
    return getStreamingReviews({ productId: product.id }, { signal })
  })

  return () => (
    <div>
      <Derive
        from={reviews}
        fallback={<p data-testid="reviews-fallback">Loading reviews...</p>}
      >
        {(items) => (
          <ul data-testid="reviews-list">
            {items.map((review) => (
              <li key={review.id} data-testid="review-item">
                {review.text}
              </li>
            ))}
          </ul>
        )}
      </Derive>
      <p data-testid="product-name">{product.name}</p>
    </div>
  )
}
