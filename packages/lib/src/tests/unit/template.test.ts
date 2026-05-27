import { describe, it } from "node:test"
import assert from "node:assert"
import { createElement } from "../../element.js"
import { headlessRender } from "../../headlessRender.js"
import { _template, cloneTemplateDom, getTemplateFragment } from "../../template.js"
import { withJSDOM } from "./jsdom.js"

describe("template", () => {
  it("_template caches fragments by html string", async () => {
    await withJSDOM(async () => {
      const html = '<span class="badge">OK</span>'
      const a = _template(html)
      const b = _template(html)
      assert.notStrictEqual(a, b)
      assert.strictEqual(getTemplateFragment(html), getTemplateFragment(html))
    })
  })

  it("cloneTemplateDom produces independent elements", async () => {
    await withJSDOM(async () => {
      const html = '<span class="badge">OK</span>'
      const el1 = cloneTemplateDom(html)
      const el2 = cloneTemplateDom(html)
      assert.notStrictEqual(el1, el2)
      assert.strictEqual(el1.outerHTML, el2.outerHTML)
      el1.textContent = "changed"
      assert.strictEqual(el2.textContent, "OK")
    })
  })

  it("template html matches headlessRender output", () => {
    const el = createElement("span", { className: "badge", children: "OK" })
    let html = ""
    headlessRender({ write: (chunk) => (html += chunk) }, el)
    const tpl = _template('<span class="badge">OK</span>')
    assert.strictEqual(tpl.html, html)
  })

  it("composed _template literal merges child html via .html", () => {
    const child = _template('<span class="badge">OK</span>')
    const parent = _template(
      `<div><h1><!--#--></h1><!--#-->${child.html}<div>123</div></div>`,
      2
    )
    assert.ok(parent.html.includes('class="badge"'))
    assert.ok(parent.html.includes("<div>123</div>"))
  })

  it("mounts template children via reconciler", async () => {
    await withJSDOM(async (container, kiru) => {
      const $t0 = _template('<span class="badge">OK</span>')
      kiru.mount($t0, container)
      const badge = container.querySelector(".badge")
      assert.ok(badge)
      assert.strictEqual(badge!.textContent, "OK")
    })
  })
})
