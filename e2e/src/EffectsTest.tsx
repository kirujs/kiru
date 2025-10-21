import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "kiru"

const LogCtx = createContext<(msg: string) => void>(null as any)

const useLog = () => useContext(LogCtx)

export function EffectsTest() {
  const logs = useRef<string[]>([])

  const addLog = (msg: string) => {
    logs.current.push(msg)
  }
  useEffect(() => {
    const output = document.getElementById("output")
    output!.innerHTML = logs.current.join("\n")
  }, [])
  return (
    <div>
      <LogCtx.Provider value={addLog}>
        <Parent />
      </LogCtx.Provider>
      <pre style="font-family: monospace; text-align: left; padding: .5rem; background: #111">
        <code id="output"></code>
      </pre>
    </div>
  )
}

function Parent() {
  const log = useLog()
  useEffect(() => {
    log("app mounted - post")
  }, [])
  useLayoutEffect(() => {
    log("app mounted - pre")
  }, [])
  return (
    <div>
      Parent
      <Child />
      <GrandChild />
    </div>
  )
}

function Child() {
  const log = useLog()
  useEffect(() => {
    log("child mounted - post")
  }, [])
  useEffect(() => {
    log("child mounted - post 2")
  }, [])
  useLayoutEffect(() => {
    log("child mounted - pre")
  }, [])
  useLayoutEffect(() => {
    log("child mounted - pre 2")
  }, [])
  return (
    <div>
      Child
      <GrandChild />
    </div>
  )
}

function GrandChild() {
  const log = useLog()
  useEffect(() => {
    log("grandchild mounted - post")
  }, [])
  useLayoutEffect(() => {
    log("grandchild mounted - pre")
  }, [])
  return (
    <div>
      <div>GrandChild</div>
    </div>
  )
}
