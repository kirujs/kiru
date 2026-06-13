import { useRouter } from "kiru/router";
export default function HashSectionPage() {
    const router = useRouter();
    return () => (kiru.createElement("section", { "data-testid": "hash-section-page" },
        kiru.createElement("p", { "data-testid": "hash-router" }, router.hash.value || "(no hash)"),
        kiru.createElement("h2", { id: "section" }, "Section")));
}
//# sourceMappingURL=index.js.map