import type { KiruFetch, KiruMiddleware } from "./types.js"

/** Compose onion middleware around a terminal fetch handler. */
export function composeFetch(
  terminal: KiruFetch,
  ...layers: KiruMiddleware[]
): KiruFetch {
  return layers.reduceRight<KiruFetch>(
    (next, layer) => (request) => layer(request, () => next(request)),
    terminal
  )
}
