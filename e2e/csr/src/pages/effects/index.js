import { createContext, useContext, onMount, ref, onBeforeMount } from "kiru";
const LogContext = createContext(null);
const useLog = () => useContext(LogContext);
export default function EffectsPage() {
    const logs = ref([]);
    const addLog = (msg) => {
        logs.current.push(msg);
    };
    onMount(() => {
        const output = document.getElementById("output");
        output.innerHTML = logs.current.join("\n");
    });
    return () => (kiru.createElement("div", null,
        kiru.createElement(LogContext, { value: addLog },
            kiru.createElement(Parent, null)),
        kiru.createElement("pre", { style: "font-family: monospace; text-align: left; padding: .5rem; background: #111" },
            kiru.createElement("code", { id: "output" }))));
}
function Parent() {
    const log = useLog();
    onMount(() => log("app mounted - post"));
    onBeforeMount(() => log("app mounted - pre"));
    return () => (kiru.createElement("div", null,
        "Parent",
        kiru.createElement(Child, null),
        kiru.createElement(GrandChild, null)));
}
function Child() {
    const log = useLog();
    onMount(() => log("child mounted - post"));
    onMount(() => log("child mounted - post 2"));
    onBeforeMount(() => log("child mounted - pre"));
    onBeforeMount(() => log("child mounted - pre 2"));
    return () => (kiru.createElement("div", null,
        "Child",
        kiru.createElement(GrandChild, null)));
}
function GrandChild() {
    const log = useLog();
    onMount(() => log("grandchild mounted - post"));
    onBeforeMount(() => log("grandchild mounted - pre"));
    return () => (kiru.createElement("div", null,
        kiru.createElement("div", null, "GrandChild")));
}
//# sourceMappingURL=index.js.map