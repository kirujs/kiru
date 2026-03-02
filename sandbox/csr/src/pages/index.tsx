import { computed, signal } from "kiru"

export default function HomePage() {
  const color = signal("#23a964")
  const lightness = signal(0)
  const backgroundColor = computed(() =>
    ColorLuminance(color.value, lightness.value)
  )

  return () => (
    <div className="flex flex-col gap-4">
      <span className="p-2 rounded-lg" style={{ color, backgroundColor }}>
        Hello World
      </span>
      <input type="color" bind:value={color} />
      <input type="range" bind:value={lightness} min={-1} max={1} step={0.1} />
    </div>
  )
}

function ColorLuminance(hex: string, lum: number) {
  hex = String(hex).replace(/[^0-9a-f]/gi, "")

  let rgb = "#",
    c,
    i
  for (i = 0; i < 3; i++) {
    c = parseInt(hex.substr(i * 2, 2), 16)
    // Apply luminosity factor and clamp values between 0 and 255
    c = Math.round(Math.min(Math.max(0, c + c * lum), 255)).toString(16)
    // Pad with leading zero if necessary
    rgb += ("00" + c).substr(c.length)
  }

  return rgb
}
