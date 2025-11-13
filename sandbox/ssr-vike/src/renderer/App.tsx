import "./global.css"
import { PageContext } from "vike/types"
import { PageContextProvider } from "$/context/pageContext"

export function App({ pageContext }: { pageContext: PageContext }) {
  const { Page, Layout } = pageContext.config
  return (
    <PageContextProvider pageContext={pageContext}>
      <Layouts layouts={Layout}>
        <Page {...pageContext.data} />
      </Layouts>
    </PageContextProvider>
  )
}

function Layouts({
  layouts,
  children,
}: {
  layouts: PageContext["config"]["Layout"]
  children: JSX.Children
}) {
  return layouts.reduce((children, Layout) => {
    return <Layout>{children}</Layout>
  }, children)
}
