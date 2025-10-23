import { Link } from "kiru/router"

export default function BlogIndexPage() {
  return (
    <div>
      <h1>Blog Index Page</h1>
      <div>
        <Link to="/blog/a">Blog A</Link>
      </div>
      <div>
        <Link to="/blog/b">Blog B</Link>
      </div>
    </div>
  )
}
