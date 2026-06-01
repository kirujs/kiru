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
    filePath: "/project/src/conditional.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen domShow", () => {
  it("emits on() bindings inside domShow factory for cond && button", async () => {
    const out = await transformDomTsx(`
"use dom";
import { mount, signal } from "kiru/dom";

function App() {
  const show = signal(true);
  return () => (
    <div>
      {show() && (
        <button type="button" onclick={() => show.set(false)}>
          Hide
        </button>
      )}
    </div>
  );
}
`)
    assert.match(out, /domShow\(/)
    assert.match(
      out,
      /domShow\([\s\S]*on\(\$el\d+, "click"/
    )
  })

  it("emits createComponent factory for cond && component (shape C)", async () => {
    const out = await transformDomTsx(`
"use dom";
import { setupDom, signal } from "kiru/dom";

function Child() {
  return (props: { label: string }) => <span>{props.label}</span>;
}

function App() {
  const show = signal(true);
  const { derive } = setupDom<{ show: ReturnType<typeof signal<boolean>> }>();
  const visible = derive((p) => p.show());
  return (props) => (
    <div>
      {visible() && <Child label="hi" />}
    </div>
  );
}
`)
    assert.match(
      out,
      /domShow\([\s\S]*createComponent\(Child/
    )
    assert.doesNotMatch(out, /on\(createComponent/)
  })
})
