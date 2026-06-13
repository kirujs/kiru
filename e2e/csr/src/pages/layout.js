import { defineInterceptors, Link } from "kiru/router";
import { routeLinks } from "../routes";
import PhotoModal from "./photos/photo-modal";
export const interceptors = defineInterceptors({
    photo: {
        path: "/photos/[id]",
        load: ({ params }) => {
            const id = params.id;
            return { title: `Photo ${id}` };
        },
        render: ({ params, restore, reload, data, error }) => error ? (kiru.createElement("div", { "data-testid": "photo-modal-error" },
            kiru.createElement("p", null, error.message),
            kiru.createElement("button", { type: "button", "data-testid": "photo-modal-retry", onclick: reload }, "Retry"))) : (kiru.createElement(PhotoModal, { photoId: params.id, title: data.title, onClose: restore })),
    },
});
export default function RootLayout({ children }) {
    return (kiru.createElement("main", null,
        kiru.createElement("header", null,
            kiru.createElement("h1", null, "Hello World")),
        kiru.createElement("nav", null,
            kiru.createElement("ul", null, routeLinks.map((link) => (kiru.createElement("li", null,
                kiru.createElement(Link, { ...{
                        to: link.path,
                        ...("params" in link ? { params: link.params } : {}),
                        "data-testid": `nav-${link.displayName}`,
                        children: link.displayName,
                    } })))))),
        kiru.createElement("div", { id: "router-outlet" }, children)));
}
//# sourceMappingURL=layout.js.map