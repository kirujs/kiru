export function resolveDefaultFetch(
  exported: unknown
): ((req: Request) => Promise<Response>) | null {
  if (
    exported &&
    typeof exported === "object" &&
    typeof (exported as { fetch?: unknown }).fetch === "function"
  ) {
    const fetch = (exported as { fetch: (req: Request) => Promise<Response> })
      .fetch
    return (req) => fetch.call(exported, req)
  }
  if (typeof exported === "function") {
    return exported as (req: Request) => Promise<Response>
  }
  return null
}
