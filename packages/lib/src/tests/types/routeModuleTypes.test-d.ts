import type { KiruISRConfig } from "../../router/isr.js"
import type { KiruLoader } from "../../router/loaders.js"
import type { KiruPageHead } from "../../router/pageHead.js"
import type {
  ErrorModule,
  LayoutModule,
  PageModule,
} from "../../router/types.js"

/** Compile-time fixtures for page vs layout module exports. */
export const routeModuleFixtures = {
  pageBare: (() => null) satisfies PageModule,
  pageObject: {
    default: () => null,
    load: undefined as KiruLoader | undefined,
    head: undefined as KiruPageHead | undefined,
    isr: undefined as KiruISRConfig | undefined,
    generateStaticParams: undefined,
    generateSitemapParams: undefined,
  } satisfies PageModule,
  layout: {
    default: () => null,
    interceptors: undefined,
  } satisfies LayoutModule,
  error: {
    default: (_props: { error: Error }) => null,
  } satisfies ErrorModule,
}
