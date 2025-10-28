const data = {
  user: {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    image: "https://via.placeholder.com/150",
    email: "john.doe@example.com",
  },
}

export default function UserDetailPage() {
  return (
    <div>
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
    </div>
  )
}
