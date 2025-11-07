```tsx
import { definePageConfig, useFileRouter } from "kiru/router"

export const config = definePageConfig({
  loader: {
    load: async ({ signal, params }) => {
      const response = await fetch(
        `https://dummyjson.com/users/${params.id}?select=firstName,lastName,image,email`,
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      const user = await response.json()
      return { user }
    },
  },
})

export default function UserDetailPage({ data, loading, error }) {
  const router = useFileRouter()

  if (loading) return <p>Loading...</p>
  if (error) return <p>{String(error.cause)}</p>

  return (
    <div>
      <button onclick={() => router.reload()}>Reload</button>
      <h1>User Detail</h1>
      <p>User ID: {data.user.id}</p>
      <p>
        User Name: {data.user.firstName} {data.user.lastName}
      </p>
      <img
        src={data.user.image}
        alt={data.user.firstName + " " + data.user.lastName}
        className="w-10 h-10 rounded-full"
      />
      <p>User Email: {data.user.email}</p>
      <button onclick={() => router.navigate("/")}>Back to Home</button>
    </div>
  )
}
```
