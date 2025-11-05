```ts
type UseAsyncState<T> = (
  | /** loading*/ {
      data: null
      loading: true
      error: null
    }
  | /** loaded */ {
      data: T
      loading: false
      error: null
    }
  | /** error */ {
      data: null
      loading: false
      error: UseAsyncError
    }
) & {
  invalidate: () => void
}
```
