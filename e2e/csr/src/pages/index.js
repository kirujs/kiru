import { Link } from "kiru/router";
export default function HomePage() {
    return (kiru.createElement("div", { "data-testid": "home-page" },
        kiru.createElement("h2", null, "Home"),
        kiru.createElement("p", null,
            kiru.createElement(Link, { to: "/photos/[id]", params: { id: "123" }, "data-testid": "home-photo-link-123" }, "Open photo 123")),
        kiru.createElement("p", null,
            kiru.createElement(Link, { to: "/users/[id]", params: { id: "99" }, "data-testid": "home-user-link-99" }, "View user 99 (full page)"))));
}
//# sourceMappingURL=index.js.map