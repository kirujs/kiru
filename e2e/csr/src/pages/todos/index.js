import { For, signal } from "kiru";
export default function TodosPage() {
    const inputText = signal("");
    const items = signal([
        { text: "buy coffee" },
        { text: "walk the dog" },
        { text: "push the latest commits" },
    ]);
    function addItem() {
        items.value = [...items.value, { text: inputText.peek() }];
        inputText.value = "";
    }
    return () => (kiru.createElement("div", { id: "todos" },
        kiru.createElement("input", { "bind:value": inputText }),
        kiru.createElement("button", { onclick: addItem }),
        kiru.createElement("ul", null,
            kiru.createElement(For, { each: items }, (item) => kiru.createElement("li", null, item.text)))));
}
//# sourceMappingURL=index.js.map