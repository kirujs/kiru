import { ErrorBoundary, usePromise, Derive, useCallback } from "kiru"
import { RouteQuery, useFileRouter } from "kiru/router"

interface Product {
  id: number
  title: string
  thumbnail: string
  description: string
}

interface ProductsSearchResponse {
  products: Product[]
  total: number
  skip: number
  limit: number
}

async function loadProducts(
  signal: AbortSignal,
  query: RouteQuery
): Promise<ProductsSearchResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const page = parseSearchNumber(query.p, 1)
  const pageSize = parseSearchNumber(query.s, 10)
  const search = String(query.q || "")

  const skip = (page - 1) * pageSize
  const url = `https://dummyjson.com/products/search?q=${search}&skip=${skip}&limit=${pageSize}`

  const request = await fetch(url, { signal })
  if (!request.ok) throw new Error(request.statusText)
  return request.json()
}

const loadingAll = (
  <div>
    <i>Loading products...</i>
  </div>
)
export default function UsePromiseExample() {
  const {
    state: { query },
    setQuery,
  } = useFileRouter()

  const search = Array.isArray(query.q) ? query.q[0] : query.q
  const pageSize = parseSearchNumber(query.s, 10).toString()
  const products = usePromise((signal) => loadProducts(signal, query), [query])

  const handleSearchChanged = useCallback(
    (e: Kiru.FormEvent<HTMLInputElement>) => {
      setQuery({ ...query, q: e.target.value, p: "1" }, { replace: true })
    },
    [query]
  )

  const handlePageSizeChanged = useCallback(
    (e: Kiru.FormEvent<HTMLSelectElement>) => {
      const nextSize = parseInt(e.target.value)
      const pageSize = parseSearchNumber(query.s, 10)
      const page = parseSearchNumber(query.p, 1)

      const currentOffset = (page - 1) * pageSize
      const nextPage = Math.ceil((currentOffset + 1) / nextSize) + ""

      setQuery({ ...query, s: e.target.value, p: nextPage }, { replace: true })
    },
    [query]
  )

  return (
    <div>
      <div className="flex justify-between">
        <input
          autofocus
          placeholder="Search products"
          className="w-full p-2 rounded-md border"
          value={search}
          oninput={handleSearchChanged}
        />
        <select
          disabled={products.isPending}
          className="p-2 rounded-md border disabled:opacity-50"
          value={pageSize}
          oninput={handlePageSizeChanged}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="20">20</option>
        </select>
      </div>
      <ErrorBoundary
        onError={(error) => console.error("Error loading products", error)}
        fallback={(error) => (
          <>
            <div>Error loading products: {error.message}</div>
            <button onclick={() => products.refresh()}>Retry</button>
          </>
        )}
      >
        <Derive from={products} fallback={loadingAll}>
          {(products, isStale) => (
            <ProductsTable {...products} isStale={isStale} />
          )}
        </Derive>
      </ErrorBoundary>
    </div>
  )
}

interface ProductsTableProps extends ProductsSearchResponse {
  isStale?: boolean
}

function ProductsTable({ products, total, isStale }: ProductsTableProps) {
  const {
    state: { query },
    setQuery,
  } = useFileRouter()
  const pageSize = parseSearchNumber(query.s, 10)
  const page = parseSearchNumber(query.p, 1)
  const numPages = Math.ceil(total / pageSize)
  const disablePrev = page === 1
  const disableNext = page === numPages
  let start = Math.max(1, page - 5)
  let end = Math.min(numPages, start + 9)
  start = Math.max(1, end - 9)

  const setPage = (value: Kiru.StateSetter<number>) => {
    const page = parseSearchNumber(query.p, 1)
    const next = typeof value === "function" ? value(page) : value
    setQuery({ ...query, p: next + "" }, { replace: true })
  }

  return (
    <div>
      <table
        className={`w-full transition-opacity ${isStale ? "opacity-50" : ""}`}
      >
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.title}</td>
              <td>
                <img src={product.thumbnail} className="w-16 h-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center">
        <button
          disabled={disablePrev}
          onclick={() => setPage((prev) => prev - 1)}
          className="p-2 rounded-md border disabled:opacity-50"
        >
          Prev
        </button>
        {Array.from({ length: end - start + 1 }, (_, idx) => {
          const i = start + idx
          return (
            <button
              key={i}
              disabled={i === page}
              onclick={() => setPage(i)}
              className={`p-2 rounded-md border disabled:opacity-90 ${
                i === page ? "bg-blue-500 text-white" : ""
              }`}
            >
              {i}
            </button>
          )
        })}
        <button
          disabled={disableNext}
          onclick={() => setPage((prev) => prev + 1)}
          className="p-2 rounded-md border disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function parseSearchNumber(
  value: string | string[] | undefined,
  fallback: number
) {
  const parsed = parseInt(String(value ?? fallback))
  return isNaN(parsed) ? fallback : parsed
}
