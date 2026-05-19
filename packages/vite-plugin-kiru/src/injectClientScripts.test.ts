import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { injectClientEntryScripts } from "./injectClientScripts.js"

describe("injectClientEntryScripts", () => {
  it("replaces dev entry script and injects css", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<script type="module" src="/src/main.tsx"></script></body></html>`
    const out = injectClientEntryScripts(html, {
      "index.html": {
        file: "assets/index-abc.js",
        css: ["assets/index.css"],
        isEntry: true,
      },
    })
    assert.match(out, /src="\/assets\/index-abc\.js"/)
    assert.match(out, /href="\/assets\/index\.css"/)
    assert.doesNotMatch(out, /main\.tsx/)
  })
})
