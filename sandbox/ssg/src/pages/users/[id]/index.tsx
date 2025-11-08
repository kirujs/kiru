import { ElementProps, unwrap } from "kiru"
import { definePageConfig, Head, PageProps, useFileRouter } from "kiru/router"
import { className as cls } from "kiru/utils"

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
    mode: "client",
    cache: {
      type: "sessionStorage",
      ttl: 1000 * 60 * 5, // 5 minutes
    },
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
  if (error)
    return (
      <>
        <Head.Content>
          <title>Failed to load user</title>
        </Head.Content>
        <p>{String(error.cause)}</p>
      </>
    )

  return (
    <div>
      <Head.Content>
        <title>
          User Detail - {data.user.firstName} {data.user.lastName}
        </title>
      </Head.Content>
      <Button onclick={() => router.reload()}>Reload</Button>
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
      <div className="flex gap-2 justify-between">
        <Button onclick={() => router.navigate("/users")}>Back to Users</Button>
        <Button onclick={() => router.navigate(`/users/${data.user.id - 1}`)}>
          Prev User
        </Button>
        <Button onclick={() => router.navigate(`/users/${data.user.id + 1}`)}>
          Next User
        </Button>
      </div>
    </div>
  )
}

function Button({ className, ...props }: ElementProps<"button">) {
  return (
    <button
      className={cls(
        "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded",
        unwrap(className)
      )}
      {...props}
    />
  )
}
