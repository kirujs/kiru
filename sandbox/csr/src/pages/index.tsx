import { Fragment, signal, effect, Derive, Signal } from "kiru"

const text = signal("Hello World!")

effect(() => {
  console.log(text.value)
})

const count = signal(0)

setInterval(() => {
  count.value++
}, 1000)

export default function HomePage() {
  return (
    <>
      <div className="mb-24">
        <input bind:value={text} />
        <CountDisplay count={count} />
        <Fragment key="test">test 123</Fragment>
        <h1>Welcome Home!</h1>
        <Derive from={text}>{(text) => <p>{text}</p>}</Derive>
        <p>This page is wrapped by the root layout only.</p>
        <p>
          You can see the navigation header and footer from the root layout.
        </p>
      </div>
      <p>Child</p>
    </>
  )
}

interface ChildProps {
  count: Signal<number>
}
function CountDisplay({ count }: ChildProps) {
  return (
    <div>
      <p>Child</p>
      {count.value % 2 === 0 ? <CountText count={count.value} /> : null}
    </div>
  )
}

function CountText({ count }: { count: number }) {
  return <p>Count: {count}</p>
}
