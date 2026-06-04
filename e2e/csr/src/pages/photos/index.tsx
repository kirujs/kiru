import { Show } from "kiru"
import { defineRouteInterceptors, Link, routeInterceptor } from "kiru/router"
import PhotoModal from "./photo-modal"

export const interceptors = defineRouteInterceptors({
  photo: routeInterceptor("/photos/[id]", {
    load: ({ params }) => ({ title: `Photo ${params.id}` }),
    render: ({ params, restore, reload, data, error }) =>
      error ? (
        <div data-testid="photo-modal-error">
          <p>{error.message}</p>
          <button
            type="button"
            data-testid="photo-modal-retry"
            onclick={reload}
          >
            Retry
          </button>
        </div>
      ) : (
        <PhotoModal photoId={params.id} title={data.title} onClose={restore} />
      ),
  }),
})

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
      <interceptors.photo.Outlet />
      <Show when={interceptors.photo.isPending}>
        <div>
          <p>Photo modal is loading</p>
        </div>
      </Show>
      <Show when={interceptors.photo.isActive}>
        <div>
          <p>Photo modal is active</p>
        </div>
      </Show>
    </div>
  )
}
