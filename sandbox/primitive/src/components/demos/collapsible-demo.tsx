import { Collapsible } from "@kirujs/headless-ui"

export const CollapsibleDemo = () => {
  return (
    <Collapsible.Root defaultOpen className="collapsible">
      <Collapsible.Trigger>Collapsible Trigger</Collapsible.Trigger>
      <Collapsible.Content className="collapsible-content">
        <p>Collapsible Content</p>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
