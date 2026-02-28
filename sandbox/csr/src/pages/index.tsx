import {
  Fragment,
  signal,
  effect,
  Derive,
  computed,
  DevTools,
  ElementProps,
} from "kiru"

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
  return () => {
    console.log("effect cleanup")
    clearInterval(intervalId)
  }
})

const count = signal(0)
const double = computed(() => count.value * 2)
if (import.meta.env.DEV) {
  DevTools.track(count, "count")
  DevTools.track(double, "double")
  DevTools.track(text, "text")
  DevTools.track(foo, "foo")
}

export default function HomePage() {
  return (
    <>
      <div className="mb-24">
        <input bind:value={text} />
        <Fragment key="test">test 123</Fragment>
        <h1>Welcome Home!</h1>
        <Derive from={text}>{(text) => <p>{text}</p>}</Derive>
        <p>This page is wrapped by the root layout only.</p>
        <p>
          You can see the navigation header and footer from the root layout.
        </p>
      </div>
      <p>Child</p>
      <MyButton>Click me</MyButton>
    </>
  )
}

const MyButton: Kiru.FC<ElementProps<"button">> = () => {
  const timesClicked = signal(0)
  const handleClick = () => {
    timesClicked.value++
  }

  return ({ children, ...props }) => (
    <button onclick={(e) => (handleClick(), props.onclick?.(e))} {...props}>
      {children}
      {timesClicked}
    </button>
  )
}
