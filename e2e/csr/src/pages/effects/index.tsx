import { createContext, useContext, onMount, ref, onBeforeMount } from "kiru"

const LogContext = createContext<(msg: string) => void>(null as any)

const useLog = () => useContext(LogContext)

export default function EffectsPage() {
  const logs = ref<string[]>([])

  const addLog = (msg: string) => {
    logs.current.push(msg)
  }
  onMount(() => {
    const output = document.getElementById("output")
    output!.innerHTML = logs.current.join("\n")
  })
  return () => (
    <div>
      <LogContext value={addLog}>
        <Parent />
      </LogContext>
      <pre style="font-family: monospace; text-align: left; padding: .5rem; background: #111">
        <code id="output"></code>
      </pre>
    </div>
  )
}

function Parent() {
  const log = useLog()
  onMount(() => log("app mounted - post"))
  onBeforeMount(() => log("app mounted - pre"))

  return () => (
    <div>
      Parent
      <Child />
      <GrandChild />
    </div>
  )
}

function Child() {
  const log = useLog()
  onMount(() => log("child mounted - post"))
  onMount(() => log("child mounted - post 2"))
  onBeforeMount(() => log("child mounted - pre"))
  onBeforeMount(() => log("child mounted - pre 2"))
  return () => (
    <div>
      Child
      <GrandChild />
    </div>
  )
}

function GrandChild() {
  const log = useLog()
  onMount(() => log("grandchild mounted - post"))
  onBeforeMount(() => log("grandchild mounted - pre"))
  return () => (
    <div>
      <div>GrandChild</div>
    </div>
  )
}
