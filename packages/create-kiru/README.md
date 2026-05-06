# create-kiru

CLI tool to quickly get started with a new Kiru project.

Templates scaffold modern Kiru app modes (CSR, SSG, SSR) and can consume declarative route trees from `kiru/router`.

**Router / SSG / SSR conventions**

- Use **`Link`** from `kiru/router` in layouts (works for CSR, SSR, and SSG; static prerender omits SPA `click` handlers so links stay crawlable).
- **SEO**: add a `meta` object on scopes and routes (`title`, `description`, `openGraph`, `twitter`, `canonical`, …). Titles/descriptions support `{param}` placeholders for dynamic segments.
- **SSG**: enable `router.ssg: true` in `vite-plugin-kiru` and a single `vite build` prerenders pages into your built `index.html` shell—no separate prerender script. Use template tokens in source `index.html`: `{{kiru_head}}` in `<head>` and `{{kiru_body}}` where app markup should be injected.
- **SSR**: use `createRenderer` from `kiru/router` and assemble the response with `fillRouteHtmlTemplate(templateHtml, { body, headHtml: document.headHtml })`, using the same `index.html` shape as SSG when possible. Hydrate with `bootstrapSsrClient` from `kiru/ssr/router` (not `RouterView` alone—non-streaming SSR does not inject deferred resource payloads).

#### interactive setup:

```
npx create-kiru@latest
# or
yarn create kiru
# or
pnpm create kiru
# or
bunx create-kiru
```
