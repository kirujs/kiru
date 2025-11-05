```ts
type Store<T, U extends MethodFactory<T>> = {
  (): { value: T } & ReturnType<U>
  <R>(selector: (value: T) => R): { value: R } & ReturnType<U>
  getState: () => T
  setState: (setter: T | ((prev: T) => T)) => void
  methods: ReturnType<U>
  subscribe: (fn: (value: T) => void) => () => void
}
```
