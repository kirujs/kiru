import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addLocale,
  shouldPrefixLocale,
  stripLocale,
} from "../../router/localePolicy.js"

const locales = {
  default: "en",
  prefixes: ["en", "fr"],
  localePrefix: "as-needed" as const,
}

describe("localePolicy", () => {
  it("stripLocale removes prefix", () => {
    assert.deepEqual(stripLocale("/fr/about", locales), {
      locale: "fr",
      pathname: "/about",
    })
  })

  it("addLocale prepends prefix for non-default with as-needed", () => {
    assert.equal(addLocale("/about", "fr", locales), "/fr/about")
    assert.equal(addLocale("/about", "en", locales), "/about")
    assert.equal(addLocale("/", "en", locales), "/")
  })

  it("addLocale always prefixes when localePrefix is always", () => {
    const always = { ...locales, localePrefix: "always" as const }
    assert.equal(addLocale("/about", "en", always), "/en/about")
  })

  it("addLocale never prefixes when localePrefix is never", () => {
    const never = { ...locales, localePrefix: "never" as const }
    assert.equal(addLocale("/about", "fr", never), "/about")
  })

  it("shouldPrefixLocale reflects policy", () => {
    assert.equal(shouldPrefixLocale("en", locales), false)
    assert.equal(shouldPrefixLocale("fr", locales), true)
  })
})
