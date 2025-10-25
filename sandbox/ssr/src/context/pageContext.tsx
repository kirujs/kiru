import type { PageContext } from "vike/types"
import { createContext, useContext } from "kiru"

export { usePageContext, PageContextProvider }

const PageContext = createContext<PageContext>(null as any)

type PageContextProviderProps = {
  pageContext: PageContext
  children: JSX.Children
}

function PageContextProvider({
  pageContext: value,
  children,
}: PageContextProviderProps) {
  return <PageContext.Provider {...{ value, children }} />
}

function usePageContext() {
  return useContext(PageContext)
}
