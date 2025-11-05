import { siteCodeLang } from "$/state/siteCodeLang"
import { useCallback } from "kiru"

export function SiteLangToggle() {
  const handleClick = useCallback(() => {
    siteCodeLang.value = siteCodeLang.value === "js" ? "ts" : "js"
  }, [])

  const isJs = siteCodeLang.value === "js"

  return (
    <button
      className="group relative flex items-center justify-between bg-stone-950 border border-stone-800 rounded-md px-3 py-1.5 hover:bg-neutral-800 hover:border-neutral-700 text-sm font-bold min-w-14"
      onclick={handleClick}
      title={`Switch to ${isJs ? "TypeScript" : "JavaScript"}`}
      aria-label={`Switch to ${isJs ? "TypeScript" : "JavaScript"}`}
    >
      <span className={`${isJs ? "text-[#F7DF1F]" : "text-[#197ABF]"}`}>
        {isJs ? "JS" : "TS"}
      </span>

      <div className="absolute -top-1 -right-2 w-6 h-6 rounded-md bg-neutral-800 border border-stone-800 opacity-50 group-hover:opacity-100">
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-neutral-300">
          {isJs ? "TS" : "JS"}
        </span>
      </div>
    </button>
  )
}
