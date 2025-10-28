import { Link } from "kiru/router"

const users = [
  {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    image: "https://via.placeholder.com/150",
  },
]

export default function Page() {
  return (
    <div>
      <h1>Users</h1>
      <p>This is the users page</p>
      <div className="flex flex-col gap-2">
        {users.map((user) => (
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
