```ts
type Context<T> = {
  // Component that acts as a 'provider' for the context, initialized with it's own value.
  // Multiple can exist for the same context within an application.
  Provider: ({ value }: { value: T }) => JSX.Element
  // ...
}
```
