export type ClientRouteOutletMode = "csr" | "ssr-hydrate" | "ssr-stream"

export type ClientRouteOutletProps = {
  manifest: import("./types.js").RouteManifest
  mode?: ClientRouteOutletMode
  /** Pre-built route subtree for SSR/SSG hydration. */
  initialSubtree?: JSX.Element | null
  /** Server stream render: static routed subtree. */
  staticSubtree?: JSX.Element | null
}
