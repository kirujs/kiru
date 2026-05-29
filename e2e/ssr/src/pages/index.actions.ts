import { action, type Schema } from "kiru/remote"

export const getServerMessage = action(async ({ context }) => {
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
export const getStreamingTodos = action(async () => {
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

export const getPost = action(async (): Promise<StreamingProduct> => {
  return { id: "p1", name: "Streaming Product" }
})

export const getStreamingProduct = action(
  async (): Promise<StreamingProduct> => {
    console.log("action: get streaming product")
    return { id: "p1", name: "Streaming Product" }
  }
)

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

export const getStreamingReviews = action({
  validation: { body: streamingReviewsInputSchema },
  handler: async ({ request }): Promise<StreamingReview[]> => {
    console.log("action: get streaming reviews")
    return [{ id: "r1", text: `Review for ${request.body.productId}` }]
  },
})
