import { ErrorBoundary, Suspense, useMemo, usePromise, useState } from "kiru"

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
  pageSize: number,
  setTotal: (total: number) => void
): Promise<ProductsSearchResponse> {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  if (Math.random() < 0.3) {
    console.log("throwing error")
    throw new Error("Test error")
  }

  const skip = (page - 1) * pageSize
  const url = `https://dummyjson.com/products/search?q=${search}&skip=${skip}&limit=${pageSize}`
  console.log("fetching", url)

  const request = await fetch(url, { signal })
  if (!request.ok) throw new Error(request.statusText)
  const data = await request.json()
  setTotal(data.total)
  return data
}

export default function SuspenseExample() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const products = usePromise(
    ({ signal }) =>
      loadProduct(signal, search, page, pageSize, (n) => setTotal(n)),
    [search, page, pageSize]
  )
  const disableNext = useMemo(() => {
    const skip = (page - 1) * pageSize
    return skip + pageSize >= total
  }, [page, pageSize, total])

  return (
    <div>
      <div className="flex justify-between">
        <input
          placeholder="Search products"
          className="w-full p-2 rounded-md border"
          value={search}
          oninput={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          disabled={products.pending}
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
        fallback={(error) => (
          <>
            <div>Error loading products: {error.message}</div>
            <button onclick={() => products.refresh()}>Retry</button>
          </>
        )}
      >
        <Suspense
          data={products.data}
          fallback={
            <div>
              {search
                ? `Loading products for "${search}"...`
                : "Loading all products..."}
            </div>
          }
        >
          {(pdata) => (
            <table className="w-full">
              <tbody>
                {pdata.products.map((product) => (
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
          )}
        </Suspense>
      </ErrorBoundary>
      <div className="flex justify-between">
        <button
          disabled={page === 1}
          onclick={() => setPage((prev) => prev - 1)}
          className="p-2 rounded-md border disabled:opacity-50"
        >
          Prev
        </button>
        <span>page:{page}</span>
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
