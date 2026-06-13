import { signal } from "kiru";
import { useMatches, useRouter } from "kiru/router";
function formatSnapshot(pathname, params) {
    const keys = Object.keys(params);
    if (!keys.length)
        return pathname;
    return `${pathname}?${keys.map((k) => `${k}=${params[k]}`).join("&")}`;
}
export default function NavigationDemoPage() {
    const router = useRouter();
    const lastNav = signal("");
    const getMatches = useMatches();
    return () => (kiru.createElement("div", null,
        kiru.createElement("h2", null, "Navigation demo"),
        kiru.createElement("button", { type: "button", "data-testid": "nav-programmatic", onclick: async () => {
                const r = await router.navigate("/about");
                lastNav.value = r.status;
            } }, "Programmatic navigate to About"),
        kiru.createElement("button", { type: "button", "data-testid": "nav-slow", onclick: async () => {
                await router.navigate("/slow-target");
            } }, "Navigate to slow route"),
        kiru.createElement("p", { "data-testid": "nav-result" }, () => lastNav.value),
        kiru.createElement("p", { "data-testid": "match-depth" }, () => String(getMatches().length)),
        kiru.createElement("p", { "data-testid": "nav-in-progress" }, () => (router.isNavigating.value ? "yes" : "no")),
        kiru.createElement("p", { "data-testid": "nav-from" }, () => {
            const from = router.currentNavigation.value?.from;
            return from ? formatSnapshot(from.pathname, from.params) : "";
        }),
        kiru.createElement("p", { "data-testid": "nav-to" }, () => {
            const to = router.currentNavigation.value?.to;
            return to ? formatSnapshot(to.pathname, to.params) : "";
        })));
}
//# sourceMappingURL=index.js.map