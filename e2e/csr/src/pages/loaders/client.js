import { clientLoader } from "kiru/router";
export const load = clientLoader(async () => ({
    source: "client",
    message: "from clientLoader",
}));
export default function ClientLoaderPage({ data, error }) {
    return (kiru.createElement("div", null,
        kiru.createElement("h2", null, "Client loader"),
        kiru.createElement("p", { "data-testid": "loader-data" }, error ? error.message : `${data.source}:${data.message}`)));
}
//# sourceMappingURL=client.js.map