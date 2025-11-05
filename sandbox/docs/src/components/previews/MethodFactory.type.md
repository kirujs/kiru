```ts
type MethodFactory<T> = (
  setState: (setter: T | ((prev: T) => T)) => void,
  getState: () => T
) => Record<string, (...args: any[]) => void>
```
