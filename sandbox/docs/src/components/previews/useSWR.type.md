```ts
<T, Key>(
  key: Key,
  fetcher: (key: Key) => Promise<T>,
  options?: SWROptions
): SWRResponse<T>
```
