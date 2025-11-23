import { ErrorBoundary, usePromise, useState, Derive } from "kiru"

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

async function loadProduct(
  signal: AbortSignal,
  search: string,
  page: number,
  pageSize: number
): Promise<ProductsSearchResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300))
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

export default function SuspenseExample() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const products = usePromise(
    (signal) => loadProduct(signal, search, page, pageSize),
    [search, page, pageSize]
  )

  return (
    <div>
      <div className="flex justify-between">
        <input
          autofocus
          placeholder="Search products"
          className="w-full p-2 rounded-md border"
          value={search}
          oninput={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          disabled={products.isPending}
          className="p-2 rounded-md border disabled:opacity-50"
          value={pageSize.toString()}
          oninput={(e) => {
            const nextSize = parseInt(e.currentTarget.value)
            const currentOffset = (page - 1) * pageSize
            setPageSize(nextSize)
            setPage(Math.ceil((currentOffset + 1) / nextSize))
          }}
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
        <Derive from={{ products }} fallback={loadingAll}>
          {({ products }, isStale) => {
            return (
              <>
                <ProductsTable
                  {...products}
                  page={page}
                  setPage={setPage}
                  pageSize={pageSize}
                  isStale={isStale}
                />
              </>
            )
          }}
        </Derive>
      </ErrorBoundary>
    </div>
  )
}

interface ProductsTableProps extends ProductsSearchResponse {
  page: number
  setPage: (value: Kiru.StateSetter<number>) => void
  pageSize: number
  isStale?: boolean
}

function ProductsTable({
  products,
  total,
  page,
  pageSize,
  setPage,
  isStale,
}: ProductsTableProps) {
  const numPages = Math.ceil(total / pageSize)
  const disablePrev = page === 1
  const disableNext = page === numPages
  let start = Math.max(1, page - 5)
  let end = Math.min(numPages, start + 9)
  start = Math.max(1, end - 9)

  return (
    <div className={`transition-opacity ${isStale ? "opacity-50" : ""}`}>
      <table className="w-full">
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
