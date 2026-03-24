import { Show, signal } from "kiru"
import {
  Accordion,
  Tabs,
  type AccordionContentProps,
  type AccordionHeaderProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
} from "@kirujs/headless-ui"

import { ChevronDownIcon } from "./components/icons/chevron-down-icon"

const isExtraContentShown = signal(false)
const toggleExtraContent = () => {
  isExtraContentShown.value = !isExtraContentShown.value
}

const rotate = (selected: Kiru.Signal<string>, items: string[]) => {
  const idx = items.indexOf(selected.value)
  selected.value = items[(idx + 1) % items.length]
}

export const App = () => {
  const tab = signal("tab-1")
  const section = signal("section-1")

  const switchTab = () => rotate(tab, ["tab-1", "tab-2", "tab-3"])
  const switchSection = () =>
    rotate(section, ["section-1", "section-2", "section-3"])

  return () => (
    <>
      <button onclick={switchSection}>Switch Section</button>
      <Accordion.Root
        asChild
        //mode="multiple"
        collapsible
        //defaultValue="section-1"
        value={section}
        //orientation="horizontal"
      >
        <section
          className="accordion"
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AccordionItem value="section-1">
            <AccordionHeader>
              <AccordianTrigger>Section 1</AccordianTrigger>
            </AccordionHeader>
            <AccordionContent>
              <p>Content for section 1</p>
              <button onclick={toggleExtraContent}>Toggle</button>
              <Show when={isExtraContentShown}>
                <p>Extra Content</p>
              </Show>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="section-2">
            <AccordionHeader>
              <AccordianTrigger>Section 2</AccordianTrigger>
            </AccordionHeader>
            <AccordionContent>
              <p>Content for section 2</p>
              <p>Content for section 2</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="section-3">
            <AccordionHeader>
              <AccordianTrigger>Section 3</AccordianTrigger>
            </AccordionHeader>
            <AccordionContent>Content for section 3</AccordionContent>
          </AccordionItem>
        </section>
      </Accordion.Root>
      <Tabs.Root value={tab}>
        <Tabs.List>
          <Tabs.Trigger value="tab-1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab-2">Tab 2</Tabs.Trigger>
          <Tabs.Trigger value="tab-3">Tab 3</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab-1">
          <p>Content for tab 1</p>
          <input />
        </Tabs.Content>
        <Tabs.Content value="tab-2">
          <p>Content for tab 2</p>
        </Tabs.Content>
        <Tabs.Content value="tab-3">
          <p>Content for tab 3</p>
        </Tabs.Content>
      </Tabs.Root>
      <button onclick={switchTab}>Switch Tab</button>
    </>
  )
}

const AccordionItem: Kiru.FC<AccordionItemProps> = (props) => (
  <Accordion.Item className="accordion-item" {...props} />
)

const AccordionHeader: Kiru.FC<AccordionHeaderProps> = (props) => (
  <Accordion.Header className="accordion-header" {...props} />
)

const AccordianTrigger: Kiru.FC<AccordionTriggerProps> = ({
  children,
  ...props
}) => (
  <Accordion.Trigger className="accordion-trigger" {...props}>
    {children}
    <ChevronDownIcon className="accordion-chevron" />
  </Accordion.Trigger>
)

const AccordionContent: Kiru.FC<AccordionContentProps> = ({
  children,
  ...props
}) => (
  <Accordion.Content className="accordion-content" {...props}>
    <div className="inner">{children}</div>
  </Accordion.Content>
)
