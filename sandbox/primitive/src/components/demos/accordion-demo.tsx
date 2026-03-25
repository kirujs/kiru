import { Show, signal } from "kiru"
import {
  Accordion,
  type AccordionContentProps,
  type AccordionHeaderProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
} from "@kirujs/headless-ui"
import { rotate } from "./utils"
import { ChevronDownIcon } from "../icons/chevron-down-icon"

const isExtraContentShown = signal(false)
const toggleExtraContent = () => {
  isExtraContentShown.value = !isExtraContentShown.value
}

export const AccordionDemo = () => {
  const sections = ["section-1", "section-2", "section-3"]
  const section = signal<(typeof sections)[number]>("section-1")
  const switchSection = () => rotate(section, sections)
  return () => (
    <>
      <button onclick={switchSection}>Switch Section</button>{" "}
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
