import { definePageConfig, PageProps, useFileRouter } from "kiru/router"

interface GetPostResponse {
  id: number
  title: string
  body: string
  tags: string[]
  reactions: {
    likes: number
    dislikes: number
  }
  views: number
  userId: number
}

export const config = definePageConfig({
  loader: {
    load: async ({ signal, params }) => {
      const response = await fetch(
        `https://dummyjson.com/posts/${params.postId}`,
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      const post = (await response.json()) as GetPostResponse
      if (post.userId !== Number(params.id)) throw new Error("Post not found")
      return { post }
    },
  },
})

export default function PostPage({
  data,
  loading,
  error,
}: PageProps<typeof config>) {
  const router = useFileRouter()
  if (loading) return <p>Loading...</p>
  if (error) return <p>{String(error.cause)}</p>
  return (
    <div>
      <h1>Post Page - user {router.state.params.id}</h1>
      <p>Post ID: {router.state.params.postId}</p>
      <p>Post Title: {data.post.title}</p>
      <p>Post Body: {data.post.body}</p>
      <p>Post User ID: {data.post.userId}</p>
      <p>Post Tags: {data.post.tags.join(", ")}</p>
      <p>
        Post Reactions: {data.post.reactions.likes} likes,{" "}
        {data.post.reactions.dislikes} dislikes
      </p>
      <div className="flex gap-2 justify-between">
        <button
          onclick={() =>
            router.navigate(`/users/${router.state.params.id}/posts`)
          }
        >
          Back to Posts
        </button>
      </div>
    </div>
  )
}
