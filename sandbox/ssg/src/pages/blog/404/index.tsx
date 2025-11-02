import { ErrorPageProps, Head } from "kiru/router"

export default function Blog404({ source }: ErrorPageProps) {
  return (
    <div>
      <Head.Content>
        <title>Blog 404 Route</title>
      </Head.Content>
      <h1>Blog 404 Route</h1>
      <p>src: {source?.path}</p>
    </div>
  )
}
