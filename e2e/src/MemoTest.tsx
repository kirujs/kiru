import { memo, signal, useState } from "kaioken"

export function MemoTest() {
  const [count, setCount] = useState(0)
  return (
    <div id="memo">
      <span>Count: {count}</span>
      <button onclick={() => setCount((prev) => prev + 1)}>Increment</button>
      <WhenPropsChangeMemo count={1} />
      {count % 2 === 0 && <DynamicRenderMemo />}
    </div>
  )
}

let renders = 0
const WhenPropsChangeMemo = memo(({ count }: { count: number }) => {
  return (
    <div id="memo-props" className="flex flex-col">
      <div>Memo Demo {count}</div>
      <span>Render Count: {++renders}</span>
    </div>
  )
})

const renders2 = signal(0)
const DynamicRenderMemo = memo(() => {
  const [count, setCount] = useState(123)
  const r = renders2.peek()
  renders2.sneak(renders2.peek() + 1)
  return (
    <div id="memo-dynamic" className="flex flex-col">
      <span className="text-red-500">Render Count: {r}</span>
      <span>Count: {count}</span>
      <button onclick={() => setCount((prev) => prev + 1)}>Increment</button>
    </div>
  )
})
