import { Router, Route, Link } from "kiru/router"
import { ROUTES } from "./routes"
import { Suspense, usePromise, useState } from "kiru"

interface Product {
  id: number
  title: string
  thumbnail: string
}

async function loadProduct(id: number, signal: AbortSignal): Promise<Product> {
  const request = await fetch(`https://dummyjson.com/products/${id}`, {
    signal,
  })
  if (!request.ok) throw new Error(request.statusText)
  return request.json()
}

function Home() {
  const [productId, setProductId] = useState(4)
  const productDataPromise = usePromise(
    ({ signal }) => loadProduct(productId, signal),
    [productId]
  )

  return (
    <div>
      <Suspense data={[productDataPromise]} fallback={<div>Loading...</div>}>
        {(pdata) => (
          <div>
            <h1>{pdata.title}</h1>
            <img src={pdata.thumbnail} />
          </div>
        )}
      </Suspense>
      <button
        disabled={productId === 1}
        onclick={() => setProductId((prev) => prev - 1)}
      >
        Prev
      </button>
      <button onclick={() => setProductId((prev) => prev + 1)}>Next</button>
    </div>
  )
}

function Nav() {
  return (
    <nav className=" min-h-screen p-2  mb-5 h-full">
      <div className="sticky top-0 flex flex-col gap-2">
        <Link to={"/"}>Home</Link>
        {Object.entries(ROUTES).map(([path, route]) => (
          <Link key={route.title} to={path}>
            {route.title}
          </Link>
        ))}
        <Link to="/unhandled-route">Unhandled route</Link>
      </div>
    </nav>
  )
}

export function App() {
  return (
    <>
      <Nav />
      <main className="flex items-center justify-center flex-grow w-full">
        <Router>
          <Route path="/" element={<Home />} />
          {Object.entries(ROUTES).map(([path, route]) => (
            <Route
              key={path}
              path={path}
              element={<route.component />}
              fallthrough={route.fallthrough}
            />
          ))}
          <Route path="*" element={<h1>Uh-oh! Page not found :C</h1>} />
        </Router>
      </main>
    </>
  )
}
