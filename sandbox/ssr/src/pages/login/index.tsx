import { client } from "@/api"
import "./styles.css"
import { useFileRouter } from "kiru/router"

const login = async (
  email: string,
  password: string,
  redirect?: string | string[]
) => {
  const response = await client.api.auth.login.$post({
    json: { email, password },
  })
  if (!response.ok) {
    alert(response.statusText)
    return
  }
  if (typeof redirect === "string") {
    window.location.href = redirect
    return
  }
  if (response.redirected) {
    window.location.href = response.url
    return
  }
}

export default function LoginPage() {
  const { state } = useFileRouter()
  const handleSubmit = (e: Kiru.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget),
      email = data.get("email"),
      password = data.get("password")

    if (typeof email !== "string" || typeof password !== "string") {
      alert("Email and password are required")
      return
    }

    login(email, password, state.query.redirect)
  }
  return (
    <div>
      <h1>Login Page</h1>
      <form onsubmit={handleSubmit}>
        <input type="email" required name="email" />
        <input type="password" required name="password" />
        <button type="submit">Login</button>
      </form>
    </div>
  )
}
