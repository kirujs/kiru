import { memo, signal, useModel } from "kaioken"
import { Button } from "./atoms/Button"

const count = signal(0)

export default function MemoExample() {
  return (
    <div id="memo">
      <span>Count: {count.value}</span>
      <Button onclick={() => count.value++}>Increment</Button>
      <MemoizedComponent test="test" />
    </div>
  )
}

// @ts-ignore
const MemoizedComponent = memo(({ test }: { test: string }) => {
  console.log("render MemoizedComponent")
  const [ref, name] = useModel<HTMLInputElement>("")
  return (
    <div id="memo-dynamic" className="flex flex-col">
      <input ref={ref} type="text" />
      <span>Name: {name}</span>
    </div>
  )
})
