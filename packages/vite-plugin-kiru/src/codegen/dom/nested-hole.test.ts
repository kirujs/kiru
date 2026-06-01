import { describe, it } from "node:test"
import assert from "node:assert"
import esbuild from "esbuild"
import { parseAst } from "rollup/parseAst"
import { MagicString } from "../shared.js"
import { applyDomCodegen } from "./index.js"

async function transformDomTsx(source: string): Promise<string> {
  const { code: js } = await esbuild.transform(source, {
    loader: "tsx",
    jsx: "automatic",
    jsxImportSource: "kiru",
    jsxDev: true,
  })
  const ast = parseAst(js, { allowReturnOutsideFunction: true })
  const code = new MagicString(js)
  const ctx = {
    code,
    ast,
    isBuild: false,
    fileLinkFormatter: (id: string) => id,
    filePath: "/project/src/nested.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen nested component hole", () => {
  it("compiles Counter jsxDEV hole and mixed p children without leftover jsxDEV", async () => {
    const out = await transformDomTsx(`
"use dom";
import { mount, signal } from "kiru/dom";
import { Counter } from "./counter.tsx";

function NestedApp() {
  const parentCount = signal(0);
  return () => (
    <div data-testid="nested-app">
      <p class="parent-label">
        Parent:{" "}
        <span data-testid="parent-value" onclick={() => parentCount.set((c) => c + 1)}>
          {parentCount()}
        </span>
      </p>
      <Counter initial={5} testId="child-counter" />
    </div>
  );
}

export function mountNested(container) {
  return mount(() => <NestedApp />, container);
}
`)
    assert.match(out, /createComponent\(Counter, \{[^}]+\}, \$n\d+\.anchors\[\d+\]\)/)
    assert.doesNotMatch(out, /mountBefore\([^)]*createComponent\(Counter/)
    assert.doesNotMatch(out, /\bjsxDEV\(/)
  })
})
