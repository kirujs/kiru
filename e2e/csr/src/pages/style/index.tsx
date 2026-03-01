import { StyleObject, ref, signal } from "kiru"

export default function StylePage() {
  const divRef = ref<HTMLButtonElement>(null)
  const divStyle = signal<StyleObject | string | undefined>({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  })
  const verified = signal("✅")
  const signalColor = signal("red")

  const randomizeStyle = () => {
    divStyle.value = generateRandomStyleProp()
    const styleAttr = divRef.current?.getAttribute("style") ?? ""
    try {
      compareStyles(divStyle.value, styleAttr)
      verified.value = "✅"
    } catch {
      verified.value = "❌"
    }
  }

  return () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        data-style-test-target
        ref={divRef}
        style={divStyle}
        onclick={randomizeStyle}
      >
        {verified}
      </button>
      <span
        data-css-var-target
        style={{ "--my-style": "12px", "--another-var": "2rem" }}
      >
        CSS variable target
      </span>
      <span data-style-signal-target style={{ color: signalColor }}>
        Signal in style
      </span>
      <button
        data-style-signal-toggle
        onclick={() => {
          signalColor.value = signalColor.value === "red" ? "blue" : "red"
        }}
      >
        Toggle color
      </button>
    </div>
  )
}

const generateRandomStyleProp = (): StyleObject | string | undefined => {
  if (Math.random() > 0.5) return undefined

  if (Math.random() > 0.5) return "flex"

  return {
    display:
      Math.random() > 0.5 ? "flex" : Math.random() > 0.5 ? "block" : undefined,
    flexDirection: "column",
    alignItems: Math.random() > 0.5 ? "flex-start" : "center",
    backgroundColor: `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(
      Math.random() * 255
    )}, ${Math.floor(Math.random() * 255)})`,
  }
}

function parseStyleString(str: string): StyleObject {
  const result: StyleObject = {}
  str.split(";").forEach((s) => {
    const [key, value] = s.split(":")
    if (!key) return
    result[key!.trim() as any] = value?.trim()
  })
  return result
}

const compareStyles = (
  divStyle: StyleObject | string | undefined,
  styleAttr: string
) => {
  if (typeof divStyle === "string") {
    if (styleAttr !== divStyle) throw new Error()
    return
  }

  if (divStyle === undefined) {
    if (styleAttr !== "") throw new Error()
    return
  }

  const parsedPrev = parseStyleString(styleAttr)

  const dummyDiv = document.createElement("div")
  for (const key in divStyle as any) {
    // @ts-ignore
    dummyDiv.style[key] = divStyle[key]
  }
  const parsedNext = parseStyleString(dummyDiv.getAttribute("style") ?? "")

  if (Object.keys(parsedNext).length !== Object.keys(parsedPrev).length) {
    throw new Error()
  }

  const keys = new Set([...Object.keys(parsedNext), ...Object.keys(parsedPrev)])
  for (const key of keys) {
    // @ts-ignore
    if (parsedNext[key] !== parsedPrev[key]) {
      throw new Error()
    }
  }
}
