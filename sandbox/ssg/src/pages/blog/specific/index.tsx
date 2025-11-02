import { Head } from "kiru/router"

export default function BlogSpecific() {
  return (
    <div>
      <Head.Content>
        <title>Blog Specific Route</title>
      </Head.Content>
      <h1>Blog Specific Route</h1>
      <p>This is a specific route that should match before the catchall</p>
    </div>
  )
}
