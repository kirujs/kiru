import { Link } from "kiru/router";
export default function PhotosPage() {
    return (kiru.createElement("div", { "data-testid": "photos-page" },
        kiru.createElement("h2", null, "Photos"),
        kiru.createElement("ul", { "data-testid": "photos-feed" },
            kiru.createElement("li", null,
                kiru.createElement(Link, { to: "/photos/[id]", params: { id: "123" }, "data-testid": "photo-link-123" }, "Open photo 123")),
            kiru.createElement("li", null,
                kiru.createElement(Link, { to: "/photos/[id]", params: { id: "456" }, intercept: false, "data-testid": "photo-link-456-full" }, "Open photo 456 (full page)")))));
}
//# sourceMappingURL=index.js.map