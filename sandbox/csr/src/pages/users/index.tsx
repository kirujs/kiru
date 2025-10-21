import { Link, useAsync } from "kiru"

interface FetchUsersResponse {
  users: {
    id: number
    firstName: string
    lastName: string
    image: string
  }[]
}
export default function Page() {
  const users = useAsync<FetchUsersResponse>(
    () =>
      fetch(
        "https://dummyjson.com/users?limit=5&skip=10&select=firstName,lastName,image"
      ).then((res) => res.json()),
    []
  )
  return (
    <div>
      <h1>Users</h1>
      <p>This is the users page</p>
      <div className="flex flex-col gap-2">
        {users.data?.users.map((user) => (
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
