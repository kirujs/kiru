import { useSignal, useState } from "kiru"

export default function TodosPage() {
  const inputText = useSignal("")
  const [items, setItems] = useState<{ text: string }[]>([
    { text: "buy coffee" },
    { text: "walk the dog" },
    { text: "push the latest commits" },
  ])

  function addItem() {
    setItems((items) => [...items, { text: inputText.peek() }])
    inputText.value = ""
  }

  return (
    <div id="todos">
      <input bind:value={inputText} />
      <button onclick={addItem} />
      <ul>
        {items.map((item) => (
          <li>{item.text}</li>
        ))}
      </ul>
    </div>
  )
}
