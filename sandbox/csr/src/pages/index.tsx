import { signal } from "kiru"

export default function HomePage() {
  const color = signal("#23a964")
  const backgroundColor = signal("#23a964")

  return () => {
    return (
      <div className="flex flex-col gap-4">
        <span style={{ color, backgroundColor }}>Hello World</span>
        <input type="color" bind:value={color} />
        <input type="color" bind:value={backgroundColor} />
      </div>
    )
  }
}
