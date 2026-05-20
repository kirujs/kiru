import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addLocale,
  shouldPrefixLocale,
  stripLocale,
} from "../../router/i18n/localeRouting.js"

const routing = {
  default: "en",
  prefixes: ["en", "fr"],
  localePrefix: "as-needed" as const,
  invalidLocale: "redirect" as const,
}

describe("i18n localeRouting", () => {
  it("stripLocale removes prefix", () => {
    assert.deepEqual(stripLocale("/fr/about", routing), {
      locale: "fr",
      pathname: "/about",
    })
  })

  it("addLocale prepends prefix for non-default with as-needed", () => {
    assert.equal(addLocale("/about", "fr", routing), "/fr/about")
    assert.equal(addLocale("/about", "en", routing), "/about")
    assert.equal(addLocale("/", "en", routing), "/")
  })

  it("addLocale always prefixes when localePrefix is always", () => {
    const always = { ...routing, localePrefix: "always" as const }
    assert.equal(addLocale("/about", "en", always), "/en/about")
  })

  it("addLocale never prefixes when localePrefix is never", () => {
    const never = { ...routing, localePrefix: "never" as const }
    assert.equal(addLocale("/about", "fr", never), "/about")
  })

  it("shouldPrefixLocale reflects policy", () => {
    assert.equal(shouldPrefixLocale("en", routing), false)
    assert.equal(shouldPrefixLocale("fr", routing), true)
  })
})
