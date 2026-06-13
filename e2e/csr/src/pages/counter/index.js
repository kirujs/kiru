import { signal } from "kiru";
export default function CounterPage() {
    const $toggled = signal(false);
    const $count = signal(0);
    return () => {
        return (kiru.createElement("div", { id: "counter" },
            () => $toggled.value && kiru.createElement("p", { id: "toggled" }, "Toggled"),
            kiru.createElement("button", { id: "toggle", onclick: () => ($toggled.value = !$toggled.value) }, "toggle"),
            () => $count.value % 2 === 0 ? (kiru.createElement("span", { "data-even": true, "data-test": true, id: "count" }, $count)) : (kiru.createElement("span", { "data-odd": true, "data-test": true, id: "count" }, $count)),
            kiru.createElement("button", { ariaLabel: "increment", id: "increment", onclick: () => $count.value++ }, "increment"),
            () => ($count.value > 0 && $count.value % 2 === 0) && kiru.createElement("p", null, "count is even")));
    };
}
//# sourceMappingURL=index.js.map