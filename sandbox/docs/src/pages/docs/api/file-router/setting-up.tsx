import { TabGroup } from "$/components/TabGroup"
import { signal } from "kiru"
import { match } from "lit-match"
import { SettingUpSSG } from "./setting-up.ssg"
import { SettingUpCSR } from "./setting-up.csr"

const selectedTab = signal<"SSG" | "CSR">("CSR")

export function SettingUp() {
  return (
    <>
      <TabGroup
        items={["CSR", "SSG"] as const}
        onSelect={(value) => (selectedTab.value = value)}
        value={selectedTab.value}
      />
      {match(selectedTab.value)
        .with("CSR", () => <SettingUpCSR />)
        .with("SSG", () => <SettingUpSSG />)
        .exhaustive()}
    </>
  )
}
