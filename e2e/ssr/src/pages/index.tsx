import { onBeforeRouteLeave, useRequestContext } from "kiru/router"
import { signal } from "kiru"
import { getServerMessage } from "./index.actions"

export default function Home() {
  const ctx = useRequestContext()
  const remoteResult = signal("")

  onBeforeRouteLeave((to) => {
    if (to.pathname === "/blocked") return false
    return
  })

  return () => (
    <>
      <p data-testid="ssr-home">SSR e2e home</p>
      <p data-testid="ssr-user">User: {ctx.user?.name ?? "none"}</p>
      <button
        data-testid="ssr-remote-button"
        onclick={async () => {
          remoteResult.value = await getServerMessage()
        }}
      >
        Call remote
      </button>
      <p data-testid="ssr-remote-result">{remoteResult}</p>
    </>
  )
}
