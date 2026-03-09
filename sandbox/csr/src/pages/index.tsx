import { signal, resource, ErrorBoundary, Derive, DevTools } from "kiru"

interface User {
  id: number
  firstName: string
  lastName: string
  age: number
}

const userId = signal(1)
const user = resource<User>(async (signal) => {
  const res = await fetch(`https://dummyjson.com/users/${userId}`, {
    signal,
  })
  return res.json()
})

DevTools.track(user, "User")

export default function HomePage() {
  return (
    <>
      <ErrorBoundary fallback={<div>Error!</div>}>
        <Derive from={user} fallback={<div>Loading...</div>}>
          {(user, isStale) => (
            <div style={{ opacity: isStale ? 0.5 : 1 }}>
              Hello {`${user.firstName} ${user.lastName}`} (age: {user.age})
            </div>
          )}
        </Derive>
      </ErrorBoundary>
      <button onclick={() => userId.value++}>Next User</button>
      <button onclick={() => user.refetch()}>Refetch</button>
    </>
  )
}
