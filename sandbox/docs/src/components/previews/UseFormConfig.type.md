```ts
type UseFormConfig<T> = {
  initialValues: T
  onSubmit: (context: FormContext<T>) => void | Promise<void>
  validate?: (values: T) => Record<string, string> | undefined
}
```
