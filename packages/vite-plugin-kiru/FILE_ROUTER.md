# File-Based Router for Kiru

A powerful file-based routing system that integrates seamlessly with the Kiru Vite plugin, providing automatic route generation based on your file structure.

## Features

- **File-based routing**: Routes are automatically generated from your file structure
- **Dynamic imports**: Pages are loaded on-demand for optimal performance
- **TypeScript support**: Full type safety for routes, parameters, and queries
- **Hot module replacement**: Routes update automatically when files change
- **Parameterized routes**: Support for dynamic segments like `[id].tsx`
- **Query parameter handling**: Built-in support for URL search parameters

## Setup

### 1. Configure the Vite Plugin

Enable file-based routing in your `vite.config.ts`:

```ts
import { defineConfig } from "vite"
import kiru from "vite-plugin-kiru"

export default defineConfig({
  plugins: [
    kiru({
      fileRouter: {
        enabled: true,
        pagesDir: "pages", // Directory containing page files
        pageExtensions: [".tsx", ".ts", ".jsx", ".js"], // File extensions to consider
      },
    }),
  ],
})
```

### 2. Create Your App Structure

```tsx
// app.tsx
import { FileRouter } from "kiru"

export default function App() {
  return (
    <div>
      <FileRouter />
    </div>
  )
}
```

### 3. Create Page Files

Create your pages in the configured directory (default: `pages/`):

```
pages/
├── index.tsx              # Route: /
├── about/
│   └── index.tsx          # Route: /about
├── users/
│   ├── index.tsx          # Route: /users
│   └── [id]/
│       └── index.tsx      # Route: /users/:id
└── blog/
    ├── index.tsx          # Route: /blog
    └── [slug]/
        └── index.tsx      # Route: /blog/:slug
```

## Usage

### Basic Page Component

```tsx
// pages/index.tsx
export default function Page() {
  return <h1>Hello World!</h1>
}
```

### Using the Router Hook

```tsx
// pages/users/[id].tsx
import { useFileRouter } from "kiru"

export default function UserPage() {
  const router = useFileRouter()

  return (
    <div>
      <h1>User Profile</h1>
      <p>User ID: {router.state.params.id}</p>
      <p>Current path: {router.state.path}</p>
      <p>Query params: {JSON.stringify(router.state.query)}</p>

      <button onclick={() => router.navigate("/")}>Go Home</button>

      <button onclick={() => router.setQuery({ tab: "settings" })}>
        Set Query
      </button>
    </div>
  )
}
```

## API Reference

### `useFileRouter()`

Returns the router state and navigation functions:

```ts
interface RouterState {
  path: string // Current pathname
  params: Record<string, string> // Route parameters
  query: Record<string, string | string[] | undefined> // Query parameters
}

interface RouterContextValue {
  state: RouterState
  navigate: (path: string) => void
  setQuery: (query: Record<string, string | string[] | undefined>) => void
}
```

### `FileRouter`

The main router component that handles file-based routing:

```tsx
<FileRouter />
```

### `Link`

A component for navigation links:

```tsx
import { Link } from "kiru"
;<Link to="/users/123">View User</Link>
```

### `useFileRoute`

A hook to get detailed route information:

```tsx
import { useFileRoute } from "kiru"

export default function MyPage() {
  const { route, params, query } = useFileRoute()

  return (
    <div>
      <p>Route: {route?.path}</p>
      <p>Params: {JSON.stringify(params)}</p>
      <p>Query: {JSON.stringify(query)}</p>
    </div>
  )
}
```

## File Naming Conventions

Only `index` files are considered routes. The directory structure directly maps to the URL structure:

- `pages/index.tsx` → `/` (root route)
- `pages/about/index.tsx` → `/about`
- `pages/users/index.tsx` → `/users`
- `pages/users/[id]/index.tsx` → `/users/:id` (parameterized route)
- `pages/blog/[slug]/index.tsx` → `/blog/:slug`

## TypeScript Support

The router provides full TypeScript support with proper type inference for:

- Route parameters
- Query parameters
- Navigation functions
- Component props

## Examples

### Simple Page

```tsx
// pages/contact.tsx
export default function ContactPage() {
  return (
    <div>
      <h1>Contact Us</h1>
      <p>Get in touch!</p>
    </div>
  )
}
```

### Page with Parameters

```tsx
// pages/posts/[id]/index.tsx
import { useFileRouter } from "kiru"

export default function PostPage() {
  const { state } = useFileRouter()
  const postId = state.params.id

  return (
    <div>
      <h1>Post {postId}</h1>
      <p>This is post with ID: {postId}</p>
    </div>
  )
}
```

### Page with Query Parameters

```tsx
// pages/search/index.tsx
import { useFileRouter } from "kiru"

export default function SearchPage() {
  const { state, setQuery } = useFileRouter()
  const query = state.query.q as string

  return (
    <div>
      <h1>Search Results</h1>
      <p>Searching for: {query}</p>
      <button onclick={() => setQuery({ q: "new search" })}>New Search</button>
    </div>
  )
}
```

This file-based router provides a modern, efficient way to handle routing in Kiru applications with minimal configuration and maximum developer experience.
