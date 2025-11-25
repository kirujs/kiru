import { Link, useFileRouter, useRequestContext } from "kiru/router"
import { client } from "@/api"

export default function RootLayout({ children }: { children: JSX.Children }) {
  const { state } = useFileRouter()

  return (
    <div className="min-h-screen flex flex-col gap-20 justify-between px-10 py-20">
      <h1 className="text-3xl md:text-4xl md:leading-normal font-bold text-center">
        Welcome to your Kiru SSR app!
      </h1>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link to="/" className={state.pathname === "/" ? "" : "underline"}>
          Home
        </Link>
        <Link
          to="/todos"
          className={state.pathname === "/todos" ? "" : "underline"}
        >
          Todos
        </Link>
        <Link
          to="/about"
          className={state.pathname === "/about" ? "" : "underline"}
        >
          About
        </Link>
        <Link
          to="/dynamic/123"
          className={state.pathname.startsWith("/dynamic") ? "" : "underline"}
        >
          Dynamic
        </Link>
        <Link
          to="/streaming"
          className={state.pathname === "/streaming" ? "" : "underline"}
        >
          Streaming
        </Link>
        <Link
          to="/products"
          className={state.pathname === "/products" ? "" : "underline"}
        >
          Products
        </Link>
        <AuthLinks />
      </div>
      {children}
      <div className="text-center text-stone-200">
        <p>Learn at</p>
        <div className="flex gap-4 text-xl w-full justify-center">
          <a
            href="https://kirujs.dev"
            target="_blank"
            className="font-semibold flex items-center gap-1 w-full justify-center"
          >
            <img className="w-5 h-5" src="/favicon.svg" alt="kiru logo" />
            kirujs.dev
          </a>
        </div>
      </div>
    </div>
  )
}

function AuthLinks() {
  const { state } = useFileRouter()
  const { user } = useRequestContext()

  if (!user) {
    return (
      <Link
        to="/login"
        className={state.pathname === "/login" ? "" : "underline"}
      >
        Login
      </Link>
    )
  }

  return (
    <>
      <Link
        to="/protected"
        className={state.pathname === "/protected" ? "" : "underline"}
      >
        Protected
      </Link>
      <Link
        prefetchJs={false}
        to="/logout"
        onclick={(e) => {
          e.preventDefault()
          client.api.auth.logout.$get().then((res) => {
            window.location.href = res.url
          })
        }}
        className={state.pathname === "/logout" ? "" : "underline"}
      >
        Logout
      </Link>
    </>
  )
}
