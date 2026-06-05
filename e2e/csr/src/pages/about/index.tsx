import { defineInterceptors, Link, useI18n, useRouter } from "kiru/router"

export const interceptors = defineInterceptors({
  user: {
    path: "/users/[id]",
    render: ({ params, restore }) => {
      const id = (params as { id: string }).id
      return (
      <div data-testid="user-preview-modal" data-user-id={id}>
        <p>User preview {id}</p>
        <button
          type="button"
          data-testid="user-preview-close"
          onclick={restore}
        >
          Close
        </button>
      </div>
      )
    },
  },
})

export default function AboutPage() {
  const { locale, t, locales } = useI18n()
  const router = useRouter()

  return () => (
    <main data-testid="csr-about" data-locale-page>
      <h1 data-testid="locale-title">{t("title")}</h1>
      <p data-testid="locale-greeting">{t("home.greeting")}</p>
      <p data-testid="locale-code">{locale}</p>
      <nav data-testid="locale-switcher">
        {locales.map((loc) => (
          <button
            key={loc}
            type="button"
            data-testid={`locale-switch-${loc}`}
            onclick={() => {
              void router.setLocale(loc)
            }}
          >
            {loc}
          </button>
        ))}
      </nav>
      <p>
        <Link to="/about" locale="fr" data-testid="locale-link-fr">
          About in French
        </Link>
      </p>
      <p>
        <Link
          to="/users/[id]"
          params={{ id: "99" }}
          data-testid="about-user-link-99"
        >
          View user 99
        </Link>
      </p>
    </main>
  )
}
