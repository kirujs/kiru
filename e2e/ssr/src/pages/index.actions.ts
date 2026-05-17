import { action } from "kiru/remote"

export const getServerMessage = action(async (ctx, _input: unknown) => {
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
export const getStreamingTodos = action(async () => {
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

export const getStreamingProduct = action(async () => {
  await new Promise((r) => setTimeout(r, 1000))
  return { id: "p1", name: "Streaming Product" } satisfies StreamingProduct
})

export const getStreamingReviews = action(
  async (_ctx, input: { productId: string }) => {
    await new Promise((r) => setTimeout(r, 1000))
    return [
      { id: "r1", text: `Review for ${input.productId}` },
    ] satisfies StreamingReview[]
  }
)