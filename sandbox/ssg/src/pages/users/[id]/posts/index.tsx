import { definePageConfig, Link, PageProps, useFileRouter } from "kiru/router"

interface Post {
  id: number
  title: string
  body: string
  userId: number
  tags: string[]
  reactions: {
    likes: number
    dislikes: number
  }
}

interface FetchPostsResponse {
  posts: Post[]
}
export const config = definePageConfig({
  loader: {
    load: async ({ signal, params }) => {
      const response = await fetch(
        `https://dummyjson.com/users/${params.id}/posts`,
        { signal }
      )
      if (!response.ok) throw new Error(response.statusText)
      const { posts } = (await response.json()) as FetchPostsResponse
      return { posts }
    },
  },
})
export default function PostsPage({
  data,
  loading,
  error,
}: PageProps<typeof config>) {
  const router = useFileRouter()
  if (loading) return <p>Loading...</p>
  if (error) return <p>{String(error.cause)}</p>

  return (
    <>
      <div>PostsPage</div>
      <ul>
        {data.posts.map((post) => (
          <li key={post.id}>
            <Link to={`/users/${router.state.params.id}/posts/${post.id}`}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 justify-between">
        <button
          onclick={() => router.navigate(`/users/${router.state.params.id}`)}
        >
          Back to User
        </button>
      </div>
    </>
  )
}
