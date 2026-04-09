import { signal, resource, Derive } from "kiru"

interface User {
  id: number
  firstName: string
  lastName: string
  age: number
}

const search = signal("")
const limit = signal(10)

// able to be created globally _or_ within components
const users = resource({ search, limit }, async (src, ctx) => {
  const res = await fetch(
    `https://dummyjson.com/users/search?q=${src.search}&limit=${src.limit}`,
    { signal: ctx.signal }
  )
  return res.json() as Promise<{ users: User[] }>
})

export default function HomePage() {
  return (
    <>
      <Derive from={users} fallback={<div>Loading...</div>}>
        {(data, isStale) => (
          <div style={{ opacity: isStale ? 0.5 : 1 }}>
            <ul>
              {data.users.map((user) => (
                <li key={user.id}>
                  {user.firstName} {user.lastName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Derive>
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
