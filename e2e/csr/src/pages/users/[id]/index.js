import { useRouter } from "kiru/router";
export default function UserPage() {
    const router = useRouter();
    return () => (kiru.createElement("h2", { "data-testid": "csr-user" },
        "User ",
        () => router.params.value.id));
}
//# sourceMappingURL=index.js.map