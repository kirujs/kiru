import {
  StyleObject,
  useRef,
  useState,
  useSignal,
  useEffectEvent,
  nextIdle,
} from "kiru"

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

export function StyleTest() {
  const divRef = useRef<HTMLButtonElement>(null)
  const [divStyle, setDivstyle] = useState<StyleObject | string | undefined>({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  })
  const verified = useSignal("✅")

  const randomizeStyle = () => {
    const next = generateRandomStyleProp()
    setDivstyle(next)
    nextIdle(verify)
  }

  const verify = useEffectEvent(() => {
    const styleAttr = divRef.current?.getAttribute("style") ?? ""
    try {
      compareStyles(divStyle, styleAttr)
      verified.value = "✅"
    } catch {
      verified.value = "❌"
    }
  })
  return (
    <button
      data-style-test-target
      ref={divRef}
      style={divStyle}
      onclick={randomizeStyle}
    >
      {verified}
    </button>
  )
}
