import { Signal, signal, useComputed, useState, watch } from "kiru"

const text = signal("Hello World!")
const text2 = signal("Hello World!2")

watch(() => {
  console.log(text.value)
})

export default function HomePage() {
  const [selectedText, setSelectedText] = useState(text)
  return (
    <div>
      <input bind:value={selectedText} />
      <button
        onclick={() => setSelectedText(selectedText === text ? text2 : text)}
      >
        Toggle
      </button>
      <h1>Welcome Home!</h1>
      <p>This page is wrapped by the root layout only.</p>
      <p>You can see the navigation header and footer from the root layout.</p>
      <TextDisplay text={selectedText} />
    </div>
  )
}

function TextDisplay({ text }: { text: Signal<string> }) {
  console.log("TextDisplay")
  const [suffix, setSuffix] = useState("")
  const textValue = useComputed(() => {
    console.log("textValue compute")
    return text.value + suffix
  }, [suffix, text])

  return (
    <>
      <div>
        <p>{textValue}</p>
        <input
          type="text"
          placeholder="suffix"
          value={suffix}
          oninput={(e) => setSuffix(e.target.value)}
        />
      </div>
    </>
  )
}
