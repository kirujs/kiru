import {
  defineRouteInterceptors,
  routeInterceptor,
} from "../../router/defineRouteInterceptors.js"
import { createRoute } from "../../router/createRouteTree.js"

const photosRoute = createRoute("/photos", async () => ({ default: () => null }))
const photoDetailRoute = createRoute(
  "/photos/[id]",
  async () => ({ default: () => null })
)

declare module "kiru/router" {
  interface RouteTree {
    routes: [typeof photosRoute, typeof photoDetailRoute]
  }
}

defineRouteInterceptors({
  photo: routeInterceptor("/photos/[id]", {
    load: async ({ params }) => {
      params.id satisfies string
      return { title: `Photo ${params.id}` }
    },
    render: ({ params, context, data, error, reload }) => {
      params.id satisfies string
      void context
      void reload
      if (error === null) {
        data.title satisfies string
      } else {
        error.message satisfies string
      }
      return null as unknown as JSX.Element
    },
  }),
})

// @ts-expect-error path must be a registered route
defineRouteInterceptors({
  bad: routeInterceptor("/photsos/[id]", {
    render: () => null as unknown as JSX.Element,
  }),
})
