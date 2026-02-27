import { Fragment, signal, effect, Derive, Signal, computed } from "kiru"

const text = signal("Hello World!")
const foo = signal({
  foo: "bar",
  baz: [1, 2, 3],
  qux: {
    quux: "quuux",
  },
})

effect(() => {
  console.log(text.value)
  const intervalId = setInterval(() => {
    count.value++
  }, 1000)
  return () => clearInterval(intervalId)
})

const count = signal(0)
const double = computed(() => count.value * 2)
if (import.meta.env.DEV) {
  count.displayName = "count"
  double.displayName = "double"
  text.displayName = "text 123 456"
  foo.displayName = "foo"
  window.__kiru.devtools?.debugger.add(count)
  window.__kiru.devtools?.debugger.add(double)
  window.__kiru.devtools?.debugger.add(text)
  window.__kiru.devtools?.debugger.add(foo)
}

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
