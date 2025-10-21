import { type AnyFormFieldContext, useForm } from "kiru/form"

function FieldInfo({ field }: { field: AnyFormFieldContext }) {
  return (
    <div>
      {field.state.isTouched && field.state.errors.length ? (
        <em>{field.state.errors}</em>
      ) : null}
      {field.state.isValidating ? "Validating..." : null}
    </div>
  )
}

const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
function hasSpecialChars(str: string) {
  return specialCharsRegex.test(str)
}

type Person = {
  name: string
  age: number
  favoriteColors: string[]
}

export default function UseFormExample() {
  const form = useForm({
    initialValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      friends: [] as Person[],
      foo: {
        bar: 123,
      },
    },
    onSubmit: async ({ state }) => {
      console.log("submitting", state)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log("submitted")
    },
  })

  console.log("render UseFormExample")

  return (
    <form
      onsubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) =>
            !value
              ? "A first name is required"
              : value.length < 3
              ? "First name must be at least 3 characters"
              : undefined,
          onChangeAsyncDebounceMs: 500,
          onChangeAsync: async ({ value }) => {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            return value.includes("error") && 'No "error" allowed in first name'
          },
        }}
        children={(field) => {
          console.log("render firstName")
          return (
            <div className="flex">
              <label htmlFor={field.name}>First Name:</label>
              <input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onblur={field.handleBlur}
                oninput={(e) => field.handleChange(e.target.value)}
              />
              <FieldInfo field={field} />
            </div>
          )
        }}
      />
      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) =>
            value.length < 8
              ? "Password must be at least 8 characters"
              : undefined,
        }}
        children={(field) => (
          <div className="flex">
            <label htmlFor={field.name}>Password:</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onblur={field.handleBlur}
              type="password"
              oninput={(e) => field.handleChange(e.target.value)}
            />
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Field
        name="confirmPassword"
        validators={{
          dependentOn: ["password"],
          onChange: ({ value }) =>
            value !== form.getFieldState("password").value
              ? "Passwords do not match"
              : undefined,
        }}
        children={(field) => (
          <div className="flex">
            <label htmlFor={field.name}>Confirm Password:</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onblur={field.handleBlur}
              type="password"
              oninput={(e) => field.handleChange(e.target.value)}
            />
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Field
        name="foo.bar"
        children={(field) => (
          <div className="flex">
            <label htmlFor={field.name}>Foo Bar:</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onblur={field.handleBlur}
              oninput={(e) => field.handleChange(parseInt(e.target.value))}
            />
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Field
        array
        name="friends"
        validators={{
          onChange: ({ value }) => {
            if (value.length < 2) {
              return "Must have at least 2 friends"
            }
          },
          // @ts-expect-error
          ["invalid-field"]: 123,
        }}
        children={(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor={field.name}>Friends:</label>
            <ul className="flex flex-col gap-2">
              {field.state.value.map((_, i) => (
                <li>
                  <form.Field
                    validators={{
                      onChange: ({ value }) => {
                        // if value contains any special characters, return an error
                        if (hasSpecialChars(value)) {
                          return "Name must not contain special characters"
                        }
                      },
                    }}
                    name={`friends.${i}.name`}
                    children={(subField) => {
                      return (
                        <>
                          <div className="flex">
                            <input
                              id={subField.name}
                              name={subField.name}
                              value={subField.state.value}
                              onblur={subField.handleBlur}
                              oninput={(e) =>
                                subField.handleChange(e.target.value)
                              }
                            />
                            <button
                              type="button"
                              onclick={() => field.items.remove(i)}
                            >
                              Remove
                            </button>
                          </div>
                          <FieldInfo field={subField} />
                        </>
                      )
                    }}
                  />
                  <form.Field
                    array
                    name={`friends.${i}.favoriteColors`}
                    children={(subField) => (
                      <div className="flex">
                        <label htmlFor={subField.name}>Favorite Colors:</label>
                        <ul>
                          {subField.state.value.map((_, j) => (
                            <li className="flex gap-2">
                              <form.Field
                                name={`friends.${i}.favoriteColors.${j}`}
                                children={(colorField) => (
                                  <input
                                    id={colorField.name}
                                    name={colorField.name}
                                    value={colorField.state.value}
                                    onblur={colorField.handleBlur}
                                    type="color"
                                    oninput={(e) =>
                                      colorField.handleChange(e.target.value)
                                    }
                                  />
                                )}
                              />
                              <button
                                type="button"
                                onclick={() => subField.items.remove(j)}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onclick={() => subField.items.push("")}
                        >
                          add color
                        </button>
                      </div>
                    )}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onclick={() =>
                field.items.push({ name: "", age: 42, favoriteColors: [] })
              }
            >
              Add Friend
            </button>
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => {
          console.log("render submit buttons")
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
