import type { CreateRouterAppOptions } from "kiru/router/csr"
import ContextPending from "./ContextPending.tsx"
import { e2eResolveContext } from "./e2eAuth.js"
/** Router options shared by CSR and SSG context e2e apps. */
export function createContextAppOptions(
  base: Pick<CreateRouterAppOptions, "routes" | "container" | "i18n">
): CreateRouterAppOptions {
  return {
    ...base,
    resolveContext: e2eResolveContext,
    contextPendingFallback: () => <ContextPending />,
    stickyContext: false,
  }
}
