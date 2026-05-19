import { Link, useI18n, useRouter } from "kiru/router"

export default function About() {
  const { locale, t, locales } = useI18n()
  const router = useRouter()

  return () => (
    <main data-testid="ssg-about" data-locale-page>
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
    </main>
  )
}
