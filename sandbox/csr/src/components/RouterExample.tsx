import { useState } from "kaioken"
import { useRouter, Link, Router, Route } from "kaioken/router"

export default function RouterExample() {
  const [count, setCount] = useState(0)
  const {
    params,
    query: { sort = "desc" },
  } = useRouter()
  console.log("RouterTest", params, sort)
  return (
    <div>
      <p>query: {sort}</p>
      <p>params: {JSON.stringify(params, null, 2)}</p>
      <p>count: {count}</p>
      <button onclick={() => setCount((c) => c + 1)}>+</button>
      <Link to={`/?sort=${sort}`} inherit>
        Home
      </Link>
      <Link to={`/child-route/69?sort=${sort}`} inherit>
        Child Route
      </Link>
      <Router>
        <Route path="/" element={<h2>Home</h2>} />
        <Route path="/child-route/:funny-number" element={<ChildRoute />} />
      </Router>
    </div>
  )
}

function ChildRoute() {
  console.log("ChildRoute")
  const { params, query, setQuery } = useRouter()
  return (
    <div>
      <h2>Child Route - {params["funny-number"]}</h2>
      <button
        onclick={() =>
          setQuery({ sort: query.sort === "desc" ? "asc" : "desc" })
        }
      >
        Sort
      </button>
    </div>
  )
}
