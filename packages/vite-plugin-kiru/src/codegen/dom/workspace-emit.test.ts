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
    filePath: "/project/src/workspace.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen workspace stress excerpt", () => {
  it("emits nested For, fragment children, and insertText on shell root", async () => {
    const out = await transformDomTsx(`
"use dom";
import { computed, For, mount, signal } from "kiru/dom";

function WorkspaceApp() {
  const sections = signal([{ id: 1, name: "A", tasks: [{ id: 1, text: "t", done: false }] }]);
  const visibleSections = computed(() => sections());
  return () => (
    <div data-testid="workspace-inner">
      <For each={visibleSections} key={(s) => s.id}>
        {(section) => (
          <>
            <p className="section-spacer">{section.id}</p>
            <div data-section-id={section.id}>
              <For each={section.tasks} key={(t) => t.id}>
                {(task) => (
                  <>
                    <span className="task-badge">{task.id}</span>
                    <div className="task-row">{task.text}</div>
                  </>
                )}
              </For>
            </div>
          </>
        )}
      </For>
    </div>
  );
}
`)
    const forMatches = out.match(/createComponent\(For,/g)
    assert.ok(forMatches && forMatches.length >= 2, "expected nested For emits")
    assert.match(out, /children:\s*\(section\)\s*=>\s*\[/)
    assert.match(out, /insertText\(\$el\d+, \(\) => String\(section\.id\)\)/)
    assert.doesNotMatch(
      out,
      /section-spacer[\s\S]*insertText\(\$n\d+\.nodes\[0\]/
    )
    assert.doesNotMatch(out, /\bjsxDEV\(/)
  })
})
