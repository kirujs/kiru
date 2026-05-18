import { createFormController } from "kiru/remote"
import {
  submitMessage,
  submitRedirect,
  submitValidation,
} from "./forms-demo.actions"

export default function FormsDemo() {
  const messageForm = createFormController(submitMessage)
  const validationForm = createFormController(submitValidation)
  const redirectForm = createFormController(submitRedirect)

  return () => (
    <section data-testid="forms-demo">
      <h1>Form action demo</h1>
      <form
        data-testid="forms-demo-form"
        action={messageForm.action}
        method={messageForm.method}
        onsubmit={messageForm.onsubmit}
      >
        <label>
          Message
          <input
            data-testid="forms-demo-input"
            name="message"
            type="text"
            autocomplete="off"
          />
        </label>
        <button data-testid="forms-demo-submit" type="submit">
          Submit (enhanced)
        </button>
      </form>
      <p data-testid="forms-demo-result">
        {messageForm.isPending.value
          ? "pending…"
          : (messageForm.result.value?.message ?? "")}
      </p>
      <form
        data-testid="forms-validation-form"
        action={validationForm.action}
        method={validationForm.method}
        onsubmit={validationForm.onsubmit}
      >
        <label>
          Validate
          <input
            data-testid="forms-validation-input"
            name="message"
            type="text"
            autocomplete="off"
          />
        </label>
        <button data-testid="forms-validation-submit" type="submit">
          Submit validation
        </button>
      </form>
      <p data-testid="forms-validation-error">
        {validationForm.fieldErrors.value?.message ?? ""}
      </p>
      <form
        data-testid="forms-demo-redirect-form"
        action={redirectForm.action}
        method={redirectForm.method}
        onsubmit={redirectForm.onsubmit}
      >
        <button data-testid="forms-demo-redirect" type="submit">
          Submit redirect
        </button>
      </form>
    </section>
  )
}
