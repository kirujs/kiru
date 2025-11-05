```tsx
import { useSWR } from "kiru/swr"

interface User {
  id: number
  name: string
  email: string
}

const fetcher = async (url: string): Promise<User> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

function EditableUserProfile({ userId }: { userId: number }) {
  const { data, loading, error, mutate, isMutating } = useSWR(
    `/api/users/${userId}`,
    fetcher
  )

  const updateUser = async (newName: string): Promise<User> => {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
    return res.json()
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <input
        value={data.name}
        onchange={(e) => mutate(() => updateUser(e.target.value))}
        disabled={isMutating.value}
      />
      {isMutating.value && <span>Saving...</span>}
    </div>
  )
}
```
