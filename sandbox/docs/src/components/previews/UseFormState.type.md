```ts
type UseFormState<T> = {
  Field: Kaioiken.FC<FormFieldProps<T>>
  Subscribe: Kaioiken.FC<FormSubscribeProps<T>>
  handleSubmit: () => void
  reset: () => void
  getFieldState: (name: string) => FormFieldState<T>
}
```
