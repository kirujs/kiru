# Kiru Router — phased roadmap

Actionable backlog for making `kiru/router` competitive with Next.js, SvelteKit, and SolidStart. Items are grouped by **tier** (release phase), not strict calendar quarters.

| Phase | Document | Goal |
|-------|----------|------|
| **Tier 1** | [tier-1-release-credibility.md](./tier-1-release-credibility.md) | Ship a credible v1: docs, adapters, tests, and sharp-edge fixes |
| **Tier 2** | [tier-2-framework-parity.md](./tier-2-framework-parity.md) | Match core meta-framework expectations (data, context, params, env) |
| **Tier 3** | [tier-3-differentiation.md](./tier-3-differentiation.md) | Optional advanced features; pick selectively vs positioning |

**Positioning (target):** Vite-native, signal-based meta-framework — one declarative route tree, explicit CSR/SSR/SSG/hybrid, bring your own server.

**Out of scope (unless strategy changes):** React Server Components, full Next App Router parity, opinionated hosting lock-in.

## How to use these docs

- Check boxes as work lands; link PRs in the item line when helpful.
- Tier 2 assumes Tier 1 “blockers” are done or explicitly deferred with a note.
- Tier 3 items are **optional** — not required for a strong v1.

## Guides (docs-site source)

| Guide | Path |
|-------|------|
| Tier 3 wave 1 (ISR, loader cache, i18n, assets) | [tier-3-wave-1.md](../router/tier-3-wave-1.md) |
| Image pipeline (`<Image>`, `kiru/image`, Vite `router.images`) | [kiru-image.md](../router/kiru-image.md) |
| Deploy runtimes (Node, Bun, Workers) | [deploy-runtimes.md](../router/deploy-runtimes.md) |

## Related code areas

| Area | Path |
|------|------|
| Router core | `packages/lib/src/router/` |
| Hydration | `packages/lib/src/ssr/routerHydrate.ts` |
| Vite plugin | `packages/vite-plugin-kiru/` |
| E2E | `e2e/csr`, `e2e/ssr`, `e2e/ssg` |
| Scaffolding | `packages/create-kiru/` |
