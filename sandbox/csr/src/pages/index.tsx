import { Fragment, signal, effect, Derive, ElementProps } from "kiru"

const text = signal("Hello World!")

effect(() => {
  console.log(text.value)
})

export default function HomePage() {
  return (
    <div>
      <input bind:value={text} />
      <Fragment key="test">test 123</Fragment>
      <h1>Welcome Home!</h1>
      <Derive from={text}>{(text) => <p>{text}</p>}</Derive>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
