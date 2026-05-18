import { loader, type PageProps } from "kiru/router"

const querySchema = {
  parse(input: unknown) {
    if (typeof input !== "object" || input === null || !("q" in input)) {
      throw new Error("Invalid input")
    }
    if (typeof (input as { q: unknown }).q !== "string") {
      throw new Error("Invalid input")
    }
    return input as { q: string }
  },
}

export const load = loader({
  validation: {
    query: querySchema,
    queryDefaults: { q: "default" },
    redirectToCanonical: true,
    onInvalid: (c) => c.notFound(),
  },
  load: async ({ query }) => query,
})

export default function SearchSchemaPage({
  data,
}: PageProps<typeof load>) {
  return () => (
    <p data-testid="search-schema">q={data?.q ?? "missing"}</p>
  )
}
