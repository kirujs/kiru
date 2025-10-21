import { createContext, useContext } from "kiru"

export { usePageContext, PageContextProvider }

const PageContext = createContext<Vike.PageContext & { isClient: boolean }>(
  null as any
)

function PageContextProvider({
  pageContext,
  children,
}: {
  pageContext: Vike.PageContext
  children: JSX.Children
}) {
  return (
    <PageContext.Provider
      value={{ ...pageContext, isClient: !!globalThis.window?.location }}
    >
      {children}
    </PageContext.Provider>
  )
}

function usePageContext() {
  return useContext(PageContext)
}
