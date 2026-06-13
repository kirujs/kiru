import { For, signal } from "kiru";
function Counter({ item }) {
    const count = signal(item.count);
    return () => (kiru.createElement("div", { className: "counter-item", "data-id": item.id },
        kiru.createElement("span", { className: "counter-id", style: "font-weight: bold; background: white; color: black;" },
            "#",
            item.id),
        kiru.createElement("span", { className: "counter-value" }, count),
        kiru.createElement("button", { className: "increment", onclick: () => count.value++ }, "+"),
        kiru.createElement("button", { className: "decrement", onclick: () => count.value-- }, "-")));
}
export default function KeyedListPage() {
    const items = signal([
        { id: 1, count: 0 },
        { id: 2, count: 0 },
        { id: 3, count: 0 },
    ]);
    function moveUp(index) {
        if (index === 0)
            return;
        const newItems = [...items.value];
        [newItems[index - 1], newItems[index]] = [
            newItems[index],
            newItems[index - 1],
        ];
        items.value = newItems;
    }
    function moveDown(index) {
        if (index === items.value.length - 1)
            return;
        const newItems = [...items.value];
        [newItems[index], newItems[index + 1]] = [
            newItems[index + 1],
            newItems[index],
        ];
        items.value = newItems;
    }
    return () => (kiru.createElement("div", { id: "keyed-list" },
        kiru.createElement("h2", null, "Keyed List Test"),
        kiru.createElement("div", { style: "display: flex; flex-direction: column; gap: 0.5rem;" },
            kiru.createElement(For, { each: items }, (item, index) => (kiru.createElement("div", { className: "list-item", key: item.id, style: "display: flex; gap: 0.5rem;" },
                kiru.createElement(Counter, { item: item }),
                kiru.createElement("div", { className: "controls" },
                    kiru.createElement("button", { className: "move-up", "data-index": index, onclick: () => moveUp(index) }, "\u2191"),
                    kiru.createElement("button", { className: "move-down", "data-index": index, onclick: () => moveDown(index) }, "\u2193"))))))));
}
//# sourceMappingURL=index.js.map