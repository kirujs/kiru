import { loader } from "kiru/router";
export const load = loader(async () => {
    throw new Error("e2e-csr-loader-boom");
});
export default function CsrBreakLoaderPage({ error }) {
    return error ? (kiru.createElement("p", { "data-testid": "csr-loader-error" },
        "Loader error: ",
        error.message)) : (kiru.createElement("p", { "data-testid": "csr-break-loader-page" }, "should not render"));
}
//# sourceMappingURL=csr-break-loader.js.map