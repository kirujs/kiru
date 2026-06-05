import { getRequestEvent, query, type Schema } from "kiru/remote"

export const getServerMessage = query(async () => {
  const { context } = getRequestEvent()
  return `hello from server (${context.user?.name ?? "unknown"})`
})

export interface TodoItem {
  id: string
  text: string
}

const todos: TodoItem[] = [
  { id: "1", text: "buy coffee" },
  { id: "2", text: "write tests" },
]
export const getStreamingTodos = query(async () => {
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

export const getPost = query(async (): Promise<StreamingProduct> => {
  await new Promise((r) => setTimeout(r, 1000))
  return { id: "p1", name: "Streaming Product" }
})

export const getStreamingProduct = query(async (): Promise<StreamingProduct> => {
  console.log("query: get streaming product")
  await new Promise((r) => setTimeout(r, 1000))
  return { id: "p1", name: "Streaming Product" }
})

const streamingReviewsInputSchema: Schema<{ productId: string }> = {
  parse: (input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      !("productId" in input)
    ) {
      throw new Error("Invalid input")
    }
    return input as { productId: string }
  },
}

export const getStreamingReviews = query(
  streamingReviewsInputSchema,
  async (input): Promise<StreamingReview[]> => {
    console.log("query: get streaming reviews")
    await new Promise((r) => setTimeout(r, 1000))
    return [{ id: "r1", text: `Review for ${input.productId}` }]
  }
)
