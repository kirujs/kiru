import { useAsync } from "kiru"
import { useFileRouter } from "kiru/router"

interface FetchUserResponse {
  id: number
  firstName: string
  lastName: string
  image: string
  email: string
}

export default function UserDetailPage() {
  const router = useFileRouter()

  const user = useAsync<FetchUserResponse>(
    () =>
      fetch(
        `https://dummyjson.com/users/${router.state.params.id}?select=firstName,lastName,image,email`
      ).then((res) => res.json()),
    []
  )

  return (
    <div>
      <h1>User Detail</h1>
      <p>User ID: {user.data?.id}</p>
      <p>
        User Name: {user.data?.firstName} {user.data?.lastName}
      </p>
      <img
        src={user.data?.image}
        alt={user.data?.firstName + " " + user.data?.lastName}
        className="w-10 h-10 rounded-full"
      />
      <p>User Email: {user.data?.email}</p>
      <button onclick={() => router.navigate("/users")}>Back to Users</button>
    </div>
  )
}
