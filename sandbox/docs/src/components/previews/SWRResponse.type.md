```ts
type SWRResponse<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  mutate: (fn: () => Promise<T>) => void
  isMutating: Signal<boolean>
  isValidating: Signal<boolean>
}
```
