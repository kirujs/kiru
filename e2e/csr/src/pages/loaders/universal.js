import { loader } from "kiru/router";
export const load = loader(async () => ({
    source: "universal",
    message: "from loader",
}));
export default function UniversalLoaderPage({ data, error }) {
    return (kiru.createElement("div", null,
        kiru.createElement("h2", null, "Universal loader"),
        kiru.createElement("p", { "data-testid": "loader-data" }, error ? error.message : `${data.source}:${data.message}`)));
}
//# sourceMappingURL=universal.js.map