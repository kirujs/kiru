import { computed } from "kiru"
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

const PostsPage: Kiru.FC<PageProps<typeof config>> = () => {
  const router = useFileRouter()
  const id = computed(() => router.state.params.value["id"])

  return ({ data, loading, error }) => {
    if (loading) return <p>Loading...</p>
    if (error) return <p>{String(error.cause)}</p>

    return (
      <>
        <div>PostsPage</div>
        <ul>
          {data.posts.map((post) => (
            <li key={post.id}>
              <Link to={`/users/${id}/posts/${post.id}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-between">
          <button onclick={() => router.navigate(`/users/${id}`)}>
            Back to User
          </button>
        </div>
      </>
    )
  }
}

export default PostsPage
