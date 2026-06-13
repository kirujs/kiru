import { ref, signal } from "kiru";
export default function StylePage() {
    const divRef = ref(null);
    const divStyle = signal({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    });
    const verified = signal("✅");
    const signalColor = signal("red");
    const fontSize = signal("12px");
    const cssVarFromSignal = signal("4px");
    const multiSignalStyle = {
        color: signalColor,
        fontSize,
    };
    const randomizeStyle = () => {
        divStyle.value = generateRandomStyleProp();
        const styleAttr = divRef.current?.getAttribute("style") ?? "";
        try {
            compareStyles(divStyle.value, styleAttr);
            verified.value = "✅";
        }
        catch {
            verified.value = "❌";
        }
    };
    return () => (kiru.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        kiru.createElement("button", { "data-style-test-target": true, ref: divRef, style: divStyle, onclick: randomizeStyle }, verified),
        kiru.createElement("span", { "data-css-var-target": true, style: { "--my-style": "12px", "--another-var": "2rem" } }, "CSS variable target"),
        kiru.createElement("span", { "data-style-signal-target": true, style: { color: signalColor } }, "Signal in style"),
        kiru.createElement("button", { "data-style-signal-toggle": true, onclick: () => {
                signalColor.value = signalColor.value === "red" ? "blue" : "red";
            } }, "Toggle color"),
        kiru.createElement("span", { "data-multi-signal-style-target": true, style: multiSignalStyle }, "Multi-signal style"),
        kiru.createElement("button", { "data-toggle-color-only": true, onclick: () => {
                signalColor.value = signalColor.value === "red" ? "blue" : "red";
            } }, "Toggle color only"),
        kiru.createElement("button", { "data-toggle-font-size-only": true, onclick: () => {
                fontSize.value = fontSize.value === "12px" ? "24px" : "12px";
            } }, "Toggle fontSize only"),
        kiru.createElement("span", { "data-css-var-signal-target": true, style: { "--dynamic-gap": cssVarFromSignal } }, "CSS var from signal"),
        kiru.createElement("button", { "data-toggle-css-var": true, onclick: () => {
                cssVarFromSignal.value =
                    cssVarFromSignal.value === "4px" ? "16px" : "4px";
            } }, "Toggle --dynamic-gap")));
}
const generateRandomStyleProp = () => {
    if (Math.random() > 0.5)
        return undefined;
    if (Math.random() > 0.5)
        return "flex";
    return {
        display: Math.random() > 0.5 ? "flex" : Math.random() > 0.5 ? "block" : undefined,
        flexDirection: "column",
        alignItems: Math.random() > 0.5 ? "flex-start" : "center",
        backgroundColor: `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`,
    };
};
function parseStyleString(str) {
    const result = {};
    str.split(";").forEach((s) => {
        const [key, value] = s.split(":");
        if (!key)
            return;
        result[key.trim()] = value?.trim();
    });
    return result;
}
const compareStyles = (divStyle, styleAttr) => {
    if (typeof divStyle === "string") {
        if (styleAttr !== divStyle)
            throw new Error();
        return;
    }
    if (divStyle === undefined) {
        if (styleAttr !== "")
            throw new Error();
        return;
    }
    const parsedPrev = parseStyleString(styleAttr);
    const dummyDiv = document.createElement("div");
    for (const key in divStyle) {
        // @ts-ignore
        dummyDiv.style[key] = divStyle[key];
    }
    const parsedNext = parseStyleString(dummyDiv.getAttribute("style") ?? "");
    if (Object.keys(parsedNext).length !== Object.keys(parsedPrev).length) {
        throw new Error();
    }
    const keys = new Set([...Object.keys(parsedNext), ...Object.keys(parsedPrev)]);
    for (const key of keys) {
        // @ts-ignore
        if (parsedNext[key] !== parsedPrev[key]) {
            throw new Error();
        }
    }
};
//# sourceMappingURL=index.js.map