import { siteCodeLang } from "$/state/siteCodeLang"
import ExampleMain from "./example.main.md"
import { CopyInnerText } from "$/components/CopyInnerText"
import { TabGroup } from "$/components/TabGroup"
import ConfigInfo from "./setting-up.csr-config-info.md"

export function SettingUpCSR() {
  return (
    <div className="p-2 bg-black/30 rounded-md">
      <i className="text-sm text-neutral-300">
        With CSR, use Vite's <code>import.meta.glob</code> feature to discover
        all pages and layouts in your application.
      </i>
      <TabGroup
        items={["src/main"] as const}
        onSelect={() => {}}
        value="src/main"
        itemSuffix={(item) =>
          `.${siteCodeLang.value}${item === "src/main" ? "x" : ""}`
        }
      />
      <CopyInnerText>
        <ExampleMain />
      </CopyInnerText>
      <small>
        <ConfigInfo />
      </small>
    </div>
  )
}
