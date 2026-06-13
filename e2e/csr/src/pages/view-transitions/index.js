import { useRouter } from "kiru/router";
export default function ViewTransitionsPage() {
    const router = useRouter();
    return () => (kiru.createElement("div", null,
        kiru.createElement("h2", { "data-testid": "vt-page" }, "View transitions"),
        kiru.createElement("button", { type: "button", "data-testid": "vt-nav-about", onclick: () => void router.navigate("/about", { transition: true }) }, "About with transition")));
}
//# sourceMappingURL=index.js.map