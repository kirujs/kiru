import { defineISR, loader } from "kiru/router"
import { nextForceDynamicHit } from "./ppr-force-dynamic-demo.state.js"

/** Prerendered at build, but production requests must SSR (skip disk). */
export const isr = defineISR({ dynamic: "force-dynamic" })

export const load = loader(async () => ({
  hit: nextForceDynamicHit(),
}))

export default function PprForceDynamicDemo({
  data,
}: {
  data: { hit: number }
}) {
  return (
    <main data-testid="ppr-force-dynamic-demo">
      <h1>PPR force-dynamic</h1>
      <p data-testid="ppr-force-dynamic-hit">{data.hit}</p>
    </main>
  )
}
