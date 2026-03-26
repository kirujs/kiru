import { signal } from "kiru"
import { AccordionDemo } from "./components/demos/accordion-demo"
import { CollapsibleDemo } from "./components/demos/collapsible-demo"
import { TabsDemo } from "./components/demos/tabs-demo"
import { CheckboxDemo } from "./components/demos/checkbox-demo"
import { RadioGroupDemo } from "./components/demos/radio-group-demo"
import { SliderDemo } from "./components/demos/slider-demo"
import { SwitchDemo } from "./components/demos/switch-demo"

const demos = {
  accordion: AccordionDemo,
  checkbox: CheckboxDemo,
  collapsible: CollapsibleDemo,
  radioGroup: RadioGroupDemo,
  slider: SliderDemo,
  switch: SwitchDemo,
  tabs: TabsDemo,
}

const demo = signal<keyof typeof demos>("accordion")
const setDemoFromWindow = () => {
  const fromParams = new URLSearchParams(window.location.search).get("demo")
  if (fromParams && fromParams in demos) {
    demo.value = fromParams as keyof typeof demos
  } else {
    demo.value = "accordion"
  }
}
setDemoFromWindow()
window.addEventListener("popstate", setDemoFromWindow)

export const App = () => {
  return (
    <div style="display:flex; gap:1rem; flex-direction:column">
      <select
        name="demo-selection"
        bind:value={demo}
        onchange={(e) => {
          window.history.pushState(null, "", "/?demo=" + e.target.value)
        }}
      >
        <option value="accordion">Accordion</option>
        <option value="checkbox">Checkbox</option>
        <option value="collapsible">Collapsible</option>
        <option value="radioGroup">Radio Group</option>
        <option value="slider">Slider</option>
        <option value="switch">Switch</option>
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
    case "checkbox":
      return <demos.checkbox />
    case "collapsible":
      return <demos.collapsible />
    case "radioGroup":
      return <demos.radioGroup />
    case "slider":
      return <demos.slider />
    case "switch":
      return <demos.switch />
    case "tabs":
      return <demos.tabs />
  }
}
