import { siteCodeLang } from "$/state/siteCodeLang"
import { CopyInnerText } from "$/components/CopyInnerText"
import { TabGroup } from "$/components/TabGroup"
import { match } from "lit-match"
import { signal } from "kiru"
import ExampleDocument from "./example.document.md"
import ExampleViteConfig from "./example.vite.config.md"
import ConfigInfo from "./setting-up.ssg-config-info.md"
import { CalloutBlock } from "$/components/atoms/CalloutBlock"

const selectedTab = signal<"vite.config" | "src/pages/document">("vite.config")

export function SettingUpSSG() {
  return (
    <div className="p-2 bg-black/30 rounded-md">
      <div className="text-neutral-300 mb-2 block text-sm">
        <i className="block">
          With SSG, configure the <code>ssg</code> option in your Vite config.
          Kiru automatically utilizes Vite's <code>import.meta.glob</code>{" "}
          feature to discover all pages and layouts in your application.
        </i>
      </div>
      <TabGroup
        items={["vite.config", "src/pages/document"] as const}
        onSelect={(value) => (selectedTab.value = value)}
        value={selectedTab.value}
        itemSuffix={(item) =>
          `.${siteCodeLang.value}${item === "src/pages/document" ? "x" : ""}`
        }
      />
      <CopyInnerText>
        {match(selectedTab.value)
          .with("src/pages/document", () => <ExampleDocument />)
          .with("vite.config", () => <ExampleViteConfig />)
          .exhaustive()}
      </CopyInnerText>
      <CalloutBlock variant="info">
        SSG requires that you create a <code>document</code> file. This replaces
        the default <code>index.html</code> file that comes with Vite and
        enables you to use Kiru's <code>{"<Head.Outlet>"}</code> component for
        rendering content in the <code>{"<head>"}</code> tag from your pages.
      </CalloutBlock>
      <small>
        <ConfigInfo />
      </small>
    </div>
  )
}
