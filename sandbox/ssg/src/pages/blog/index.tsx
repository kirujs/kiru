import { Link } from "kiru/router"

export default function BlogIndexPage() {
  return (
    <div>
      <h1>Blog Index Page</h1>
      <div>
        <Link to="/blog/a">Blog A (root level)</Link>
      </div>
      <div>
        <Link to="/blog/b">Blog B</Link>
      </div>
      <div>
        <Link to="/blog/specific">
          Blog Specific (should match before catchall)
        </Link>
      </div>
      <div>
        <Link to="/blog/catchall-test">Blog Catchall Test</Link>
      </div>
    </div>
  )
}
