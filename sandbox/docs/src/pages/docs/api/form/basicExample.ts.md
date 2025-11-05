```tsx
import { useForm } from "kiru/form"

type ContactFormData = {
  name: string
  email: string
}

function ContactForm() {
  const form = useForm<ContactFormData>({
    initialValues: {
      name: "",
      email: "",
    },
    onSubmit: ({ state }) => {
      console.log("Form submitted:", state)
    },
  })

  return (
    <form
      onsubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="name"
        children={(field) => (
          <div>
            <label>Name</label>
            <input
              value={field.state.value}
              onchange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      />

      <form.Field
        name="email"
        children={(field) => (
          <div>
            <label>Email</label>
            <input
              type="email"
              value={field.state.value}
              onchange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      />

      <button type="submit">Submit</button>
    </form>
  )
}
```
