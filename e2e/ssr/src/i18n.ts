import { createI18nConfig } from "kiru/router"

const i18n = createI18nConfig({
  locales: ["en", "fr"],
  defaultLocale: "en",
  load: {
    en: () => import("./i18n/en.json"),
    fr: () => import("./i18n/fr.json"),
  },
})

declare module "kiru/router" {
  interface Internationalization {
    config: typeof i18n
  }
}

export default i18n
