import { signal } from "kiru"
import { AccordionDemo } from "./components/demos/accordion-demo"
import { CollapsibleDemo } from "./components/demos/collapsible-demo"
import { TabsDemo } from "./components/demos/tabs-demo"

const demos = {
  accordion: AccordionDemo,
  collapsible: CollapsibleDemo,
  tabs: TabsDemo,
}
const demo = signal<keyof typeof demos>("accordion")

export const App = () => {
  return (
    <div style="display:flex; gap:1rem; flex-direction:column">
      <select bind:value={demo}>
        <option value="accordion">Accordion</option>
        <option value="collapsible">Collapsible</option>
        <option value="tabs">Tabs</option>
      </select>
      <div>
        <DemoOutlet />
      </div>
    </div>
  )
}

const DemoOutlet = () => {
  switch (demo.value) {
    case "accordion":
      return <demos.accordion />
    case "collapsible":
      return <demos.collapsible />
    case "tabs":
      return <demos.tabs />
  }
}
