import { defineISR } from "kiru/router"

export const isr = defineISR({ revalidate: false })

export default function Docs() {
  return <h1>Immutable static docs</h1>
}
