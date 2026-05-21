import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createElement } from "../../index.js"
import {
  compileRouteTree,
  createRenderer,
  createRouter,
  createStaticRouter,
  createRoute,
  createRouteTree,
  generatePublicStaticPaths,
  serverLoader,
  type PageProps,
} from "../../router/index.js"
import {
  createI18nConfig,
  getI18nLocaleRouting,
  loaderI18nFields,
  loadI18nMessages,
  resolveInvalidLocaleRedirect,
  splitAppPathname,
  splitAppPathnameDetailed,
  stripLocalePrefixFromPath,
  expandPathsForLocales,
  createI18nTranslator,
  getByPath,
} from "../../router/i18n/index.js"
import { buildLoaderContext } from "../../router/runPageLoad.js"
import { staticLoaderSignal } from "../../router/navigationScope.js"
import {
  detectLocaleFromRequest,
  resolveLocale,
} from "../../router/i18n/detect.js"
import {
  fillRouteHtmlTemplate,
  LOCALE_TOKEN,
  templateHasStaticHtmlLang,
  templateUsesLocaleToken,
} from "../../router/htmlTemplate.js"

const I18N_TPL = `<!doctype html><html lang="${LOCALE_TOKEN}"><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>`

describe("i18n", () => {
  const messages = {
    en: { title: "About", home: { greeting: "Hello" } },
    fr: { title: "À propos", home: { greeting: "Bonjour" } },
  }

  const i18n = createI18nConfig(["en", "fr"])({
    default: "en",
    load: {
      en: async () => ({ default: messages.en }),
      fr: async () => ({ default: messages.fr }),
    },
  })

  it("createI18nConfig preserves locales list and routing defaults", () => {
    assert.deepEqual(i18n.locales, ["en", "fr"])
    assert.equal(i18n.default, "en")
    assert.equal(i18n.localePrefix, "as-needed")
    assert.equal(i18n.invalidLocale, "redirect")
    assert.equal(i18n.localeDetection, true)
  })

  it("loadI18nMessages loads locale bundle", async () => {
    const fr = await loadI18nMessages(i18n, "fr")
    assert.equal(fr.title, "À propos")
    assert.equal(fr.home.greeting, "Bonjour")
  })

  it("getByPath resolves nested message keys", () => {
    assert.equal(getByPath(messages.en, "home.greeting"), "Hello")
    assert.equal(getByPath(messages.en, "missing"), undefined)
  })

  it("createI18nTranslator resolves dot-path keys only", () => {
    const t = createI18nTranslator(messages.en)
    assert.equal(t("title"), "About")
    assert.equal(t("home.greeting"), "Hello")
    assert.throws(
      () => t("missing.key" as "title"),
      /Missing or non-string translation/
    )
  })

  it("splitAppPathname strips locale for route matching", () => {
    const locales = getI18nLocaleRouting(i18n)
    assert.deepEqual(splitAppPathname("/fr/about", locales), {
      locale: "fr",
      pathname: "/about",
    })
    assert.deepEqual(splitAppPathname("/about", locales), {
      locale: "en",
      pathname: "/about",
    })
  })

  it("loaderI18nFields populates loader context", () => {
    const fields = loaderI18nFields(i18n, "fr")
    const ctx = buildLoaderContext({
      params: {},
      pathname: "/about",
      search: "",
      hash: "",
      query: {},
      context: {},
      meta: {},
      routeId: "route:1",
      signal: staticLoaderSignal(),
      ...fields,
    })
    assert.equal(ctx.locale, "fr")
    assert.deepEqual(ctx.locales, ["en", "fr"])
    assert.equal(ctx.defaultLocale, "en")
  })

  it("resolveLocale falls back from nl-BE to nl", () => {
    const nlConfig = createI18nConfig(["en", "nl"])({
      default: "en",
      load: {
        en: async () => ({ default: {} }),
        nl: async () => ({ default: {} }),
      },
    })
    assert.equal(resolveLocale(nlConfig, "nl-BE"), "nl")
  })

  it("detectLocaleFromRequest prefers cookie over Accept-Language", () => {
    const req = {
      headers: {
        get(name: string) {
          if (name === "cookie") return "KIRU_LOCALE=en"
          if (name === "accept-language") return "fr"
          return null
        },
      },
    }
    assert.equal(detectLocaleFromRequest(req, i18n), "en")
  })

  it("fillRouteHtmlTemplate substitutes {{kiru_locale}}", () => {
    const tpl = `<!doctype html><html lang="${LOCALE_TOKEN}"><head>{{kiru_head}}</head><body>{{kiru_body}}</body></html>`
    const html = fillRouteHtmlTemplate(tpl, {
      body: "<main/>",
      headHtml: "",
      locale: "fr",
    })
    assert.ok(html.includes('<html lang="fr">'))
    assert.ok(!html.includes(LOCALE_TOKEN))
  })

  it("templateHasStaticHtmlLang detects fixed lang attribute", () => {
    assert.equal(
      templateHasStaticHtmlLang('<html lang="en"><head></head></html>'),
      true
    )
    assert.equal(
      templateHasStaticHtmlLang(`<html lang="${LOCALE_TOKEN}">`),
      false
    )
    assert.equal(templateUsesLocaleToken(`<html lang="${LOCALE_TOKEN}">`), true)
  })

  it("expandPathsForLocales emits public paths per locale", () => {
    const locales = getI18nLocaleRouting(i18n)
    const expanded = expandPathsForLocales(["/about"], locales)
    assert.ok(expanded.includes("/about"))
    assert.ok(expanded.includes("/fr/about"))
  })

  it("stripLocalePrefixFromPath removes leading locale segment", () => {
    const locales = getI18nLocaleRouting(i18n)
    assert.equal(stripLocalePrefixFromPath("/fr/about", locales), "/about")
  })

  it("splitAppPathnameDetailed detects invalid locale segment", () => {
    const locales = getI18nLocaleRouting(i18n)
    const split = splitAppPathnameDetailed("/de/about", locales)
    assert.equal(split.kind, "invalid-locale")
    if (split.kind === "invalid-locale") {
      assert.equal(split.segment, "de")
      assert.equal(split.pathname, "/about")
      assert.equal(
        resolveInvalidLocaleRedirect(split, locales),
        "/about"
      )
    }
  })

  it("resolveHref with locale false does not double-prefix", () => {
    const history = {
      state: null as { index?: number } | null,
      length: 1,
      pushState() {},
      replaceState() {},
    } as any as History
    const location = {
      pathname: "/fr/about",
      search: "",
      hash: "",
      origin: "http://localhost",
    } as any as Location
    const routes = createRouteTree({
        children: [
          createRoute("/about", async () => ({
            default: () => createElement("p", null, "about"),
          })),
        ],
      })
    const router = createRouter({
      routes,
      i18n,
      history,
      location,
    })
    assert.equal(router.resolveHref("/fr/about", { locale: false }), "/fr/about")
    assert.equal(router.resolveHref("/about", { locale: false }), "/about")
    assert.equal(router.resolveHref("/about"), "/fr/about")
  })

  it("createStaticRouter resolveHref applies Link locale at prerender", () => {
    const manifest = compileRouteTree(
      createRouteTree({
          children: [
            createRoute("/about", async () => ({
              default: () => createElement("p", null, "about"),
            })),
          ],
        })
    )
    const localeRouting = getI18nLocaleRouting(i18n)
    const router = createStaticRouter({
      manifest,
      pathname: "/about",
      localeRouting,
      locale: "en",
    })
    assert.equal(router.resolveHref("/about", { locale: "fr" }), "/fr/about")
    assert.equal(router.resolveHref("/about"), "/about")
  })

  it("generatePublicStaticPaths expands logical paths per locale", async () => {
    const routes = createRouteTree({
        static: true,
        children: [
          createRoute("/about", async () => ({
            default: () => createElement("p", null, "about"),
          })),
        ],
      })
    const manifest = compileRouteTree(routes)
    const localeRouting = getI18nLocaleRouting(i18n)
    const paths = await generatePublicStaticPaths(
      manifest,
      undefined,
      undefined,
      localeRouting
    )
    assert.ok(paths.includes("/about"))
    assert.ok(paths.includes("/fr/about"))
  })

  it("createRenderer redirects / using Accept-Language when localeDetection enabled", async () => {
    const routes = createRouteTree({
        children: [
          createRoute("/", async () => ({
            default: () => createElement("p", null, "home"),
          })),
        ],
      })
    const renderer = createRenderer({
      routes,
      i18n,
      htmlTemplate: I18N_TPL,
    })
    const response = await renderer.render(
      new Request("http://localhost/", {
        headers: { "accept-language": "fr,en;q=0.9" },
      })
    )
    assert.ok(response)
    assert.equal(response.status, 302)
    assert.match(response.headers.location ?? "", /\/fr\/?$/)
  })

  it("createRenderer serves logical route when invalidLocale is not-found", async () => {
    const i18nNotFound = createI18nConfig(["en", "fr"], {
      invalidLocale: "not-found",
    })({
      default: "en",
      load: {
        en: async () => ({ default: messages.en }),
        fr: async () => ({ default: messages.fr }),
      },
    })
    const routes = createRouteTree({
        children: [
          createRoute("/about", async () => ({
            default: () =>
              createElement("p", { "data-testid": "about" }, "about"),
          })),
        ],
      })
    const renderer = createRenderer({
      routes,
      i18n: i18nNotFound,
      htmlTemplate: I18N_TPL,
    })
    const response = await renderer.render("http://localhost/de/about")
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.ok((response.body as string).includes('data-testid="about"'))
  })

  it("createRenderer passes locale into serverLoader context", async () => {
    const load = serverLoader({
      load: async (ctx) => ({ locale: ctx.locale ?? "" }),
      fallback: () => createElement("p", null, "loading"),
    })
    const routes = createRouteTree({
        children: [
          createRoute("/about", {
            component: async () => ({
              load,
              default: ({ data }: PageProps<typeof load>) =>
                createElement(
                  "p",
                  { "data-testid": "loader-locale" },
                  data?.locale ?? ""
                ),
            }),
          }),
        ],
      })
    const renderer = createRenderer({
      routes,
      i18n,
      htmlTemplate: I18N_TPL,
    })
    const response = await renderer.render("http://localhost/fr/about")
    assert.ok(response)
    assert.equal(response.status, 200)
    assert.ok((response.body as string).includes('data-testid="loader-locale">fr'))
  })
})
