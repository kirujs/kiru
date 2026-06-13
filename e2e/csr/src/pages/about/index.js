import { defineInterceptors, Link, useI18n, useRouter } from "kiru/router";
export const interceptors = defineInterceptors({
    user: {
        path: "/users/[id]",
        render: ({ params, restore }) => {
            const id = params.id;
            return (kiru.createElement("div", { "data-testid": "user-preview-modal", "data-user-id": id },
                kiru.createElement("p", null,
                    "User preview ",
                    id),
                kiru.createElement("button", { type: "button", "data-testid": "user-preview-close", onclick: restore }, "Close")));
        },
    },
});
export default function AboutPage() {
    const { locale, t, locales } = useI18n();
    const router = useRouter();
    return () => (kiru.createElement("main", { "data-testid": "csr-about", "data-locale-page": true },
        kiru.createElement("h1", { "data-testid": "locale-title" }, t("title")),
        kiru.createElement("p", { "data-testid": "locale-greeting" }, t("home.greeting")),
        kiru.createElement("p", { "data-testid": "locale-code" }, locale),
        kiru.createElement("nav", { "data-testid": "locale-switcher" }, locales.map((loc) => (kiru.createElement("button", { key: loc, type: "button", "data-testid": `locale-switch-${loc}`, onclick: () => {
                void router.setLocale(loc);
            } }, loc)))),
        kiru.createElement("p", null,
            kiru.createElement(Link, { to: "/about", locale: "fr", "data-testid": "locale-link-fr" }, "About in French")),
        kiru.createElement("p", null,
            kiru.createElement(Link, { to: "/users/[id]", params: { id: "99" }, "data-testid": "about-user-link-99" }, "View user 99"))));
}
//# sourceMappingURL=index.js.map