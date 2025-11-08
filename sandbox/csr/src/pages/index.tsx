import { signal, watch } from "kiru"

const text = signal("Hello World!")

watch(() => {
  console.log(text.value)
})

export default function HomePage() {
  return (
    <div>
      <input bind:value={text} />
      <h1>Welcome Home!</h1>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
    </div>
  )
}
