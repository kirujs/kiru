export default function CsrErrorPage({ error }) {
    return (kiru.createElement("p", { "data-testid": "csr-error-page" },
        "CSR error boundary: ",
        error.message));
}
//# sourceMappingURL=csr-error-page.js.map