import { computed, Derive, signal } from "kiru"
import { AccordionDemo } from "./components/demos/accordion-demo"
import { CollapsibleDemo } from "./components/demos/collapsible-demo"
import { TabsDemo } from "./components/demos/tabs-demo"
import { CheckboxDemo } from "./components/demos/checkbox-demo"
import { RadioGroupDemo } from "./components/demos/radio-group-demo"
import { SliderDemo } from "./components/demos/slider-demo"
import { SwitchDemo } from "./components/demos/switch-demo"
import { ProgressDemo } from "./components/demos/progress-demo"
import { SeparatorDemo } from "./components/demos/separator-demo"

interface Demo {
  id: string
  component: Kiru.FC
  displayName: string
}

const demos: Demo[] = [
  { id: "accordion", component: AccordionDemo, displayName: "Accordion" },
  { id: "checkbox", component: CheckboxDemo, displayName: "Checkbox" },
  { id: "collapsible", component: CollapsibleDemo, displayName: "Collapsible" },
  { id: "radioGroup", component: RadioGroupDemo, displayName: "Radio Group" },
  { id: "progress", component: ProgressDemo, displayName: "Progress" },
  { id: "separator", component: SeparatorDemo, displayName: "Separator" },
  { id: "slider", component: SliderDemo, displayName: "Slider" },
  { id: "switch", component: SwitchDemo, displayName: "Switch" },
  { id: "tabs", component: TabsDemo, displayName: "Tabs" },
]

const demoId = signal(demos[0].id)
const demoComponent = computed(() => {
  const match = demos.find((d) => d.id === demoId.value)
  if (!match) return demos[0].component
  return match.component
})

const setDemoFromWindow = () => {
  const fromParams = new URLSearchParams(window.location.search).get("demo")
  if (fromParams && demos.some((d) => d.id === fromParams)) {
    demoId.value = fromParams
  } else {
    demoId.value = demos[0].id
  }
}
setDemoFromWindow()
window.addEventListener("popstate", setDemoFromWindow)

export const App = () => (
  <>
    <div>
      <select
        name="demo-id"
        bind:value={demoId}
        onchange={(e) => {
          window.history.pushState(null, "", "/?demo=" + e.target.value)
        }}
      >
        {demos.map(({ id, displayName }) => (
          <option value={id}>{displayName}</option>
        ))}
      </select>
    </div>
    <Derive from={demoComponent}>{(Component) => <Component />}</Derive>
  </>
)
