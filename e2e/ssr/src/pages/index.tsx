import { onBeforeRouteLeave, useRequestContext } from "kiru/router"

export default function Home() {
  const ctx = useRequestContext()

  onBeforeRouteLeave((to) => {
    if (to.pathname === "/blocked") return false
    return
  })

  return (
    <>
      <p data-testid="ssr-home">SSR e2e home</p>
      <p data-testid="ssr-user">User: {ctx.user?.name ?? "none"}</p>
    </>
  )
}
