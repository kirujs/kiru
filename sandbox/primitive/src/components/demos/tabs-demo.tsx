import { signal } from "kiru"
import { rotate } from "./utils"
import { Tabs } from "@kirujs/headless-ui"

export const TabsDemo = () => {
  const tabs = ["tab-1", "tab-2", "tab-3"]
  const tab = signal<(typeof tabs)[number]>("tab-1")
  const switchTab = () => rotate(tab, tabs)

  return () => (
    <>
      <button onclick={switchTab}>Switch Tab</button>
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
    </>
  )
}
