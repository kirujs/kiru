import { defineISR } from "kiru/router"

/** No build-time HTML for this route — production must 404. */
export const isr = defineISR({ dynamic: "force-static" })

export default function PprForceStaticDemo() {
  return (
    <main data-testid="ppr-force-static-demo">
      <p>Unreachable without prerender HTML</p>
    </main>
  )
}
