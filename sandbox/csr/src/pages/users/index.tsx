import { definePageConfig, Link, PageProps } from "kiru/router"

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
      const response = await fetch(
        "https://dummyjson.com/users?limit=5&skip=10&select=firstName,lastName,image",
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      const { users } = (await response.json()) as FetchUsersResponse
      return { users: users.splice(0, 5) }
    },
    transition: false,
    cache: {
      type: "memory",
      ttl: 1000 * 60 * 5, // 5 minutes
    },
  },
})

export default function Page({
  data,
  loading,
  error,
}: PageProps<typeof config>) {
  if (loading) return <p>Loading...</p>
  if (error) return <p>{String(error.cause)}</p>

  return (
    <div>
      <h1>Users</h1>
      <p>This is the users page</p>
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
