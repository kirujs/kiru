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
    filePath: "/project/src/todo.tsx",
    log: () => {},
  }
  applyDomCodegen(ctx)
  return ctx.code.toString()
}

describe("dom codegen For component", () => {
  it("emits createComponent(For, props, anchor) not createKeyedBlock", async () => {
    const out = await transformDomTsx(`
"use dom";
import { For, mount, signal } from "kiru/dom";

function TodoApp() {
  const items = signal([]);
  return () => (
    <ul>
      <For each={items}>
        {(item) => (
          <li key={item.id}>{item.text}</li>
        )}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /createComponent\(For, \{/)
    assert.match(out, /\.anchors\[0\]\)/)
    assert.doesNotMatch(out, /createKeyedBlock/)
    assert.doesNotMatch(out, /\bjsxDEV\(/)
    assert.doesNotMatch(out, /createComponent\(For, \{[\s\S]*?\bkey:/)
  })

  it("passes explicit For key prop through emit", async () => {
    const out = await transformDomTsx(`
"use dom";
import { For, mount, signal } from "kiru/dom";

function TodoApp() {
  const items = signal([]);
  return () => (
    <ul>
      <For each={items} key={(item) => item.id}>
        {(item) => <li>{item.text}</li>}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /\bkey:/)
  })

  it("compiles fallback prop", async () => {
    const out = await transformDomTsx(`
"use dom";
import { For, mount, signal } from "kiru/dom";

function App() {
  const items = signal([]);
  return () => (
    <ul>
      <For each={items} fallback={<p data-testid="empty">No items</p>}>
        {(item) => <li key={item.id}>{item.text}</li>}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /fallback:/)
    assert.match(out, /data-testid="empty"/)
  })

  it("emits array for two-child fragment children", async () => {
    const out = await transformDomTsx(`
"use dom";
import { Fragment } from "kiru/jsx-dev-runtime";
import { For, mount, signal } from "kiru/dom";

function App() {
  const items = signal([{ id: 1, text: "a" }]);
  return () => (
    <ul>
      <For each={items}>
        {(item) => (
          <>
            <p>{item.text}</p>
            <li>{item.text}</li>
          </>
        )}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /children:\s*\(item\)\s*=>\s*\[/)
    assert.doesNotMatch(
      out,
      /children:\s*\(item\)\s*=>\s*createComponent\(\(\)\s*=>\s*\{[\s\S]*<>/
    )
  })

  it("unwraps single-child fragment to one root", async () => {
    const out = await transformDomTsx(`
"use dom";
import { Fragment } from "kiru/jsx-dev-runtime";
import { For, mount, signal } from "kiru/dom";

function App() {
  const items = signal([{ id: 1 }]);
  return () => (
    <ul>
      <For each={items}>
        {(item) => (
          <>
            <li>{item.id}</li>
          </>
        )}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /children:\s*\(item\)\s*=>\s*createComponent\(/)
    assert.doesNotMatch(out, /children:\s*\(item\)\s*=>\s*\[/)
  })

  it("compiles render prop with fragment like For children", async () => {
    const out = await transformDomTsx(`
"use dom";
import { Fragment } from "kiru/jsx-dev-runtime";
import { mount, signal } from "kiru/dom";

function Repeat(props) {
  return () => null;
}

function App() {
  const items = signal([{ id: 1 }]);
  return () => (
    <Repeat
      each={items}
      render={(item) => (
        <>
          <span>{item.id}</span>
          <p>{item.id}</p>
        </>
      )}
    />
  );
}
`)
    assert.match(out, /render:\s*\(item\)\s*=>\s*\[/)
    assert.doesNotMatch(out, /\bjsxDEV\(/)
  })

  it("binds shell-only fragment text via insertText on cloned root", async () => {
    const out = await transformDomTsx(`
"use dom";
import { Fragment } from "kiru/jsx-dev-runtime";
import { For, mount, signal } from "kiru/dom";

function App() {
  const items = signal([{ id: 1 }]);
  return () => (
    <ul>
      <For each={items}>
        {(item) => (
          <>
            <p className="list-spacer">{item.id}</p>
            <div className="list-item">{item.id}</div>
          </>
        )}
      </For>
    </ul>
  );
}
`)
    assert.match(out, /insertText\(\$el\d+, \(\) => String\(item\.id\)\)/)
    assert.doesNotMatch(
      out,
      /list-spacer[\s\S]*insertText\(\$n\d+\.nodes\[0\]/
    )
  })
})
