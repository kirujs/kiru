import { defineHeadContent } from "kiru/router"

export const head = defineHeadContent({ title: "E2E SSR From page head export" })

export default function HeadOverridePage() {
  return (
    <p data-testid="ssr-head-override">
      Page head export overrides route title on client navigation
    </p>
  )
}
