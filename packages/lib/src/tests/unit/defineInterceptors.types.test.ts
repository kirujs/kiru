import { defineInterceptors } from "../../router/defineInterceptors.js"

// @ts-expect-error invalid path when RouteTree is augmented
defineInterceptors({
  bad: {
    path: "/photsos/[id]",
    render: () => null as unknown as JSX.Element,
  },
})

defineInterceptors({
  photo: {
    path: "/photos/[id]",
    load: async ({ params }) => ({ title: `Photo ${params.id}` }),
    render: ({ params, data }) =>
      null as unknown as JSX.Element & { photoId: typeof params.id; title: typeof data.title },
  },
})
