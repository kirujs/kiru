import { computed, signal } from "kiru"
import { Checkbox, CheckboxGroup } from "@kirujs/headless-ui"

export const CheckboxDemo = () => {
  const checked = signal(false)
  const checkedText = computed(() => String(checked.value))
  const indeterminate = signal<boolean | "indeterminate">("indeterminate")
  const indeterminateText = computed(() => String(indeterminate.value))
  const indeterminateIndicator = computed(() =>
    indeterminate.value === "indeterminate" ? "-" : "✓"
  )

  const fruits = ["fuji-apple", "gala-apple", "granny-smith-apple"]
  const groupValue = signal<string[]>(["fuji-apple"])
  const groupValueText = computed(() => JSON.stringify(groupValue.value))
  const groupValueIndicator = computed(() =>
    groupValue.value.length === fruits.length ? "✓" : "-"
  )

  return () => (
    <div style="display:flex; flex-direction:column; gap:1rem">
      <div>
        <Checkbox.Root checked={checked} className="checkbox">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">
          Controlled checkbox (checked: {checkedText})
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
            {indeterminateIndicator}
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem">
          Indeterminate checkbox (state: {indeterminateText})
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

      <div style="display:flex; flex-direction:column; gap:0.5rem">
        <div style="opacity:0.85">CheckboxGroup</div>

        <CheckboxGroup.Root value={groupValue} allValues={fruits} name="fruit">
          <div style="display:flex; align-items:center; gap:0.5rem">
            <Checkbox.Root parent className="checkbox">
              <Checkbox.Indicator className="checkbox-indicator">
                {groupValueIndicator}
              </Checkbox.Indicator>
            </Checkbox.Root>
            <label>Select all</label>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem; padding-left:1.5rem">
            <div style="display:flex; align-items:center; gap:0.5rem">
              <Checkbox.Root value="fuji-apple" className="checkbox">
                <Checkbox.Indicator className="checkbox-indicator">
                  ✓
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label>Fuji</label>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem">
              <Checkbox.Root value="gala-apple" className="checkbox">
                <Checkbox.Indicator className="checkbox-indicator">
                  ✓
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label>Gala</label>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem">
              <Checkbox.Root value="granny-smith-apple" className="checkbox">
                <Checkbox.Indicator className="checkbox-indicator">
                  ✓
                </Checkbox.Indicator>
              </Checkbox.Root>
              <label>Granny Smith</label>
            </div>
          </div>
        </CheckboxGroup.Root>

        <div style="opacity:0.75; font-size:0.9em">
          Selected: {groupValueText}
        </div>
      </div>
    </div>
  )
}
