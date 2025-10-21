import { createContext, memo, useContext, useState } from "kiru"

type CountContextType = {
  count: number
  setCount: (count: Kiru.StateSetter<number>) => void
}
const CountContext = createContext<CountContextType>(null!)
const useCount = () => useContext(CountContext)

export function MemoTest() {
  const [count, setCount] = useState(0)
  return (
    <div id="memo">
      <span>Count: {count}</span>
      <button onclick={() => setCount((prev) => prev + 1)}>Increment</button>
      <PropsChangedMemo count={1} />
      {count % 2 === 0 && <ToggledMemo />}
      <CountContext.Provider value={{ count, setCount }}>
        <ContextConsumerMemo />

        <MemoNode depth={0}>
          <MemoNode depth={1}>
            <MemoNode depth={2}>
              <ContextConsumerMemo id="memo-deep-context-consumer" />
            </MemoNode>
          </MemoNode>
        </MemoNode>
      </CountContext.Provider>
    </div>
  )
}

let propsChangedRenders = 0
const PropsChangedMemo = memo(({ count }: { count: number }) => {
  return (
    <div id="memo-props" className="flex flex-col">
      <div>Memo Demo {count}</div>
      <span>Render Count: {++propsChangedRenders}</span>
    </div>
  )
})

let toggledRenders = 0
const ToggledMemo = memo(function MemoDynamic() {
  return (
    <div id="memo-dynamic" className="flex flex-col">
      <span>Render Count: {++toggledRenders}</span>
    </div>
  )
})

let contextConsumerRenders = new Map<string, number>([])
const ContextConsumerMemo = memo(function MemoContextConsumer({
  id = "memo-context-consumer",
}: {
  id?: string
}) {
  const { count, setCount } = useCount()
  if (!contextConsumerRenders.has(id)) {
    contextConsumerRenders.set(id, 1)
  } else {
    contextConsumerRenders.set(id, contextConsumerRenders.get(id)! + 1)
  }
  return (
    <div id={id}>
      <button onclick={() => setCount((prev) => prev + 1)}>
        Increment: {count}
      </button>
      <span>Render Count: {contextConsumerRenders.get(id)}</span>
    </div>
  )
})

const memoNodeRenders = new Map<number, number>([
  [0, 0],
  [1, 0],
  [2, 0],
])
const MemoNode: Kiru.FC<{ depth: number }> = memo(
  function MemoNode({ children, depth }) {
    const renders = memoNodeRenders.get(depth)! + 1
    memoNodeRenders.set(depth, renders)
    return (
      <div data-memo-depth={depth} data-renders={renders}>
        {children}
      </div>
    )
  },
  () => true
)
