import { signal } from "kiru"
import { Checkbox } from "@kirujs/headless-ui"

export const CheckboxDemo = () => {
  const checked = signal(false)
  const indeterminate = signal<boolean | "indeterminate">("indeterminate")

  return () => (
    <div style="display:flex; flex-direction:column; gap:1rem">
      <div>
        <Checkbox.Root checked={checked} className="checkbox">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">
          Controlled checkbox (checked: {String(checked.value)})
        </label>
      </div>

      <div>
        <Checkbox.Root defaultChecked className="checkbox">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">
          Uncontrolled checkbox (default checked)
        </label>
      </div>

      <div>
        <Checkbox.Root checked={indeterminate} className="checkbox">
          <Checkbox.Indicator className="checkbox-indicator">
            {indeterminate.value === "indeterminate" ? "-" : "✓"}
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">
          Indeterminate checkbox (state: {() => String(indeterminate.value)})
        </label>
      </div>

      <div>
        <Checkbox.Root disabled className="checkbox">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">Disabled checkbox</label>
      </div>
    </div>
  )
}
