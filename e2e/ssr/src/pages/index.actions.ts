import { action } from "kiru/remote"

export const getServerMessage = action.get(async (ctx) => {
  return `hello from server (${ctx.user?.name ?? "unknown"})`
})

export interface TodoItem {
  id: string
  text: string
}

const todos: TodoItem[] = [
  { id: "1", text: "buy coffee" },
  { id: "2", text: "write tests" },
]
export const getStreamingTodos = action.get(async () => {
  await new Promise((r) => setTimeout(r, 4000))
  return todos
})

export interface StreamingProduct {
  id: string
  name: string
}

export interface StreamingReview {
  id: string
  text: string
}

export const getPost = action.get<StreamingProduct>(async () => {
  await new Promise((r) => setTimeout(r, 3000))
  return { id: "p1", name: "Streaming Product" }
})

export const getStreamingProduct = action.get<StreamingProduct>(async () => {
  await new Promise((r) => setTimeout(r, 3000))
  return { id: "p1", name: "Streaming Product" }
})

export const getStreamingReviews = action.post<{ productId: string }, StreamingReview[]>(
  {
    parse: (input): input is { productId: string } =>
      typeof input === "object" &&
      input !== null &&
      "productId" in input &&
      typeof input.productId === "string",
  },
  async (_ctx, input: { productId: string }) => {
    await new Promise((r) => setTimeout(r, 3000))
    return [
      { id: "r1", text: `Review for ${input.productId}` },
    ]
  }
)
