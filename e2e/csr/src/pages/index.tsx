import { Link } from "kiru/router"

export default function HomePage() {
  return (
    <div data-testid="home-page">
      <h2>Home</h2>
      <p>
        <Link
          to="/photos/[id]"
          params={{ id: "123" }}
          data-testid="home-photo-link-123"
        >
          Open photo 123
        </Link>
      </p>
      <p>
        <Link
          to="/users/[id]"
          params={{ id: "99" }}
          data-testid="home-user-link-99"
        >
          View user 99 (full page)
        </Link>
      </p>
    </div>
  )
}
