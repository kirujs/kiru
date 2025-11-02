import { definePageConfig, PageProps, useFileRouter } from "kiru/router"

interface FetchUserResponse {
  id: number
  firstName: string
  lastName: string
  image: string
  email: string
}

export const config = definePageConfig({
  loader: {
    load: async ({ signal, params }) => {
      const response = await fetch(
        `https://dummyjson.com/users/${params.id}?select=firstName,lastName,image,email`,
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      const user = (await response.json()) as FetchUserResponse
      return { user }
    },
    mode: "static",
  },
  title: (_, data) => {
    if (!data) {
      return "Failed to load user"
    }
    return `${data.user.firstName} ${data.user.lastName}`
  },
  generateStaticParams: async () => {
    const response = await fetch("https://dummyjson.com/users?select=id")
    if (!response.ok) throw new Error(response.statusText)
    const users = await response.json()
    return users.users.map((user: any) => ({ id: user.id.toString() }))
  },
})

export default function UserDetailPage({
  data,
  loading,
  error,
}: PageProps<typeof config>) {
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
      <button onclick={() => router.navigate("/users")}>Back to Users</button>
    </div>
  )
}
