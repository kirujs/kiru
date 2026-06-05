import { form, query, requested, type Schema } from "kiru/remote"

export type CatalogItem = { id: string; label: string; tag: string }

const catalog: CatalogItem[] = [
  { id: "1", label: "Alpha", tag: "work" },
  { id: "2", label: "Beta", tag: "play" },
  { id: "3", label: "Gamma", tag: "work" },
]

const filterSchema: Schema<{ filter: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null || !("filter" in input)) {
      throw new Error("invalid filter")
    }
    const filter = String((input as { filter: unknown }).filter ?? "").trim()
    if (!filter) throw new Error("filter required")
    return { filter }
  },
}

const addItemSchema: Schema<{ label: string; tag: string }> = {
  parse: (input) => {
    if (typeof input !== "object" || input === null) throw new Error("invalid")
    const label = String((input as { label?: unknown }).label ?? "").trim()
    const tag = String((input as { tag?: unknown }).tag ?? "").trim()
    if (!label || !tag) throw new Error("label and tag required")
    return { label, tag }
  },
}

/** Parameterized read — filtered catalog slice. */
export const listFiltered = query(filterSchema, async ({ filter }) =>
  catalog.filter((item) => item.tag === filter)
)

/** Form write — adds item then refreshes client-requested query instances. */
export const addItem = form(addItemSchema, async (data) => {
  catalog.push({
    id: crypto.randomUUID(),
    label: data.label,
    tag: data.tag,
  })
  await requested(listFiltered, 3).refreshAll()
  return { ok: true as const }
})
