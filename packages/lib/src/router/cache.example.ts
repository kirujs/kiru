/**
 * Example usage of the router cache system
 *
 * This file demonstrates how to use caching with page loaders
 */

import type { PageConfig } from "./types.js"

// Example 1: Basic memory caching
export const userPageConfig: PageConfig<{ name: string; id: number }> = {
  loader: {
    mode: "client",
    cache: {
      type: "memory",
      ttl: 1000 * 60 * 5, // 5 minutes
    },
    load: async ({ params }) => {
      // This will be cached in memory for 5 minutes
      const response = await fetch(`/api/users/${params.id}`)
      return response.json()
    },
  },
}

// Example 2: localStorage caching (persists across browser sessions)
export const settingsPageConfig: PageConfig<{ settings: any }> = {
  loader: {
    mode: "client",
    cache: {
      type: "localStorage",
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    },
    load: async () => {
      // This will be cached in localStorage for 24 hours
      // Data persists even after browser restart
      const response = await fetch("/api/user/settings")
      return response.json()
    },
  },
}

// Example 3: sessionStorage caching (persists only during browser session)
export const tempDataPageConfig: PageConfig<{ data: any }> = {
  loader: {
    mode: "client",
    cache: {
      type: "sessionStorage",
      ttl: 1000 * 60 * 30, // 30 minutes
    },
    load: async () => {
      // This will be cached in sessionStorage for 30 minutes
      // Data is cleared when browser tab is closed
      const response = await fetch("/api/temp-data")
      return response.json()
    },
  },
}

// Example 4: Caching with transitions
export const postsPageConfig: PageConfig<{ posts: any[] }> = {
  loader: {
    mode: "client",
    transition: true, // Enable transitions when loading
    cache: {
      type: "memory",
      ttl: 1000 * 60 * 2, // 2 minutes
    },
    load: async ({ query }) => {
      const page = query.page || "1"
      const response = await fetch(`/api/posts?page=${page}`)
      return response.json()
    },
  },
}

// Example 3: Using the invalidate function
// In your component or event handler:
/*
import { useFileRouter } from "./context.js"

function UserProfile() {
  const router = useFileRouter()
  
  const handleUserUpdate = async (userId: string) => {
    // Update user data
    await updateUser(userId, newData)
    
    // Invalidate specific user cache
    router.invalidate(`/users/${userId}`)
    
    // Or invalidate all user pages
    router.invalidate("/users/[id]")
    
    // Or invalidate multiple patterns
    router.invalidate("/users/[id]", "/posts", "/dashboard")
  }
  
  return <div>...</div>
}
*/
// Example 5: Pattern matching examples
/*
The cache system supports flexible pattern matching for invalidation:

Exact path matching:
- router.invalidate("/users/123") → only invalidates /users/123

Dynamic segment matching:
- router.invalidate("/users/[id]") → invalidates /users/123, /users/456, etc.
- router.invalidate("/posts/[slug]") → invalidates /posts/hello-world, /posts/my-post, etc.

Multi-segment patterns:
- router.invalidate("/users/[id]/posts/[postId]") → invalidates /users/123/posts/456, etc.

Catchall patterns:
- router.invalidate("/api/[...path]") → invalidates /api/users, /api/users/123, /api/posts/456/comments, etc.

Mixed patterns:
- router.invalidate("/users/[id]", "/posts", "/api/[...path]") → invalidates multiple patterns at once
*/

// Example 6: Cache behavior demonstration
/*
Navigation flow with caching:

1. First visit to /users/123:
   - No cache → shows loading: true
   - Fetches data → caches result → shows data, loading: false

2. Navigate away and back to /users/123 (within TTL):
   - Cache hit → shows data immediately, loading: false (no loading state!)
   - No network request needed

3. After TTL expires or cache invalidated:
   - Cache miss → shows loading: true again
   - Fetches fresh data → updates cache → shows new data, loading: false

This provides instant navigation for cached routes while maintaining data freshness.
The key improvement is that cached data is checked BEFORE setting loading states,
providing a seamless user experience for frequently visited pages.
*/

// Example 7: Auto-refresh current page on invalidation
/*
Automatic page refresh behavior:

1. User is on /users/123 with cached data displayed
2. User performs an action that updates the user data
3. Code calls router.invalidate("/users/123") or router.invalidate("/users/[id]")
4. Cache is cleared AND current page automatically refreshes to show updated data

Example implementation:

function UserProfile({ data, loading, error }) {
  const router = useFileRouter()
  
  const handleUpdateUser = async (userData) => {
    try {
      // Update user on server
      await updateUserAPI(userData)
      
      // Invalidate cache - this will automatically refresh the current page
      // since we're on /users/[id] which matches the pattern
      router.invalidate("/users/[id]")
      
      // No need to manually reload - the page refreshes automatically!
    } catch (error) {
      console.error("Failed to update user:", error)
    }
  }
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => handleUpdateUser({ name: "New Name" })}>
        Update User
      </button>
    </div>
  )
}

This provides a seamless experience where users see updated data immediately
after performing actions that modify the underlying data.
*/

// Storage Type Comparison:
/*
MEMORY CACHE:
- Fastest performance
- Cleared when page refreshes or navigates away
- Best for: Frequently accessed data during single session

LOCALSTORAGE CACHE:
- Persists across browser sessions and page refreshes
- Survives browser restart
- Has storage quota limits (~5-10MB)
- Best for: User preferences, settings, long-term data

SESSIONSTORAGE CACHE:
- Persists during browser session (until tab is closed)
- Cleared when tab is closed
- Has storage quota limits (~5-10MB)
- Best for: Temporary data that should persist during session

All storage types:
- Support TTL expiration
- Handle storage errors gracefully (fallback to memory)
- Support pattern-based invalidation
- Automatically refresh current page on invalidation
*/
// Example 8: Optimized cache initialization behavior
/*
The router now optimizes initialization by checking cache during preparePreloadConfig:

SCENARIO 1: Fresh page load with no cache
1. User visits /users/123 for the first time
2. preparePreloadConfig() → no cache found → pageProps = { loading: true }
3. Router initializes → calls loadRouteData() → fetches data → caches result → shows data

SCENARIO 2: Page refresh with valid cache (OPTIMIZED!)
1. User refreshes /users/123 (data was cached from previous visit)
2. preparePreloadConfig() → cache hit! → pageProps = { data: cachedData, loading: false }
3. Router initializes → skips loadRouteData() → shows data immediately
4. NO network request needed, NO loading state shown

SCENARIO 3: Page refresh with expired cache
1. User refreshes /users/123 (cache has expired)
2. preparePreloadConfig() → cache expired → pageProps = { loading: true }
3. Router initializes → calls loadRouteData() → fetches fresh data → updates cache → shows data

Key optimization: Cache is checked BEFORE router initialization, eliminating
unnecessary loadRouteData calls and providing truly instant page loads.
*/
