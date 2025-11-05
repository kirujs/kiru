```tsx
import { useForm } from "kiru/form"

const App = () => {
  const form = useForm({
    initialValues: {
      username: "",
    },
    onSubmit: ({ state }) => {
      console.log("form submitted", state)
    },
  })

  return (
    <form
      onsubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div>
        <form.Field
          name="username"
          validators={{
            onChange: ({ value }) => !value && "Username is required",
          }}
          children={(field) => (
            <div>
              <label htmlFor={field.name}>Username</label>
              <input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onblur={field.handleBlur}
                onchange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.errors.length && (
                <span>{field.state.errors.join(", ")}</span>
              )}
            </div>
          )}
        />
      </div>
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => {
          return (
            <>
              <button
                className={canSubmit ? "bg-green-500" : "bg-red-500"}
                type="submit"
                disabled={!canSubmit}
              >
                {isSubmitting ? "..." : "Submit"}
              </button>
              <button type="reset" onclick={() => form.reset()}>
                Reset
              </button>
            </>
          )
        }}
      />
    </form>
  )
}
```
