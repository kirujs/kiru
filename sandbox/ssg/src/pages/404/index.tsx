import { ErrorPageProps, Head } from "kiru/router"

export default function _404Page({ source }: ErrorPageProps) {
  if (source) {
    return (
      <>
        <Head.Content>
          <title>404 - {source.path}</title>
        </Head.Content>
        <h1>404 - {source.path}</h1>
      </>
    )
  }

  return (
    <>
      <Head.Content>
        <title>404</title>
      </Head.Content>
      <h1>404</h1>
      <p>Page not found</p>
    </>
  )
}
