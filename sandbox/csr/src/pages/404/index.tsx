import { ErrorPageProps } from "kiru/router"

export default function _404Page({ source }: ErrorPageProps) {
  if (source) {
    return <h1>404 - {source.path}</h1>
  }

  return (
    <>
      <h1>404</h1>
      <p>Page not found</p>
    </>
  )
}
