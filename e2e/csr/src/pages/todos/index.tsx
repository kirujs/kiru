import { For, signal } from "kiru"

export default function TodosPage() {
  const inputText = signal("")
  const items = signal<{ text: string }[]>([
    { text: "buy coffee" },
    { text: "walk the dog" },
    { text: "push the latest commits" },
  ])

  function addItem() {
    items.value = [...items.value, { text: inputText.peek() }]
    inputText.value = ""
  }

  return (
    <div id="todos">
      <input bind:value={inputText} />
      <button onclick={addItem} />
      <ul>
        <For each={items}>{(item) => <li>{item.text}</li>}</For>
      </ul>
    </div>
  )
}
