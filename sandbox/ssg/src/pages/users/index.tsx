import { definePageConfig, Link, PageProps, useFileRouter } from "kiru/router"
import { Head } from "kiru/router"

interface FetchUsersResponse {
  users: {
    id: number
    firstName: string
    lastName: string
    image: string
  }[]
}

export const config = definePageConfig({
  loader: {
    load: async ({ signal }) => {
      console.log("Fetching users")
      const response = await fetch(
        "https://dummyjson.com/users?select=firstName,lastName,image",
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      return (await response.json()) as FetchUsersResponse
    },
    mode: "static",
  },
  generateStaticParams: async () => {
    const response = await fetch("https://dummyjson.com/users?select=id")
    if (!response.ok) throw new Error(response.statusText)
    const users = await response.json()
    return users.users.map((user: any) => ({ id: user.id.toString() }))
  },
})

export default function Page({
  data,
  loading,
  error,
}: PageProps<typeof config>) {
  const router = useFileRouter()

  if (loading) return <p>Loading...</p>
  if (error)
    return (
      <>
        <Head.Content>
          <title>Failed to load users</title>
        </Head.Content>
        <p>{String(error.cause)}</p>
      </>
    )

  return (
    <div>
      <Head.Content>
        <title>Users - {data.users.length}</title>
      </Head.Content>
      <h1>Users</h1>
      <div className="flex gap-2">
        <p>This is the users page</p>
        <button onclick={() => router.invalidate("/users")}>
          Invalidate this page
        </button>
        <button onclick={() => router.invalidate("/users/1")}>
          Invalidate User 1
        </button>
        <button onclick={() => router.invalidate("/users/[id]")}>
          Invalidate Users
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {data.users.map((user) => (
          <div key={user.id} className="flex gap-2">
            <Link to={`/users/${user.id}`}>
              {user.firstName} {user.lastName}
            </Link>
            <img
              src={user.image}
              alt={user.firstName + " " + user.lastName}
              className="w-10 h-10 rounded-full"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
