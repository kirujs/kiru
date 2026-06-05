import type { CreatedRoute } from "kiru/router"

/** Leaf route paths for type-safe `Link` and `defineInterceptors`. */
declare module "kiru/router" {
  interface RouteTree {
    routes: [
      CreatedRoute<"/">,
      CreatedRoute<"/about">,
      CreatedRoute<"/users/[id]">,
      CreatedRoute<"/guarded">,
      CreatedRoute<"/forbidden">,
      CreatedRoute<"/hash-section">,
      CreatedRoute<"/counter">,
      CreatedRoute<"/effects">,
      CreatedRoute<"/keyed-list">,
      CreatedRoute<"/signals">,
      CreatedRoute<"/style">,
      CreatedRoute<"/todos">,
      CreatedRoute<"/navigation">,
      CreatedRoute<"/csr-break">,
      CreatedRoute<"/csr-break-loader">,
      CreatedRoute<"/view-transitions">,
      CreatedRoute<"/slow-target">,
      CreatedRoute<"/loaders/client">,
      CreatedRoute<"/loaders/universal">,
      CreatedRoute<"/photos">,
      CreatedRoute<"/photos/[id]">,
    ]
  }
}
