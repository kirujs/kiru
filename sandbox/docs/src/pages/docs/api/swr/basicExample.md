```jsx
import { useSWR } from "kiru/swr"

const fetcher = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

function UserProfile({ userId }) {
  const { data, loading, error } = useSWR(`/api/users/${userId}`, fetcher)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>{data.name}</h2>
      <p>{data.email}</p>
    </div>
  )
}
```
