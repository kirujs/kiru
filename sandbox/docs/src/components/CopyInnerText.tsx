import { useSignal, useRef, useEffect, useCallback, Derive } from "kiru"
import { CopyIcon } from "./icons/CopyIcon"

type CopyInnerTextProps = {
  children: JSX.Children
  prefix?: string
  importsOverride?: string
}

export function CopyInnerText({
  children,
  prefix = "",
  importsOverride = "",
}: CopyInnerTextProps) {
  const copied = useSignal(false)
  const ref = useRef<HTMLDivElement>(null)
  const copiedTimeout = useRef(-1)

  useEffect(
    () => () =>
      copiedTimeout.current !== -1 &&
      window.clearTimeout(copiedTimeout.current),
    []
  )

  const copyToClipboard = useCallback(async () => {
    if (copiedTimeout.current !== -1) {
      window.clearTimeout(copiedTimeout.current!)
    }

    const allLines = (prefix + ref.current!.textContent!).split("\n")
    let toWrite = allLines
    if (importsOverride) {
      toWrite = allLines.map((line) =>
        line.startsWith("import") ? importsOverride : line
      )
    }

    await navigator.clipboard.writeText(toWrite.join("\n"))
    copied.value = true
    copiedTimeout.current = window.setTimeout(
      () => (copied.value = false),
      1500
    )
  }, [])

  return (
    <div ref={ref} className="relative code-copy-wrapper">
      {children}
      <div className="absolute top-0 right-0">
        <div className="flex justify-end">
          <button
            ariaLabel="Copy to clipboard"
            className="text-[#aaa] opacity-30 hover:opacity-60 focus:opacity-60 p-2"
            onclick={copyToClipboard}
          >
            <CopyIcon />
          </button>
        </div>
        <Derive from={copied}>
          {(copied) =>
            copied && (
              <span className="text-light text-xs p-1 bg-black mr-1">
                Copied to clipboard!
              </span>
            )
          }
        </Derive>
      </div>
    </div>
  )
}
