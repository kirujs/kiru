```ts
;(config: {
  loader?: {
    load: (context: {
      signal: AbortSignal
      params: Record<string, string>
      query: Record<string, string>
      path: string
    }) => Promise<any>
    transition?: boolean
  }
}) => PageConfig
```
