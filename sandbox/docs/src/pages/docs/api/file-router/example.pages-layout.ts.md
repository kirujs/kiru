```jsx
import { Link, useFileRouter } from "kiru/router"

export default function RootLayout({ children }: { children: JSX.Children }) {
  const { state } = useFileRouter()

  return (
    <>
      <nav>
        <Link to="/" className={state.pathname === "/" ? "active" : ""}>
          Home
        </Link>
        <Link
          to="/users"
          className={state.pathname === "/users" ? "active" : ""}
        >
          Users
        </Link>
      </nav>
      <main>{children}</main>
    </>
  )
}
```
