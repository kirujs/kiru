import type { PageContext as VikePageContext } from "vike/types"
import { createContext, useContext } from "kiru"

export const PageContext = createContext<VikePageContext>(null!)

export function usePageContext() {
  return useContext(PageContext)
}
