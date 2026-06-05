import { Link } from "kiru/router"

export default function PhotosPage() {
  return (
    <div data-testid="photos-page">
      <h2>Photos</h2>
      <ul data-testid="photos-feed">
        <li>
          <Link
            to="/photos/[id]"
            params={{ id: "123" }}
            data-testid="photo-link-123"
          >
            Open photo 123
          </Link>
        </li>
        <li>
          <Link
            to="/photos/[id]"
            params={{ id: "456" }}
            intercept={false}
            data-testid="photo-link-456-full"
          >
            Open photo 456 (full page)
          </Link>
        </li>
      </ul>
    </div>
  )
}
