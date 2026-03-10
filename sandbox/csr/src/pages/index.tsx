import { signal, resource, ErrorBoundary, Derive, computed, setup } from "kiru"

interface User {
  id: number
  firstName: string
  lastName: string
  age: number
}

//const userId = signal(1)
const limit = signal(4)
const search = signal("")
const searchParams = computed(() => {
  return {
    search: search.value,
    limit: limit.value,
  }
})

const users = resource(searchParams, async (src, ctx) => {
  const res = await fetch(
    `https://dummyjson.com/users/search?q=${src.search}&limit=${src.limit}`,
    { signal: ctx.signal }
  )
  if (Math.random() > 0.5) throw new Error("Network error")
  return res.json() as Promise<{ users: User[] }>
})

export default function HomePage() {
  return () => (
    <>
      <ErrorBoundary fallback={(e) => <div>Error: {e.message}</div>}>
        <Derive from={users} fallback={<div>Loading...</div>}>
          {({ users }, isStale) => (
            <div style={{ opacity: isStale ? 0.5 : 1 }}>
              <ul>
                {users.map((user) => (
                  <li key={user.id}>
                    {user.firstName} {user.lastName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Derive>
      </ErrorBoundary>
      errSig: {users.error}
      <div>pending: {users.isPending.value.toString()}</div>
      <button onclick={() => users.refetch()}>Refetch</button>
      <input placeholder={"search"} bind:value={search} />
      <input
        type="range"
        min={1}
        max={10}
        placeholder={"limit"}
        bind:value={limit}
      />
    </>
  )
}
