import { siteCodeLang } from "$/state/siteCodeLang"
import { Derive, useComputed } from "kiru"

type CodeDemoProps = {
  name: string
  mode?: "jsx"
  code: {
    js: () => JSX.Element
    ts?: () => JSX.Element
  }
  children: JSX.Children
}

export function CodeDemo({ name, mode, code, children }: CodeDemoProps) {
  const CodeBlock = useComputed(() => {
    if (siteCodeLang.value === "ts" && code.ts) return code.ts
    return code.js
  })
  return (
    <div className="grid md:grid-cols-5">
      <div className="not-prose flex flex-col md:col-span-3 md:rounded-2xl glass-container text-light overflow-hidden z-10 shadow-[#0006] shadow-lg">
        <span className="text-sm px-4 py-2 text-stone-200 opacity-80">
          <Derive
            from={siteCodeLang}
            children={(lang) => `${name}.${lang}${mode === "jsx" ? "x" : ""}`}
          />
        </span>
        <Derive from={CodeBlock} children={(Code) => <Code />} />
      </div>
      <div className="md:col-span-2 md:rounded-e-2xl md:my-5 px-4 py-8 my-0 bg-theme-gradient flex items-center justify-center shadow-[#0006] shadow-lg">
        {children}
      </div>
    </div>
  )
}
