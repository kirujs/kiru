import { defineInterceptors, Link, type LinkProps } from "kiru/router"
import { routeLinks } from "../routes"
import PhotoModal from "./photos/photo-modal"

export const interceptors = defineInterceptors({
  photo: {
    path: "/photos/[id]",
    load: ({ params }) => {
      const id = (params as { id: string }).id
      return { title: `Photo ${id}` }
    },
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
        <PhotoModal
          photoId={(params as { id: string }).id}
          title={(data as { title: string }).title}
          onClose={restore}
        />
      ),
  },
})

export default function RootLayout({ children }: { children: JSX.Children }) {
  return (
    <main>
      <header>
        <h1>Hello World</h1>
      </header>
      <nav>
        <ul>
          {routeLinks.map((link) => (
            <li>
              <Link
                {...({
                  to: link.path,
                  ...("params" in link ? { params: link.params } : {}),
                  "data-testid": `nav-${link.displayName}`,
                  children: link.displayName,
                } as LinkProps)}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div id="router-outlet">{children}</div>
    </main>
  )
}
